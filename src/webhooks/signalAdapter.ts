/**
 * Signal Adapter for TradingView Webhooks
 * 
 * Converts incoming TradingView indicator data to EnrichedSignal format.
 * Handles flexible input formats and provides sensible defaults.
 */

import { z } from 'zod';
import type { DayOfWeek, EnrichedSignal, SignalType, SignalQuality, Timeframe } from '@/types/signal';

// Flexible input schema that matches your TradingView indicator output
export const FlexibleSignalSchema = z.object({
  signal: z.object({
    type: z.string(), // Will convert to LONG/SHORT
    timeframe: z.string(), // Will convert to valid timeframe
    quality: z.string().optional().default('MEDIUM'), // Will convert to EXTREME/HIGH/MEDIUM
    ai_score: z.number().optional().default(7.0),
    timestamp: z.number().optional(),
    bar_time: z.string().optional(),
  }),
  instrument: z.object({
    exchange: z.string().optional().default('AMEX'),
    ticker: z.string(),
    current_price: z.number(),
  }),
  entry: z.object({
    price: z.number(),
    stop_loss: z.number(),
    target_1: z.number(),
    target_2: z.number(),
    stop_reason: z.string().optional().default('STRATEGY_BASED'),
  }),
  risk: z.object({
    amount: z.number().optional().default(1000),
    rr_ratio_t1: z.number().optional().default(2.0),
    rr_ratio_t2: z.number().optional().default(4.0),
    stop_distance_pct: z.number().optional(),
    recommended_shares: z.number().optional().default(10),
    recommended_contracts: z.number().optional().default(1),
    position_multiplier: z.number().optional().default(1.0),
    account_risk_pct: z.number().optional().default(1.0),
    max_loss_dollars: z.number().optional(),
  }),
  market_context: z.object({
    vwap: z.number(),
    pmh: z.number(),
    pml: z.number(),
    day_open: z.number(),
    day_change_pct: z.number(),
    price_vs_vwap_pct: z.number(),
    distance_to_pmh_pct: z.number(),
    distance_to_pml_pct: z.number(),
    atr: z.number(),
    volume_vs_avg: z.number(),
    candle_direction: z.string().optional().default('GREEN'),
    candle_size_atr: z.number().optional().default(1.0),
  }),
  trend: z.object({
    ema_8: z.number().optional(),
    ema_21: z.number().optional(),
    ema_50: z.number().optional(),
    alignment: z.string().optional().default('BULLISH'),
    strength: z.number().optional().default(75),
    rsi: z.number().optional().default(60),
    macd_signal: z.string().optional().default('BULLISH'),
  }),
  mtf_context: z.object({
    '4h_bias': z.string().optional().default('LONG'),
    '4h_rsi': z.number().optional().default(55),
    '1h_bias': z.string().optional().default('LONG'),
  }),
  score_breakdown: z.object({
    strat: z.number().optional().default(7.0),
    trend: z.number().optional().default(7.0),
    gamma: z.number().optional().default(6.0),
    vwap: z.number().optional().default(7.0),
    mtf: z.number().optional().default(7.0),
    golf: z.number().optional().default(7.0),
  }),
  components: z.array(z.string()).optional().default(['STRATEGY_SIGNAL']),
  time_context: z.object({
    market_session: z.string().optional().default('OPEN'),
    day_of_week: z.string().optional(),
  }).optional(),
});

export type FlexibleSignal = z.infer<typeof FlexibleSignalSchema>;

/**
 * Convert signal type to valid enum value
 */
function normalizeSignalType(type: string): SignalType {
  const upper = type.toUpperCase();
  if (upper.includes('LONG') || upper.includes('BUY')) return 'LONG';
  if (upper.includes('SHORT') || upper.includes('SELL')) return 'SHORT';
  return 'LONG'; // Default fallback
}

/**
 * Convert timeframe to valid enum value
 */
function normalizeTimeframe(tf: string): Timeframe {
  // Extract numbers from timeframe string
  const num = parseInt(tf.replace(/[^0-9]/g, ''));
  
  if (num <= 3) return '3';
  if (num <= 5) return '5';
  if (num <= 15) return '15';
  if (num <= 30) return '30';
  if (num <= 60) return '60';
  return '240'; // Default to 4H for anything larger
}

/**
 * Convert quality to valid enum value
 */
function normalizeQuality(quality: string): SignalQuality {
  const upper = quality.toUpperCase();
  if (upper.includes('EXTREME')) return 'EXTREME';
  if (upper.includes('HIGH')) return 'HIGH';
  return 'MEDIUM'; // Default
}

/**
 * Get current day of week
 */
function getCurrentDayOfWeek(): DayOfWeek {
  // Trading signals are only relevant on trading days; map weekends to Monday.
  const day = new Date().getDay(); // 0=Sun ... 6=Sat
  if (day === 1) return 'MONDAY';
  if (day === 2) return 'TUESDAY';
  if (day === 3) return 'WEDNESDAY';
  if (day === 4) return 'THURSDAY';
  if (day === 5) return 'FRIDAY';
  return 'MONDAY';
}

function normalizeDayOfWeek(value: unknown): DayOfWeek | undefined {
  if (typeof value !== 'string') return undefined;
  const upper = value.toUpperCase().trim();

  // Common abbreviations
  if (upper === 'MON') return 'MONDAY';
  if (upper === 'TUE' || upper === 'TUES') return 'TUESDAY';
  if (upper === 'WED') return 'WEDNESDAY';
  if (upper === 'THU' || upper === 'THUR') return 'THURSDAY';
  if (upper === 'FRI') return 'FRIDAY';

  if (upper === 'MONDAY') return 'MONDAY';
  if (upper === 'TUESDAY') return 'TUESDAY';
  if (upper === 'WEDNESDAY') return 'WEDNESDAY';
  if (upper === 'THURSDAY') return 'THURSDAY';
  if (upper === 'FRIDAY') return 'FRIDAY';

  return undefined;
}

/**
 * Calculate missing risk values
 */
function calculateRiskValues(input: FlexibleSignal): {
  stop_distance_pct: number;
  max_loss_dollars: number;
} {
  const { entry, risk } = input;
  
  const stop_distance_pct = Math.abs((entry.price - entry.stop_loss) / entry.price) * 100;
  const max_loss_dollars = risk.amount * (stop_distance_pct / 100);
  
  return {
    stop_distance_pct: Number(stop_distance_pct.toFixed(2)),
    max_loss_dollars: Number(max_loss_dollars.toFixed(2)),
  };
}

/**
 * Convert flexible signal format to EnrichedSignal
 */
export function adaptSignalToEnriched(input: FlexibleSignal): EnrichedSignal {
  const now = Date.now();
  const currentTime = new Date().toISOString();
  
  // Calculate missing risk values
  const riskCalcs = calculateRiskValues(input);
  
  // Fill in missing trend values with current price
  const currentPrice = input.instrument.current_price;
  
  const enriched: EnrichedSignal = {
    signal: {
      type: normalizeSignalType(input.signal.type),
      timeframe: normalizeTimeframe(input.signal.timeframe),
      quality: normalizeQuality(input.signal.quality),
      ai_score: Math.min(10.5, Math.max(0, input.signal.ai_score)),
      timestamp: input.signal.timestamp || Math.floor(now / 1000),
      bar_time: input.signal.bar_time || currentTime,
    },
    instrument: {
      exchange: input.instrument.exchange,
      ticker: input.instrument.ticker,
      current_price: input.instrument.current_price,
    },
    entry: {
      price: input.entry.price,
      stop_loss: input.entry.stop_loss,
      target_1: input.entry.target_1,
      target_2: input.entry.target_2,
      stop_reason: input.entry.stop_reason,
    },
    risk: {
      amount: input.risk.amount,
      rr_ratio_t1: input.risk.rr_ratio_t1,
      rr_ratio_t2: input.risk.rr_ratio_t2,
      stop_distance_pct: input.risk.stop_distance_pct || riskCalcs.stop_distance_pct,
      recommended_shares: input.risk.recommended_shares,
      recommended_contracts: input.risk.recommended_contracts,
      position_multiplier: input.risk.position_multiplier,
      account_risk_pct: input.risk.account_risk_pct,
      max_loss_dollars: input.risk.max_loss_dollars || riskCalcs.max_loss_dollars,
    },
    market_context: {
      vwap: input.market_context.vwap,
      pmh: input.market_context.pmh,
      pml: input.market_context.pml,
      day_open: input.market_context.day_open,
      day_change_pct: input.market_context.day_change_pct,
      price_vs_vwap_pct: input.market_context.price_vs_vwap_pct,
      distance_to_pmh_pct: input.market_context.distance_to_pmh_pct,
      distance_to_pml_pct: input.market_context.distance_to_pml_pct,
      atr: input.market_context.atr,
      volume_vs_avg: input.market_context.volume_vs_avg,
      candle_direction: input.market_context.candle_direction.toUpperCase() === 'RED' ? 'RED' : 'GREEN',
      candle_size_atr: input.market_context.candle_size_atr,
    },
    trend: {
      ema_8: input.trend.ema_8 || currentPrice,
      ema_21: input.trend.ema_21 || currentPrice,
      ema_50: input.trend.ema_50 || currentPrice,
      alignment: input.trend.alignment.toUpperCase() === 'BEARISH' ? 'BEARISH' : 
                 input.trend.alignment.toUpperCase() === 'NEUTRAL' ? 'NEUTRAL' : 'BULLISH',
      strength: Math.min(100, Math.max(0, input.trend.strength)),
      rsi: Math.min(100, Math.max(0, input.trend.rsi)),
      macd_signal: input.trend.macd_signal.toUpperCase() === 'BEARISH' ? 'BEARISH' : 'BULLISH',
    },
    mtf_context: {
      '4h_bias': input.mtf_context['4h_bias'].toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG',
      '4h_rsi': Math.min(100, Math.max(0, input.mtf_context['4h_rsi'])),
      '1h_bias': input.mtf_context['1h_bias'].toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG',
    },
    score_breakdown: {
      strat: input.score_breakdown.strat,
      trend: input.score_breakdown.trend,
      gamma: input.score_breakdown.gamma,
      vwap: input.score_breakdown.vwap,
      mtf: input.score_breakdown.mtf,
      golf: input.score_breakdown.golf,
    },
    components: input.components,
    time_context: {
      market_session: input.time_context?.market_session?.toUpperCase() === 'MIDDAY' ? 'MIDDAY' :
                     input.time_context?.market_session?.toUpperCase() === 'POWER_HOUR' ? 'POWER_HOUR' :
                     input.time_context?.market_session?.toUpperCase() === 'AFTERHOURS' ? 'AFTERHOURS' : 'OPEN',
      day_of_week: normalizeDayOfWeek(input.time_context?.day_of_week) || getCurrentDayOfWeek(),
    },
  };
  
  return enriched;
}

/**
 * Parse and adapt incoming webhook data to EnrichedSignal
 */
export function parseAndAdaptSignal(
  rawData: unknown
): { success: true; data: EnrichedSignal } | { success: false; error: unknown } {
  try {
    // Try to parse as flexible signal first
    const flexResult = FlexibleSignalSchema.safeParse(rawData);
    
    if (flexResult.success) {
      const enriched = adaptSignalToEnriched(flexResult.data);
      return { success: true, data: enriched };
    }
    
    return { success: false, error: flexResult.error };
  } catch (error) {
    return { success: false, error };
  }
}