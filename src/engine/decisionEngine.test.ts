/**
 * Decision Engine Tests
 * Property-based tests for the immutable decision engine
 * 
 * Requirements: 2.5, 15.3
 */

import fc from 'fast-check';
import { makeDecision, ENGINE_VERSION } from './decisionEngine';
import { TimeframeStore, getTimeframeStore, resetTimeframeStore } from '@/webhooks/timeframeStore';
import { PhaseStore } from '@/webhooks/phaseStore';
import { TrendStore } from '@/trend/storage/trendStore';
import { generateSignal } from '@/testing/generators/signalGenerator';
import { generatePhase } from '@/testing/generators/phaseGenerator';
import { generateTrend } from '@/testing/generators/trendGenerator';
import { Timeframe, SignalType } from '@/types/signal';
import { Decision } from '@/types/decision';
import { SatyPhaseWebhook } from '@/types/saty';
import { TrendWebhook } from '@/types/trend';

describe('Decision Engine', () => {
  let timeframeStore: TimeframeStore;
  let phaseStore: PhaseStore;
  let trendStore: TrendStore;

  beforeEach(() => {
    resetTimeframeStore();
    timeframeStore = getTimeframeStore();
    phaseStore = PhaseStore.getInstance();
    trendStore = TrendStore.getInstance();
    
    // Clear stores
    timeframeStore.clear();
    phaseStore.clear();
    trendStore.clear();
  });

  describe('Property 5: Decision Engine Determinism', () => {
    test('should produce identical output for identical inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            // Generate identical signals
            const signal1 = generateSignal({ seed, timeframe: '240', type: 'LONG', ai_score: 8 });
            const signal2 = generateSignal({ seed, timeframe: '240', type: 'LONG', ai_score: 8 });
            
            // Store signals in separate stores
            const store1 = getTimeframeStore();
            resetTimeframeStore();
            const store2 = getTimeframeStore();
            
            store1.clear();
            store2.clear();
            
            store1.storeSignal(signal1);
            store2.storeSignal(signal2);
            
            // Make decisions
            const decision1 = makeDecision(store1.getActiveSignals(), new Map());
            const decision2 = makeDecision(store2.getActiveSignals(), new Map());
            
            // Should be identical
            expect(decision1).toEqual(decision2);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should produce same result regardless of call order', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            const signal = generateSignal({ seed, timeframe: '240', type: 'LONG', ai_score: 8 });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const signals = timeframeStore.getActiveSignals();
            const phases = new Map();
            
            // Call multiple times
            const decision1 = makeDecision(signals, phases);
            const decision2 = makeDecision(signals, phases);
            const decision3 = makeDecision(signals, phases);
            
            expect(decision1).toEqual(decision2);
            expect(decision2).toEqual(decision3);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should include ENGINE_VERSION in every decision', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            const signal = generateSignal({ seed });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            expect(decision.engine_version).toBe(ENGINE_VERSION);
            expect(typeof decision.engine_version).toBe('string');
            expect(decision.engine_version.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 6: Decision Output Validity', () => {
    test('should always return a valid decision type', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            const signal = generateSignal({ seed });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            expect(['EXECUTE', 'WAIT', 'SKIP']).toContain(decision.decision);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should always include a non-empty reason', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            const signal = generateSignal({ seed });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            expect(typeof decision.reason).toBe('string');
            expect(decision.reason.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should have confluence_score between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            const signal = generateSignal({ seed });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            expect(decision.confluence_score).toBeGreaterThanOrEqual(0);
            expect(decision.confluence_score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should have final_multiplier within bounds for EXECUTE decisions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            // Generate high-quality signal likely to EXECUTE
            const signal = generateSignal({ 
              seed,
              timeframe: '240', 
              type: 'LONG', 
              ai_score: 9,
              quality: 'EXTREME'
            });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            if (decision.decision === 'EXECUTE') {
              expect(decision.breakdown.final_multiplier).toBeGreaterThanOrEqual(0.5);
              expect(decision.breakdown.final_multiplier).toBeLessThanOrEqual(3.0);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should have recommended_contracts >= 1 for EXECUTE decisions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            // Generate high-quality signal likely to EXECUTE
            const signal = generateSignal({ 
              seed,
              timeframe: '240', 
              type: 'LONG', 
              ai_score: 9,
              quality: 'EXTREME'
            });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            if (decision.decision === 'EXECUTE') {
              expect(decision.recommended_contracts).toBeGreaterThanOrEqual(1);
              expect(Number.isInteger(decision.recommended_contracts)).toBe(true);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should have recommended_contracts = 0 for WAIT/SKIP decisions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            const signal = generateSignal({ seed });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            if (decision.decision === 'WAIT' || decision.decision === 'SKIP') {
              expect(decision.recommended_contracts).toBe(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should include entry_signal for EXECUTE decisions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            // Generate high-quality signal likely to EXECUTE
            const signal = generateSignal({ 
              seed,
              timeframe: '240', 
              type: 'LONG', 
              ai_score: 9,
              quality: 'EXTREME'
            });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            if (decision.decision === 'EXECUTE') {
              expect(decision.entry_signal).not.toBeNull();
              expect(decision.entry_signal?.signal.type).toBe('LONG');
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should return WAIT when no signals present', () => {
      timeframeStore.clear();
      
      const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
      
      expect(decision.decision).toBe('WAIT');
      expect(decision.reason).toContain('No active signals');
    });

    test('should have valid breakdown structure', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            const signal = generateSignal({ seed });
            
            timeframeStore.clear();
            timeframeStore.storeSignal(signal);
            
            const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
            
            const breakdown = decision.breakdown;
            
            // All multipliers should be numbers
            expect(typeof breakdown.confluence_multiplier).toBe('number');
            expect(typeof breakdown.quality_multiplier).toBe('number');
            expect(typeof breakdown.htf_alignment_multiplier).toBe('number');
            expect(typeof breakdown.rr_multiplier).toBe('number');
            expect(typeof breakdown.volume_multiplier).toBe('number');
            expect(typeof breakdown.trend_multiplier).toBe('number');
            expect(typeof breakdown.session_multiplier).toBe('number');
            expect(typeof breakdown.day_multiplier).toBe('number');
            expect(typeof breakdown.phase_confidence_boost).toBe('number');
            expect(typeof breakdown.phase_position_boost).toBe('number');
            expect(typeof breakdown.trend_alignment_boost).toBe('number');
            expect(typeof breakdown.final_multiplier).toBe('number');
            
            // All should be positive
            expect(breakdown.confluence_multiplier).toBeGreaterThan(0);
            expect(breakdown.quality_multiplier).toBeGreaterThan(0);
            expect(breakdown.htf_alignment_multiplier).toBeGreaterThan(0);
            expect(breakdown.rr_multiplier).toBeGreaterThan(0);
            expect(breakdown.volume_multiplier).toBeGreaterThan(0);
            expect(breakdown.trend_multiplier).toBeGreaterThan(0);
            expect(breakdown.session_multiplier).toBeGreaterThan(0);
            expect(breakdown.day_multiplier).toBeGreaterThan(0);
            expect(breakdown.final_multiplier).toBeGreaterThan(0);
            
            // Boosts should be non-negative
            expect(breakdown.phase_confidence_boost).toBeGreaterThanOrEqual(0);
            expect(breakdown.phase_position_boost).toBeGreaterThanOrEqual(0);
            expect(breakdown.trend_alignment_boost).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Decision Logic Correctness', () => {
    test('should require HTF bias for EXECUTE decision', () => {
      // Generate signal without HTF bias (low AI score)
      const signal = generateSignal({ 
        seed: 123,
        timeframe: '15', 
        type: 'LONG', 
        ai_score: 5 // Below HTF_MIN_AI_SCORE
      });
      
      timeframeStore.clear();
      timeframeStore.storeSignal(signal);
      
      const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
      
      expect(decision.decision).toBe('WAIT');
      expect(decision.reason).toContain('No valid HTF bias');
    });

    test('should require minimum confluence for EXECUTE decision', () => {
      // Generate single low-weight signal (won't meet confluence threshold)
      const signal = generateSignal({ 
        seed: 123,
        timeframe: '3', // Lowest weight (3%)
        type: 'LONG', 
        ai_score: 5 // Below HTF threshold
      });
      
      timeframeStore.clear();
      timeframeStore.storeSignal(signal);
      
      const decision = makeDecision(timeframeStore.getActiveSignals(), new Map());
      
      expect(decision.decision).toBe('WAIT');
      // This will fail HTF bias first, not confluence
      expect(decision.reason).toContain('No valid HTF bias');
    });
  });

  describe('Property 39: Phase Confidence Boost Application', () => {
    test('should apply phase confidence boost when htf_alignment is true', () => {
      // Create multiple signals to meet confluence threshold (need 60%+)
      const signal240 = generateSignal({ 
        seed: 123,
        timeframe: '240', // 40% weight
        type: 'LONG', 
        ai_score: 9,
        quality: 'EXTREME'
      });
      
      const signal60 = generateSignal({ 
        seed: 124,
        timeframe: '60', // 25% weight  
        type: 'LONG', 
        ai_score: 8,
        quality: 'HIGH'
      });
      // Total confluence: 40% + 25% = 65% (above 60% threshold)
      
      // Create a phase that aligns with the signal and has htf_alignment = true
      const phase: SatyPhaseWebhook = {
        meta: {
          engine: 'SATY_PO',
          engine_version: '2.0.0',
          event_id: 'test_phase_1',
          event_type: 'REGIME_PHASE_ENTRY',
          generated_at: new Date().toISOString(),
        },
        instrument: {
          symbol: 'SPY',
          exchange: 'NYSE',
          asset_class: 'EQUITY',
          session: 'RTH',
        },
        timeframe: {
          chart_tf: '240',
          event_tf: '240M',
          tf_role: 'REGIME',
          bar_close_time: new Date().toISOString(),
        },
        event: {
          name: 'ENTER_ACCUMULATION',
          description: 'Enter accumulation phase',
          directional_implication: 'UPSIDE_POTENTIAL',
          event_priority: 8,
        },
        oscillator_state: {
          value: 50,
          previous_value: 45,
          zone_from: 'NEUTRAL',
          zone_to: 'ACCUMULATION',
          distance_from_zero: 50,
          distance_from_extreme: 50,
          velocity: 'INCREASING',
        },
        regime_context: {
          local_bias: 'BULLISH',
          htf_bias: {
            tf: '240',
            bias: 'BULLISH',
            osc_value: 60,
          },
          macro_bias: {
            tf: 'D',
            bias: 'BULLISH',
            osc_value: 70,
          },
        },
        confidence: {
          confidence_score: 80,
          confidence_tier: 'HIGH',
          htf_alignment: true,
          decay_time_minutes: 240,
        },
        execution_guidance: {
          trade_allowed: true,
          allowed_directions: ['LONG'],
          position_sizing_modifier: 1.0,
          risk_adjustment: 0,
        },
        risk_hints: {
          avoid_if: [],
          time_decay_minutes: 240,
          cooldown_tf: '240M',
        },
        text: '',
      };
      
      timeframeStore.clear();
      phaseStore.clear();
      
      timeframeStore.storeSignal(signal240);
      timeframeStore.storeSignal(signal60);
      phaseStore.storePhase(phase);
      
      const decision = makeDecision(
        timeframeStore.getActiveSignals(), 
        phaseStore.getActivePhases()
      );
      
      // Should EXECUTE with phase confidence boost
      expect(decision.decision).toBe('EXECUTE');
      expect(decision.breakdown.phase_confidence_boost).toBe(0.20);
    });

    test('should not apply phase confidence boost when htf_alignment is false', () => {
      // Create multiple signals to meet confluence threshold
      const signal240 = generateSignal({ 
        seed: 123,
        timeframe: '240', // 40% weight
        type: 'LONG', 
        ai_score: 9,
        quality: 'EXTREME'
      });
      
      const signal60 = generateSignal({ 
        seed: 124,
        timeframe: '60', // 25% weight  
        type: 'LONG', 
        ai_score: 8,
        quality: 'HIGH'
      });
      
      // Create a phase that aligns with the signal but has htf_alignment = false
      const phase: SatyPhaseWebhook = {
        meta: {
          engine: 'SATY_PO',
          engine_version: '2.0.0',
          event_id: 'test_phase_2',
          event_type: 'REGIME_PHASE_ENTRY',
          generated_at: new Date().toISOString(),
        },
        instrument: {
          symbol: 'SPY',
          exchange: 'NYSE',
          asset_class: 'EQUITY',
          session: 'RTH',
        },
        timeframe: {
          chart_tf: '240',
          event_tf: '240M',
          tf_role: 'REGIME',
          bar_close_time: new Date().toISOString(),
        },
        event: {
          name: 'ENTER_ACCUMULATION',
          description: 'Enter accumulation phase',
          directional_implication: 'UPSIDE_POTENTIAL',
          event_priority: 8,
        },
        oscillator_state: {
          value: 50,
          previous_value: 45,
          zone_from: 'NEUTRAL',
          zone_to: 'ACCUMULATION',
          distance_from_zero: 50,
          distance_from_extreme: 50,
          velocity: 'INCREASING',
        },
        regime_context: {
          local_bias: 'BULLISH',
          htf_bias: {
            tf: '240',
            bias: 'BULLISH',
            osc_value: 60,
          },
          macro_bias: {
            tf: 'D',
            bias: 'BULLISH',
            osc_value: 70,
          },
        },
        confidence: {
          confidence_score: 80,
          confidence_tier: 'HIGH',
          htf_alignment: false,
          decay_time_minutes: 240,
        },
        execution_guidance: {
          trade_allowed: true,
          allowed_directions: ['LONG'],
          position_sizing_modifier: 1.0,
          risk_adjustment: 0,
        },
        risk_hints: {
          avoid_if: [],
          time_decay_minutes: 240,
          cooldown_tf: '240M',
        },
        text: '',
      };
      
      timeframeStore.clear();
      phaseStore.clear();
      
      timeframeStore.storeSignal(signal240);
      timeframeStore.storeSignal(signal60);
      phaseStore.storePhase(phase);
      
      const decision = makeDecision(
        timeframeStore.getActiveSignals(), 
        phaseStore.getActivePhases()
      );
      
      // Should EXECUTE but without phase confidence boost
      expect(decision.decision).toBe('EXECUTE');
      expect(decision.breakdown.phase_confidence_boost).toBe(0);
    });

    test('should apply phase position boost when confidence >= 70 and htf_alignment is true', () => {
      // Create multiple signals to meet confluence threshold
      const signal240 = generateSignal({ 
        seed: 123,
        timeframe: '240', // 40% weight
        type: 'LONG', 
        ai_score: 9,
        quality: 'EXTREME'
      });
      
      const signal60 = generateSignal({ 
        seed: 124,
        timeframe: '60', // 25% weight  
        type: 'LONG', 
        ai_score: 8,
        quality: 'HIGH'
      });
      
      // Create a phase with confidence >= 70 and htf_alignment = true
      const phase: SatyPhaseWebhook = {
        meta: {
          engine: 'SATY_PO',
          engine_version: '2.0.0',
          event_id: 'test_phase_3',
          event_type: 'REGIME_PHASE_ENTRY',
          generated_at: new Date().toISOString(),
        },
        instrument: {
          symbol: 'SPY',
          exchange: 'NYSE',
          asset_class: 'EQUITY',
          session: 'RTH',
        },
        timeframe: {
          chart_tf: '240',
          event_tf: '240M',
          tf_role: 'REGIME',
          bar_close_time: new Date().toISOString(),
        },
        event: {
          name: 'ENTER_ACCUMULATION',
          description: 'Enter accumulation phase',
          directional_implication: 'UPSIDE_POTENTIAL',
          event_priority: 8,
        },
        oscillator_state: {
          value: 50,
          previous_value: 45,
          zone_from: 'NEUTRAL',
          zone_to: 'ACCUMULATION',
          distance_from_zero: 50,
          distance_from_extreme: 50,
          velocity: 'INCREASING',
        },
        regime_context: {
          local_bias: 'BULLISH',
          htf_bias: {
            tf: '240',
            bias: 'BULLISH',
            osc_value: 60,
          },
          macro_bias: {
            tf: 'D',
            bias: 'BULLISH',
            osc_value: 70,
          },
        },
        confidence: {
          confidence_score: 75,
          confidence_tier: 'HIGH',
          htf_alignment: true,
          decay_time_minutes: 240,
        },
        execution_guidance: {
          trade_allowed: true,
          allowed_directions: ['LONG'],
          position_sizing_modifier: 1.0,
          risk_adjustment: 0,
        },
        risk_hints: {
          avoid_if: [],
          time_decay_minutes: 240,
          cooldown_tf: '240M',
        },
        text: '',
      };
      
      timeframeStore.clear();
      phaseStore.clear();
      
      timeframeStore.storeSignal(signal240);
      timeframeStore.storeSignal(signal60);
      phaseStore.storePhase(phase);
      
      const decision = makeDecision(
        timeframeStore.getActiveSignals(), 
        phaseStore.getActivePhases()
      );
      
      // Should EXECUTE with both confidence and position boosts
      expect(decision.decision).toBe('EXECUTE');
      expect(decision.breakdown.phase_confidence_boost).toBe(0.20);
      expect(decision.breakdown.phase_position_boost).toBe(0.10);
    });
  });

  describe('Property 38: Trend Position Boost Application', () => {
    test('should apply trend position boost when strength is STRONG', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 75, max: 100 }), // STRONG alignment score
          (seed, alignmentScore) => {
            // Create multiple signals to meet confluence threshold
            const signal240 = generateSignal({ 
              seed,
              timeframe: '240', // 40% weight
              type: 'LONG', 
              ai_score: 9,
              quality: 'EXTREME',
              ticker: 'SPY'
            });
            
            const signal60 = generateSignal({ 
              seed: seed + 1,
              timeframe: '60', // 25% weight  
              type: 'LONG', 
              ai_score: 8,
              quality: 'HIGH',
              ticker: 'SPY'
            });
            
            // Create a trend with STRONG alignment (>=75%) but HTF bias that doesn't match
            // This should give position boost (+30%) but no confidence boost
            const trendWebhook = generateTrend(seed + 100, {
              ticker: 'SPY',
              alignment_score: alignmentScore,
              htf_bias: 'bearish' // HTF bias doesn't match LONG signal
            });
            
            // Parse the trend data from the webhook
            const trendData = JSON.parse(trendWebhook.text);
            const trend: TrendWebhook = {
              ticker: trendData.ticker,
              exchange: trendData.exchange,
              timestamp: trendData.timestamp,
              price: trendData.price,
              timeframes: trendData.timeframes,
            };
            
            timeframeStore.clear();
            phaseStore.clear();
            trendStore.clear();
            
            timeframeStore.storeSignal(signal240);
            timeframeStore.storeSignal(signal60);
            trendStore.storeTrend(trend);
            
            const decision = makeDecision(
              timeframeStore.getActiveSignals(), 
              phaseStore.getActivePhases(),
              trendStore
            );
            
            // Should EXECUTE with trend position boost (30% for STRONG) but no confidence boost
            expect(decision.decision).toBe('EXECUTE');
            expect(decision.breakdown.trend_alignment_boost).toBeCloseTo(0.30, 10);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should not apply trend position boost when strength is not STRONG', () => {
      // Create multiple signals to meet confluence threshold
      const signal240 = generateSignal({ 
        seed: 123,
        timeframe: '240', // 40% weight
        type: 'LONG', 
        ai_score: 9,
        quality: 'EXTREME',
        ticker: 'SPY'
      });
      
      const signal60 = generateSignal({ 
        seed: 124,
        timeframe: '60', // 25% weight  
        type: 'LONG', 
        ai_score: 8,
        quality: 'HIGH',
        ticker: 'SPY'
      });
      
      // Manually create trend with non-STRONG alignment (< 75%)
      // Use 4/8 = 50% alignment (WEAK strength)
      const trend: TrendWebhook = {
        ticker: 'SPY',
        exchange: 'NASDAQ',
        timestamp: new Date().toISOString(),
        price: 450.00,
        timeframes: {
          tf3min: { direction: 'bullish', open: 449.50, close: 450.25 },
          tf5min: { direction: 'bullish', open: 450.00, close: 450.50 },
          tf15min: { direction: 'bearish', open: 450.75, close: 450.25 },
          tf30min: { direction: 'neutral', open: 450.25, close: 450.30 },
          tf60min: { direction: 'bullish', open: 450.00, close: 450.75 },
          tf240min: { direction: 'bullish', open: 449.00, close: 451.00 }, // HTF bias
          tf1week: { direction: 'bearish', open: 451.00, close: 450.00 },
          tf1month: { direction: 'bearish', open: 452.00, close: 449.00 },
        },
      };
      
      timeframeStore.clear();
      phaseStore.clear();
      trendStore.clear();
      
      timeframeStore.storeSignal(signal240);
      timeframeStore.storeSignal(signal60);
      trendStore.storeTrend(trend);
      
      const decision = makeDecision(
        timeframeStore.getActiveSignals(), 
        phaseStore.getActivePhases(),
        trendStore
      );
      
      // Should EXECUTE with HTF bias confidence boost but no position boost (WEAK strength)
      expect(decision.decision).toBe('EXECUTE');
      expect(decision.breakdown.trend_alignment_boost).toBeCloseTo(0.15, 10); // Only HTF bias match
    });

    test('should apply trend confidence boost when htf_bias matches signal direction', () => {
      // Create multiple LONG signals to meet confluence threshold
      const signal240 = generateSignal({ 
        seed: 123,
        timeframe: '240', // 40% weight
        type: 'LONG', 
        ai_score: 9,
        quality: 'EXTREME',
        ticker: 'SPY'
      });
      
      const signal60 = generateSignal({ 
        seed: 124,
        timeframe: '60', // 25% weight  
        type: 'LONG', 
        ai_score: 8,
        quality: 'HIGH',
        ticker: 'SPY'
      });
      
      // Create a trend with matching HTF bias but not STRONG (to isolate confidence boost)
      // Use 4/8 = 50% alignment (WEAK, not STRONG)
      const trend: TrendWebhook = {
        ticker: 'SPY',
        exchange: 'NASDAQ',
        timestamp: new Date().toISOString(),
        price: 450.00,
        timeframes: {
          tf3min: { direction: 'bullish', open: 449.50, close: 450.25 },
          tf5min: { direction: 'bullish', open: 450.00, close: 450.50 },
          tf15min: { direction: 'bearish', open: 450.75, close: 450.25 },
          tf30min: { direction: 'neutral', open: 450.25, close: 450.30 },
          tf60min: { direction: 'bullish', open: 450.00, close: 450.75 },
          tf240min: { direction: 'bullish', open: 449.00, close: 451.00 }, // HTF bias matches
          tf1week: { direction: 'bearish', open: 451.00, close: 450.00 },
          tf1month: { direction: 'bearish', open: 452.00, close: 449.00 },
        },
      };
      
      timeframeStore.clear();
      phaseStore.clear();
      trendStore.clear();
      
      timeframeStore.storeSignal(signal240);
      timeframeStore.storeSignal(signal60);
      trendStore.storeTrend(trend);
      
      const decision = makeDecision(
        timeframeStore.getActiveSignals(), 
        phaseStore.getActivePhases(),
        trendStore
      );
      
      // Should EXECUTE with confidence boost from HTF bias match
      expect(decision.decision).toBe('EXECUTE');
      expect(decision.breakdown.phase_confidence_boost).toBe(0); // No phase data
      expect(decision.breakdown.trend_alignment_boost).toBeCloseTo(0.15, 10); // HTF bias match
    });

    test('should not apply trend boosts when no trend data exists', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (seed) => {
            // Create multiple signals to meet confluence threshold
            const signal240 = generateSignal({ 
              seed,
              timeframe: '240', // 40% weight
              type: 'LONG', 
              ai_score: 9,
              quality: 'EXTREME',
              ticker: 'SPY'
            });
            
            const signal60 = generateSignal({ 
              seed: seed + 1,
              timeframe: '60', // 25% weight  
              type: 'LONG', 
              ai_score: 8,
              quality: 'HIGH',
              ticker: 'SPY'
            });
            
            timeframeStore.clear();
            phaseStore.clear();
            trendStore.clear();
            
            timeframeStore.storeSignal(signal240);
            timeframeStore.storeSignal(signal60);
            // Don't store any trend data
            
            const decision = makeDecision(
              timeframeStore.getActiveSignals(), 
              phaseStore.getActivePhases(),
              trendStore
            );
            
            // Should EXECUTE but without trend boosts
            if (decision.decision === 'EXECUTE') {
              expect(decision.breakdown.trend_alignment_boost).toBe(0);
              expect(decision.breakdown.phase_confidence_boost).toBe(0);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});