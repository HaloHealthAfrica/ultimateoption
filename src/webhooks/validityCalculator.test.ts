/**
 * Property Tests for Signal Validity Calculation
 * 
 * Property 2: Signal Validity Calculation
 * For any valid EnrichedSignal, the calculated validity period SHALL equal:
 * base_timeframe × role_multiplier × quality_multiplier × session_multiplier,
 * clamped between base_timeframe and 720 minutes.
 * 
 * Validates: Requirements 1.6, 1.8, 1.9, 1.10, 1.11
 */

import * as fc from 'fast-check';
import {
  calculateSignalValidityMinutes,
  getValidityBreakdown,
  TIMEFRAME_ROLE_MULTIPLIERS,
  QUALITY_MULTIPLIERS,
  SESSION_MULTIPLIERS,
  MAX_VALIDITY_MINUTES,
} from './validityCalculator';
import {
  EnrichedSignal,
  Timeframe,
  SignalQuality,
  MarketSession,
  DayOfWeek,
} from '@/types/signal';

// Arbitrary generators
const timeframeArb = fc.constantFrom<Timeframe>('3', '5', '15', '30', '60', '240');
const qualityArb = fc.constantFrom<SignalQuality>('EXTREME', 'HIGH', 'MEDIUM');
const sessionArb = fc.constantFrom<MarketSession>('OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS');
const dayOfWeekArb = fc.constantFrom<DayOfWeek>('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

// Helper for finite doubles
const finiteDouble = (opts?: { min?: number; max?: number }) => 
  fc.double({ 
    min: opts?.min ?? -1e10, 
    max: opts?.max ?? 1e10, 
    noNaN: true,
    noDefaultInfinity: true,
  });

// Minimal signal generator for validity testing
const minimalSignalArb = fc.record({
  signal: fc.record({
    type: fc.constantFrom('LONG' as const, 'SHORT' as const),
    timeframe: timeframeArb,
    quality: qualityArb,
    ai_score: finiteDouble({ min: 0, max: 10.5 }),
    timestamp: fc.integer({ min: 0 }),
    bar_time: fc.string({ minLength: 1 }),
  }),
  instrument: fc.record({
    exchange: fc.constant('NYSE'),
    ticker: fc.constant('SPY'),
    current_price: finiteDouble({ min: 100, max: 500 }),
  }),
  entry: fc.record({
    price: finiteDouble({ min: 100, max: 500 }),
    stop_loss: finiteDouble({ min: 90, max: 490 }),
    target_1: finiteDouble({ min: 110, max: 510 }),
    target_2: finiteDouble({ min: 120, max: 520 }),
    stop_reason: fc.constant('ATR'),
  }),
  risk: fc.record({
    amount: finiteDouble({ min: 100, max: 1000 }),
    rr_ratio_t1: finiteDouble({ min: 1, max: 5 }),
    rr_ratio_t2: finiteDouble({ min: 2, max: 10 }),
    stop_distance_pct: finiteDouble({ min: 0.5, max: 5 }),
    recommended_shares: fc.integer({ min: 1, max: 1000 }),
    recommended_contracts: fc.integer({ min: 1, max: 100 }),
    position_multiplier: finiteDouble({ min: 0.5, max: 3 }),
    account_risk_pct: finiteDouble({ min: 0.5, max: 2 }),
    max_loss_dollars: finiteDouble({ min: 100, max: 1000 }),
  }),
  market_context: fc.record({
    vwap: finiteDouble({ min: 100, max: 500 }),
    pmh: finiteDouble({ min: 100, max: 500 }),
    pml: finiteDouble({ min: 100, max: 500 }),
    day_open: finiteDouble({ min: 100, max: 500 }),
    day_change_pct: finiteDouble({ min: -5, max: 5 }),
    price_vs_vwap_pct: finiteDouble({ min: -5, max: 5 }),
    distance_to_pmh_pct: finiteDouble({ min: -10, max: 10 }),
    distance_to_pml_pct: finiteDouble({ min: -10, max: 10 }),
    atr: finiteDouble({ min: 1, max: 10 }),
    volume_vs_avg: finiteDouble({ min: 0.5, max: 3 }),
    candle_direction: fc.constantFrom('GREEN' as const, 'RED' as const),
    candle_size_atr: finiteDouble({ min: 0.5, max: 2 }),
  }),
  trend: fc.record({
    ema_8: finiteDouble({ min: 100, max: 500 }),
    ema_21: finiteDouble({ min: 100, max: 500 }),
    ema_50: finiteDouble({ min: 100, max: 500 }),
    alignment: fc.constantFrom('BULLISH' as const, 'BEARISH' as const, 'NEUTRAL' as const),
    strength: finiteDouble({ min: 0, max: 100 }),
    rsi: finiteDouble({ min: 0, max: 100 }),
    macd_signal: fc.constantFrom('BULLISH' as const, 'BEARISH' as const),
  }),
  mtf_context: fc.record({
    '4h_bias': fc.constantFrom('LONG' as const, 'SHORT' as const),
    '4h_rsi': finiteDouble({ min: 0, max: 100 }),
    '1h_bias': fc.constantFrom('LONG' as const, 'SHORT' as const),
  }),
  score_breakdown: fc.record({
    strat: finiteDouble({ min: 0, max: 10 }),
    trend: finiteDouble({ min: 0, max: 10 }),
    gamma: finiteDouble({ min: 0, max: 10 }),
    vwap: finiteDouble({ min: 0, max: 10 }),
    mtf: finiteDouble({ min: 0, max: 10 }),
    golf: finiteDouble({ min: 0, max: 10 }),
  }),
  components: fc.constant([]),
  time_context: fc.record({
    market_session: sessionArb,
    day_of_week: dayOfWeekArb,
  }),
}) as fc.Arbitrary<EnrichedSignal>;


describe('Property 2: Signal Validity Calculation', () => {
  /**
   * Feature: options-trading-platform, Property 2: Signal Validity Calculation
   * Validity = base_tf × role_mult × quality_mult × session_mult, clamped to [base_tf, 720]
   */
  it('should calculate validity as base × role × quality × session, clamped to bounds', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const tf = signal.signal.timeframe;
        const quality = signal.signal.quality;
        const session = signal.time_context.market_session;
        
        const baseTf = parseInt(tf, 10);
        const expectedRaw = baseTf * 
          TIMEFRAME_ROLE_MULTIPLIERS[tf] * 
          QUALITY_MULTIPLIERS[quality] * 
          SESSION_MULTIPLIERS[session];
        
        const expectedClamped = Math.min(Math.max(expectedRaw, baseTf), MAX_VALIDITY_MINUTES);
        const actual = calculateSignalValidityMinutes(signal);
        
        expect(actual).toBeCloseTo(expectedClamped, 5);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 2: Signal Validity Calculation
   * Validity should never be less than base timeframe
   */
  it('should never return validity less than base timeframe (min bound)', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const baseTf = parseInt(signal.signal.timeframe, 10);
        const validity = calculateSignalValidityMinutes(signal);
        
        expect(validity).toBeGreaterThanOrEqual(baseTf);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 2: Signal Validity Calculation
   * Validity should never exceed 720 minutes (max bound)
   */
  it('should never return validity greater than 720 minutes (max bound)', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const validity = calculateSignalValidityMinutes(signal);
        
        expect(validity).toBeLessThanOrEqual(MAX_VALIDITY_MINUTES);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 2: Signal Validity Calculation
   * Higher quality signals should have >= validity than lower quality (same TF/session)
   */
  it('should give higher quality signals longer or equal validity', () => {
    fc.assert(
      fc.property(
        minimalSignalArb,
        (baseSignal) => {
          // Create variants with different qualities
          const extremeSignal = { 
            ...baseSignal, 
            signal: { ...baseSignal.signal, quality: 'EXTREME' as const } 
          };
          const highSignal = { 
            ...baseSignal, 
            signal: { ...baseSignal.signal, quality: 'HIGH' as const } 
          };
          const mediumSignal = { 
            ...baseSignal, 
            signal: { ...baseSignal.signal, quality: 'MEDIUM' as const } 
          };
          
          const extremeValidity = calculateSignalValidityMinutes(extremeSignal);
          const highValidity = calculateSignalValidityMinutes(highSignal);
          const mediumValidity = calculateSignalValidityMinutes(mediumSignal);
          
          // EXTREME >= HIGH >= MEDIUM (before clamping effects)
          expect(extremeValidity).toBeGreaterThanOrEqual(highValidity);
          expect(highValidity).toBeGreaterThanOrEqual(mediumValidity);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 2: Signal Validity Calculation
   * 4H timeframe should have longest validity (role multiplier = 2.0)
   */
  it('should give 4H timeframe the longest validity for same quality/session', () => {
    fc.assert(
      fc.property(
        qualityArb,
        sessionArb,
        (quality, session) => {
          // Create signals for each timeframe with same quality/session
          const createSignal = (tf: Timeframe): EnrichedSignal => ({
            signal: {
              type: 'LONG',
              timeframe: tf,
              quality,
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
            time_context: { market_session: session, day_of_week: 'TUESDAY' },
          });
          
          const validity4H = calculateSignalValidityMinutes(createSignal('240'));
          const validity1H = calculateSignalValidityMinutes(createSignal('60'));
          const validity30M = calculateSignalValidityMinutes(createSignal('30'));
          
          // 4H should have highest validity (unless clamped at max)
          expect(validity4H).toBeGreaterThanOrEqual(validity1H);
          expect(validity1H).toBeGreaterThanOrEqual(validity30M);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 2: Signal Validity Calculation
   * Breakdown should match calculated validity
   */
  it('should have breakdown that matches final validity', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const validity = calculateSignalValidityMinutes(signal);
        const breakdown = getValidityBreakdown(signal);
        
        expect(breakdown.final_validity_minutes).toBeCloseTo(validity, 5);
        
        // Verify breakdown components
        const baseTf = parseInt(signal.signal.timeframe, 10);
        expect(breakdown.base_tf_minutes).toBe(baseTf);
        expect(breakdown.role_multiplier).toBe(TIMEFRAME_ROLE_MULTIPLIERS[signal.signal.timeframe]);
        expect(breakdown.quality_multiplier).toBe(QUALITY_MULTIPLIERS[signal.signal.quality]);
        expect(breakdown.session_multiplier).toBe(SESSION_MULTIPLIERS[signal.time_context.market_session]);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 2: Signal Validity Calculation
   * Clamping should be correctly reported in breakdown
   */
  it('should correctly report clamping in breakdown', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const breakdown = getValidityBreakdown(signal);
        
        if (breakdown.clamped) {
          if (breakdown.clamp_reason === 'min') {
            expect(breakdown.raw_validity_minutes).toBeLessThan(breakdown.base_tf_minutes);
            expect(breakdown.final_validity_minutes).toBe(breakdown.base_tf_minutes);
          } else if (breakdown.clamp_reason === 'max') {
            expect(breakdown.raw_validity_minutes).toBeGreaterThan(MAX_VALIDITY_MINUTES);
            expect(breakdown.final_validity_minutes).toBe(MAX_VALIDITY_MINUTES);
          }
        } else {
          expect(breakdown.raw_validity_minutes).toBeCloseTo(breakdown.final_validity_minutes, 5);
        }
      }),
      { numRuns: 100 }
    );
  });
});
