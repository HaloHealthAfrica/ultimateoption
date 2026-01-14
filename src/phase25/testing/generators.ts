/**
 * Property-Based Test Generators for Phase 2.5
 * 
 * This module provides fast-check generators for creating test data
 * that conforms to the Phase 2.5 type system.
 */

import * as fc from 'fast-check';
import { MarketContext, 
  DecisionContext,
  TradeDirection, 
  WebhookSource,
  NormalizedPayload,
  EngineAction } from '../types';

// ============================================================================
// BASIC GENERATORS
// ============================================================================

export const tradeDirectionArb = fc.constantFrom('LONG', 'SHORT') as fc.Arbitrary<TradeDirection>;

export const engineActionArb = fc.constantFrom('EXECUTE', 'WAIT', 'SKIP') as fc.Arbitrary<EngineAction>;

export const webhookSourceArb = fc.constantFrom(
  'SATY_PHASE',
  'MTF_DOTS', 
  'ULTIMATE_OPTIONS',
  'STRAT_EXEC',
  'TRADINGVIEW_SIGNAL'
) as fc.Arbitrary<WebhookSource>;

export const phaseArb = fc.constantFrom(1, 2, 3, 4) as fc.Arbitrary<1 | 2 | 3 | 4>;

export const phaseNameArb = fc.constantFrom(
  'ACCUMULATION',
  'MARKUP', 
  'DISTRIBUTION',
  'MARKDOWN'
) as fc.Arbitrary<'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN'>;

export const volatilityArb = fc.constantFrom('LOW', 'NORMAL', 'HIGH') as fc.Arbitrary<'LOW' | 'NORMAL' | 'HIGH'>;

export const qualityArb = fc.constantFrom('EXTREME', 'HIGH', 'MEDIUM') as fc.Arbitrary<'EXTREME' | 'HIGH' | 'MEDIUM'>;

export const executionQualityArb = fc.constantFrom('A', 'B', 'C') as fc.Arbitrary<'A' | 'B' | 'C'>;

export const gammaBiasArb = fc.constantFrom('POSITIVE', 'NEGATIVE', 'NEUTRAL') as fc.Arbitrary<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'>;

export const tradeVelocityArb = fc.constantFrom('SLOW', 'NORMAL', 'FAST') as fc.Arbitrary<'SLOW' | 'NORMAL' | 'FAST'>;

export const biasArb = fc.constantFrom('LONG', 'SHORT', 'NEUTRAL') as fc.Arbitrary<'LONG' | 'SHORT' | 'NEUTRAL'>;

export const tfStateArb = fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL') as fc.Arbitrary<'BULLISH' | 'BEARISH' | 'NEUTRAL'>;

// ============================================================================
// INSTRUMENT GENERATORS
// ============================================================================

export const instrumentArb = fc.record({
  symbol: fc.constantFrom('SPX', 'SPY', 'QQQ', 'IWM', 'TSLA', 'AAPL', 'MSFT'),
  exchange: fc.constantFrom('CBOE', 'NYSE', 'NASDAQ'),
  price: fc.float({ min: 1, max: 1000, noNaN: true })
});

// ============================================================================
// REGIME GENERATORS
// ============================================================================

export const regimeArb = fc.record({
  phase: phaseArb,
  phaseName: phaseNameArb,
  volatility: volatilityArb,
  confidence: fc.integer({ min: 0, max: 100 }),
  bias: biasArb
});

// ============================================================================
// ALIGNMENT GENERATORS
// ============================================================================

export const alignmentArb = fc.record({
  tfStates: fc.record({
    '3M': tfStateArb,
    '5M': tfStateArb,
    '15M': tfStateArb,
    '30M': tfStateArb,
    '1H': tfStateArb,
    '4H': tfStateArb
  }),
  bullishPct: fc.integer({ min: 0, max: 100 }),
  bearishPct: fc.integer({ min: 0, max: 100 })
});

// ============================================================================
// EXPERT GENERATORS
// ============================================================================

export const expertArb = fc.record({
  direction: tradeDirectionArb,
  aiScore: fc.float({ min: 0, max: 10.5, noNaN: true }),
  quality: qualityArb,
  components: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
  rr1: fc.float({ min: 0.5, max: 10, noNaN: true }),
  rr2: fc.float({ min: 1, max: 20, noNaN: true })
});

// ============================================================================
// STRUCTURE GENERATORS
// ============================================================================

export const structureArb = fc.record({
  validSetup: fc.boolean(),
  liquidityOk: fc.boolean(),
  executionQuality: executionQualityArb
});

// ============================================================================
// DECISION CONTEXT GENERATORS
// ============================================================================

export const decisionContextArb = fc.record({
  meta: fc.record({
    engineVersion: fc.constant('2.5.0'),
    receivedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
    completeness: fc.float({ min: 0, max: 1, noNaN: true })
  }),
  instrument: instrumentArb,
  regime: regimeArb,
  alignment: alignmentArb,
  expert: expertArb,
  structure: structureArb
}) as fc.Arbitrary<DecisionContext>;

// ============================================================================
// MARKET CONTEXT GENERATORS
// ============================================================================

export const optionsContextArb = fc.record({
  putCallRatio: fc.float({ min: 0.1, max: 3.0, noNaN: true }),
  ivPercentile: fc.integer({ min: 0, max: 100 }),
  gammaBias: gammaBiasArb,
  optionVolume: fc.integer({ min: 0, max: 1000000 }),
  maxPain: fc.float({ min: 1, max: 1000, noNaN: true })
});

export const marketStatsArb = fc.record({
  atr14: fc.float({ min: 0.1, max: 100, noNaN: true }),
  rv20: fc.float({ min: 5, max: 200, noNaN: true }),
  trendSlope: fc.float({ min: -1, max: 1, noNaN: true }),
  rsi: fc.float({ min: 0, max: 100, noNaN: true }),
  volume: fc.integer({ min: 0, max: 10000000 }),
  volumeRatio: fc.float({ min: 0.1, max: 5.0, noNaN: true })
});

export const liquidityContextArb = fc.record({
  spreadBps: fc.float({ min: 0.1, max: 50, noNaN: true }),
  depthScore: fc.integer({ min: 0, max: 100 }),
  tradeVelocity: tradeVelocityArb,
  bidSize: fc.integer({ min: 0, max: 10000 }),
  askSize: fc.integer({ min: 0, max: 10000 })
});

export const marketContextArb = fc.record({
  options: fc.option(optionsContextArb),
  stats: fc.option(marketStatsArb),
  liquidity: fc.option(liquidityContextArb),
  fetchTime: fc.integer({ min: Date.now() - 1000, max: Date.now() }),
  completeness: fc.float({ min: 0, max: 1, noNaN: true }),
  errors: fc.array(fc.string(), { maxLength: 3 })
}) as fc.Arbitrary<MarketContext>;

// ============================================================================
// NORMALIZED PAYLOAD GENERATORS
// ============================================================================

export const normalizedPayloadArb = fc.record({
  source: webhookSourceArb,
  partial: fc.record({
    regime: fc.option(regimeArb),
    alignment: fc.option(alignmentArb),
    expert: fc.option(expertArb),
    structure: fc.option(structureArb),
    instrument: fc.option(instrumentArb)
  }),
  timestamp: fc.integer({ min: Date.now() - 1000, max: Date.now() })
}) as fc.Arbitrary<NormalizedPayload>;

// ============================================================================
// CONSTRAINT GENERATORS
// ============================================================================

/**
 * Generates DecisionContext with specific constraints for testing edge cases
 */
export const constrainedDecisionContextArb = (constraints: {
  minConfidence?: number;
  maxConfidence?: number;
  requiredDirection?: TradeDirection;
  validSetup?: boolean;
  liquidityOk?: boolean;
}) => {
  return fc.record({
    meta: fc.record({
      engineVersion: fc.constant('2.5.0'),
      receivedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
      completeness: fc.float({ min: 0, max: 1, noNaN: true })
    }),
    instrument: instrumentArb,
    regime: fc.record({
      phase: phaseArb,
      phaseName: phaseNameArb,
      volatility: volatilityArb,
      confidence: fc.integer({ 
        min: constraints.minConfidence ?? 0, 
        max: constraints.maxConfidence ?? 100 
      }),
      bias: biasArb
    }),
    alignment: alignmentArb,
    expert: fc.record({
      direction: constraints.requiredDirection ? fc.constant(constraints.requiredDirection) : tradeDirectionArb,
      aiScore: fc.float({ min: 0, max: 10.5, noNaN: true }),
      quality: qualityArb,
      components: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
      rr1: fc.float({ min: 0.5, max: 10, noNaN: true }),
      rr2: fc.float({ min: 1, max: 20, noNaN: true })
    }),
    structure: fc.record({
      validSetup: constraints.validSetup !== undefined ? fc.constant(constraints.validSetup) : fc.boolean(),
      liquidityOk: constraints.liquidityOk !== undefined ? fc.constant(constraints.liquidityOk) : fc.boolean(),
      executionQuality: executionQualityArb
    })
  }) as fc.Arbitrary<DecisionContext>;
};

/**
 * Generates MarketContext with specific spread constraints for gate testing
 */
export const constrainedMarketContextArb = (constraints: {
  maxSpreadBps?: number;
  minSpreadBps?: number;
  gammaBias?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}) => {
  return fc.record({
    options: fc.option(fc.record({
      putCallRatio: fc.float({ min: 0.1, max: 3.0, noNaN: true }),
      ivPercentile: fc.integer({ min: 0, max: 100 }),
      gammaBias: constraints.gammaBias ? fc.constant(constraints.gammaBias) : gammaBiasArb,
      optionVolume: fc.integer({ min: 0, max: 1000000 }),
      maxPain: fc.float({ min: 1, max: 1000, noNaN: true })
    })),
    stats: fc.option(marketStatsArb),
    liquidity: fc.option(fc.record({
      spreadBps: fc.float({ 
        min: constraints.minSpreadBps ?? 0.1, 
        max: constraints.maxSpreadBps ?? 50, 
        noNaN: true 
      }),
      depthScore: fc.integer({ min: 0, max: 100 }),
      tradeVelocity: tradeVelocityArb,
      bidSize: fc.integer({ min: 0, max: 10000 }),
      askSize: fc.integer({ min: 0, max: 10000 })
    })),
    fetchTime: fc.integer({ min: Date.now() - 1000, max: Date.now() }),
    completeness: fc.float({ min: 0, max: 1, noNaN: true }),
    errors: fc.array(fc.string(), { maxLength: 3 })
  }) as fc.Arbitrary<MarketContext>;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a generator that ensures alignment percentages sum correctly
 */
export const validAlignmentArb = fc.record({
  tfStates: fc.record({
    '3M': tfStateArb,
    '5M': tfStateArb,
    '15M': tfStateArb,
    '30M': tfStateArb,
    '1H': tfStateArb,
    '4H': tfStateArb
  })
}).map(({ tfStates }) => {
  const states = Object.values(tfStates);
  const bullishCount = states.filter(s => s === 'BULLISH').length;
  const bearishCount = states.filter(s => s === 'BEARISH').length;
  
  return {
    tfStates,
    bullishPct: Math.round((bullishCount / states.length) * 100),
    bearishPct: Math.round((bearishCount / states.length) * 100)
  };
});

/**
 * Property test configuration with standard settings
 */
export const propertyTestConfig = {
  numRuns: 100,
  verbose: false,
  seed: 42, // For reproducible tests
  path: '0:0:0', // For debugging specific cases
  endOnFailure: true
};