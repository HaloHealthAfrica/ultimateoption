/**
 * Property Tests for SATY Phase Store
 * Tests TTL enforcement and regime context alignment
 * 
 * Requirements: 18.7, 25.1, 25.2
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { PhaseStore } from './phaseStore';
import { SatyPhaseWebhook } from '../../types/saty';

// Test data generators
const generatePhase = (
  symbol: string = 'SPY',
  timeframe: string = '4H',
  decayMinutes: number = 60,
  localBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'BULLISH'
): SatyPhaseWebhook => ({
  meta: {
    engine: 'SATY_PO',
    engine_version: '1.0.0',
    event_id: `test-${Date.now()}-${Math.random()}`,
    event_type: 'REGIME_PHASE_EXIT',
    generated_at: new Date().toISOString(),
  },
  instrument: {
    symbol,
    exchange: 'NASDAQ',
    asset_class: 'EQUITY',
    session: 'REGULAR',
  },
  timeframe: {
    chart_tf: timeframe,
    event_tf: timeframe,
    tf_role: 'REGIME',
    bar_close_time: new Date().toISOString(),
  },
  event: {
    name: 'EXIT_ACCUMULATION',
    description: 'Test phase event',
    directional_implication: 'UPSIDE_POTENTIAL',
    event_priority: 5,
  },
  oscillator_state: {
    value: 0.5,
    previous_value: 0.3,
    zone_from: 'ACCUMULATION',
    zone_to: 'NEUTRAL',
    distance_from_zero: 0.5,
    distance_from_extreme: 0.3,
    velocity: 'INCREASING',
  },
  regime_context: {
    local_bias: localBias,
    htf_bias: {
      tf: '1D',
      bias: 'BULLISH',
      osc_value: 0.7,
    },
    macro_bias: {
      tf: '1W',
      bias: 'BULLISH',
    },
  },
  market_structure: {
    mean_reversion_phase: 'EXPANSION',
    trend_phase: 'TRENDING',
    is_counter_trend: false,
    compression_state: 'NORMAL',
  },
  confidence: {
    raw_strength: 75,
    htf_alignment: true,
    confidence_score: 80,
    confidence_tier: 'HIGH',
  },
  execution_guidance: {
    trade_allowed: true,
    allowed_directions: ['LONG'],
    recommended_execution_tf: ['15M', '30M'],
    requires_confirmation: [],
  },
  risk_hints: {
    avoid_if: [],
    time_decay_minutes: decayMinutes,
    cooldown_tf: '1H',
  },
  audit: {
    source: 'test',
    alert_frequency: 'ONCE',
    deduplication_key: 'test-key',
  },
});

describe('PhaseStore Property Tests', () => {
  let store: PhaseStore;
  
  beforeEach(() => {
    // Create a fresh instance for each test to avoid singleton issues
    store = PhaseStore.createInstance();
  });
  
  afterEach(() => {
    // Clean up after each test
    store.clear();
  });
  
  /**
   * Property 36: Phase Store TTL Enforcement
   * Validates: Requirements 18.7, 25.1
   */
  describe('Property 36: Phase Store TTL Enforcement', () => {
    it('should enforce TTL correctly for all phases', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              symbol: fc.constantFrom('SPY', 'QQQ', 'AAPL'),
              timeframe: fc.constantFrom('15M', '1H', '4H', '1D'),
              decayMinutes: fc.integer({ min: 1, max: 120 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (phaseConfigs) => {
            // Remove duplicates by symbol:timeframe (keep last)
            const uniqueConfigs = phaseConfigs.reduce((acc, config) => {
              const key = `${config.symbol}:${config.timeframe}`;
              acc[key] = config;
              return acc;
            }, {} as Record<string, typeof phaseConfigs[0]>);
            
            const configArray = Object.values(uniqueConfigs);
            
            // Store phases with different TTLs
            const storedPhases = configArray.map(config => {
              const phase = generatePhase(
                config.symbol,
                config.timeframe,
                config.decayMinutes
              );
              store.updatePhase(phase);
              return { phase, config };
            });
            
            // All phases should be active immediately
            storedPhases.forEach(({ phase, config }) => {
              const retrieved = store.getPhase(config.symbol, config.timeframe);
              expect(retrieved).not.toBeNull();
              expect(retrieved?.meta.event_id).toBe(phase.meta.event_id);
            });
            
            // Test expiry by manually setting expires_at in the past
            const now = Date.now();
            storedPhases.forEach(({ config }) => {
              const key = `${config.symbol}:${config.timeframe}`;
              const stored = (store as any).phases.get(key);
              if (stored && config.decayMinutes <= 2) {
                // Set expiry to past for short TTL phases
                stored.expires_at = now - 1000;
              }
            });
            
            // Check that expired phases return null
            storedPhases.forEach(({ config }) => {
              const retrieved = store.getPhase(config.symbol, config.timeframe);
              if (config.decayMinutes <= 2) {
                expect(retrieved).toBeNull();
              } else {
                expect(retrieved).not.toBeNull();
              }
            });
          }
        ),
        { numRuns: 10, verbose: false }
      );
    });
  });
  
  /**
   * Property 37: Regime Context Alignment
   * Validates: Requirements 25.2
   */
  describe('Property 37: Regime Context Alignment', () => {
    it('should correctly calculate regime alignment', () => {
      fc.assert(
        fc.property(
          fc.record({
            symbol: fc.constantFrom('SPY', 'QQQ'),
            phases: fc.array(
              fc.record({
                timeframe: fc.constantFrom('15M', '1H', '4H', '1D'),
                bias: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL'),
              }),
              { minLength: 0, maxLength: 4 }
            ),
          }),
          ({ symbol, phases }) => {
            // Ensure clean state
            store.clear();
            
            // Remove duplicates by timeframe (keep last)
            const uniquePhases = phases.reduce((acc, phase) => {
              acc[phase.timeframe] = phase;
              return acc;
            }, {} as Record<string, { timeframe: string; bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' }>);
            
            const phaseArray = Object.values(uniquePhases);
            
            // Store phases
            phaseArray.forEach(({ timeframe, bias }) => {
              const phase = generatePhase(symbol, timeframe, 120, bias);
              store.updatePhase(phase);
            });
            
            // Get regime context
            const context = store.getRegimeContext(symbol);
            
            // Verify active count
            expect(context.active_count).toBe(phaseArray.length);
            
            // Verify alignment calculation
            if (phaseArray.length >= 2) {
              const biasCount: Record<string, number> = {};
              phaseArray.forEach(({ bias }) => {
                biasCount[bias] = (biasCount[bias] || 0) + 1;
              });
              
              const hasAlignedBias = Object.values(biasCount).some(count => count >= 2);
              expect(context.is_aligned).toBe(hasAlignedBias);
            } else {
              expect(context.is_aligned).toBe(false);
            }
            
            // Verify phase assignments
            const expectedPhases = {
              setup_phase: phaseArray.find(p => p.timeframe === '15M'),
              bias_phase: phaseArray.find(p => p.timeframe === '1H'),
              regime_phase: phaseArray.find(p => p.timeframe === '4H'),
              structural_phase: phaseArray.find(p => p.timeframe === '1D'),
            };
            
            Object.entries(expectedPhases).forEach(([role, expected]) => {
              const contextPhase = context[role as keyof typeof context];
              if (expected) {
                expect(contextPhase).not.toBeNull();
                expect((contextPhase as SatyPhaseWebhook)?.regime_context.local_bias).toBe(expected.bias);
              } else {
                expect(contextPhase).toBeNull();
              }
            });
            
            // Clean up after test
            store.clear();
          }
        ),
        { numRuns: 10, verbose: false }
      );
    });
  });
  
  describe('Basic functionality tests', () => {
    it('should store and retrieve phases correctly', () => {
      const phase = generatePhase('SPY', '4H', 60);
      store.updatePhase(phase);
      
      const retrieved = store.getPhase('SPY', '4H');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.meta.event_id).toBe(phase.meta.event_id);
      
      // Clean up
      store.clear();
    });
    
    it('should return null for non-existent phases', () => {
      const retrieved = store.getPhase('NONEXISTENT', '4H');
      expect(retrieved).toBeNull();
    });
    
    it('should handle multiple symbols independently', () => {
      const spyPhase = generatePhase('SPY', '4H', 60, 'BULLISH');
      const qqqPhase = generatePhase('QQQ', '4H', 60, 'BEARISH');
      
      store.updatePhase(spyPhase);
      store.updatePhase(qqqPhase);
      
      const spyContext = store.getRegimeContext('SPY');
      const qqqContext = store.getRegimeContext('QQQ');
      
      expect(spyContext.regime_phase?.regime_context.local_bias).toBe('BULLISH');
      expect(qqqContext.regime_phase?.regime_context.local_bias).toBe('BEARISH');
      
      // Clean up
      store.clear();
    });
  });
});