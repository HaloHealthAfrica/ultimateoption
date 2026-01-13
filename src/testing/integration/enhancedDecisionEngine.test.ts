/**
 * Enhanced Decision Engine Integration Tests
 * 
 * Tests the complete integration of Phase 1B enhanced decision engine:
 * - Signal + Phase + Trend data integration
 * - Phase confidence boost application (+20%)
 * - Trend position boost application (+30%)
 * - Complete multiplier calculation with Phase 1B factors
 * 
 * Requirements: 18.9, 18.10, 24.9, 24.10
 */

import { makeDecision } from '@/engine/decisionEngine';
import { PhaseStore } from '@/saty/storage/phaseStore';
import { TrendStore } from '@/trend/storage/trendStore';
import { TimeframeStore } from '@/webhooks/timeframeStore';
import { EnrichedSignal } from '@/types/signal';
import { SatyPhaseWebhook } from '@/types/saty';
import { TrendWebhook } from '@/types/trend';

// Test data generators (reusing from previous tests)
const generateSignal = (
  symbol: string = 'SPY',
  timeframe: string = '240', // Use numeric timeframe format
  direction: 'LONG' | 'SHORT' = 'LONG',
  aiScore: number = 8.5,
  quality: 'EXTREME' | 'HIGH' | 'MEDIUM' = 'EXTREME'
): EnrichedSignal => ({
  signal: {
    type: direction,
    timeframe: timeframe as unknown, // Cast to Timeframe type
    quality,
    ai_score: aiScore,
    timestamp: Date.now(),
    bar_time: new Date().toISOString(),
  },
  instrument: {
    exchange: 'NASDAQ',
    ticker: symbol,
    current_price: 450.25,
  },
  entry: {
    price: 450.25,
    stop_loss: direction === 'LONG' ? 445.00 : 455.50,
    target_1: direction === 'LONG' ? 455.50 : 445.00,
    target_2: direction === 'LONG' ? 460.75 : 439.75,
    stop_reason: 'ATR',
  },
  risk: {
    amount: 500,
    rr_ratio_t1: 2.0,
    rr_ratio_t2: 4.0,
    stop_distance_pct: 1.1,
    recommended_shares: 100,
    recommended_contracts: 5,
    position_multiplier: 1.0,
    account_risk_pct: 1.0,
    max_loss_dollars: 500,
  },
  market_context: {
    vwap: 449.50,
    pmh: 452.00,
    pml: 447.00,
    day_open: 448.00,
    day_change_pct: 0.5,
    price_vs_vwap_pct: 0.1,
    distance_to_pmh_pct: 0.4,
    distance_to_pml_pct: 0.7,
    atr: 5.0,
    volume_vs_avg: 1.2,
    candle_direction: 'GREEN',
    candle_size_atr: 0.8,
  },
  trend: {
    ema_8: 449.00,
    ema_21: 448.00,
    ema_50: 446.00,
    alignment: 'BULLISH',
    strength: 75,
    rsi: 55,
    macd_signal: 'BULLISH',
  },
  mtf_context: {
    '4h_bias': direction,
    '4h_rsi': 55,
    '1h_bias': direction,
  },
  score_breakdown: {
    strat: 2.0,
    trend: 1.5,
    gamma: 1.0,
    vwap: 0.5,
    mtf: 1.5,
    golf: 1.0,
  },
  time_context: {
    market_session: 'MIDDAY',
    day_of_week: 'TUESDAY',
  },
});

const generatePhase = (
  symbol: string = 'SPY',
  timeframe: string = '4H',
  localBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'BULLISH',
  confidenceScore: number = 85,
  htfAlignment: boolean = true
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
    directional_implication: localBias === 'BULLISH' ? 'UPSIDE_POTENTIAL' : 
                           localBias === 'BEARISH' ? 'DOWNSIDE_POTENTIAL' : 'NEUTRAL',
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
    htf_alignment: htfAlignment,
    confidence_score: confidenceScore,
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
    time_decay_minutes: 240,
    cooldown_tf: '1H',
  },
  audit: {
    source: 'test',
    alert_frequency: 'ONCE',
    deduplication_key: 'test-key',
  },
});

const generateTrend = (
  ticker: string = 'SPY',
  alignmentScore: number = 100,
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CHOPPY' = 'STRONG',
  htfBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'BULLISH'
): TrendWebhook => ({
  ticker,
  exchange: 'NASDAQ',
  timestamp: new Date().toISOString(),
  price: 450.25,
  timeframes: {
    tf3min: { direction: 'bullish', open: 100, close: 102 },
    tf5min: { direction: 'bullish', open: 100, close: 102 },
    tf15min: { direction: 'bullish', open: 100, close: 102 },
    tf30min: { direction: 'bullish', open: 100, close: 102 },
    tf60min: { direction: 'bullish', open: 100, close: 102 },
    tf240min: { direction: htfBias.toLowerCase() as unknown, open: 100, close: htfBias === 'BULLISH' ? 102 : 98 },
    tf1week: { direction: 'bullish', open: 100, close: 102 },
    tf1month: { direction: 'bullish', open: 100, close: 102 },
  },
});

describe('Enhanced Decision Engine Integration', () => {
  let signalStore: TimeframeStore;
  let phaseStore: PhaseStore;
  let trendStore: TrendStore;

  beforeEach(() => {
    // Create fresh instances for each test
    signalStore = new TimeframeStore();
    phaseStore = PhaseStore.createInstance();
    trendStore = TrendStore.createInstance();
  });

  afterEach(() => {
    // Clean up after each test
    signalStore.clear();
    phaseStore.clear();
    trendStore.clear();
  });

  describe('Perfect Alignment Scenario', () => {
    it('should apply maximum Phase 1B boosts for perfect signal+phase+trend alignment', () => {
      // Setup: Create perfectly aligned signal, phase, and trend
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.5, 'EXTREME'); // 4H signal = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');     // 1H signal = 25% -> Total 65%
      const phase = generatePhase('SPY', '4H', 'BULLISH', 85, true); // htf_alignment = true, confidence >= 70
      const trend = generateTrend('SPY', 100, 'STRONG', 'BULLISH'); // STRONG trend, HTF bias matches signal

      // Store all data
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      phaseStore.updatePhase(phase);
      trendStore.storeTrend(trend);

      // Get stored data for decision engine
      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();

      // Make decision with all stores
      const decision = makeDecision(activeSignals, activePhases, trendStore);

      // Verify decision is EXECUTE
      expect(decision.decision).toBe('EXECUTE');

      // Verify Phase 1B boosts are applied
      const breakdown = decision.breakdown;
      
      // Phase confidence boost: +20% (htf_alignment = true)
      expect(breakdown.phase_confidence_boost).toBe(0.20);
      
      // Phase position boost: +10% (confidence >= 70 AND htf_alignment = true)
      expect(breakdown.phase_position_boost).toBe(0.10);
      
      // Trend alignment boost: +30% for STRONG + +15% for HTF bias match = +45% total
      expect(breakdown.trend_alignment_boost).toBeCloseTo(0.45, 10);

      // Verify final multiplier incorporates all boosts
      // Base multipliers + phase boosts + trend boosts should result in higher final multiplier
      expect(breakdown.final_multiplier).toBeGreaterThan(1.0);
      
      // Verify confluence score is high due to alignment
      expect(decision.confluence_score).toBeGreaterThanOrEqual(40); // 4H signal = 40% weight minimum
    });
  });

  describe('Phase Confidence Boost Scenarios', () => {
    it('should apply +20% confidence boost when phase htf_alignment is true', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      const phase = generatePhase('SPY', '4H', 'BULLISH', 60, true); // htf_alignment = true
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      phaseStore.updatePhase(phase);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      expect(decision.breakdown.phase_confidence_boost).toBe(0.20);
      expect(decision.breakdown.phase_position_boost).toBe(0.0); // confidence < 70
    });

    it('should not apply phase confidence boost when htf_alignment is false', () => {
      const signal = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH');
      const phase = generatePhase('SPY', '4H', 'BULLISH', 85, false); // htf_alignment = false
      
      signalStore.storeSignal(signal);
      phaseStore.updatePhase(phase);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      expect(decision.breakdown.phase_confidence_boost).toBe(0.0);
      expect(decision.breakdown.phase_position_boost).toBe(0.0);
    });

    it('should apply both phase boosts when confidence >= 70 AND htf_alignment = true', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      const phase = generatePhase('SPY', '4H', 'BULLISH', 75, true); // Both conditions met
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      phaseStore.updatePhase(phase);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      expect(decision.breakdown.phase_confidence_boost).toBe(0.20);
      expect(decision.breakdown.phase_position_boost).toBe(0.10);
    });
  });

  describe('Trend Position Boost Scenarios', () => {
    it('should apply +30% position boost for STRONG trend alignment', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      const trend = generateTrend('SPY', 100, 'STRONG', 'NEUTRAL'); // STRONG but no HTF bias match
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      trendStore.storeTrend(trend);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // Should have +30% for STRONG alignment, +0% for HTF bias (NEUTRAL vs LONG)
      expect(decision.breakdown.trend_alignment_boost).toBe(0.30);
    });

    it('should apply +15% confidence boost when HTF bias matches signal direction', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      
      // Create a trend with MODERATE strength (no position boost) but HTF bias matches (confidence boost)
      // Use 5/8 = 62.5% alignment (MODERATE, not STRONG) with HTF bias = bullish
      const trend: TrendWebhook = {
        ticker: 'SPY',
        exchange: 'NASDAQ',
        timestamp: new Date().toISOString(),
        price: 450.00,
        timeframes: {
          tf3min: { direction: 'bullish', open: 449.50, close: 450.25 },
          tf5min: { direction: 'bullish', open: 450.00, close: 450.50 },
          tf15min: { direction: 'bullish', open: 450.75, close: 450.25 },
          tf30min: { direction: 'bearish', open: 450.25, close: 450.30 },
          tf60min: { direction: 'bullish', open: 450.00, close: 450.75 },
          tf240min: { direction: 'bullish', open: 449.00, close: 451.00 }, // HTF bias matches LONG
          tf1week: { direction: 'bearish', open: 451.00, close: 450.00 },
          tf1month: { direction: 'bearish', open: 452.00, close: 449.00 },
        },
      };
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      trendStore.storeTrend(trend);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // Should have +0% for MODERATE alignment, +15% for HTF bias match
      expect(decision.breakdown.trend_alignment_boost).toBeCloseTo(0.15, 10);
    });

    it('should apply +45% total boost for STRONG trend with matching HTF bias', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      const trend = generateTrend('SPY', 100, 'STRONG', 'BULLISH'); // Both conditions met
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      trendStore.storeTrend(trend);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // Should have +30% for STRONG + +15% for HTF bias match = +45%
      expect(decision.breakdown.trend_alignment_boost).toBeCloseTo(0.45, 10);
    });

    it('should not apply trend boosts for WEAK/CHOPPY trends', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      
      // Test WEAK trend (4/8 = 50% alignment) with HTF bias mismatch (no confidence boost)
      const trendWeak: TrendWebhook = {
        ticker: 'SPY',
        exchange: 'NASDAQ',
        timestamp: new Date().toISOString(),
        price: 450.00,
        timeframes: {
          tf3min: { direction: 'bullish', open: 449.50, close: 450.25 },
          tf5min: { direction: 'bullish', open: 450.00, close: 450.50 },
          tf15min: { direction: 'bearish', open: 450.75, close: 450.25 },
          tf30min: { direction: 'bearish', open: 450.25, close: 450.30 },
          tf60min: { direction: 'bullish', open: 450.00, close: 450.75 },
          tf240min: { direction: 'bearish', open: 449.00, close: 448.00 }, // HTF bias DOESN'T match LONG
          tf1week: { direction: 'bearish', open: 451.00, close: 450.00 },
          tf1month: { direction: 'bullish', open: 452.00, close: 453.00 },
        },
      };
      
      // Test CHOPPY trend (3/8 = 37.5% alignment) with HTF bias mismatch
      const trendChoppy: TrendWebhook = {
        ticker: 'SPY',
        exchange: 'NASDAQ',
        timestamp: new Date().toISOString(),
        price: 450.00,
        timeframes: {
          tf3min: { direction: 'bullish', open: 449.50, close: 450.25 },
          tf5min: { direction: 'bearish', open: 450.00, close: 449.50 },
          tf15min: { direction: 'bearish', open: 450.75, close: 450.25 },
          tf30min: { direction: 'neutral', open: 450.25, close: 450.30 },
          tf60min: { direction: 'bearish', open: 450.00, close: 449.75 },
          tf240min: { direction: 'bearish', open: 449.00, close: 448.00 }, // HTF bias DOESN'T match LONG
          tf1week: { direction: 'bearish', open: 451.00, close: 450.00 },
          tf1month: { direction: 'bullish', open: 452.00, close: 453.00 },
        },
      };
      
      // Test WEAK trend
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      trendStore.storeTrend(trendWeak);
      let activeSignals = signalStore.getActiveSignals();
      let activePhases = phaseStore.getActivePhases();
      let decision = makeDecision(activeSignals, activePhases, trendStore);
      expect(decision.breakdown.trend_alignment_boost).toBeCloseTo(0.0, 10); // No boosts
      
      // Test CHOPPY trend
      trendStore.clear();
      trendStore.storeTrend(trendChoppy);
      decision = makeDecision(activeSignals, activePhases, trendStore);
      expect(decision.breakdown.trend_alignment_boost).toBeCloseTo(0.0, 10); // No boosts
    });
  });

  describe('Conflicting Scenarios', () => {
    it('should handle phase-signal direction conflict', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      const phase = generatePhase('SPY', '4H', 'BEARISH', 80, true); // Conflicting bias
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      phaseStore.updatePhase(phase);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // Should NOT apply phase boosts because phase direction conflicts with signal direction
      expect(decision.breakdown.phase_confidence_boost).toBe(0.0);
      expect(decision.breakdown.phase_position_boost).toBe(0.0);
    });

    it('should handle trend-signal direction conflict', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      const trend = generateTrend('SPY', 100, 'STRONG', 'BEARISH'); // Conflicting HTF bias
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      trendStore.storeTrend(trend);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // Should get +30% for STRONG alignment, +0% for HTF bias mismatch
      expect(decision.breakdown.trend_alignment_boost).toBe(0.30);
    });
  });

  describe('No Phase 1B Data Scenarios', () => {
    it('should work normally with no phase or trend data', () => {
      const signal = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH');
      
      signalStore.storeSignal(signal);
      // No phase or trend data stored

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // Should have no Phase 1B boosts
      expect(decision.breakdown.phase_confidence_boost).toBe(0.0);
      expect(decision.breakdown.phase_position_boost).toBe(0.0);
      expect(decision.breakdown.trend_alignment_boost).toBe(0.0);
      
      // Should still make a decision based on signal alone
      expect(['EXECUTE', 'WAIT', 'SKIP']).toContain(decision.decision);
    });

    it('should work with only phase data (no trend)', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      const phase = generatePhase('SPY', '4H', 'BULLISH', 85, true);
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      phaseStore.updatePhase(phase);
      // No trend data

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // Should have phase boosts but no trend boosts
      expect(decision.breakdown.phase_confidence_boost).toBe(0.20);
      expect(decision.breakdown.phase_position_boost).toBe(0.10);
      expect(decision.breakdown.trend_alignment_boost).toBe(0.0);
    });

    it('should work with only trend data (no phase)', () => {
      const signal4H = generateSignal('SPY', '240', 'LONG', 8.0, 'HIGH'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 7.0, 'HIGH');  // 1H = 25% -> Total 65%
      const trend = generateTrend('SPY', 100, 'STRONG', 'BULLISH');
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      trendStore.storeTrend(trend);
      // No phase data

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // Should have trend boosts but no phase boosts
      expect(decision.breakdown.phase_confidence_boost).toBe(0.0);
      expect(decision.breakdown.phase_position_boost).toBe(0.0);
      expect(decision.breakdown.trend_alignment_boost).toBeCloseTo(0.45, 10);
    });
  });

  describe('Final Multiplier Integration', () => {
    it('should incorporate all Phase 1B factors into final multiplier calculation', () => {
      // Create multiple high-quality signals for high confluence
      const signal4H = generateSignal('SPY', '240', 'LONG', 9.5, 'EXTREME'); // 4H = 40%
      const signal1H = generateSignal('SPY', '60', 'LONG', 9.0, 'EXTREME');  // 1H = 25%
      const signal30M = generateSignal('SPY', '30', 'LONG', 8.5, 'HIGH');    // 30M = 15%
      // Total confluence: 40% + 25% + 15% = 80% (high confluence multiplier)
      
      const phase = generatePhase('SPY', '4H', 'BULLISH', 90, true); // Both phase boosts
      const trend = generateTrend('SPY', 100, 'STRONG', 'BULLISH'); // Both trend boosts
      
      signalStore.storeSignal(signal4H);
      signalStore.storeSignal(signal1H);
      signalStore.storeSignal(signal30M);
      phaseStore.updatePhase(phase);
      trendStore.storeTrend(trend);

      const activeSignals = signalStore.getActiveSignals();
      const activePhases = phaseStore.getActivePhases();
      const decision = makeDecision(activeSignals, activePhases, trendStore);
      
      // With high-quality signals + high confluence + all Phase 1B boosts, final multiplier should be substantial
      expect(decision.breakdown.final_multiplier).toBeGreaterThan(1.5);
      
      // Verify it's still within bounds (0.5-3.0)
      expect(decision.breakdown.final_multiplier).toBeGreaterThanOrEqual(0.5);
      expect(decision.breakdown.final_multiplier).toBeLessThanOrEqual(3.0);
      
      // Should result in EXECUTE decision
      expect(decision.decision).toBe('EXECUTE');
      expect(decision.recommended_contracts).toBeGreaterThan(0);
    });
  });
});