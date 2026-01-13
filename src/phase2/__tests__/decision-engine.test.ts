/**
 * Phase 2 Decision Engine - Core Decision Engine Tests
 * 
 * Comprehensive tests for the deterministic decision engine including
 * property-based testing for universal correctness properties.
 */

import fc from 'fast-check';
import { DecisionEngine } from '../engine/decision-engine';
import { MarketContext, SignalType, MarketSession, GammaBias, ENGINE_VERSION, DecisionContext } from '../types';
import { GATE_THRESHOLDS, CONFIDENCE_BOOSTS } from '../constants/gates';

// Test data generators
const createBaseContext = (): DecisionContext => ({
  indicator: {
    signalType: 'LONG' as SignalType,
    aiScore: 5.0,
    satyPhase: 75,
    marketSession: 'OPEN' as MarketSession,
    symbol: 'SPY',
    timestamp: Date.now()
  }
});

const createMarketContext = (overrides: Partial<MarketContext> = {}): MarketContext => ({
  optionsData: {
    putCallRatio: 1.0,
    ivPercentile: 50,
    gammaBias: 'NEUTRAL' as GammaBias,
    dataSource: 'API',
    ...overrides.optionsData
  },
  marketStats: {
    atr14: 1.0,
    rv20: 1.0,
    trendSlope: 0.1,
    dataSource: 'API',
    ...overrides.marketStats
  },
  liquidityData: {
    spreadBps: 8,
    depthScore: 75,
    tradeVelocity: 'NORMAL',
    dataSource: 'API',
    ...overrides.liquidityData
  }
});

const createValidContext = (): DecisionContext => {
  const context = createBaseContext();
  context.market = createMarketContext({
    liquidityData: { spreadBps: 8, depthScore: 75, tradeVelocity: 'NORMAL', dataSource: 'API' },
    marketStats: { atr14: 1.0, rv20: 1.0, trendSlope: 0.1, dataSource: 'API' },
    optionsData: { putCallRatio: 1.0, ivPercentile: 50, gammaBias: 'NEUTRAL', dataSource: 'API' }
  });
  return context;
};

describe('DecisionEngine', () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine();
  });

  describe('Basic Decision Logic', () => {
    test('should APPROVE when all gates pass', () => {
      const context = createValidContext();
      
      const result = engine.makeDecision(context);

      expect(result.decision).toBe('APPROVE');
      expect(result.direction).toBe('LONG');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.gates.failed).toHaveLength(0);
      expect(result.gates.passed).toHaveLength(5);
      expect(result.reasons).toBeUndefined();
    });

    test('should REJECT when spread gate fails', () => {
      const context = createValidContext();
      context.market!.liquidityData.spreadBps = 15; // Exceeds 12 bps threshold

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('REJECT');
      expect(result.direction).toBeUndefined();
      expect(result.confidence).toBeUndefined();
      expect(result.gates.failed).toContain('SPREAD_GATE');
      expect(result.reasons).toContain('SPREAD_TOO_WIDE');
    });

    test('should REJECT when volatility gate fails', () => {
      const context = createValidContext();
      context.market!.marketStats.atr14 = 3.0; // Creates ratio > 2.0
      context.market!.marketStats.rv20 = 1.0;

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('REJECT');
      expect(result.gates.failed).toContain('VOLATILITY_GATE');
      expect(result.reasons).toContain('VOLATILITY_SPIKE');
    });

    test('should REJECT when gamma gate fails', () => {
      const context = createValidContext();
      context.indicator.signalType = 'LONG';
      context.market!.optionsData.gammaBias = 'NEGATIVE'; // Opposes LONG signal

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('REJECT');
      expect(result.gates.failed).toContain('GAMMA_GATE');
      expect(result.reasons).toContain('GAMMA_HEADWIND');
    });

    test('should REJECT when phase gate fails', () => {
      const context = createValidContext();
      context.indicator.satyPhase = 50; // Below 65 threshold

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('REJECT');
      expect(result.gates.failed).toContain('PHASE_GATE');
      expect(result.reasons).toContain('PHASE_CONFIDENCE_LOW');
    });

    test('should REJECT when session gate fails', () => {
      const context = createValidContext();
      context.indicator.marketSession = 'AFTERHOURS';

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('REJECT');
      expect(result.gates.failed).toContain('SESSION_GATE');
      expect(result.reasons).toContain('AFTERHOURS_BLOCKED');
    });

    test('should REJECT when multiple gates fail', () => {
      const context = createValidContext();
      context.market!.liquidityData.spreadBps = 15; // Spread gate fails
      context.indicator.marketSession = 'AFTERHOURS'; // Session gate fails

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('REJECT');
      expect(result.gates.failed).toHaveLength(2);
      expect(result.gates.failed).toContain('SPREAD_GATE');
      expect(result.gates.failed).toContain('SESSION_GATE');
      expect(result.reasons).toHaveLength(2);
    });
  });

  describe('Confidence Calculation', () => {
    test('should calculate base confidence from aiScore', () => {
      const context = createValidContext();
      context.indicator.aiScore = 7.5;

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('APPROVE');
      expect(result.confidence).toBe(7.5);
    });

    test('should apply satyPhase boost for strong phase alignment', () => {
      const context = createValidContext();
      context.indicator.aiScore = 7.0;
      context.indicator.satyPhase = 85; // >= 80 threshold

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('APPROVE');
      expect(result.confidence).toBe(7.5); // 7.0 + 0.5 boost
    });

    test('should apply satyPhase boost for negative strong phase alignment', () => {
      const context = createValidContext();
      context.indicator.aiScore = 6.0;
      context.indicator.satyPhase = -90; // |−90| >= 80 threshold

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('APPROVE');
      expect(result.confidence).toBe(6.5); // 6.0 + 0.5 boost
    });

    test('should apply spread boost for tight spreads', () => {
      const context = createValidContext();
      context.indicator.aiScore = 6.0;
      context.market!.liquidityData.spreadBps = 4; // <= 5 threshold

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('APPROVE');
      expect(result.confidence).toBe(6.3); // 6.0 + 0.3 boost
    });

    test('should apply both boosts when conditions are met', () => {
      const context = createValidContext();
      context.indicator.aiScore = 6.0;
      context.indicator.satyPhase = 85; // Phase boost
      context.market!.liquidityData.spreadBps = 3; // Spread boost

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('APPROVE');
      expect(result.confidence).toBe(6.8); // 6.0 + 0.5 + 0.3
    });

    test('should cap confidence at 10.0 maximum', () => {
      const context = createValidContext();
      context.indicator.aiScore = 10.0;
      context.indicator.satyPhase = 85; // Would add 0.5
      context.market!.liquidityData.spreadBps = 3; // Would add 0.3

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('APPROVE');
      expect(result.confidence).toBe(10.0); // Capped at maximum
    });

    test('should ensure non-negative confidence', () => {
      const context = createValidContext();
      context.indicator.aiScore = 0; // Minimum aiScore

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('APPROVE');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Audit Trail', () => {
    test('should include complete audit trail', () => {
      const context = createValidContext();
      
      const result = engine.makeDecision(context);

      expect(result.audit).toBeDefined();
      expect(result.audit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.audit.symbol).toBe('SPY');
      expect(result.audit.session).toBe('OPEN');
      expect(result.audit.context_snapshot).toEqual(context);
      expect(result.audit.gate_results).toHaveLength(5);
      expect(result.audit.processing_time_ms).toBeGreaterThan(0);
    });

    test('should capture all gate results in audit trail', () => {
      const context = createValidContext();
      
      const result = engine.makeDecision(context);

      const gateNames = result.audit.gate_results.map(r => r.gate);
      expect(gateNames).toContain('SPREAD_GATE');
      expect(gateNames).toContain('VOLATILITY_GATE');
      expect(gateNames).toContain('GAMMA_GATE');
      expect(gateNames).toContain('PHASE_GATE');
      expect(gateNames).toContain('SESSION_GATE');
    });

    test('should record processing time', () => {
      const context = createValidContext();
      
      const result = engine.makeDecision(context);

      expect(result.audit.processing_time_ms).toBeGreaterThan(0);
      expect(result.audit.processing_time_ms).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Engine Metadata', () => {
    test('should stamp decisions with engine version', () => {
      const context = createValidContext();
      
      const result = engine.makeDecision(context);

      expect(result.engine_version).toBe(ENGINE_VERSION);
    });

    test('should provide engine info', () => {
      const info = engine.getEngineInfo();

      expect(info.version).toBe(ENGINE_VERSION);
      expect(info.gates).toHaveLength(5);
      expect(info.deterministic).toBe(true);
      expect(info.learning_enabled).toBe(false);
    });
  });

  describe('Property Tests', () => {
    test('Property 8: Deterministic Decision Making', () => {
      fc.assert(fc.property(
        fc.float({ min: 0, max: 10.5, noNaN: true }), // aiScore
        fc.integer({ min: -100, max: 100 }), // satyPhase
        fc.constantFrom('OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS'), // session
        fc.constantFrom('LONG', 'SHORT'), // signalType
        fc.float({ min: 0, max: 50, noNaN: true }), // spreadBps
        (aiScore, satyPhase, session, signalType, spreadBps) => {
          const context1 = createBaseContext();
          context1.indicator.aiScore = aiScore;
          context1.indicator.satyPhase = satyPhase;
          context1.indicator.marketSession = session as MarketSession;
          context1.indicator.signalType = signalType as SignalType;
          context1.market = createMarketContext({
            liquidityData: { spreadBps, depthScore: 75, tradeVelocity: 'NORMAL', dataSource: 'API' }
          });

          const context2 = JSON.parse(JSON.stringify(context1)); // Deep clone

          const result1 = engine.makeDecision(context1);
          const result2 = engine.makeDecision(context2);

          // Property: Same input produces identical results (excluding timestamps)
          expect(result1.decision).toBe(result2.decision);
          expect(result1.direction).toBe(result2.direction);
          expect(result1.confidence).toBe(result2.confidence);
          expect(result1.engine_version).toBe(result2.engine_version);
          expect(result1.gates).toEqual(result2.gates);
          expect(result1.reasons).toEqual(result2.reasons);
          
          // Audit trails should be identical except for timestamps
          expect(result1.audit.symbol).toBe(result2.audit.symbol);
          expect(result1.audit.session).toBe(result2.audit.session);
          expect(result1.audit.gate_results).toEqual(result2.audit.gate_results);
        }
      ));
    });

    test('Property 9: Gate Evaluation Completeness', () => {
      fc.assert(fc.property(
        fc.float({ min: 0, max: 10.5, noNaN: true }), // aiScore
        fc.integer({ min: -100, max: 100 }), // satyPhase
        (aiScore, satyPhase) => {
          const context = createValidContext();
          context.indicator.aiScore = aiScore;
          context.indicator.satyPhase = satyPhase;

          const result = engine.makeDecision(context);

          // Property: ALL gates are evaluated
          expect(result.audit.gate_results).toHaveLength(5);
          
          // Property: All gate results have required fields
          result.audit.gate_results.forEach(gateResult => {
            expect(gateResult).toHaveProperty('gate');
            expect(gateResult).toHaveProperty('passed');
            expect(typeof gateResult.passed).toBe('boolean');
          });

          // Property: Passed + failed gates = total gates
          const totalGates = result.gates.passed.length + result.gates.failed.length;
          expect(totalGates).toBe(5);
        }
      ));
    });

    test('Property 10: Confidence Calculation Bounds', () => {
      fc.assert(fc.property(
        fc.float({ min: 0, max: 10.5, noNaN: true }), // aiScore
        fc.integer({ min: -100, max: 100 }), // satyPhase
        fc.float({ min: 0, max: 20, noNaN: true }), // spreadBps
        (aiScore, satyPhase, spreadBps) => {
          const context = createValidContext();
          context.indicator.aiScore = aiScore;
          context.indicator.satyPhase = satyPhase;
          context.market!.liquidityData.spreadBps = spreadBps;

          const result = engine.makeDecision(context);

          if (result.decision === 'APPROVE') {
            // Property: Confidence is always between 0 and 10
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(10.0);
            
            // Property: Confidence is a finite number
            expect(Number.isFinite(result.confidence)).toBe(true);
          } else {
            // Property: REJECT decisions have undefined confidence
            expect(result.confidence).toBeUndefined();
          }
        }
      ));
    });

    test('Property: Engine Version Consistency', () => {
      fc.assert(fc.property(
        fc.float({ min: 0, max: 10.5, noNaN: true }), // aiScore
        (aiScore) => {
          const context = createValidContext();
          context.indicator.aiScore = aiScore;

          const result = engine.makeDecision(context);

          // Property: All decisions have consistent engine version
          expect(result.engine_version).toBe(ENGINE_VERSION);
          expect(typeof result.engine_version).toBe('string');
          expect(result.engine_version.length).toBeGreaterThan(0);
        }
      ));
    });

    test('Property: Audit Trail Completeness', () => {
      fc.assert(fc.property(
        fc.float({ min: 0, max: 10.5, noNaN: true }), // aiScore
        fc.string({ minLength: 1, maxLength: 10 }), // symbol
        (aiScore, symbol) => {
          const context = createValidContext();
          context.indicator.aiScore = aiScore;
          context.indicator.symbol = symbol.toUpperCase();

          const result = engine.makeDecision(context);

          // Property: Audit trail is always complete
          expect(result.audit).toBeDefined();
          expect(result.audit.timestamp).toBeDefined();
          expect(result.audit.symbol).toBe(symbol.toUpperCase());
          expect(result.audit.session).toBeDefined();
          expect(result.audit.context_snapshot).toBeDefined();
          expect(result.audit.gate_results).toHaveLength(5);
          expect(result.audit.processing_time_ms).toBeGreaterThanOrEqual(0.01);
        }
      ));
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing market context gracefully', () => {
      const context = createBaseContext();
      // No market context provided

      const result = engine.makeDecision(context);

      expect(result.decision).toBe('REJECT'); // Should fail due to fallback values
      expect(result.audit).toBeDefined();
      expect(result.audit.gate_results).toHaveLength(5);
    });

    test('should handle extreme aiScore values', () => {
      const context = createValidContext();
      context.indicator.aiScore = 10.5; // Maximum allowed

      const result = engine.makeDecision(context);

      if (result.decision === 'APPROVE') {
        expect(result.confidence).toBeLessThanOrEqual(10.0);
      }
    });

    test('should handle zero aiScore', () => {
      const context = createValidContext();
      context.indicator.aiScore = 0;

      const result = engine.makeDecision(context);

      if (result.decision === 'APPROVE') {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      }
    });

    test('should maintain gate evaluation order', () => {
      const context = createValidContext();
      
      const result = engine.makeDecision(context);

      const gateOrder = result.audit.gate_results.map(r => r.gate);
      expect(gateOrder).toEqual([
        'SPREAD_GATE',
        'VOLATILITY_GATE', 
        'GAMMA_GATE',
        'PHASE_GATE',
        'SESSION_GATE'
      ]);
    });
  });
});