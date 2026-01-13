/**
 * Testing setup for Phase 2.5 Decision Engine
 * 
 * This file configures the testing environment for property-based testing
 * and provides utilities for generating test data.
 */

import fc from 'fast-check';
import { MarketContext, 
  TradeDirection, 
  WebhookSource,
  SatyPhaseWebhook } from '../types';
  // MtfDotsWebhook, UltimateOptionsWebhook, StratExecutionWebhook unused

// ============================================================================
// PROPERTY-BASED TEST CONFIGURATION
// ============================================================================

/**
 * Standard configuration for property-based tests
 * Minimum 100 iterations as specified in the design
 */
export const PBT_CONFIG = {
  numRuns: 100,
  timeout: 5000,
  seed: 42, // For reproducible tests
  verbose: false
};

/**
 * Tag format for property tests as specified in design:
 * "Feature: decision-engine-phase25, Property {N}: {description}"
 */
export const createPropertyTag = (propertyNumber: number, description: string): string => {
  return `Feature: decision-engine-phase25, Property ${propertyNumber}: ${description}`;
};

// ============================================================================
// ARBITRARIES FOR CORE TYPES
// ============================================================================

/**
 * Generate valid trade directions
 */
export const tradeDirectionArb = (): fc.Arbitrary<TradeDirection> => {
  return fc.constantFrom("LONG", "SHORT");
};

/**
 * Generate valid webhook sources
 */
export const webhookSourceArb = (): fc.Arbitrary<WebhookSource> => {
  return fc.constantFrom(
    "SATY_PHASE",
    "MTF_DOTS", 
    "ULTIMATE_OPTIONS",
    "STRAT_EXEC",
    "TRADINGVIEW_SIGNAL"
  );
};

/**
 * Generate valid symbols
 */
export const symbolArb = (): fc.Arbitrary<string> => {
  return fc.constantFrom("SPX", "SPY", "QQQ", "IWM", "TSLA", "AAPL", "MSFT", "NVDA");
};

/**
 * Generate valid exchanges
 */
export const exchangeArb = (): fc.Arbitrary<string> => {
  return fc.constantFrom("CBOE", "NYSE", "NASDAQ");
};

// ============================================================================
// ARBITRARIES FOR DECISION CONTEXT
// ============================================================================

/**
 * Generate valid regime data
 */
export const regimeArb = (): fc.Arbitrary<DecisionContext['regime']> => {
  return fc.record({
    phase: fc.constantFrom(1, 2, 3, 4),
    phaseName: fc.constantFrom("ACCUMULATION", "MARKUP", "DISTRIBUTION", "MARKDOWN"),
    volatility: fc.constantFrom("LOW", "NORMAL", "HIGH"),
    confidence: fc.integer({ min: 0, max: 100 }),
    bias: fc.constantFrom("LONG", "SHORT", "NEUTRAL")
  });
};

/**
 * Generate valid alignment data
 */
export const alignmentArb = (): fc.Arbitrary<DecisionContext['alignment']> => {
  return fc.record({
    tfStates: fc.record({
      "3M": fc.constantFrom("BULLISH", "BEARISH", "NEUTRAL"),
      "5M": fc.constantFrom("BULLISH", "BEARISH", "NEUTRAL"),
      "15M": fc.constantFrom("BULLISH", "BEARISH", "NEUTRAL"),
      "30M": fc.constantFrom("BULLISH", "BEARISH", "NEUTRAL"),
      "1H": fc.constantFrom("BULLISH", "BEARISH", "NEUTRAL"),
      "4H": fc.constantFrom("BULLISH", "BEARISH", "NEUTRAL")
    }),
    bullishPct: fc.integer({ min: 0, max: 100 }),
    bearishPct: fc.integer({ min: 0, max: 100 })
  });
};

/**
 * Generate valid expert data
 */
export const expertArb = (): fc.Arbitrary<DecisionContext['expert']> => {
  return fc.record({
    direction: tradeDirectionArb(),
    aiScore: fc.float({ min: Math.fround(0), max: Math.fround(10.5) }).filter(x => !isNaN(x)),
    quality: fc.constantFrom("EXTREME", "HIGH", "MEDIUM"),
    components: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
    rr1: fc.float({ min: Math.fround(1), max: Math.fround(10) }).filter(x => !isNaN(x)),
    rr2: fc.float({ min: Math.fround(1), max: Math.fround(15) }).filter(x => !isNaN(x))
  });
};

/**
 * Generate valid structure data
 */
export const structureArb = (): fc.Arbitrary<DecisionContext['structure']> => {
  return fc.record({
    validSetup: fc.boolean(),
    liquidityOk: fc.boolean(),
    executionQuality: fc.constantFrom("A", "B", "C")
  });
};

/**
 * Generate valid instrument data
 */
export const instrumentArb = (): fc.Arbitrary<DecisionContext['instrument']> => {
  return fc.record({
    symbol: symbolArb(),
    exchange: exchangeArb(),
    price: fc.float({ min: Math.fround(1), max: Math.fround(1000) }).filter(x => !isNaN(x))
  });
};

/**
 * Generate complete DecisionContext
 */
export const decisionContextArb = (): fc.Arbitrary<DecisionContext> => {
  return fc.record({
    meta: fc.record({
      engineVersion: fc.constant("2.5.0"),
      receivedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
      completeness: fc.float({ min: Math.fround(0), max: Math.fround(1) }).filter(x => !isNaN(x))
    }),
    instrument: instrumentArb(),
    regime: regimeArb(),
    alignment: alignmentArb(),
    expert: expertArb(),
    structure: structureArb()
  });
};

// ============================================================================
// ARBITRARIES FOR MARKET CONTEXT
// ============================================================================

/**
 * Generate valid options context
 */
export const optionsContextArb = (): fc.Arbitrary<MarketContext['options']> => {
  return fc.record({
    putCallRatio: fc.float({ min: Math.fround(0.1), max: Math.fround(3.0) }).filter(x => !isNaN(x)),
    ivPercentile: fc.integer({ min: 0, max: 100 }),
    gammaBias: fc.constantFrom("POSITIVE", "NEGATIVE", "NEUTRAL"),
    optionVolume: fc.integer({ min: 100, max: 1000000 }),
    maxPain: fc.float({ min: Math.fround(0), max: Math.fround(1000) }).filter(x => !isNaN(x))
  });
};

/**
 * Generate valid stats context
 */
export const statsContextArb = (): fc.Arbitrary<MarketContext['stats']> => {
  return fc.record({
    atr14: fc.float({ min: Math.fround(0.1), max: Math.fround(100) }).filter(x => !isNaN(x)),
    rv20: fc.float({ min: Math.fround(5), max: Math.fround(100) }).filter(x => !isNaN(x)),
    trendSlope: fc.float({ min: Math.fround(-1), max: Math.fround(1) }).filter(x => !isNaN(x)),
    rsi: fc.float({ min: Math.fround(0), max: Math.fround(100) }).filter(x => !isNaN(x)),
    volume: fc.integer({ min: 1000, max: 100000000 }),
    volumeRatio: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0) }).filter(x => !isNaN(x))
  });
};

/**
 * Generate valid liquidity context
 */
export const liquidityContextArb = (): fc.Arbitrary<MarketContext['liquidity']> => {
  return fc.record({
    spreadBps: fc.float({ min: Math.fround(1), max: Math.fround(50) }).filter(x => !isNaN(x)),
    depthScore: fc.integer({ min: 0, max: 100 }),
    tradeVelocity: fc.constantFrom("SLOW", "NORMAL", "FAST"),
    bidSize: fc.integer({ min: 1, max: 10000 }),
    askSize: fc.integer({ min: 1, max: 10000 })
  });
};

/**
 * Generate complete MarketContext
 */
export const marketContextArb = (): fc.Arbitrary<MarketContext> => {
  return fc.record({
    options: fc.option(optionsContextArb()),
    stats: fc.option(statsContextArb()),
    liquidity: fc.option(liquidityContextArb()),
    fetchTime: fc.integer({ min: Date.now() - 1000, max: Date.now() }),
    completeness: fc.float({ min: Math.fround(0), max: Math.fround(1) }).filter(x => !isNaN(x)),
    errors: fc.array(fc.string(), { maxLength: 3 })
  });
};

// ============================================================================
// ARBITRARIES FOR WEBHOOK PAYLOADS
// ============================================================================

/**
 * Generate valid SATY phase webhook
 */
export const satyPhaseWebhookArb = (): fc.Arbitrary<SatyPhaseWebhook> => {
  return fc.record({
    meta: fc.record({
      engine: fc.constant('SATY_PO' as const),
      engine_version: fc.constant('1.0.0'),
      event_id: fc.uuid(),
      event_type: fc.constantFrom('REGIME_PHASE_EXIT', 'REGIME_PHASE_ENTRY', 'REGIME_REVERSAL'),
      generated_at: fc.date().map(d => d.toISOString())
    }),
    instrument: fc.record({
      symbol: symbolArb(),
      exchange: exchangeArb(),
      asset_class: fc.constant('EQUITY'),
      session: fc.constantFrom('REGULAR', 'EXTENDED')
    }),
    timeframe: fc.record({
      chart_tf: fc.constantFrom('15m', '1h', '4h', '1d'),
      event_tf: fc.constantFrom('15m', '1h', '4h', '1d'),
      tf_role: fc.constantFrom('REGIME', 'BIAS', 'SETUP_FORMATION', 'STRUCTURAL'),
      bar_close_time: fc.date().map(d => d.toISOString())
    }),
    event: fc.record({
      name: fc.constantFrom('EXIT_ACCUMULATION', 'ENTER_ACCUMULATION', 'EXIT_DISTRIBUTION', 'ENTER_DISTRIBUTION'),
      description: fc.string(),
      directional_implication: fc.constantFrom('UPSIDE_POTENTIAL', 'DOWNSIDE_POTENTIAL', 'NEUTRAL'),
      event_priority: fc.integer({ min: 1, max: 10 })
    }),
    oscillator_state: fc.record({
      value: fc.float({ min: -100, max: 100 }),
      previous_value: fc.float({ min: -100, max: 100 }),
      zone_from: fc.string(),
      zone_to: fc.string(),
      distance_from_zero: fc.float({ min: 0, max: 100 }),
      distance_from_extreme: fc.float({ min: 0, max: 100 }),
      velocity: fc.constantFrom('INCREASING', 'DECREASING', 'FLAT')
    }),
    regime_context: fc.record({
      local_bias: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL'),
      htf_bias: fc.record({
        tf: fc.constantFrom('4h', '1d'),
        bias: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL'),
        osc_value: fc.float({ min: -100, max: 100 })
      }),
      macro_bias: fc.record({
        tf: fc.constantFrom('1d', '1w'),
        bias: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL')
      })
    }),
    confidence: fc.record({
      raw_strength: fc.float({ min: 0, max: 100 }),
      htf_alignment: fc.boolean(),
      confidence_score: fc.integer({ min: 0, max: 100 }),
      confidence_tier: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'EXTREME')
    }),
    execution_guidance: fc.record({
      trade_allowed: fc.boolean(),
      allowed_directions: fc.array(tradeDirectionArb(), { maxLength: 2 }),
      recommended_execution_tf: fc.array(fc.string(), { maxLength: 3 }),
      requires_confirmation: fc.array(fc.string(), { maxLength: 2 })
    }),
    risk_hints: fc.record({
      avoid_if: fc.array(fc.string(), { maxLength: 3 }),
      time_decay_minutes: fc.integer({ min: 15, max: 1440 }),
      cooldown_tf: fc.string()
    })
  });
};

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a test suite with proper tagging
 */
export const createPropertyTestSuite = (suiteName: string, tests: () => void) => {
  describe(`[PBT] ${suiteName}`, tests);
};

/**
 * Create a property test with proper configuration and tagging
 */
export const createPropertyTest = (
  propertyNumber: number,
  description: string,
  testFn: () => void
) => {
  const tag = createPropertyTag(propertyNumber, description);
  it(tag, testFn, PBT_CONFIG.timeout);
};