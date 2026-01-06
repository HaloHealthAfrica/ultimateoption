/**
 * Learning Advisor Tests
 * 
 * Property tests for learning suggestion generation.
 * Validates sample size requirements and change bounds.
 */

import * as fc from 'fast-check';
import {
  hasSufficientSample,
  clampChange,
  isSignificantChange,
  generateAllSuggestions,
  SUGGESTION_BOUNDS,
} from './learningAdvisor';
import { LedgerEntry, ExitData, RegimeSnapshot } from '../types/ledger';
import { EnrichedSignal } from '../types/signal';
import { DecisionBreakdown } from '../types/decision';
import { Execution } from '../types/options';
import { MINIMUM_SAMPLE_SIZE } from './metricsEngine';

// Helper to create a valid EnrichedSignal with proper nested structure
function createTestSignal(overrides: { quality?: string; ai_score?: number } = {}): EnrichedSignal {
  return {
    signal: {
      type: 'LONG',
      timeframe: '15',
      quality: (overrides.quality || 'HIGH') as 'EXTREME' | 'HIGH' | 'MEDIUM',
      ai_score: overrides.ai_score ?? 8.5,
      timestamp: Date.now(),
      bar_time: new Date().toISOString(),
    },
    instrument: {
      exchange: 'NYSE',
      ticker: 'SPY',
      current_price: 450,
    },
    entry: {
      price: 450,
      stop_loss: 448,
      target_1: 452,
      target_2: 455,
      stop_reason: 'ATR-based',
    },
    risk: {
      amount: 500,
      rr_ratio_t1: 2.0,
      rr_ratio_t2: 3.5,
      stop_distance_pct: 0.44,
      recommended_shares: 100,
      recommended_contracts: 10,
      position_multiplier: 1.0,
      account_risk_pct: 1.0,
      max_loss_dollars: 500,
    },
    market_context: {
      vwap: 449.5,
      pmh: 451,
      pml: 447,
      day_open: 448,
      day_change_pct: 0.5,
      price_vs_vwap_pct: 0.1,
      distance_to_pmh_pct: 0.2,
      distance_to_pml_pct: 0.7,
      atr: 2.5,
      volume_vs_avg: 1.2,
      candle_direction: 'GREEN',
      candle_size_atr: 0.8,
    },
    trend: {
      ema_8: 449,
      ema_21: 448,
      ema_50: 446,
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
      golf: 1.5,
    },
    components: ['EMA_STACK', 'VWAP_BOUNCE', 'MTF_ALIGNED'],
    time_context: {
      market_session: 'OPEN',
      day_of_week: 'MONDAY',
    },
  };
}

// Helper to create a valid breakdown
function createTestBreakdown(): DecisionBreakdown {
  return {
    confluence_multiplier: 1.0,
    quality_multiplier: 1.0,
    htf_multiplier: 1.0,
    rr_multiplier: 1.0,
    volume_multiplier: 1.0,
    trend_multiplier: 1.0,
    session_multiplier: 1.0,
    day_multiplier: 1.0,
    phase_boost: 0,
    raw_multiplier: 1.0,
    final_multiplier: 1.0,
    clamped: false,
  };
}

// Helper to create a valid execution
function createTestExecution(): Execution {
  return {
    option_type: 'CALL',
    strike: 450,
    expiry: '2024-01-19',
    dte: 7,
    contracts_requested: 10,
    contracts_filled: 10,
    entry_price: 2.50,
    theoretical_price: 2.45,
    bid: 2.40,
    ask: 2.50,
    spread_cost: 0.10,
    slippage: 0.05,
    commission: 13.00,
    total_cost: 2513.00,
    risk_amount: 500,
    greeks: {
      delta: 0.55,
      gamma: 0.08,
      theta: -0.15,
      vega: 0.12,
      iv: 0.25,
    },
  };
}

// Helper to create a valid exit
function createTestExit(pnl: number): ExitData {
  return {
    exit_time: Date.now(),
    exit_price: 3.00,
    exit_iv: 0.26,
    exit_delta: 0.60,
    underlying_at_exit: 452,
    pnl_gross: pnl + 13,
    pnl_net: pnl,
    hold_time_seconds: 3600,
    exit_reason: pnl > 0 ? 'TARGET_1' : 'STOP_LOSS',
    pnl_from_delta: pnl * 0.6,
    pnl_from_iv: pnl * 0.2,
    pnl_from_theta: pnl * -0.1,
    pnl_from_gamma: pnl * 0.3,
    total_commission: 13,
    total_spread_cost: 10,
    total_slippage: 5,
  };
}

// Helper to create a valid regime
function createTestRegime(): RegimeSnapshot {
  return {
    volatility: 'NORMAL',
    trend: 'BULL',
    liquidity: 'NORMAL',
    iv_rank: 50,
  };
}

// Helper to create a closed trade entry
function createClosedTrade(pnl: number, daysAgo: number = 0): LedgerEntry {
  const createdAt = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
  return {
    id: `test-${Math.random().toString(36).substr(2, 9)}`,
    created_at: createdAt,
    engine_version: '1.0.0',
    signal: createTestSignal(),
    decision: 'EXECUTE',
    decision_reason: 'Test trade',
    decision_breakdown: createTestBreakdown(),
    confluence_score: 75,
    execution: createTestExecution(),
    exit: createTestExit(pnl),
    regime: createTestRegime(),
  };
}

describe('Learning Advisor', () => {
  describe('Property 30: Learning Suggestion Sample Size', () => {
    it('should return false for hasSufficientSample when sample < 30', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 29 }),
          (count) => {
            const entries: LedgerEntry[] = [];
            for (let i = 0; i < count; i++) {
              entries.push(createClosedTrade(100));
            }
            
            expect(hasSufficientSample(entries)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return true for hasSufficientSample when sample >= 30', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 30, max: 100 }),
          (count) => {
            const entries: LedgerEntry[] = [];
            for (let i = 0; i < count; i++) {
              entries.push(createClosedTrade(100));
            }
            
            expect(hasSufficientSample(entries)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only count closed trades (EXECUTE with exit)', () => {
      // Create 40 entries but only 25 are closed trades
      const entries: LedgerEntry[] = [];
      
      // 25 closed trades
      for (let i = 0; i < 25; i++) {
        entries.push(createClosedTrade(100));
      }
      
      // 15 non-closed entries (WAIT/SKIP or no exit)
      for (let i = 0; i < 15; i++) {
        const entry = createClosedTrade(100);
        if (i % 2 === 0) {
          entry.decision = 'WAIT';
          delete entry.execution;
          delete entry.exit;
        } else {
          delete entry.exit; // Open trade
        }
        entries.push(entry);
      }
      
      expect(hasSufficientSample(entries)).toBe(false);
    });

    it('should generate no suggestions when sample < 30', () => {
      const entries: LedgerEntry[] = [];
      for (let i = 0; i < 25; i++) {
        entries.push(createClosedTrade(100));
      }
      
      const suggestions = generateAllSuggestions(entries, {
        qualityMultipliers: { EXTREME: 1.2, HIGH: 1.0, MEDIUM: 0.8 },
        dteMultipliers: { '0DTE': 1.0, WEEKLY: 1.0, MONTHLY: 1.0, LEAP: 1.0 },
        tradeTypeMultipliers: { SCALP: 1.0, DAY: 1.0, SWING: 1.0, LEAP: 1.0 },
      });
      
      expect(suggestions.length).toBe(0);
    });
  });


  describe('Property 31: Learning Suggestion Bounds', () => {
    it('should clamp changes to +/- 15%', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
          (rawChange) => {
            const clamped = clampChange(rawChange);
            
            expect(clamped).toBeGreaterThanOrEqual(-SUGGESTION_BOUNDS.MAX_CHANGE_PERCENT);
            expect(clamped).toBeLessThanOrEqual(SUGGESTION_BOUNDS.MAX_CHANGE_PERCENT);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve changes within bounds', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-15), max: Math.fround(15), noNaN: true }),
          (rawChange) => {
            const clamped = clampChange(rawChange);
            
            // Should be unchanged (within floating point tolerance)
            expect(Math.abs(clamped - rawChange)).toBeLessThan(0.001);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should skip changes < 5%', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-4.99), max: Math.fround(4.99), noNaN: true }),
          (change) => {
            expect(isSignificantChange(change)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept changes >= 5%', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.float({ min: Math.fround(5), max: Math.fround(100), noNaN: true }),
            fc.float({ min: Math.fround(-100), max: Math.fround(-5), noNaN: true })
          ),
          (change) => {
            expect(isSignificantChange(change)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure all generated suggestions have changePercent within bounds', () => {
      // Create enough trades to generate suggestions
      const entries: LedgerEntry[] = [];
      
      // Create 50 winning trades with HIGH quality
      for (let i = 0; i < 50; i++) {
        const entry = createClosedTrade(200);
        entry.signal = createTestSignal({ quality: 'HIGH', ai_score: 7.5 });
        entries.push(entry);
      }
      
      // Create 30 losing trades with MEDIUM quality
      for (let i = 0; i < 30; i++) {
        const entry = createClosedTrade(-100);
        entry.signal = createTestSignal({ quality: 'MEDIUM', ai_score: 6.5 });
        entries.push(entry);
      }
      
      const suggestions = generateAllSuggestions(entries, {
        qualityMultipliers: { EXTREME: 1.2, HIGH: 1.0, MEDIUM: 0.8 },
        dteMultipliers: { '0DTE': 1.0, WEEKLY: 1.0, MONTHLY: 1.0, LEAP: 1.0 },
        tradeTypeMultipliers: { SCALP: 1.0, DAY: 1.0, SWING: 1.0, LEAP: 1.0 },
      });
      
      for (const suggestion of suggestions) {
        expect(Math.abs(suggestion.changePercent)).toBeLessThanOrEqual(
          SUGGESTION_BOUNDS.MAX_CHANGE_PERCENT
        );
        expect(Math.abs(suggestion.changePercent)).toBeGreaterThanOrEqual(
          SUGGESTION_BOUNDS.MIN_CHANGE_PERCENT
        );
      }
    });
  });

  describe('Suggestion Status', () => {
    it('should generate suggestions with PENDING status', () => {
      const entries: LedgerEntry[] = [];
      
      // Create enough trades with varying performance
      for (let i = 0; i < 40; i++) {
        const entry = createClosedTrade(i % 2 === 0 ? 200 : -50);
        entry.signal = createTestSignal({ quality: 'HIGH', ai_score: 7.5 });
        entries.push(entry);
      }
      
      for (let i = 0; i < 35; i++) {
        const entry = createClosedTrade(i % 3 === 0 ? 100 : -150);
        entry.signal = createTestSignal({ quality: 'MEDIUM', ai_score: 6.5 });
        entries.push(entry);
      }
      
      const suggestions = generateAllSuggestions(entries, {
        qualityMultipliers: { EXTREME: 1.2, HIGH: 1.0, MEDIUM: 0.8 },
        dteMultipliers: { '0DTE': 1.0, WEEKLY: 1.0, MONTHLY: 1.0, LEAP: 1.0 },
        tradeTypeMultipliers: { SCALP: 1.0, DAY: 1.0, SWING: 1.0, LEAP: 1.0 },
      });
      
      for (const suggestion of suggestions) {
        expect(suggestion.status).toBe('PENDING');
      }
    });
  });

  describe('Evidence Requirements', () => {
    it('should include evidence with each suggestion', () => {
      const entries: LedgerEntry[] = [];
      
      // Create trades with clear performance difference
      for (let i = 0; i < 45; i++) {
        const entry = createClosedTrade(300); // All winners
        entry.signal = createTestSignal({ quality: 'HIGH', ai_score: 7.5 });
        entries.push(entry);
      }
      
      for (let i = 0; i < 35; i++) {
        const entry = createClosedTrade(-200); // All losers
        entry.signal = createTestSignal({ quality: 'MEDIUM', ai_score: 6.5 });
        entries.push(entry);
      }
      
      const suggestions = generateAllSuggestions(entries, {
        qualityMultipliers: { EXTREME: 1.2, HIGH: 1.0, MEDIUM: 0.8 },
        dteMultipliers: { '0DTE': 1.0, WEEKLY: 1.0, MONTHLY: 1.0, LEAP: 1.0 },
        tradeTypeMultipliers: { SCALP: 1.0, DAY: 1.0, SWING: 1.0, LEAP: 1.0 },
      });
      
      for (const suggestion of suggestions) {
        expect(suggestion.evidence).toBeDefined();
        expect(suggestion.evidence.sampleSize).toBeGreaterThanOrEqual(MINIMUM_SAMPLE_SIZE);
        expect(typeof suggestion.evidence.winRate).toBe('number');
        expect(typeof suggestion.evidence.expectancy).toBe('number');
        expect(typeof suggestion.evidence.avgR).toBe('number');
        expect(typeof suggestion.evidence.profitFactor).toBe('number');
        expect(suggestion.evidence.featureKey).toBeDefined();
        expect(suggestion.rationale).toBeDefined();
        expect(suggestion.rationale.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty entries', () => {
      const suggestions = generateAllSuggestions([], {
        qualityMultipliers: { EXTREME: 1.2, HIGH: 1.0, MEDIUM: 0.8 },
        dteMultipliers: { '0DTE': 1.0, WEEKLY: 1.0, MONTHLY: 1.0, LEAP: 1.0 },
        tradeTypeMultipliers: { SCALP: 1.0, DAY: 1.0, SWING: 1.0, LEAP: 1.0 },
      });
      
      expect(suggestions).toEqual([]);
    });

    it('should handle all winning trades', () => {
      const entries: LedgerEntry[] = [];
      for (let i = 0; i < 50; i++) {
        entries.push(createClosedTrade(100));
      }
      
      const suggestions = generateAllSuggestions(entries, {
        qualityMultipliers: { EXTREME: 1.2, HIGH: 1.0, MEDIUM: 0.8 },
        dteMultipliers: { '0DTE': 1.0, WEEKLY: 1.0, MONTHLY: 1.0, LEAP: 1.0 },
        tradeTypeMultipliers: { SCALP: 1.0, DAY: 1.0, SWING: 1.0, LEAP: 1.0 },
      });
      
      // Should not crash, may or may not generate suggestions
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle all losing trades', () => {
      const entries: LedgerEntry[] = [];
      for (let i = 0; i < 50; i++) {
        entries.push(createClosedTrade(-100));
      }
      
      const suggestions = generateAllSuggestions(entries, {
        qualityMultipliers: { EXTREME: 1.2, HIGH: 1.0, MEDIUM: 0.8 },
        dteMultipliers: { '0DTE': 1.0, WEEKLY: 1.0, MONTHLY: 1.0, LEAP: 1.0 },
        tradeTypeMultipliers: { SCALP: 1.0, DAY: 1.0, SWING: 1.0, LEAP: 1.0 },
      });
      
      // Should not crash, may or may not generate suggestions
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
});
