/**
 * Setup verification tests for Phase 2.5 Decision Engine
 * 
 * These tests verify that the basic project structure and types are working correctly.
 */

import fc from 'fast-check';
import { 
  ENGINE_VERSION,
  PHASE_RULES,
  DecisionContext,
  MarketContext,
  getConfluenceMultiplier,
  getRRMultiplier,
  clamp
} from '../types';
import { 
  PBT_CONFIG,
  createPropertyTag,
  decisionContextArb,
  marketContextArb,
  tradeDirectionArb
} from '../testing/setup';
import { DEFAULT_ENGINE_CONFIG, validateEngineConfig } from '../config/engine.config';

describe('Phase 2.5 Setup Verification', () => {
  
  describe('Constants and Configuration', () => {
    
    it('should have correct engine version', () => {
      expect(ENGINE_VERSION).toBe("2.5.0");
    });
    
    it('should have valid phase rules', () => {
      expect(PHASE_RULES[1].allowed).toContain("LONG");
      expect(PHASE_RULES[1].allowed).toContain("SHORT");
      expect(PHASE_RULES[2].allowed).toContain("LONG");
      expect(PHASE_RULES[2].allowed).not.toContain("SHORT");
      expect(PHASE_RULES[3].allowed).toHaveLength(0);
      expect(PHASE_RULES[4].allowed).toContain("SHORT");
    });
    
    it('should validate default configuration', () => {
      const errors = validateEngineConfig(DEFAULT_ENGINE_CONFIG);
      expect(errors).toHaveLength(0);
    });
    
  });
  
  describe('Utility Functions', () => {
    
    it('should calculate confluence multipliers correctly', () => {
      expect(getConfluenceMultiplier(95)).toBe(2.5);
      expect(getConfluenceMultiplier(85)).toBe(2.0);
      expect(getConfluenceMultiplier(75)).toBe(1.5);
      expect(getConfluenceMultiplier(65)).toBe(1.0);
      expect(getConfluenceMultiplier(55)).toBe(0.7);
      expect(getConfluenceMultiplier(45)).toBe(0.5);
    });
    
    it('should calculate R:R multipliers correctly', () => {
      expect(getRRMultiplier(5.5)).toBe(1.2);
      expect(getRRMultiplier(4.5)).toBe(1.15);
      expect(getRRMultiplier(3.5)).toBe(1.1);
      expect(getRRMultiplier(2.5)).toBe(1.0);
      expect(getRRMultiplier(1.8)).toBe(0.85);
      expect(getRRMultiplier(1.0)).toBe(0.5);
    });
    
    it('should clamp values correctly', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
    
  });
  
  describe('Property-Based Testing Setup', () => {
    
    it('should create proper property tags', () => {
      const tag = createPropertyTag(1, "Test property");
      expect(tag).toBe("Feature: decision-engine-phase25, Property 1: Test property");
    });
    
    it('should generate valid DecisionContext objects', () => {
      fc.assert(
        fc.property(decisionContextArb(), (context: DecisionContext) => {
          // Verify structure
          expect(context.meta).toBeDefined();
          expect(context.instrument).toBeDefined();
          expect(context.regime).toBeDefined();
          expect(context.alignment).toBeDefined();
          expect(context.expert).toBeDefined();
          expect(context.structure).toBeDefined();
          
          // Verify constraints
          expect(context.meta.engineVersion).toBe("2.5.0");
          expect(context.meta.completeness).toBeGreaterThanOrEqual(0);
          expect(context.meta.completeness).toBeLessThanOrEqual(1);
          expect(context.regime.confidence).toBeGreaterThanOrEqual(0);
          expect(context.regime.confidence).toBeLessThanOrEqual(100);
          expect(context.expert.aiScore).toBeGreaterThanOrEqual(0);
          expect(context.expert.aiScore).toBeLessThanOrEqual(10.5);
          
          return true;
        }),
        { numRuns: PBT_CONFIG.numRuns }
      );
    });
    
    it('should generate valid MarketContext objects', () => {
      fc.assert(
        fc.property(marketContextArb(), (context: MarketContext) => {
          // Verify structure
          expect(context.fetchTime).toBeDefined();
          expect(context.completeness).toBeGreaterThanOrEqual(0);
          expect(context.completeness).toBeLessThanOrEqual(1);
          expect(Array.isArray(context.errors)).toBe(true);
          
          // Verify optional fields constraints
          if (context.options) {
            expect(context.options.putCallRatio).toBeGreaterThan(0);
            expect(context.options.ivPercentile).toBeGreaterThanOrEqual(0);
            expect(context.options.ivPercentile).toBeLessThanOrEqual(100);
          }
          
          if (context.stats) {
            expect(context.stats.atr14).toBeGreaterThan(0);
            expect(context.stats.trendSlope).toBeGreaterThanOrEqual(-1);
            expect(context.stats.trendSlope).toBeLessThanOrEqual(1);
          }
          
          if (context.liquidity) {
            expect(context.liquidity.spreadBps).toBeGreaterThan(0);
            expect(context.liquidity.depthScore).toBeGreaterThanOrEqual(0);
            expect(context.liquidity.depthScore).toBeLessThanOrEqual(100);
          }
          
          return true;
        }),
        { numRuns: PBT_CONFIG.numRuns }
      );
    });
    
  });
  
  describe('[PBT] Basic Property Tests', () => {
    
    it(createPropertyTag(0, "Clamp function bounds enforcement"), () => {
      fc.assert(
        fc.property(
          fc.float().filter(x => !isNaN(x)),
          fc.float().filter(x => !isNaN(x)),
          fc.float().filter(x => !isNaN(x)),
          (value: number, min: number, max: number) => {
            // Ensure min <= max for valid test
            if (min > max) [min, max] = [max, min];
            
            const result = clamp(value, min, max);
            return result >= min && result <= max && !isNaN(result);
          }
        ),
        { numRuns: PBT_CONFIG.numRuns }
      );
    });
    
  });
  
});