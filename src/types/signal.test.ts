/**
 * Property Tests for Schema Validation
 * 
 * Property 1: Schema Validation Correctness
 * For any webhook payload, the Webhook_Receiver SHALL correctly accept valid 
 * EnrichedSignal payloads and reject invalid payloads with descriptive errors.
 * 
 * Validates: Requirements 1.1, 1.4
 */

import * as fc from 'fast-check';
import {
  safeParseEnrichedSignal,
  SignalType,
  Timeframe,
  SignalQuality,
  CandleDirection,
  TrendAlignment,
  MacdSignal,
  MarketSession,
  DayOfWeek,
  MtfBias,
} from './signal';

// Arbitrary generators for valid enum values
const signalTypeArb = fc.constantFrom<SignalType>('LONG', 'SHORT');
const timeframeArb = fc.constantFrom<Timeframe>('3', '5', '15', '30', '60', '240');
const qualityArb = fc.constantFrom<SignalQuality>('EXTREME', 'HIGH', 'MEDIUM');
const candleDirectionArb = fc.constantFrom<CandleDirection>('GREEN', 'RED');
const trendAlignmentArb = fc.constantFrom<TrendAlignment>('BULLISH', 'BEARISH', 'NEUTRAL');
const macdSignalArb = fc.constantFrom<MacdSignal>('BULLISH', 'BEARISH');
const marketSessionArb = fc.constantFrom<MarketSession>('OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS');
const dayOfWeekArb = fc.constantFrom<DayOfWeek>('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');
const mtfBiasArb = fc.constantFrom<MtfBias>('LONG', 'SHORT');

// Helper for finite doubles (excludes NaN and Infinity)
const finiteDouble = (opts?: { min?: number; max?: number }) => 
  fc.double({ 
    min: opts?.min ?? -1e10, 
    max: opts?.max ?? 1e10, 
    noNaN: true,
    noDefaultInfinity: true,
  });

// Generator for valid EnrichedSignal
const validEnrichedSignalArb = fc.record({
  signal: fc.record({
    type: signalTypeArb,
    timeframe: timeframeArb,
    quality: qualityArb,
    ai_score: finiteDouble({ min: 0, max: 10.5 }),
    timestamp: fc.integer({ min: 0 }),
    bar_time: fc.string({ minLength: 1 }),
  }),
  instrument: fc.record({
    exchange: fc.string({ minLength: 1 }),
    ticker: fc.string({ minLength: 1 }),
    current_price: finiteDouble({ min: 0.01, max: 100000 }),
  }),
  entry: fc.record({
    price: finiteDouble({ min: 0.01, max: 100000 }),
    stop_loss: finiteDouble({ min: 0.01, max: 100000 }),
    target_1: finiteDouble({ min: 0.01, max: 100000 }),
    target_2: finiteDouble({ min: 0.01, max: 100000 }),
    stop_reason: fc.string(),
  }),
  risk: fc.record({
    amount: finiteDouble(),
    rr_ratio_t1: finiteDouble(),
    rr_ratio_t2: finiteDouble(),
    stop_distance_pct: finiteDouble(),
    recommended_shares: fc.integer({ min: 0 }),
    recommended_contracts: fc.integer({ min: 0 }),
    position_multiplier: finiteDouble(),
    account_risk_pct: finiteDouble(),
    max_loss_dollars: finiteDouble(),
  }),
  market_context: fc.record({
    vwap: finiteDouble(),
    pmh: finiteDouble(),
    pml: finiteDouble(),
    day_open: finiteDouble(),
    day_change_pct: finiteDouble(),
    price_vs_vwap_pct: finiteDouble(),
    distance_to_pmh_pct: finiteDouble(),
    distance_to_pml_pct: finiteDouble(),
    atr: finiteDouble({ min: 0.001, max: 1000 }),
    volume_vs_avg: finiteDouble({ min: 0, max: 1e6 }),
    candle_direction: candleDirectionArb,
    candle_size_atr: finiteDouble(),
  }),
  trend: fc.record({
    ema_8: finiteDouble(),
    ema_21: finiteDouble(),
    ema_50: finiteDouble(),
    alignment: trendAlignmentArb,
    strength: finiteDouble({ min: 0, max: 100 }),
    rsi: finiteDouble({ min: 0, max: 100 }),
    macd_signal: macdSignalArb,
  }),
  mtf_context: fc.record({
    '4h_bias': mtfBiasArb,
    '4h_rsi': finiteDouble({ min: 0, max: 100 }),
    '1h_bias': mtfBiasArb,
  }),
  score_breakdown: fc.record({
    strat: finiteDouble(),
    trend: finiteDouble(),
    gamma: finiteDouble(),
    vwap: finiteDouble(),
    mtf: finiteDouble(),
    golf: finiteDouble(),
  }),
  components: fc.array(fc.string()),
  time_context: fc.record({
    market_session: marketSessionArb,
    day_of_week: dayOfWeekArb,
  }),
});


describe('Property 1: Schema Validation Correctness', () => {
  /**
   * Feature: options-trading-platform, Property 1: Schema Validation Correctness
   * For any valid EnrichedSignal, parsing should succeed
   */
  it('should accept all valid EnrichedSignal payloads', () => {
    fc.assert(
      fc.property(validEnrichedSignalArb, (signal) => {
        // Wrap in webhook payload format
        const payload = { text: JSON.stringify(signal) };
        
        // Parse should succeed
        const result = safeParseEnrichedSignal(payload);
        expect(result.success).toBe(true);
        
        if (result.success) {
          // Parsed data should match input
          expect(result.data.signal.type).toBe(signal.signal.type);
          expect(result.data.signal.timeframe).toBe(signal.signal.timeframe);
          expect(result.data.signal.quality).toBe(signal.signal.quality);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 1: Schema Validation Correctness
   * For any invalid signal type, parsing should fail with descriptive error
   */
  it('should reject invalid signal types with descriptive errors', () => {
    fc.assert(
      fc.property(
        validEnrichedSignalArb,
        fc.string().filter(s => s !== 'LONG' && s !== 'SHORT'),
        (signal, invalidType) => {
          const invalidSignal = {
            ...signal,
            signal: { ...signal.signal, type: invalidType },
          };
          const payload = { text: JSON.stringify(invalidSignal) };
          
          const result = safeParseEnrichedSignal(payload);
          expect(result.success).toBe(false);
          
          if (!result.success) {
            // Error should mention the invalid field
            const errorPaths = result.error.issues.map(i => i.path.join('.'));
            expect(errorPaths.some(p => p.includes('signal') || p.includes('type'))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 1: Schema Validation Correctness
   * For any invalid timeframe, parsing should fail
   */
  it('should reject invalid timeframes', () => {
    fc.assert(
      fc.property(
        validEnrichedSignalArb,
        fc.string().filter(s => !['3', '5', '15', '30', '60', '240'].includes(s)),
        (signal, invalidTf) => {
          const invalidSignal = {
            ...signal,
            signal: { ...signal.signal, timeframe: invalidTf },
          };
          const payload = { text: JSON.stringify(invalidSignal) };
          
          const result = safeParseEnrichedSignal(payload);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 1: Schema Validation Correctness
   * For any ai_score outside [0, 10.5], parsing should fail
   */
  it('should reject ai_score outside valid range', () => {
    fc.assert(
      fc.property(
        validEnrichedSignalArb,
        fc.oneof(
          fc.double({ min: -1000, max: -0.001, noNaN: true }),
          fc.double({ min: 10.501, max: 1000, noNaN: true })
        ),
        (signal, invalidScore) => {
          const invalidSignal = {
            ...signal,
            signal: { ...signal.signal, ai_score: invalidScore },
          };
          const payload = { text: JSON.stringify(invalidSignal) };
          
          const result = safeParseEnrichedSignal(payload);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 1: Schema Validation Correctness
   * Invalid JSON should be rejected with descriptive error
   */
  it('should reject invalid JSON with descriptive error', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => {
          try { JSON.parse(s); return false; } catch { return true; }
        }),
        (invalidJson) => {
          const payload = { text: invalidJson };
          
          const result = safeParseEnrichedSignal(payload);
          expect(result.success).toBe(false);
          
          if (!result.success) {
            expect(result.error.issues.some(i => 
              i.message.toLowerCase().includes('json') || 
              i.path.includes('text')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 1: Schema Validation Correctness
   * Missing required fields should be rejected
   */
  it('should reject payloads with missing required fields', () => {
    fc.assert(
      fc.property(
        validEnrichedSignalArb,
        fc.constantFrom('signal', 'instrument', 'entry', 'risk', 'market_context', 'trend', 'mtf_context', 'score_breakdown', 'time_context'),
        (signal, fieldToRemove) => {
          const invalidSignal = { ...signal };
          delete (invalidSignal as Record<string, unknown>)[fieldToRemove];
          
          const payload = { text: JSON.stringify(invalidSignal) };
          
          const result = safeParseEnrichedSignal(payload);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 1: Schema Validation Correctness
   * Payload without text wrapper should be rejected
   */
  it('should reject payloads without text wrapper', () => {
    fc.assert(
      fc.property(validEnrichedSignalArb, (signal) => {
        // Send signal directly without text wrapper
        const result = safeParseEnrichedSignal(signal);
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 1: Schema Validation Correctness
   * Round-trip: valid signal -> stringify -> parse should equal original
   */
  it('should preserve data through round-trip parsing', () => {
    fc.assert(
      fc.property(validEnrichedSignalArb, (signal) => {
        const payload = { text: JSON.stringify(signal) };
        const result = safeParseEnrichedSignal(payload);
        
        expect(result.success).toBe(true);
        if (result.success) {
          // Key fields should match exactly
          expect(result.data.signal.type).toBe(signal.signal.type);
          expect(result.data.signal.timeframe).toBe(signal.signal.timeframe);
          expect(result.data.signal.quality).toBe(signal.signal.quality);
          expect(result.data.instrument.ticker).toBe(signal.instrument.ticker);
          expect(result.data.time_context.market_session).toBe(signal.time_context.market_session);
          expect(result.data.time_context.day_of_week).toBe(signal.time_context.day_of_week);
        }
      }),
      { numRuns: 100 }
    );
  });
});
