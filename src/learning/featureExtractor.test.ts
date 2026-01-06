/**
 * Feature Extractor Property Tests
 * 
 * Property 26: Trade Type Classification
 * Property 27: DTE Bucketing
 * Property 28: AI Score Bucketing
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import * as fc from 'fast-check';
import {
  classifyTradeType,
  bucketDTE,
  bucketAIScore,
  bucketIVRank,
  bucketTrendStrength,
  bucketVolume,
  extractFeatures,
  groupByDTEBucket,
  groupByTradeType,
  createFeatureKey,
  createDTEIsolatedKey,
} from './featureExtractor';
import { LedgerEntry } from '../types/ledger';
import { EnrichedSignal } from '../types/signal';
import { DecisionBreakdown } from '../types/decision';

// Helper to create a valid EnrichedSignal for testing
function createTestSignal(overrides: Partial<EnrichedSignal> = {}): EnrichedSignal {
  return {
    signal: {
      type: 'LONG',
      timeframe: '15',
      quality: 'HIGH',
      ai_score: 7.5,
      timestamp: Date.now(),
      bar_time: new Date().toISOString(),
    },
    instrument: {
      exchange: 'NYSE',
      ticker: 'SPY',
      current_price: 450.00,
    },
    entry: {
      price: 450.00,
      stop_loss: 445.00,
      target_1: 455.00,
      target_2: 460.00,
      stop_reason: 'ATR',
    },
    risk: {
      amount: 500,
      rr_ratio_t1: 2.0,
      rr_ratio_t2: 4.0,
      stop_distance_pct: 1.1,
      recommended_shares: 100,
      recommended_contracts: 5,
      position_multiplier: 1.0,
      account_risk_pct: 1.0,
      max_loss_dollars: 500,
    },
    market_context: {
      vwap: 449.50,
      pmh: 452.00,
      pml: 447.00,
      day_open: 448.00,
      day_change_pct: 0.5,
      price_vs_vwap_pct: 0.1,
      distance_to_pmh_pct: 0.4,
      distance_to_pml_pct: 0.7,
      atr: 5.0,
      volume_vs_avg: 1.2,
      candle_direction: 'GREEN',
      candle_size_atr: 0.8,
    },
    trend: {
      ema_8: 449.00,
      ema_21: 448.00,
      ema_50: 446.00,
      alignment: 'BULLISH',
      strength: 75,
      rsi: 55,
      macd_signal: 'BULLISH',
    },
    mtf_context: {
      '4h_bias': 'LONG',
      '4h_rsi': 60,
      '1h_bias': 'LONG',
    },
    score_breakdown: {
      strat: 2,
      trend: 1.5,
      gamma: 1,
      vwap: 1,
      mtf: 1.5,
      golf: 0.5,
    },
    components: ['STRAT', 'TREND', 'MTF'],
    time_context: {
      market_session: 'MIDDAY',
      day_of_week: 'TUESDAY',
    },
    ...overrides,
  } as EnrichedSignal;
}

// Helper to create a valid DecisionBreakdown
function createTestBreakdown(): DecisionBreakdown {
  return {
    confluence_multiplier: 1.5,
    quality_multiplier: 1.1,
    htf_alignment_multiplier: 1.3,
    rr_multiplier: 1.0,
    volume_multiplier: 1.0,
    trend_multiplier: 1.0,
    session_multiplier: 1.0,
    day_multiplier: 1.1,
    phase_confidence_boost: 0,
    phase_position_boost: 0,
    final_multiplier: 1.5,
  };
}

// Helper to create a test ledger entry
function createTestEntry(
  timeframe: string,
  dte: number,
  aiScore: number
): LedgerEntry {
  return {
    id: 'test-' + Math.random().toString(36).substr(2, 9),
    created_at: Date.now(),
    engine_version: '1.0.0',
    signal: createTestSignal({
      signal: {
        type: 'LONG',
        timeframe,
        quality: 'HIGH',
        ai_score: aiScore,
        timestamp: Date.now(),
        bar_time: new Date().toISOString(),
      },
    }),
    decision: 'EXECUTE',
    decision_reason: 'Test',
    decision_breakdown: createTestBreakdown(),
    confluence_score: 75,
    regime: {
      volatility: 'NORMAL',
      trend: 'BULL',
      liquidity: 'NORMAL',
      iv_rank: 45,
    },
    execution: {
      option_type: 'CALL',
      strike: 450,
      expiry: '2024-01-19',
      dte,
      contracts: 5,
      entry_price: 3.50,
      entry_iv: 0.25,
      entry_delta: 0.55,
      entry_theta: -0.05,
      entry_gamma: 0.08,
      entry_vega: 0.15,
      spread_cost: 0.05,
      slippage: 0.02,
      fill_quality: 'FULL',
      filled_contracts: 5,
      commission: 6.50,
      underlying_at_entry: 450.00,
      risk_amount: 500,
    },
  };
}

describe('Feature Extractor', () => {
  describe('Property 26: Trade Type Classification', () => {
    /**
     * Property 26: Trade Type Classification
     * *For any* timeframe, trade_type SHALL be: <=5M → SCALP, <=60M → DAY, <=240M → SWING, >240M → LEAP.
     * **Validates: Requirements 7.1**
     */
    
    it('should classify timeframes <= 5 as SCALP', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (tf) => {
            const result = classifyTradeType(tf.toString());
            expect(result).toBe('SCALP');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify timeframes 6-60 as DAY', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 60 }),
          (tf) => {
            const result = classifyTradeType(tf.toString());
            expect(result).toBe('DAY');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify timeframes 61-240 as SWING', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 61, max: 240 }),
          (tf) => {
            const result = classifyTradeType(tf.toString());
            expect(result).toBe('SWING');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify timeframes > 240 as LEAP', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 241, max: 10000 }),
          (tf) => {
            const result = classifyTradeType(tf.toString());
            expect(result).toBe('LEAP');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle standard timeframe strings correctly', () => {
      expect(classifyTradeType('3')).toBe('SCALP');
      expect(classifyTradeType('5')).toBe('SCALP');
      expect(classifyTradeType('15')).toBe('DAY');
      expect(classifyTradeType('30')).toBe('DAY');
      expect(classifyTradeType('60')).toBe('DAY');
      expect(classifyTradeType('240')).toBe('SWING');
    });

    it('should handle alternative timeframe formats', () => {
      expect(classifyTradeType('1H')).toBe('DAY');
      expect(classifyTradeType('60M')).toBe('DAY');
      expect(classifyTradeType('4H')).toBe('SWING');
      expect(classifyTradeType('240M')).toBe('SWING');
      expect(classifyTradeType('1D')).toBe('LEAP');
      expect(classifyTradeType('D')).toBe('LEAP');
    });
  });

  describe('Property 27: DTE Bucketing', () => {
    /**
     * Property 27: DTE Bucketing
     * *For any* DTE value, bucket SHALL be: 0 → 0DTE, 1-7 → WEEKLY, 8-45 → MONTHLY, >45 → LEAP.
     * **Validates: Requirements 7.2**
     */
    
    it('should bucket DTE 0 as 0DTE', () => {
      expect(bucketDTE(0)).toBe('0DTE');
    });

    it('should bucket DTE 1-7 as WEEKLY', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 7 }),
          (dte) => {
            const result = bucketDTE(dte);
            expect(result).toBe('WEEKLY');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should bucket DTE 8-45 as MONTHLY', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 45 }),
          (dte) => {
            const result = bucketDTE(dte);
            expect(result).toBe('MONTHLY');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should bucket DTE > 45 as LEAP', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 46, max: 1000 }),
          (dte) => {
            const result = bucketDTE(dte);
            expect(result).toBe('LEAP');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly bucket boundary values', () => {
      expect(bucketDTE(0)).toBe('0DTE');
      expect(bucketDTE(1)).toBe('WEEKLY');
      expect(bucketDTE(7)).toBe('WEEKLY');
      expect(bucketDTE(8)).toBe('MONTHLY');
      expect(bucketDTE(45)).toBe('MONTHLY');
      expect(bucketDTE(46)).toBe('LEAP');
    });
  });

  describe('Property 28: AI Score Bucketing', () => {
    /**
     * Property 28: AI Score Bucketing
     * *For any* AI score, bucket SHALL be: >=9 → EXTREME_PLUS, >=8 → EXTREME, >=7 → HIGH, >=6 → MEDIUM, <6 → LOW.
     * **Validates: Requirements 7.3**
     */
    
    it('should bucket AI scores >= 9 as EXTREME_PLUS', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(9), max: Math.fround(10.5), noNaN: true }),
          (score) => {
            const result = bucketAIScore(score);
            expect(result).toBe('EXTREME_PLUS');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should bucket AI scores 8-8.99 as EXTREME', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(8), max: Math.fround(8.99), noNaN: true }),
          (score) => {
            const result = bucketAIScore(score);
            expect(result).toBe('EXTREME');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should bucket AI scores 7-7.99 as HIGH', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(7), max: Math.fround(7.99), noNaN: true }),
          (score) => {
            const result = bucketAIScore(score);
            expect(result).toBe('HIGH');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should bucket AI scores 6-6.99 as MEDIUM', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(6), max: Math.fround(6.99), noNaN: true }),
          (score) => {
            const result = bucketAIScore(score);
            expect(result).toBe('MEDIUM');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should bucket AI scores < 6 as LOW', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(5.99), noNaN: true }),
          (score) => {
            const result = bucketAIScore(score);
            expect(result).toBe('LOW');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly bucket boundary values', () => {
      expect(bucketAIScore(10.5)).toBe('EXTREME_PLUS');
      expect(bucketAIScore(9.0)).toBe('EXTREME_PLUS');
      expect(bucketAIScore(8.99)).toBe('EXTREME');
      expect(bucketAIScore(8.0)).toBe('EXTREME');
      expect(bucketAIScore(7.99)).toBe('HIGH');
      expect(bucketAIScore(7.0)).toBe('HIGH');
      expect(bucketAIScore(6.99)).toBe('MEDIUM');
      expect(bucketAIScore(6.0)).toBe('MEDIUM');
      expect(bucketAIScore(5.99)).toBe('LOW');
      expect(bucketAIScore(0)).toBe('LOW');
    });
  });

  describe('IV Rank Bucketing', () => {
    it('should bucket IV rank correctly', () => {
      expect(bucketIVRank(10)).toBe('VERY_LOW');
      expect(bucketIVRank(30)).toBe('LOW');
      expect(bucketIVRank(50)).toBe('NORMAL');
      expect(bucketIVRank(70)).toBe('HIGH');
      expect(bucketIVRank(90)).toBe('VERY_HIGH');
    });

    it('should bucket IV rank boundaries correctly', () => {
      expect(bucketIVRank(0)).toBe('VERY_LOW');
      expect(bucketIVRank(19)).toBe('VERY_LOW');
      expect(bucketIVRank(20)).toBe('LOW');
      expect(bucketIVRank(39)).toBe('LOW');
      expect(bucketIVRank(40)).toBe('NORMAL');
      expect(bucketIVRank(59)).toBe('NORMAL');
      expect(bucketIVRank(60)).toBe('HIGH');
      expect(bucketIVRank(79)).toBe('HIGH');
      expect(bucketIVRank(80)).toBe('VERY_HIGH');
      expect(bucketIVRank(100)).toBe('VERY_HIGH');
    });
  });

  describe('Trend Strength Bucketing', () => {
    it('should bucket trend strength correctly', () => {
      expect(bucketTrendStrength(20)).toBe('WEAK');
      expect(bucketTrendStrength(50)).toBe('MODERATE');
      expect(bucketTrendStrength(70)).toBe('STRONG');
      expect(bucketTrendStrength(90)).toBe('VERY_STRONG');
    });

    it('should bucket trend strength boundaries correctly', () => {
      expect(bucketTrendStrength(0)).toBe('WEAK');
      expect(bucketTrendStrength(39)).toBe('WEAK');
      expect(bucketTrendStrength(40)).toBe('MODERATE');
      expect(bucketTrendStrength(59)).toBe('MODERATE');
      expect(bucketTrendStrength(60)).toBe('STRONG');
      expect(bucketTrendStrength(79)).toBe('STRONG');
      expect(bucketTrendStrength(80)).toBe('VERY_STRONG');
      expect(bucketTrendStrength(100)).toBe('VERY_STRONG');
    });
  });

  describe('Volume Bucketing', () => {
    it('should bucket volume ratio correctly', () => {
      expect(bucketVolume(0.5)).toBe('LOW');
      expect(bucketVolume(1.0)).toBe('NORMAL');
      expect(bucketVolume(1.5)).toBe('HIGH');
      expect(bucketVolume(2.5)).toBe('VERY_HIGH');
    });

    it('should bucket volume boundaries correctly', () => {
      expect(bucketVolume(0)).toBe('LOW');
      expect(bucketVolume(0.69)).toBe('LOW');
      expect(bucketVolume(0.7)).toBe('NORMAL');
      expect(bucketVolume(1.29)).toBe('NORMAL');
      expect(bucketVolume(1.3)).toBe('HIGH');
      expect(bucketVolume(1.99)).toBe('HIGH');
      expect(bucketVolume(2.0)).toBe('VERY_HIGH');
      expect(bucketVolume(10)).toBe('VERY_HIGH');
    });
  });

  describe('Feature Extraction', () => {
    it('should extract all features from a ledger entry', () => {
      const entry = createTestEntry('15', 5, 7.5);
      const features = extractFeatures(entry);
      
      expect(features.trade_type).toBe('DAY');
      expect(features.dte_bucket).toBe('WEEKLY');
      expect(features.signal_quality).toBe('HIGH');
      expect(features.ai_score_bucket).toBe('HIGH');
      expect(features.iv_rank_bucket).toBe('NORMAL');
      expect(features.volatility_regime).toBe('NORMAL');
      expect(features.trend_regime).toBe('BULL');
      expect(features.market_session).toBe('MIDDAY');
      expect(features.day_of_week).toBe('TUESDAY');
      expect(features.direction).toBe('LONG');
    });

    it('should not contain raw floats in features (Requirement 7.4)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 240 }),
          fc.integer({ min: 0, max: 100 }),
          fc.float({ min: Math.fround(0), max: Math.fround(10.5), noNaN: true }),
          (tf, dte, aiScore) => {
            const entry = createTestEntry(tf.toString(), dte, aiScore);
            const features = extractFeatures(entry);
            
            // All features should be strings (bucketed), not numbers
            expect(typeof features.trade_type).toBe('string');
            expect(typeof features.dte_bucket).toBe('string');
            expect(typeof features.signal_quality).toBe('string');
            expect(typeof features.ai_score_bucket).toBe('string');
            expect(typeof features.iv_rank_bucket).toBe('string');
            expect(typeof features.trend_strength_bucket).toBe('string');
            expect(typeof features.volume_bucket).toBe('string');
            expect(typeof features.volatility_regime).toBe('string');
            expect(typeof features.trend_regime).toBe('string');
            expect(typeof features.market_session).toBe('string');
            expect(typeof features.day_of_week).toBe('string');
            expect(typeof features.direction).toBe('string');
            expect(typeof features.htf_alignment).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('DTE Isolated Analysis (Requirement 7.5)', () => {
    it('should group entries by DTE bucket', () => {
      const entries = [
        createTestEntry('15', 0, 7.5),   // 0DTE
        createTestEntry('15', 3, 7.5),   // WEEKLY
        createTestEntry('15', 5, 7.5),   // WEEKLY
        createTestEntry('15', 20, 7.5),  // MONTHLY
        createTestEntry('15', 60, 7.5),  // LEAP
      ];
      
      const groups = groupByDTEBucket(entries);
      
      expect(groups.get('0DTE')?.length).toBe(1);
      expect(groups.get('WEEKLY')?.length).toBe(2);
      expect(groups.get('MONTHLY')?.length).toBe(1);
      expect(groups.get('LEAP')?.length).toBe(1);
    });

    it('should create DTE-isolated feature keys', () => {
      const entry1 = createTestEntry('15', 0, 7.5);
      const entry2 = createTestEntry('15', 5, 7.5);
      
      const features1 = extractFeatures(entry1);
      const features2 = extractFeatures(entry2);
      
      const key1 = createDTEIsolatedKey(features1);
      const key2 = createDTEIsolatedKey(features2);
      
      // Different DTE buckets should have different keys
      expect(key1).not.toBe(key2);
      expect(key1).toContain('0DTE');
      expect(key2).toContain('WEEKLY');
    });
  });

  describe('Trade Type Grouping', () => {
    it('should group entries by trade type', () => {
      const entries = [
        createTestEntry('3', 0, 7.5),    // SCALP
        createTestEntry('5', 0, 7.5),    // SCALP
        createTestEntry('15', 5, 7.5),   // DAY
        createTestEntry('60', 5, 7.5),   // DAY
        createTestEntry('240', 30, 7.5), // SWING
      ];
      
      const groups = groupByTradeType(entries);
      
      expect(groups.get('SCALP')?.length).toBe(2);
      expect(groups.get('DAY')?.length).toBe(2);
      expect(groups.get('SWING')?.length).toBe(1);
      expect(groups.get('LEAP')?.length).toBe(0);
    });
  });

  describe('Feature Key Generation', () => {
    it('should create unique keys for different feature combinations', () => {
      const entry1 = createTestEntry('3', 0, 9.5);   // SCALP, 0DTE, EXTREME_PLUS
      const entry2 = createTestEntry('15', 5, 7.5);  // DAY, WEEKLY, HIGH
      
      const features1 = extractFeatures(entry1);
      const features2 = extractFeatures(entry2);
      
      const key1 = createFeatureKey(features1);
      const key2 = createFeatureKey(features2);
      
      expect(key1).not.toBe(key2);
    });

    it('should create identical keys for same feature combinations', () => {
      const entry1 = createTestEntry('15', 5, 7.5);
      const entry2 = createTestEntry('15', 5, 7.5);
      
      const features1 = extractFeatures(entry1);
      const features2 = extractFeatures(entry2);
      
      const key1 = createFeatureKey(features1);
      const key2 = createFeatureKey(features2);
      
      expect(key1).toBe(key2);
    });
  });
});
