/**
 * Property Tests for Position Sizing
 * 
 * Property 11: Position Multiplier Bounds
 * For any calculated position multiplier, the final value SHALL be clamped between 0.5 and 3.0.
 * 
 * Property 13-16: Multiplier Mappings
 * Validates correct multiplier values for confluence, quality, HTF, and R:R.
 * 
 * Validates: Requirements 3.6-3.24
 */

import * as fc from 'fast-check';
import {
  calculatePositionMultiplier,
  calculateRawMultiplier,
  shouldSkipPosition,
  determineHTFAlignment,
} from './positionSizing';
import {
  getConfluenceMultiplier,
  QUALITY_MULTIPLIERS,
  HTF_ALIGNMENT_MULTIPLIERS,
  getRRMultiplier,
  getVolumeMultiplier,
  getTrendMultiplier,
  SESSION_MULTIPLIERS,
  DAY_MULTIPLIERS,
  POSITION_MULTIPLIER_MIN,
  POSITION_MULTIPLIER_MAX,
} from './matrices';
import { StoredSignal } from '@/webhooks/timeframeStore';
import { StoredPhase } from '@/webhooks/phaseStore';
import { EnrichedSignal, Timeframe, SignalQuality, MarketSession, DayOfWeek } from '@/types/signal';

// Helper to create a signal with specific parameters
function createSignal(params: {
  timeframe?: Timeframe;
  quality?: SignalQuality;
  session?: MarketSession;
  day?: DayOfWeek;
  rr?: number;
  volume?: number;
  trendStrength?: number;
  type?: 'LONG' | 'SHORT';
  aiScore?: number;
}): EnrichedSignal {
  return {
    signal: {
      type: params.type ?? 'LONG',
      timeframe: params.timeframe ?? '15',
      quality: params.quality ?? 'HIGH',
      ai_score: params.aiScore ?? 8,
      timestamp: Date.now(),
      bar_time: '2024-01-01T10:00:00Z',
    },
    instrument: { exchange: 'NYSE', ticker: 'SPY', current_price: 450 },
    entry: { price: 450, stop_loss: 445, target_1: 455, target_2: 460, stop_reason: 'ATR' },
    risk: { 
      amount: 500, 
      rr_ratio_t1: params.rr ?? 2, 
      rr_ratio_t2: 4, 
      stop_distance_pct: 1, 
      recommended_shares: 100, 
      recommended_contracts: 5, 
      position_multiplier: 1, 
      account_risk_pct: 1, 
      max_loss_dollars: 500 
    },
    market_context: { 
      vwap: 450, pmh: 455, pml: 445, day_open: 448, day_change_pct: 0.5, 
      price_vs_vwap_pct: 0, distance_to_pmh_pct: 1, distance_to_pml_pct: 1, 
      atr: 5, 
      volume_vs_avg: params.volume ?? 1, 
      candle_direction: 'GREEN', 
      candle_size_atr: 1 
    },
    trend: { 
      ema_8: 450, ema_21: 449, ema_50: 448, 
      alignment: 'BULLISH', 
      strength: params.trendStrength ?? 70, 
      rsi: 55, 
      macd_signal: 'BULLISH' 
    },
    mtf_context: { '4h_bias': 'LONG', '4h_rsi': 55, '1h_bias': 'LONG' },
    score_breakdown: { strat: 8, trend: 7, gamma: 6, vwap: 7, mtf: 8, golf: 7 },
    components: [],
    time_context: { 
      market_session: params.session ?? 'MIDDAY', 
      day_of_week: params.day ?? 'TUESDAY' 
    },
  };
}

// Helper to create stored signal
function createStoredSignal(signal: EnrichedSignal): StoredSignal {
  return {
    signal,
    received_at: Date.now(),
    expires_at: Date.now() + 3600000,
    validity_minutes: 60,
  };
}

// Arbitrary generators
const qualityArb = fc.constantFrom<SignalQuality>('EXTREME', 'HIGH', 'MEDIUM');
const sessionArb = fc.constantFrom<MarketSession>('OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS');
const dayArb = fc.constantFrom<DayOfWeek>('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');
const confluenceArb = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });
const rrArb = fc.double({ min: 0.5, max: 10, noNaN: true, noDefaultInfinity: true });
const volumeArb = fc.double({ min: 0.1, max: 5, noNaN: true, noDefaultInfinity: true });
const trendArb = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });


describe('Property 11: Position Multiplier Bounds', () => {
  /**
   * Feature: options-trading-platform, Property 11: Position Multiplier Bounds
   * Final multiplier should always be between 0.5 and 3.0
   */
  it('should clamp final multiplier between 0.5 and 3.0', () => {
    fc.assert(
      fc.property(
        confluenceArb,
        qualityArb,
        sessionArb,
        dayArb,
        rrArb,
        volumeArb,
        trendArb,
        (confluence, quality, session, day, rr, volume, trend) => {
          const signal = createSignal({ quality, session, day, rr, volume, trendStrength: trend });
          const signals = new Map<Timeframe, StoredSignal>();
          const phases = new Map<string, StoredPhase>();
          
          const breakdown = calculatePositionMultiplier(confluence, signal, signals, phases);
          
          expect(breakdown.final_multiplier).toBeGreaterThanOrEqual(POSITION_MULTIPLIER_MIN);
          expect(breakdown.final_multiplier).toBeLessThanOrEqual(POSITION_MULTIPLIER_MAX);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: options-trading-platform, Property 11: Position Multiplier Bounds
   * Raw multiplier can exceed bounds, but final is clamped
   */
  it('should allow raw multiplier to exceed bounds while clamping final', () => {
    // Create conditions for very high multiplier
    const signal = createSignal({
      quality: 'EXTREME',
      session: 'MIDDAY',
      day: 'TUESDAY',
      rr: 6,
      volume: 2,
      trendStrength: 90,
    });
    
    // Add aligned HTF signals
    const signals = new Map<Timeframe, StoredSignal>();
    signals.set('240', createStoredSignal(createSignal({ timeframe: '240', aiScore: 8 })));
    signals.set('60', createStoredSignal(createSignal({ timeframe: '60', aiScore: 8 })));
    
    const phases = new Map<string, StoredPhase>();
    
    const breakdown = calculatePositionMultiplier(95, signal, signals, phases);
    const raw = calculateRawMultiplier(breakdown);
    
    // Raw can be > 3.0, but final is clamped
    expect(breakdown.final_multiplier).toBeLessThanOrEqual(POSITION_MULTIPLIER_MAX);
    
    // If raw > max, final should be exactly max
    if (raw > POSITION_MULTIPLIER_MAX) {
      expect(breakdown.final_multiplier).toBe(POSITION_MULTIPLIER_MAX);
    }
  });
});

describe('Property 13: Confluence Multiplier Mapping', () => {
  /**
   * Feature: options-trading-platform, Property 13: Confluence Multiplier Mapping
   * 90%+=2.5x, 80%+=2.0x, 70%+=1.5x, 60%+=1.0x, 50%+=0.7x
   */
  it('should apply correct confluence multipliers', () => {
    const testCases = [
      { score: 95, expected: 2.5 },
      { score: 90, expected: 2.5 },
      { score: 85, expected: 2.0 },
      { score: 80, expected: 2.0 },
      { score: 75, expected: 1.5 },
      { score: 70, expected: 1.5 },
      { score: 65, expected: 1.0 },
      { score: 60, expected: 1.0 },
      { score: 55, expected: 0.7 },
      { score: 50, expected: 0.7 },
      { score: 45, expected: 0.5 },
      { score: 0, expected: 0.5 },
    ];
    
    for (const { score, expected } of testCases) {
      expect(getConfluenceMultiplier(score)).toBe(expected);
    }
  });

  it('should use confluence multiplier in breakdown', () => {
    fc.assert(
      fc.property(confluenceArb, (confluence) => {
        const signal = createSignal({});
        const signals = new Map<Timeframe, StoredSignal>();
        const phases = new Map<string, StoredPhase>();
        
        const breakdown = calculatePositionMultiplier(confluence, signal, signals, phases);
        
        expect(breakdown.confluence_multiplier).toBe(getConfluenceMultiplier(confluence));
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 14: Quality Multiplier Mapping', () => {
  /**
   * Feature: options-trading-platform, Property 14: Quality Multiplier Mapping
   * EXTREME=1.3x, HIGH=1.1x, MEDIUM=1.0x
   */
  it('should apply correct quality multipliers', () => {
    expect(QUALITY_MULTIPLIERS['EXTREME']).toBe(1.3);
    expect(QUALITY_MULTIPLIERS['HIGH']).toBe(1.1);
    expect(QUALITY_MULTIPLIERS['MEDIUM']).toBe(1.0);
  });

  it('should use quality multiplier in breakdown', () => {
    fc.assert(
      fc.property(qualityArb, (quality) => {
        const signal = createSignal({ quality });
        const signals = new Map<Timeframe, StoredSignal>();
        const phases = new Map<string, StoredPhase>();
        
        const breakdown = calculatePositionMultiplier(70, signal, signals, phases);
        
        expect(breakdown.quality_multiplier).toBe(QUALITY_MULTIPLIERS[quality]);
      }),
      { numRuns: 30 }
    );
  });
});

describe('Property 15: HTF Alignment Multiplier Mapping', () => {
  /**
   * Feature: options-trading-platform, Property 15: HTF Alignment Multiplier Mapping
   * PERFECT=1.3x, GOOD=1.15x, WEAK=0.85x, COUNTER=0.5x
   */
  it('should have correct HTF alignment multipliers', () => {
    expect(HTF_ALIGNMENT_MULTIPLIERS['PERFECT']).toBe(1.3);
    expect(HTF_ALIGNMENT_MULTIPLIERS['GOOD']).toBe(1.15);
    expect(HTF_ALIGNMENT_MULTIPLIERS['WEAK']).toBe(0.85);
    expect(HTF_ALIGNMENT_MULTIPLIERS['COUNTER']).toBe(0.5);
  });

  it('should detect PERFECT alignment when 4H and 1H aligned', () => {
    const signal = createSignal({ type: 'LONG' });
    const signals = new Map<Timeframe, StoredSignal>();
    
    // Add aligned 4H and 1H signals
    signals.set('240', createStoredSignal(createSignal({ timeframe: '240', type: 'LONG', aiScore: 8 })));
    signals.set('60', createStoredSignal(createSignal({ timeframe: '60', type: 'LONG', aiScore: 8 })));
    
    const phases = new Map<string, StoredPhase>();
    
    const alignment = determineHTFAlignment(signal, signals, phases);
    expect(alignment).toBe('PERFECT');
  });
});

describe('Property 16: R:R Multiplier Mapping', () => {
  /**
   * Feature: options-trading-platform, Property 16: R:R Multiplier Mapping
   * >=5.0=1.2x, >=4.0=1.15x, >=3.0=1.1x, >=2.0=1.0x, >=1.5=0.85x, <1.5=0.5x
   */
  it('should apply correct R:R multipliers', () => {
    const testCases = [
      { rr: 6.0, expected: 1.2 },
      { rr: 5.0, expected: 1.2 },
      { rr: 4.5, expected: 1.15 },
      { rr: 4.0, expected: 1.15 },
      { rr: 3.5, expected: 1.1 },
      { rr: 3.0, expected: 1.1 },
      { rr: 2.5, expected: 1.0 },
      { rr: 2.0, expected: 1.0 },
      { rr: 1.7, expected: 0.85 },
      { rr: 1.5, expected: 0.85 },
      { rr: 1.2, expected: 0.5 },
      { rr: 1.0, expected: 0.5 },
    ];
    
    for (const { rr, expected } of testCases) {
      expect(getRRMultiplier(rr)).toBe(expected);
    }
  });

  it('should use R:R multiplier in breakdown', () => {
    fc.assert(
      fc.property(rrArb, (rr) => {
        const signal = createSignal({ rr });
        const signals = new Map<Timeframe, StoredSignal>();
        const phases = new Map<string, StoredPhase>();
        
        const breakdown = calculatePositionMultiplier(70, signal, signals, phases);
        
        expect(breakdown.rr_multiplier).toBe(getRRMultiplier(rr));
      }),
      { numRuns: 100 }
    );
  });
});

describe('Additional Multiplier Tests', () => {
  it('should apply volume multipliers correctly', () => {
    expect(getVolumeMultiplier(2.0)).toBe(1.1);
    expect(getVolumeMultiplier(1.5)).toBe(1.1);
    expect(getVolumeMultiplier(1.0)).toBe(1.0);
    expect(getVolumeMultiplier(0.8)).toBe(1.0);
    expect(getVolumeMultiplier(0.5)).toBe(0.7);
  });

  it('should apply trend multipliers correctly', () => {
    expect(getTrendMultiplier(90)).toBe(1.2);
    expect(getTrendMultiplier(80)).toBe(1.2);
    expect(getTrendMultiplier(70)).toBe(1.0);
    expect(getTrendMultiplier(60)).toBe(1.0);
    expect(getTrendMultiplier(50)).toBe(0.8);
  });

  it('should apply session multipliers correctly', () => {
    expect(SESSION_MULTIPLIERS['OPEN']).toBe(0.9);
    expect(SESSION_MULTIPLIERS['MIDDAY']).toBe(1.0);
    expect(SESSION_MULTIPLIERS['POWER_HOUR']).toBe(0.85);
    expect(SESSION_MULTIPLIERS['AFTERHOURS']).toBe(0.5);
  });

  it('should apply day multipliers correctly', () => {
    expect(DAY_MULTIPLIERS['MONDAY']).toBe(0.95);
    expect(DAY_MULTIPLIERS['TUESDAY']).toBe(1.1);
    expect(DAY_MULTIPLIERS['WEDNESDAY']).toBe(1.0);
    expect(DAY_MULTIPLIERS['THURSDAY']).toBe(0.95);
    expect(DAY_MULTIPLIERS['FRIDAY']).toBe(0.85);
  });

  it('should detect when position should be skipped', () => {
    // Create conditions for very low multiplier
    const signal = createSignal({
      quality: 'MEDIUM',
      session: 'AFTERHOURS',
      day: 'FRIDAY',
      rr: 1.0,
      volume: 0.3,
      trendStrength: 30,
    });
    
    // Counter-trend signal
    signal.mtf_context['4h_bias'] = 'SHORT';
    signal.mtf_context['1h_bias'] = 'SHORT';
    
    const signals = new Map<Timeframe, StoredSignal>();
    const phases = new Map<string, StoredPhase>();
    
    const breakdown = calculatePositionMultiplier(40, signal, signals, phases);
    
    // With all negative factors, raw multiplier should be very low
    const raw = calculateRawMultiplier(breakdown);
    
    // If raw < 0.5, shouldSkipPosition should return true
    if (raw < POSITION_MULTIPLIER_MIN) {
      expect(shouldSkipPosition(breakdown)).toBe(true);
    }
  });
});
