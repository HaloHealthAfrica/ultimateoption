/**
 * Phase 2 Decision Engine - Risk Gates Tests
 * 
 * Comprehensive tests for all risk gates including property-based testing
 * to validate universal correctness properties across many inputs.
 */

import fc from 'fast-check';
import { 
  SpreadGate, 
  VolatilityGate, 
  GammaGate, 
  PhaseGate, 
  SessionGate 
} from '../gates';
import { MarketContext, SignalType, MarketSession, GammaBias, DecisionContext } from '../types';
import { GATE_THRESHOLDS, GATE_REASONS } from '../constants/gates';

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

describe('SpreadGate', () => {
  const gate = new SpreadGate();

  describe('Unit Tests', () => {
    test('passes when spread is exactly at threshold (12 bps)', () => {
      const context = createBaseContext();
      context.market = createMarketContext({
        liquidityData: { spreadBps: 12, depthScore: 75, tradeVelocity: 'NORMAL', dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.gate).toBe('SPREAD_GATE');
      expect(result.value).toBe(12);
      expect(result.threshold).toBe(12);
      expect(result.reason).toBeUndefined();
    });

    test('fails when spread exceeds threshold', () => {
      const context = createBaseContext();
      context.market = createMarketContext({
        liquidityData: { spreadBps: 15, depthScore: 75, tradeVelocity: 'NORMAL', dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.gate).toBe('SPREAD_GATE');
      expect(result.value).toBe(15);
      expect(result.threshold).toBe(12);
      expect(result.reason).toBe(GATE_REASONS.SPREAD_TOO_WIDE);
    });

    test('uses fallback value when market data unavailable', () => {
      const context = createBaseContext();
      // No market context provided

      const result = gate.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.value).toBe(999); // Fallback value
      expect(result.reason).toBe(GATE_REASONS.SPREAD_TOO_WIDE);
    });
  });

  describe('Property Tests', () => {
    test('Property 3: Spread Gate Threshold Enforcement', () => {
      fc.assert(fc.property(
        fc.float({ min: 0, max: 1000 }), // spreadBps
        (spreadBps) => {
          const context = createBaseContext();
          context.market = createMarketContext({
            liquidityData: { spreadBps, depthScore: 75, tradeVelocity: 'NORMAL', dataSource: 'API' }
          });

          const result = gate.evaluate(context);

          // Property: Gate passes if and only if spread <= threshold
          const shouldPass = spreadBps <= GATE_THRESHOLDS.SPREAD_BPS;
          expect(result.passed).toBe(shouldPass);
          
          // Property: Failed gates always have reasons
          if (!result.passed) {
            expect(result.reason).toBe(GATE_REASONS.SPREAD_TOO_WIDE);
          }
          
          // Property: Gate always records the spread value
          expect(result.value).toBe(spreadBps);
          expect(result.threshold).toBe(GATE_THRESHOLDS.SPREAD_BPS);
        }
      ));
    });
  });
});

describe('VolatilityGate', () => {
  const gate = new VolatilityGate();

  describe('Unit Tests', () => {
    test('passes when volatility ratio is at threshold (2.0)', () => {
      const context = createBaseContext();
      context.market = createMarketContext({
        marketStats: { atr14: 2.0, rv20: 1.0, trendSlope: 0.1, dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.value).toBe(2.0);
      expect(result.threshold).toBe(2.0);
    });

    test('fails when volatility ratio exceeds threshold', () => {
      const context = createBaseContext();
      context.market = createMarketContext({
        marketStats: { atr14: 3.0, rv20: 1.0, trendSlope: 0.1, dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.value).toBe(3.0);
      expect(result.reason).toBe(GATE_REASONS.VOLATILITY_SPIKE);
    });

    test('handles zero RV20 with default ratio of 1.0', () => {
      const context = createBaseContext();
      context.market = createMarketContext({
        marketStats: { atr14: 1.5, rv20: 0, trendSlope: 0.1, dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.value).toBe(1.0); // Default when RV20 is zero
    });

    test('uses fallback values when market data unavailable', () => {
      const context = createBaseContext();
      // No market context provided

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.value).toBe(1.0); // 0/0 handled as 1.0
    });

    test('handles NaN values gracefully', () => {
      const context = createBaseContext();
      context.market = createMarketContext({
        marketStats: { atr14: NaN, rv20: NaN, trendSlope: 0.1, dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.value).toBe(1.0); // NaN values treated as 0, so 0/0 -> 1.0
    });
  });

  describe('Property Tests', () => {
    test('Property 4: Volatility Spike Detection', () => {
      fc.assert(fc.property(
        fc.float({ min: 0, max: 10, noNaN: true }), // atr14
        fc.float({ min: 0, max: 10, noNaN: true }), // rv20
        (atr14, rv20) => {
          const context = createBaseContext();
          context.market = createMarketContext({
            marketStats: { atr14, rv20, trendSlope: 0.1, dataSource: 'API' }
          });

          const result = gate.evaluate(context);

          // Calculate expected ratio with zero-division protection
          const expectedRatio = rv20 > 0 ? atr14 / rv20 : 1.0;
          
          // Property: Gate passes if and only if ratio <= threshold
          const shouldPass = expectedRatio <= GATE_THRESHOLDS.VOLATILITY_SPIKE;
          expect(result.passed).toBe(shouldPass);
          
          // Property: Calculated ratio matches expected
          expect(result.value).toBeCloseTo(expectedRatio, 5);
          
          // Property: Failed gates have volatility spike reason
          if (!result.passed) {
            expect(result.reason).toBe(GATE_REASONS.VOLATILITY_SPIKE);
          }
        }
      ));
    });
  });
});

describe('GammaGate', () => {
  const gate = new GammaGate();

  describe('Unit Tests', () => {
    test('fails LONG signal with NEGATIVE gamma bias', () => {
      const context = createBaseContext();
      context.indicator.signalType = 'LONG';
      context.market = createMarketContext({
        optionsData: { putCallRatio: 1.0, ivPercentile: 50, gammaBias: 'NEGATIVE', dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.reason).toBe(GATE_REASONS.GAMMA_HEADWIND);
    });

    test('fails SHORT signal with POSITIVE gamma bias', () => {
      const context = createBaseContext();
      context.indicator.signalType = 'SHORT';
      context.market = createMarketContext({
        optionsData: { putCallRatio: 1.0, ivPercentile: 50, gammaBias: 'POSITIVE', dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.reason).toBe(GATE_REASONS.GAMMA_HEADWIND);
    });

    test('passes LONG signal with POSITIVE gamma bias', () => {
      const context = createBaseContext();
      context.indicator.signalType = 'LONG';
      context.market = createMarketContext({
        optionsData: { putCallRatio: 1.0, ivPercentile: 50, gammaBias: 'POSITIVE', dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('passes SHORT signal with NEGATIVE gamma bias', () => {
      const context = createBaseContext();
      context.indicator.signalType = 'SHORT';
      context.market = createMarketContext({
        optionsData: { putCallRatio: 1.0, ivPercentile: 50, gammaBias: 'NEGATIVE', dataSource: 'API' }
      });

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('passes any signal with NEUTRAL gamma bias', () => {
      const contextLong = createBaseContext();
      contextLong.indicator.signalType = 'LONG';
      contextLong.market = createMarketContext({
        optionsData: { putCallRatio: 1.0, ivPercentile: 50, gammaBias: 'NEUTRAL', dataSource: 'API' }
      });

      const contextShort = createBaseContext();
      contextShort.indicator.signalType = 'SHORT';
      contextShort.market = createMarketContext({
        optionsData: { putCallRatio: 1.0, ivPercentile: 50, gammaBias: 'NEUTRAL', dataSource: 'API' }
      });

      expect(gate.evaluate(contextLong).passed).toBe(true);
      expect(gate.evaluate(contextShort).passed).toBe(true);
    });

    test('uses fallback NEUTRAL when gamma data unavailable', () => {
      const context = createBaseContext();
      context.indicator.signalType = 'LONG';
      // No market context provided

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true); // NEUTRAL allows all signals
    });
  });

  describe('Property Tests', () => {
    test('Property 5: Gamma Bias Opposition Detection', () => {
      fc.assert(fc.property(
        fc.constantFrom('LONG', 'SHORT'), // signalType
        fc.constantFrom('POSITIVE', 'NEGATIVE', 'NEUTRAL'), // gammaBias
        (signalType, gammaBias) => {
          const context = createBaseContext();
          context.indicator.signalType = signalType as SignalType;
          context.market = createMarketContext({
            optionsData: { putCallRatio: 1.0, ivPercentile: 50, gammaBias: gammaBias as GammaBias, dataSource: 'API' }
          });

          const result = gate.evaluate(context);

          // Property: Gate fails if and only if there's gamma headwind
          const hasHeadwind = (
            (signalType === 'LONG' && gammaBias === 'NEGATIVE') ||
            (signalType === 'SHORT' && gammaBias === 'POSITIVE')
          );
          
          expect(result.passed).toBe(!hasHeadwind);
          
          // Property: Failed gates have gamma headwind reason
          if (hasHeadwind) {
            expect(result.reason).toBe(GATE_REASONS.GAMMA_HEADWIND);
          }
        }
      ));
    });
  });
});

describe('PhaseGate', () => {
  const gate = new PhaseGate();

  describe('Unit Tests', () => {
    test('passes when phase confidence is exactly at threshold (65)', () => {
      const context = createBaseContext();
      context.indicator.satyPhase = 65;

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.value).toBe(65);
      expect(result.threshold).toBe(65);
    });

    test('passes when phase confidence is exactly at negative threshold (-65)', () => {
      const context = createBaseContext();
      context.indicator.satyPhase = -65;

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.value).toBe(65); // Absolute value
      expect(result.threshold).toBe(65);
    });

    test('fails when phase confidence is below threshold', () => {
      const context = createBaseContext();
      context.indicator.satyPhase = 50;

      const result = gate.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.value).toBe(50);
      expect(result.reason).toBe(GATE_REASONS.PHASE_CONFIDENCE_LOW);
    });

    test('uses default value of 0 when phase data missing', () => {
      const context = createBaseContext();
      context.indicator.satyPhase = undefined as unknown;

      const result = gate.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.value).toBe(0); // Default value
      expect(result.reason).toBe(GATE_REASONS.PHASE_CONFIDENCE_LOW);
    });
  });

  describe('Property Tests', () => {
    test('Property 6: Phase Confidence Threshold', () => {
      fc.assert(fc.property(
        fc.integer({ min: -100, max: 100 }), // satyPhase
        (satyPhase) => {
          const context = createBaseContext();
          context.indicator.satyPhase = satyPhase;

          const result = gate.evaluate(context);

          // Property: Gate passes if and only if |satyPhase| >= threshold
          const absolutePhase = Math.abs(satyPhase);
          const shouldPass = absolutePhase >= GATE_THRESHOLDS.PHASE_CONFIDENCE;
          
          expect(result.passed).toBe(shouldPass);
          expect(result.value).toBe(absolutePhase);
          expect(result.threshold).toBe(GATE_THRESHOLDS.PHASE_CONFIDENCE);
          
          // Property: Failed gates have low confidence reason
          if (!shouldPass) {
            expect(result.reason).toBe(GATE_REASONS.PHASE_CONFIDENCE_LOW);
          }
        }
      ));
    });
  });
});

describe('SessionGate', () => {
  const gate = new SessionGate();

  describe('Unit Tests', () => {
    test('passes during OPEN session', () => {
      const context = createBaseContext();
      context.indicator.marketSession = 'OPEN';

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('passes during MIDDAY session', () => {
      const context = createBaseContext();
      context.indicator.marketSession = 'MIDDAY';

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
    });

    test('passes during POWER_HOUR session', () => {
      const context = createBaseContext();
      context.indicator.marketSession = 'POWER_HOUR';

      const result = gate.evaluate(context);

      expect(result.passed).toBe(true);
    });

    test('fails during AFTERHOURS session', () => {
      const context = createBaseContext();
      context.indicator.marketSession = 'AFTERHOURS';

      const result = gate.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.reason).toBe(GATE_REASONS.AFTERHOURS_BLOCKED);
    });
  });

  describe('Property Tests', () => {
    test('Property 7: Session Gate Afterhours Blocking', () => {
      fc.assert(fc.property(
        fc.constantFrom('OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS'), // marketSession
        (marketSession) => {
          const context = createBaseContext();
          context.indicator.marketSession = marketSession as MarketSession;

          const result = gate.evaluate(context);

          // Property: Gate passes if and only if not afterhours
          const shouldPass = marketSession !== 'AFTERHOURS';
          expect(result.passed).toBe(shouldPass);
          
          // Property: Afterhours sessions are blocked with specific reason
          if (marketSession === 'AFTERHOURS') {
            expect(result.reason).toBe(GATE_REASONS.AFTERHOURS_BLOCKED);
          }
        }
      ));
    });
  });
});

describe('All Gates Integration', () => {
  const gates = [
    new SpreadGate(),
    new VolatilityGate(),
    new GammaGate(),
    new PhaseGate(),
    new SessionGate()
  ];

  test('all gates have unique names', () => {
    const names = gates.map(gate => gate.name);
    const uniqueNames = new Set(names);
    
    expect(uniqueNames.size).toBe(gates.length);
  });

  test('all gates return consistent result structure', () => {
    const context = createBaseContext();
    context.market = createMarketContext();

    gates.forEach(gate => {
      const result = gate.evaluate(context);
      
      expect(result).toHaveProperty('gate');
      expect(result).toHaveProperty('passed');
      expect(typeof result.passed).toBe('boolean');
      expect(result.gate).toBe(gate.name);
      
      // Failed gates should have reasons
      if (!result.passed) {
        expect(result.reason).toBeDefined();
        expect(typeof result.reason).toBe('string');
      }
    });
  });

  describe('Property Tests', () => {
    test('Property: Gate Evaluation Determinism', () => {
      fc.assert(fc.property(
        fc.float({ min: 0, max: 10.5 }), // aiScore
        fc.integer({ min: -100, max: 100 }), // satyPhase
        fc.constantFrom('OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS'), // session
        fc.constantFrom('LONG', 'SHORT'), // signalType
        (aiScore, satyPhase, session, signalType) => {
          const context1 = createBaseContext();
          context1.indicator.aiScore = aiScore;
          context1.indicator.satyPhase = satyPhase;
          context1.indicator.marketSession = session as MarketSession;
          context1.indicator.signalType = signalType as SignalType;
          context1.market = createMarketContext();

          const context2 = JSON.parse(JSON.stringify(context1)); // Deep clone

          // Property: Same input produces identical results
          gates.forEach(gate => {
            const result1 = gate.evaluate(context1);
            const result2 = gate.evaluate(context2);
            
            expect(result1).toEqual(result2);
          });
        }
      ));
    });
  });
});