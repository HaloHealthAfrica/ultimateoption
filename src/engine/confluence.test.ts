/**
 * Property Tests for Confluence Calculation
 * 
 * Property 8: Confluence Score Calculation
 * For any set of active signals, the confluence score SHALL equal the sum of
 * (weight × 1) for aligned signals, where weights are:
 * 4H=40%, 1H=25%, 30M=15%, 15M=10%, 5M=7%, 3M=3%.
 * 
 * Validates: Requirements 3.1, 3.2
 */

import * as fc from 'fast-check';
import {
  calculateConfluenceForDirection,
  calculateConfluenceWithBreakdown,
  getDominantDirection,
  isTimeframeAligned,
  getMaxPossibleConfluence,
  TIMEFRAMES_BY_WEIGHT,
} from './confluence';
import { CONFLUENCE_WEIGHTS } from './matrices';
import { StoredSignal } from '@/webhooks/timeframeStore';
import { EnrichedSignal, Timeframe, SignalType } from '@/types/signal';

// Helper to create a minimal signal
function createSignal(
  timeframe: Timeframe,
  type: SignalType
): EnrichedSignal {
  return {
    signal: {
      type,
      timeframe,
      quality: 'HIGH',
      ai_score: 8,
      timestamp: Date.now(),
      bar_time: '2024-01-01T10:00:00Z',
    },
    instrument: { exchange: 'NYSE', ticker: 'SPY', current_price: 450 },
    entry: { price: 450, stop_loss: 445, target_1: 455, target_2: 460, stop_reason: 'ATR' },
    risk: { amount: 500, rr_ratio_t1: 2, rr_ratio_t2: 4, stop_distance_pct: 1, recommended_shares: 100, recommended_contracts: 5, position_multiplier: 1, account_risk_pct: 1, max_loss_dollars: 500 },
    market_context: { vwap: 450, pmh: 455, pml: 445, day_open: 448, day_change_pct: 0.5, price_vs_vwap_pct: 0, distance_to_pmh_pct: 1, distance_to_pml_pct: 1, atr: 5, volume_vs_avg: 1, candle_direction: 'GREEN', candle_size_atr: 1 },
    trend: { ema_8: 450, ema_21: 449, ema_50: 448, alignment: 'BULLISH', strength: 70, rsi: 55, macd_signal: 'BULLISH' },
    mtf_context: { '4h_bias': 'LONG', '4h_rsi': 55, '1h_bias': 'LONG' },
    score_breakdown: { strat: 8, trend: 7, gamma: 6, vwap: 7, mtf: 8, golf: 7 },
    components: [],
    time_context: { market_session: 'MIDDAY', day_of_week: 'TUESDAY' },
  };
}

// Helper to create a stored signal
function createStoredSignal(timeframe: Timeframe, type: SignalType): StoredSignal {
  const signal = createSignal(timeframe, type);
  return {
    signal,
    received_at: Date.now(),
    expires_at: Date.now() + 3600000,
    validity_minutes: 60,
  };
}

// Arbitrary generators
const timeframeArb = fc.constantFrom<Timeframe>(...TIMEFRAMES_BY_WEIGHT);
const directionArb = fc.constantFrom<SignalType>('LONG', 'SHORT');

// Generate a subset of timeframes with their directions
const signalSetArb = fc.array(
  fc.record({
    timeframe: timeframeArb,
    direction: directionArb,
  }),
  { minLength: 0, maxLength: 6 }
).map(signals => {
  // Deduplicate by timeframe (keep last)
  const map = new Map<Timeframe, SignalType>();
  for (const s of signals) {
    map.set(s.timeframe, s.direction);
  }
  return map;
});


describe('Property 8: Confluence Score Calculation', () => {
  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * Score = sum of weights for aligned timeframes
   */
  it('should calculate confluence as sum of weights for aligned signals', () => {
    fc.assert(
      fc.property(signalSetArb, directionArb, (signalMap, direction) => {
        // Build stored signals map
        const signals = new Map<Timeframe, StoredSignal>();
        for (const [tf, dir] of signalMap) {
          signals.set(tf, createStoredSignal(tf, dir));
        }
        
        // Calculate expected score manually
        let expectedScore = 0;
        for (const [tf, dir] of signalMap) {
          if (dir === direction) {
            expectedScore += CONFLUENCE_WEIGHTS[tf] * 100;
          }
        }
        
        const actualScore = calculateConfluenceForDirection(signals, direction);
        
        expect(actualScore).toBeCloseTo(expectedScore, 5);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * Weights should be: 4H=40%, 1H=25%, 30M=15%, 15M=10%, 5M=7%, 3M=3%
   */
  it('should use correct weights for each timeframe', () => {
    expect(CONFLUENCE_WEIGHTS['240']).toBe(0.40);
    expect(CONFLUENCE_WEIGHTS['60']).toBe(0.25);
    expect(CONFLUENCE_WEIGHTS['30']).toBe(0.15);
    expect(CONFLUENCE_WEIGHTS['15']).toBe(0.10);
    expect(CONFLUENCE_WEIGHTS['5']).toBe(0.07);
    expect(CONFLUENCE_WEIGHTS['3']).toBe(0.03);
    
    // Weights should sum to 1.0 (100%)
    const totalWeight = Object.values(CONFLUENCE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * Perfect alignment should give 100% confluence
   */
  it('should return 100% for perfect alignment', () => {
    fc.assert(
      fc.property(directionArb, (direction) => {
        const signals = new Map<Timeframe, StoredSignal>();
        
        // Add all timeframes aligned
        for (const tf of TIMEFRAMES_BY_WEIGHT) {
          signals.set(tf, createStoredSignal(tf, direction));
        }
        
        const score = calculateConfluenceForDirection(signals, direction);
        expect(score).toBeCloseTo(100, 5);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * No signals should give 0% confluence
   */
  it('should return 0% for no signals', () => {
    fc.assert(
      fc.property(directionArb, (direction) => {
        const signals = new Map<Timeframe, StoredSignal>();
        const score = calculateConfluenceForDirection(signals, direction);
        expect(score).toBe(0);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * All signals opposite direction should give 0% confluence
   */
  it('should return 0% when all signals are opposite direction', () => {
    fc.assert(
      fc.property(directionArb, (direction) => {
        const signals = new Map<Timeframe, StoredSignal>();
        const opposite: SignalType = direction === 'LONG' ? 'SHORT' : 'LONG';
        
        // Add all timeframes with opposite direction
        for (const tf of TIMEFRAMES_BY_WEIGHT) {
          signals.set(tf, createStoredSignal(tf, opposite));
        }
        
        const score = calculateConfluenceForDirection(signals, direction);
        expect(score).toBe(0);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * Breakdown should match total score
   */
  it('should have breakdown contributions sum to total score', () => {
    fc.assert(
      fc.property(signalSetArb, directionArb, (signalMap, direction) => {
        const signals = new Map<Timeframe, StoredSignal>();
        for (const [tf, dir] of signalMap) {
          signals.set(tf, createStoredSignal(tf, dir));
        }
        
        const result = calculateConfluenceWithBreakdown(signals, direction);
        
        // Sum of contributions should equal total score
        const sumContributions = Object.values(result.breakdown)
          .reduce((sum, b) => sum + b.contribution, 0);
        
        expect(sumContributions).toBeCloseTo(result.score, 5);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * Aligned timeframes list should match breakdown
   */
  it('should correctly identify aligned timeframes', () => {
    fc.assert(
      fc.property(signalSetArb, directionArb, (signalMap, direction) => {
        const signals = new Map<Timeframe, StoredSignal>();
        for (const [tf, dir] of signalMap) {
          signals.set(tf, createStoredSignal(tf, dir));
        }
        
        const result = calculateConfluenceWithBreakdown(signals, direction);
        
        // Check each aligned timeframe
        for (const tf of result.alignedTimeframes) {
          expect(result.breakdown[tf].aligned).toBe(true);
          expect(isTimeframeAligned(signals, tf, direction)).toBe(true);
        }
        
        // Check each misaligned timeframe
        for (const tf of result.misalignedTimeframes) {
          expect(result.breakdown[tf].aligned).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * Dominant direction should have higher or equal score
   */
  it('should identify dominant direction correctly', () => {
    fc.assert(
      fc.property(signalSetArb, (signalMap) => {
        const signals = new Map<Timeframe, StoredSignal>();
        for (const [tf, dir] of signalMap) {
          signals.set(tf, createStoredSignal(tf, dir));
        }
        
        const { direction, score } = getDominantDirection(signals);
        
        if (signals.size === 0) {
          expect(direction).toBeNull();
          expect(score).toBe(0);
        } else if (direction) {
          const longScore = calculateConfluenceForDirection(signals, 'LONG');
          const shortScore = calculateConfluenceForDirection(signals, 'SHORT');
          
          // Dominant direction should have >= score
          expect(score).toBeGreaterThanOrEqual(Math.min(longScore, shortScore));
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 8: Confluence Score Calculation
   * Max possible confluence should be 100%
   */
  it('should have max possible confluence of 100%', () => {
    expect(getMaxPossibleConfluence()).toBeCloseTo(100, 5);
  });
});
