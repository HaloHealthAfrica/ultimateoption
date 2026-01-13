/**
 * Context Store Service Tests
 * 
 * Tests for context store functionality including partial updates,
 * completeness validation, expiration handling, and context building.
 */

import { ContextStoreService } from '../services/context-store.service';
import { DecisionContext, WebhookSource } from '../types';

describe('ContextStoreService', () => {
  let contextStore: ContextStoreService;

  beforeEach(() => {
    contextStore = new ContextStoreService();
  });

  describe('Constructor and Initial State', () => {
    it('should initialize with empty context', () => {
      expect(contextStore.isComplete()).toBe(false);
      expect(contextStore.build()).toBeNull();
      expect(contextStore.getLastUpdate('SATY_PHASE')).toBeNull();
    });

    it('should accept custom completeness rules', () => {
      const customStore = new ContextStoreService({
        requiredSources: ['MTF_DOTS'],
        maxAge: 10000
      });

      const stats = customStore.getCompletenessStats();
      expect(stats.requiredSources).toHaveLength(1);
      expect(stats.requiredSources[0].source).toBe('MTF_DOTS');
    });
  });

  describe('Context Updates', () => {
    it('should update regime context from SATY_PHASE', () => {
      const regimeData: Partial<DecisionContext> = {
        regime: {
          phase: 2,
          phaseName: 'MARKUP',
          volatility: 'NORMAL',
          confidence: 85,
          bias: 'LONG'
        },
        instrument: {
          symbol: 'SPY',
          exchange: 'ARCA',
          price: 450.25
        }
      };

      contextStore.update(regimeData, 'SATY_PHASE');

      expect(contextStore.getLastUpdate('SATY_PHASE')).toBeGreaterThan(0);
      
      const stats = contextStore.getCompletenessStats();
      expect(stats.requiredSources[0].available).toBe(true);
    });

    it('should update expert context from ULTIMATE_OPTIONS', () => {
      const expertData: Partial<DecisionContext> = {
        expert: {
          direction: 'LONG',
          aiScore: 8.5,
          quality: 'HIGH',
          components: ['RSI', 'MACD'],
          rr1: 2.5,
          rr2: 4.0
        },
        instrument: {
          symbol: 'SPY',
          exchange: 'ARCA',
          price: 450.50
        }
      };

      contextStore.update(expertData, 'ULTIMATE_OPTIONS');

      expect(contextStore.getLastUpdate('ULTIMATE_OPTIONS')).toBeGreaterThan(0);
    });

    it('should update alignment context from MTF_DOTS', () => {
      const alignmentData: Partial<DecisionContext> = {
        alignment: {
          tfStates: {
            tf3min: 'BULLISH',
            tf5min: 'BULLISH',
            tf15min: 'BEARISH'
          },
          bullishPct: 66.67,
          bearishPct: 33.33
        }
      };

      contextStore.update(alignmentData, 'MTF_DOTS');

      expect(contextStore.getLastUpdate('MTF_DOTS')).toBeGreaterThan(0);
    });

    it('should update structure context from STRAT_EXEC', () => {
      const structureData: Partial<DecisionContext> = {
        structure: {
          validSetup: true,
          liquidityOk: true,
          executionQuality: 'A'
        }
      };

      contextStore.update(structureData, 'STRAT_EXEC');

      expect(contextStore.getLastUpdate('STRAT_EXEC')).toBeGreaterThan(0);
    });

    it('should merge instrument data from multiple sources', () => {
      // First update with symbol and exchange
      contextStore.update({
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'SATY_PHASE');

      // Second update with new price
      contextStore.update({
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 451.25 }
      }, 'ULTIMATE_OPTIONS');

      const context = contextStore.build();
      // Should not be complete yet (missing required data), but instrument should be merged
      expect(context).toBeNull(); // Still incomplete
      
      // Add required data to make it complete
      contextStore.update({
        regime: {
          phase: 1,
          phaseName: 'ACCUMULATION',
          volatility: 'NORMAL',
          confidence: 75,
          bias: 'NEUTRAL'
        }
      }, 'SATY_PHASE');

      contextStore.update({
        expert: {
          direction: 'LONG',
          aiScore: 8.0,
          quality: 'HIGH',
          components: [],
          rr1: 2.0,
          rr2: 3.0
        }
      }, 'ULTIMATE_OPTIONS');

      const completeContext = contextStore.build();
      expect(completeContext?.instrument.price).toBe(451.25); // Latest price
      expect(completeContext?.instrument.symbol).toBe('SPY');
    });
  });

  describe('Context Completeness', () => {
    it('should not be complete with only one required source', () => {
      contextStore.update({
        regime: {
          phase: 1,
          phaseName: 'ACCUMULATION',
          volatility: 'NORMAL',
          confidence: 75,
          bias: 'NEUTRAL'
        },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'SATY_PHASE');

      expect(contextStore.isComplete()).toBe(false);
      expect(contextStore.build()).toBeNull();
    });

    it('should be complete with all required sources', () => {
      // Add SATY_PHASE data
      contextStore.update({
        regime: {
          phase: 1,
          phaseName: 'ACCUMULATION',
          volatility: 'NORMAL',
          confidence: 75,
          bias: 'NEUTRAL'
        },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'SATY_PHASE');

      // Add ULTIMATE_OPTIONS data
      contextStore.update({
        expert: {
          direction: 'LONG',
          aiScore: 8.0,
          quality: 'HIGH',
          components: [],
          rr1: 2.0,
          rr2: 3.0
        }
      }, 'ULTIMATE_OPTIONS');

      expect(contextStore.isComplete()).toBe(true);
      
      const context = contextStore.build();
      expect(context).not.toBeNull();
      expect(context?.regime.phase).toBe(1);
      expect(context?.expert.direction).toBe('LONG');
    });

    it('should include optional sources in completeness calculation', () => {
      // Add all required sources
      contextStore.update({
        regime: { phase: 1, phaseName: 'ACCUMULATION', volatility: 'NORMAL', confidence: 75, bias: 'NEUTRAL' },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'SATY_PHASE');

      contextStore.update({
        expert: { direction: 'LONG', aiScore: 8.0, quality: 'HIGH', components: [], rr1: 2.0, rr2: 3.0 }
      }, 'ULTIMATE_OPTIONS');

      let stats = contextStore.getCompletenessStats();
      expect(stats.overallCompleteness).toBe(0.4); // 2 out of 5 total sources

      // Add optional source
      contextStore.update({
        alignment: { tfStates: { tf5min: 'BULLISH' }, bullishPct: 100, bearishPct: 0 }
      }, 'MTF_DOTS');

      stats = contextStore.getCompletenessStats();
      expect(stats.overallCompleteness).toBe(0.6); // 3 out of 5 total sources
    });
  });

  describe('Context Building', () => {
    beforeEach(() => {
      // Set up complete context for building tests
      contextStore.update({
        regime: {
          phase: 2,
          phaseName: 'MARKUP',
          volatility: 'HIGH',
          confidence: 85,
          bias: 'LONG'
        },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 452.75 }
      }, 'SATY_PHASE');

      contextStore.update({
        expert: {
          direction: 'LONG',
          aiScore: 9.0,
          quality: 'EXTREME',
          components: ['RSI', 'MACD', 'Volume'],
          rr1: 3.0,
          rr2: 5.0
        }
      }, 'ULTIMATE_OPTIONS');
    });

    it('should build complete DecisionContext with all data', () => {
      const context = contextStore.build();

      expect(context).not.toBeNull();
      expect(context?.meta.engineVersion).toBe('2.5.0');
      expect(context?.meta.completeness).toBeGreaterThan(0);
      expect(context?.instrument.symbol).toBe('SPY');
      expect(context?.regime.phase).toBe(2);
      expect(context?.expert.direction).toBe('LONG');
    });

    it('should include default values for missing optional sections', () => {
      const context = contextStore.build();

      expect(context?.alignment).toEqual({
        tfStates: {},
        bullishPct: 50,
        bearishPct: 50
      });

      expect(context?.structure).toEqual({
        validSetup: false,
        liquidityOk: false,
        executionQuality: 'C'
      });
    });

    it('should use actual data when optional sections are provided', () => {
      contextStore.update({
        alignment: {
          tfStates: { tf5min: 'BULLISH', tf15min: 'BULLISH' },
          bullishPct: 100,
          bearishPct: 0
        }
      }, 'MTF_DOTS');

      contextStore.update({
        structure: {
          validSetup: true,
          liquidityOk: true,
          executionQuality: 'A'
        }
      }, 'STRAT_EXEC');

      const context = contextStore.build();

      expect(context?.alignment.bullishPct).toBe(100);
      expect(context?.structure.validSetup).toBe(true);
    });
  });

  describe('Context Expiration', () => {
    it('should detect expired sources', () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // Add data at time 1000000
      contextStore.update({
        regime: { phase: 1, phaseName: 'ACCUMULATION', volatility: 'NORMAL', confidence: 75, bias: 'NEUTRAL' },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'SATY_PHASE');

      expect(contextStore.isSourceExpired('SATY_PHASE')).toBe(false);

      // Move time forward by 6 minutes (beyond 5 minute expiration)
      mockTime += 6 * 60 * 1000;

      expect(contextStore.isSourceExpired('SATY_PHASE')).toBe(true);
      expect(contextStore.getExpiredSources()).toContain('SATY_PHASE');

      // Restore original Date.now
      Date.now = originalNow;
    });

    it('should not be complete when required sources are expired', () => {
      const originalNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // Add complete context
      contextStore.update({
        regime: { phase: 1, phaseName: 'ACCUMULATION', volatility: 'NORMAL', confidence: 75, bias: 'NEUTRAL' },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'SATY_PHASE');

      contextStore.update({
        expert: { direction: 'LONG', aiScore: 8.0, quality: 'HIGH', components: [], rr1: 2.0, rr2: 3.0 }
      }, 'ULTIMATE_OPTIONS');

      expect(contextStore.isComplete()).toBe(true);

      // Expire SATY_PHASE data
      mockTime += 6 * 60 * 1000;

      expect(contextStore.isComplete()).toBe(false);

      Date.now = originalNow;
    });

    it('should cleanup expired data', () => {
      const originalNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // Add data
      contextStore.update({
        regime: { phase: 1, phaseName: 'ACCUMULATION', volatility: 'NORMAL', confidence: 75, bias: 'NEUTRAL' }
      }, 'SATY_PHASE');

      contextStore.update({
        alignment: { tfStates: {}, bullishPct: 50, bearishPct: 50 }
      }, 'MTF_DOTS');

      expect(contextStore.getLastUpdate('SATY_PHASE')).not.toBeNull();
      expect(contextStore.getLastUpdate('MTF_DOTS')).not.toBeNull();

      // Expire data
      mockTime += 6 * 60 * 1000;

      contextStore.cleanupExpired();

      expect(contextStore.getLastUpdate('SATY_PHASE')).toBeNull();
      expect(contextStore.getLastUpdate('MTF_DOTS')).toBeNull();

      Date.now = originalNow;
    });
  });

  describe('Context Statistics', () => {
    it('should provide detailed completeness statistics', () => {
      contextStore.update({
        regime: { phase: 1, phaseName: 'ACCUMULATION', volatility: 'NORMAL', confidence: 75, bias: 'NEUTRAL' },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'SATY_PHASE');

      contextStore.update({
        alignment: { tfStates: {}, bullishPct: 50, bearishPct: 50 }
      }, 'MTF_DOTS');

      const stats = contextStore.getCompletenessStats();

      expect(stats.requiredSources).toHaveLength(1);
      expect(stats.optionalSources).toHaveLength(4);
      expect(stats.requiredSources[0].available).toBe(true); // SATY_PHASE
      expect(stats.optionalSources[0].available).toBe(true); // MTF_DOTS
      expect(stats.isComplete).toBe(false);
      expect(stats.overallCompleteness).toBe(0.4); // 2 out of 5 sources
    });

    it('should include age information in statistics', () => {
      contextStore.update({
        regime: { phase: 1, phaseName: 'ACCUMULATION', volatility: 'NORMAL', confidence: 75, bias: 'NEUTRAL' }
      }, 'SATY_PHASE');

      const stats = contextStore.getCompletenessStats();
      const satyStats = stats.requiredSources.find(s => s.source === 'SATY_PHASE');

      expect(satyStats?.available).toBe(true);
      expect(satyStats?.age).toBeGreaterThanOrEqual(0);
      expect(satyStats?.age).toBeLessThan(1000); // Should be very recent
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all context data', () => {
      // Add some data
      contextStore.update({
        regime: { phase: 1, phaseName: 'ACCUMULATION', volatility: 'NORMAL', confidence: 75, bias: 'NEUTRAL' },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'SATY_PHASE');

      expect(contextStore.getLastUpdate('SATY_PHASE')).not.toBeNull();

      contextStore.clear();

      expect(contextStore.getLastUpdate('SATY_PHASE')).toBeNull();
      expect(contextStore.isComplete()).toBe(false);
      expect(contextStore.build()).toBeNull();
    });
  });

  describe('Completeness Rules Updates', () => {
    it('should allow updating completeness rules', () => {
      contextStore.updateCompletenessRules({
        requiredSources: ['MTF_DOTS'],
        maxAge: 10000
      });

      // Add MTF_DOTS data
      contextStore.update({
        alignment: { tfStates: {}, bullishPct: 50, bearishPct: 50 },
        instrument: { symbol: 'SPY', exchange: 'ARCA', price: 450.00 }
      }, 'MTF_DOTS');

      // Add expert data (still required for completeness)
      contextStore.update({
        expert: { direction: 'LONG', aiScore: 8.0, quality: 'HIGH', components: [], rr1: 2.0, rr2: 4.0 }
      }, 'ULTIMATE_OPTIONS');

      // Should now be complete with MTF_DOTS and expert data
      expect(contextStore.isComplete()).toBe(true);
    });
  });
});