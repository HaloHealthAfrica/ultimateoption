/**
 * Signal Generator
 * 
 * Generates realistic EnrichedSignal payloads for testing.
 * Supports configurable parameters and multi-timeframe generation.
 * 
 * Requirements: 19.1, 19.2, 21.1, 21.2
 */

import { 
  EnrichedSignal, 
  SignalType, 
  Timeframe, 
  SignalQuality,
  MarketSession,
  DayOfWeek,
} from '../../types/signal';

/**
 * Signal generation options
 */
export interface SignalGeneratorOptions {
  // Core signal parameters
  type?: SignalType;
  timeframe?: Timeframe;
  quality?: SignalQuality;
  ai_score?: number;
  
  // Instrument
  ticker?: string;
  price?: number;
  
  // Entry parameters
  stop_distance_pct?: number;
  target_1_distance_pct?: number;
  target_2_distance_pct?: number;
  
  // Market context
  volume_ratio?: number;
  trend_strength?: number;
  rsi?: number;
  
  // MTF context
  htf_aligned?: boolean;
  
  // Time context
  session?: MarketSession;
  day_of_week?: DayOfWeek;
  
  // Seed for deterministic generation
  seed?: number;
}

/**
 * Default generation options
 */
const DEFAULT_OPTIONS: Required<SignalGeneratorOptions> = {
  type: 'LONG',
  timeframe: '15',
  quality: 'HIGH',
  ai_score: 8.0,
  ticker: 'SPY',
  price: 450,
  stop_distance_pct: 0.5,
  target_1_distance_pct: 1.0,
  target_2_distance_pct: 1.5,
  volume_ratio: 1.2,
  trend_strength: 70,
  rsi: 55,
  htf_aligned: true,
  session: 'OPEN',
  day_of_week: 'TUESDAY',
  seed: 0,
};

/**
 * Simple seeded random number generator
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}


/**
 * Generate a single EnrichedSignal
 * Requirement 19.1, 19.2
 * 
 * @param options - Generation options
 * @returns Generated EnrichedSignal
 */
export function generateSignal(options: SignalGeneratorOptions = {}): EnrichedSignal {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rng = new SeededRandom(opts.seed);
  
  const isLong = opts.type === 'LONG';
  const price = opts.price;
  
  // Calculate entry points
  const stopDistance = price * (opts.stop_distance_pct / 100);
  const target1Distance = price * (opts.target_1_distance_pct / 100);
  const target2Distance = price * (opts.target_2_distance_pct / 100);
  
  const stopLoss = isLong ? price - stopDistance : price + stopDistance;
  const target1 = isLong ? price + target1Distance : price - target1Distance;
  const target2 = isLong ? price + target2Distance : price - target2Distance;
  
  // Calculate R:R ratios
  const rrRatioT1 = target1Distance / stopDistance;
  const rrRatioT2 = target2Distance / stopDistance;
  
  // Generate market context
  const vwap = price * (1 + rng.range(-0.01, 0.01));
  const pmh = price * (1 + rng.range(0.005, 0.02));
  const pml = price * (1 - rng.range(0.005, 0.02));
  const dayOpen = price * (1 + rng.range(-0.005, 0.005));
  const atr = price * rng.range(0.005, 0.015);
  
  // Generate trend data
  const ema8 = price * (1 + (isLong ? rng.range(0, 0.005) : rng.range(-0.005, 0)));
  const ema21 = price * (1 + (isLong ? rng.range(-0.005, 0.003) : rng.range(-0.003, 0.005)));
  const ema50 = price * (1 + (isLong ? rng.range(-0.01, 0) : rng.range(0, 0.01)));
  
  // Generate score breakdown
  const stratScore = rng.range(1.5, 2.5);
  const trendScore = rng.range(1.0, 2.0);
  const gammaScore = rng.range(0.5, 1.5);
  const vwapScore = rng.range(0.5, 1.5);
  const mtfScore = opts.htf_aligned ? rng.range(1.5, 2.0) : rng.range(0.5, 1.0);
  const golfScore = rng.range(1.0, 2.0);
  
  return {
    signal: {
      type: opts.type,
      timeframe: opts.timeframe,
      quality: opts.quality,
      ai_score: opts.ai_score,
      timestamp: Date.now(),
      bar_time: new Date().toISOString(),
    },
    instrument: {
      exchange: 'NYSE',
      ticker: opts.ticker,
      current_price: price,
    },
    entry: {
      price: price,
      stop_loss: Math.round(stopLoss * 100) / 100,
      target_1: Math.round(target1 * 100) / 100,
      target_2: Math.round(target2 * 100) / 100,
      stop_reason: 'ATR-based stop',
    },
    risk: {
      amount: 500,
      rr_ratio_t1: Math.round(rrRatioT1 * 100) / 100,
      rr_ratio_t2: Math.round(rrRatioT2 * 100) / 100,
      stop_distance_pct: opts.stop_distance_pct,
      recommended_shares: Math.floor(500 / stopDistance),
      recommended_contracts: 10,
      position_multiplier: 1.0,
      account_risk_pct: 1.0,
      max_loss_dollars: 500,
    },
    market_context: {
      vwap: Math.round(vwap * 100) / 100,
      pmh: Math.round(pmh * 100) / 100,
      pml: Math.round(pml * 100) / 100,
      day_open: Math.round(dayOpen * 100) / 100,
      day_change_pct: Math.round(((price - dayOpen) / dayOpen) * 10000) / 100,
      price_vs_vwap_pct: Math.round(((price - vwap) / vwap) * 10000) / 100,
      distance_to_pmh_pct: Math.round(((pmh - price) / price) * 10000) / 100,
      distance_to_pml_pct: Math.round(((price - pml) / price) * 10000) / 100,
      atr: Math.round(atr * 100) / 100,
      volume_vs_avg: opts.volume_ratio,
      candle_direction: isLong ? 'GREEN' : 'RED',
      candle_size_atr: rng.range(0.5, 1.5),
    },
    trend: {
      ema_8: Math.round(ema8 * 100) / 100,
      ema_21: Math.round(ema21 * 100) / 100,
      ema_50: Math.round(ema50 * 100) / 100,
      alignment: isLong ? 'BULLISH' : 'BEARISH',
      strength: opts.trend_strength,
      rsi: opts.rsi,
      macd_signal: isLong ? 'BULLISH' : 'BEARISH',
    },
    mtf_context: {
      '4h_bias': opts.htf_aligned ? (isLong ? 'LONG' : 'SHORT') : (isLong ? 'SHORT' : 'LONG'),
      '4h_rsi': rng.range(40, 60),
      '1h_bias': opts.htf_aligned ? (isLong ? 'LONG' : 'SHORT') : (isLong ? 'SHORT' : 'LONG'),
    },
    score_breakdown: {
      strat: Math.round(stratScore * 100) / 100,
      trend: Math.round(trendScore * 100) / 100,
      gamma: Math.round(gammaScore * 100) / 100,
      vwap: Math.round(vwapScore * 100) / 100,
      mtf: Math.round(mtfScore * 100) / 100,
      golf: Math.round(golfScore * 100) / 100,
    },
    components: generateComponents(opts, isLong),
    time_context: {
      market_session: opts.session,
      day_of_week: opts.day_of_week,
    },
  };
}

/**
 * Generate component list based on options
 */
function generateComponents(opts: Required<SignalGeneratorOptions>, isLong: boolean): string[] {
  const components: string[] = [];
  
  if (opts.trend_strength > 60) {
    components.push('EMA_STACK');
  }
  
  if (opts.htf_aligned) {
    components.push('MTF_ALIGNED');
  }
  
  if (opts.volume_ratio > 1.0) {
    components.push('VOLUME_SURGE');
  }
  
  if (opts.ai_score >= 8) {
    components.push('HIGH_AI_SCORE');
  }
  
  components.push(isLong ? 'BULLISH_SETUP' : 'BEARISH_SETUP');
  
  return components;
}

/**
 * Generate multiple signals across timeframes
 * Requirement 21.1, 21.2
 * 
 * @param baseOptions - Base options for all signals
 * @param timeframes - Timeframes to generate
 * @returns Array of signals
 */
export function generateMultiTimeframeSignals(
  baseOptions: SignalGeneratorOptions = {},
  timeframes: Timeframe[] = ['15', '60', '240']
): EnrichedSignal[] {
  return timeframes.map((timeframe, index) => 
    generateSignal({
      ...baseOptions,
      timeframe,
      seed: (baseOptions.seed || 0) + index,
    })
  );
}

/**
 * Generate a batch of random signals
 * 
 * @param count - Number of signals to generate
 * @param baseSeed - Base seed for deterministic generation
 * @returns Array of signals
 */
export function generateSignalBatch(count: number, baseSeed: number = 0): EnrichedSignal[] {
  const signals: EnrichedSignal[] = [];
  const rng = new SeededRandom(baseSeed);
  
  const types: SignalType[] = ['LONG', 'SHORT'];
  const timeframes: Timeframe[] = ['3', '5', '15', '30', '60', '240'];
  const qualities: SignalQuality[] = ['EXTREME', 'HIGH', 'MEDIUM'];
  const sessions: MarketSession[] = ['OPEN', 'MIDDAY', 'POWER_HOUR'];
  const days: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  
  for (let i = 0; i < count; i++) {
    signals.push(generateSignal({
      type: types[rng.int(0, types.length - 1)],
      timeframe: timeframes[rng.int(0, timeframes.length - 1)],
      quality: qualities[rng.int(0, qualities.length - 1)],
      ai_score: rng.range(6, 10),
      price: rng.range(400, 500),
      volume_ratio: rng.range(0.8, 2.0),
      trend_strength: rng.range(40, 90),
      htf_aligned: rng.next() > 0.3,
      session: sessions[rng.int(0, sessions.length - 1)],
      day_of_week: days[rng.int(0, days.length - 1)],
      seed: baseSeed + i,
    }));
  }
  
  return signals;
}

/**
 * Wrap signal in webhook payload format
 * 
 * @param signal - EnrichedSignal to wrap
 * @returns Webhook payload with text field
 */
export function wrapAsWebhookPayload(signal: EnrichedSignal): { text: string } {
  return {
    text: JSON.stringify(signal),
  };
}
