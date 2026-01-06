/**
 * Property Tests for Timeframe Store
 * 
 * Property 3: Signal Expiry Enforcement
 * For any stored signal, after its validity period has elapsed,
 * the signal SHALL NOT be present in active storage.
 * 
 * Property 4: Signal Conflict Resolution
 * For any two signals arriving for the same timeframe, the Timeframe_Store
 * SHALL retain the signal with higher quality, or the existing signal if qualities are equal.
 * 
 * Validates: Requirements 1.2, 1.3, 1.12
 */

import * as fc from 'fast-check';
import { TimeframeStore } from './timeframeStore';
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

// Create a signal with specific timeframe and quality
function createSignal(
  timeframe: Timeframe,
  quality: SignalQuality,
  session: MarketSession = 'MIDDAY'
): EnrichedSignal {
  return {
    signal: {
      type: 'LONG',
      timeframe,
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
  };
}

// Minimal signal generator
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


describe('Property 3: Signal Expiry Enforcement', () => {
  let store: TimeframeStore;

  beforeEach(() => {
    store = new TimeframeStore(60000); // Long interval to prevent auto-cleanup during tests
  });

  afterEach(() => {
    store.destroy();
  });

  /**
   * Feature: options-trading-platform, Property 3: Signal Expiry Enforcement
   * After validity period, signal should not be in active storage
   */
  it('should not return expired signals from getActiveSignals', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const receivedAt = 1000000; // Fixed base time
        const stored = store.storeSignal(signal, receivedAt);
        
        // Signal should be active before expiry
        const beforeExpiry = stored.expires_at - 1;
        const activeBefore = store.getActiveSignals(beforeExpiry);
        expect(activeBefore.has(signal.signal.timeframe)).toBe(true);
        
        // Signal should NOT be active after expiry
        const afterExpiry = stored.expires_at + 1;
        const activeAfter = store.getActiveSignals(afterExpiry);
        expect(activeAfter.has(signal.signal.timeframe)).toBe(false);
        
        store.clear();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 3: Signal Expiry Enforcement
   * getSignalByTimeframe should return null for expired signals
   */
  it('should return null for expired signals via getSignalByTimeframe', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const receivedAt = 1000000;
        const stored = store.storeSignal(signal, receivedAt);
        const tf = signal.signal.timeframe;
        
        // Should return signal before expiry
        expect(store.getSignalByTimeframe(tf, stored.expires_at - 1)).not.toBeNull();
        
        // Should return null after expiry
        expect(store.getSignalByTimeframe(tf, stored.expires_at + 1)).toBeNull();
        
        store.clear();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 3: Signal Expiry Enforcement
   * cleanupExpired should remove all expired signals
   */
  it('should remove expired signals on cleanup', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const receivedAt = 1000000;
        const stored = store.storeSignal(signal, receivedAt);
        
        // Cleanup after expiry
        const afterExpiry = stored.expires_at + 1;
        const removed = store.cleanupExpired(afterExpiry);
        
        expect(removed).toBe(1);
        expect(store.getActiveCount(afterExpiry)).toBe(0);
        
        store.clear();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 3: Signal Expiry Enforcement
   * Expiry time should be exactly receivedAt + validity
   */
  it('should set expiry time correctly based on validity', () => {
    fc.assert(
      fc.property(minimalSignalArb, (signal) => {
        const receivedAt = 1000000;
        const stored = store.storeSignal(signal, receivedAt);
        
        const expectedValidityMs = stored.validity_minutes * 60 * 1000;
        const expectedExpiry = receivedAt + expectedValidityMs;
        
        expect(stored.expires_at).toBe(expectedExpiry);
        
        store.clear();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 4: Signal Conflict Resolution', () => {
  let store: TimeframeStore;

  beforeEach(() => {
    store = new TimeframeStore(60000);
  });

  afterEach(() => {
    store.destroy();
  });

  /**
   * Feature: options-trading-platform, Property 4: Signal Conflict Resolution
   * Higher quality signal should replace lower quality for same timeframe
   */
  it('should replace lower quality signal with higher quality', () => {
    fc.assert(
      fc.property(timeframeArb, sessionArb, (tf, session) => {
        const receivedAt = 1000000;
        
        // Store MEDIUM quality first
        const mediumSignal = createSignal(tf, 'MEDIUM', session);
        store.storeSignal(mediumSignal, receivedAt);
        
        // Store HIGH quality - should replace
        const highSignal = createSignal(tf, 'HIGH', session);
        const result = store.storeSignal(highSignal, receivedAt + 1000);
        
        expect(result.signal.signal.quality).toBe('HIGH');
        
        // Verify only one signal stored
        const active = store.getActiveSignals(receivedAt + 1000);
        expect(active.size).toBe(1);
        expect(active.get(tf)?.signal.signal.quality).toBe('HIGH');
        
        store.clear();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 4: Signal Conflict Resolution
   * Lower quality signal should NOT replace higher quality
   */
  it('should NOT replace higher quality signal with lower quality', () => {
    fc.assert(
      fc.property(timeframeArb, sessionArb, (tf, session) => {
        const receivedAt = 1000000;
        
        // Store EXTREME quality first
        const extremeSignal = createSignal(tf, 'EXTREME', session);
        store.storeSignal(extremeSignal, receivedAt);
        
        // Try to store MEDIUM quality - should NOT replace
        const mediumSignal = createSignal(tf, 'MEDIUM', session);
        const result = store.storeSignal(mediumSignal, receivedAt + 1000);
        
        // Should return the existing EXTREME signal
        expect(result.signal.signal.quality).toBe('EXTREME');
        
        // Verify EXTREME is still stored
        const active = store.getActiveSignals(receivedAt + 1000);
        expect(active.get(tf)?.signal.signal.quality).toBe('EXTREME');
        
        store.clear();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 4: Signal Conflict Resolution
   * Equal quality signal should NOT replace existing (existing wins on tie)
   */
  it('should NOT replace signal with equal quality (existing wins)', () => {
    fc.assert(
      fc.property(timeframeArb, qualityArb, sessionArb, (tf, quality, session) => {
        const receivedAt = 1000000;
        
        // Store first signal
        const firstSignal = createSignal(tf, quality, session);
        const firstStored = store.storeSignal(firstSignal, receivedAt);
        
        // Try to store second signal with same quality
        const secondSignal = createSignal(tf, quality, session);
        const result = store.storeSignal(secondSignal, receivedAt + 1000);
        
        // Should return the first signal (existing wins on tie)
        expect(result.received_at).toBe(firstStored.received_at);
        
        store.clear();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 4: Signal Conflict Resolution
   * New signal should replace expired signal regardless of quality
   */
  it('should replace expired signal regardless of quality', () => {
    fc.assert(
      fc.property(timeframeArb, sessionArb, (tf, session) => {
        const receivedAt = 1000000;
        
        // Store EXTREME quality first
        const extremeSignal = createSignal(tf, 'EXTREME', session);
        const stored = store.storeSignal(extremeSignal, receivedAt);
        
        // After expiry, even MEDIUM should replace
        const afterExpiry = stored.expires_at + 1;
        const mediumSignal = createSignal(tf, 'MEDIUM', session);
        const result = store.storeSignal(mediumSignal, afterExpiry);
        
        // Should be the new MEDIUM signal
        expect(result.signal.signal.quality).toBe('MEDIUM');
        expect(result.received_at).toBe(afterExpiry);
        
        store.clear();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 4: Signal Conflict Resolution
   * Quality ordering: EXTREME > HIGH > MEDIUM
   */
  it('should maintain quality ordering EXTREME > HIGH > MEDIUM', () => {
    const tf: Timeframe = '15';
    const receivedAt = 1000000;
    
    // Test all quality transitions
    const transitions = [
      { from: 'MEDIUM' as const, to: 'HIGH' as const, shouldReplace: true },
      { from: 'MEDIUM' as const, to: 'EXTREME' as const, shouldReplace: true },
      { from: 'HIGH' as const, to: 'EXTREME' as const, shouldReplace: true },
      { from: 'HIGH' as const, to: 'MEDIUM' as const, shouldReplace: false },
      { from: 'EXTREME' as const, to: 'HIGH' as const, shouldReplace: false },
      { from: 'EXTREME' as const, to: 'MEDIUM' as const, shouldReplace: false },
    ];
    
    for (const { from, to, shouldReplace } of transitions) {
      store.clear();
      
      const firstSignal = createSignal(tf, from);
      store.storeSignal(firstSignal, receivedAt);
      
      const secondSignal = createSignal(tf, to);
      const result = store.storeSignal(secondSignal, receivedAt + 1000);
      
      if (shouldReplace) {
        expect(result.signal.signal.quality).toBe(to);
      } else {
        expect(result.signal.signal.quality).toBe(from);
      }
    }
  });
});
