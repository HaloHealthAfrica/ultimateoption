/**
 * Trend Adapter for TradingView Webhooks
 * 
 * Converts incoming TradingView trend data to TrendWebhook format.
 * Handles flexible input formats and provides sensible defaults.
 */

import { z } from 'zod';
import type { TrendWebhook, Direction } from '@/types/trend';

// Flexible input schema that matches TradingView trend webhook output
export const FlexibleTrendSchema = z.object({
  event: z.string().optional(), // "trend_change"
  trigger_timeframe: z.string().optional(), // "5m", "3m,5m", etc.
  ticker: z.string().min(1),
  exchange: z.string().min(1),
  price: z.number().positive(),
  timeframes: z.object({
    '3m': z.object({
      dir: z.string(), // "bullish", "bearish", "neutral"
      chg: z.boolean(), // whether this timeframe changed
    }).optional(),
    '5m': z.object({
      dir: z.string(),
      chg: z.boolean(),
    }).optional(),
    '15m': z.object({
      dir: z.string(),
      chg: z.boolean(),
    }).optional(),
    '30m': z.object({
      dir: z.string(),
      chg: z.boolean(),
    }).optional(),
    '1h': z.object({
      dir: z.string(),
      chg: z.boolean(),
    }).optional(),
    '4h': z.object({
      dir: z.string(),
      chg: z.boolean(),
    }).optional(),
    '1w': z.object({
      dir: z.string(),
      chg: z.boolean(),
    }).optional(),
    '1M': z.object({
      dir: z.string(),
      chg: z.boolean(),
    }).optional(),
  }),
});

export type FlexibleTrend = z.infer<typeof FlexibleTrendSchema>;

/**
 * Normalize direction string to valid Direction enum
 */
function normalizeDirection(dir: string): Direction {
  const lower = dir.toLowerCase();
  if (lower === 'bullish' || lower === 'bull' || lower === 'long') return 'bullish';
  if (lower === 'bearish' || lower === 'bear' || lower === 'short') return 'bearish';
  return 'neutral';
}

/**
 * Convert flexible trend format to TrendWebhook
 */
export function adaptTrendToCanonical(input: FlexibleTrend): TrendWebhook {
  const now = new Date().toISOString();
  const price = input.price;
  
  // Helper to create TimeframeData with defaults
  const createTimeframeData = (tfData?: { dir: string; chg: boolean }) => {
    const direction = tfData ? normalizeDirection(tfData.dir) : 'neutral';
    // Use price as both open and close since TradingView doesn't provide these
    // This is acceptable since we only use direction for alignment calculations
    return {
      direction,
      open: price,
      close: price,
    };
  };
  
  const canonical: TrendWebhook = {
    ticker: input.ticker,
    exchange: input.exchange,
    timestamp: now,
    price: input.price,
    timeframes: {
      tf3min: createTimeframeData(input.timeframes['3m']),
      tf5min: createTimeframeData(input.timeframes['5m']),
      tf15min: createTimeframeData(input.timeframes['15m']),
      tf30min: createTimeframeData(input.timeframes['30m']),
      tf60min: createTimeframeData(input.timeframes['1h']),
      tf240min: createTimeframeData(input.timeframes['4h']),
      tf1week: createTimeframeData(input.timeframes['1w']),
      tf1month: createTimeframeData(input.timeframes['1M']),
    },
  };
  
  return canonical;
}

/**
 * Parse and adapt incoming webhook data to TrendWebhook
 */
export function parseAndAdaptTrend(
  rawData: unknown
): { success: true; data: TrendWebhook } | { success: false; error: unknown } {
  try {
    // Try to parse as flexible trend first
    const flexResult = FlexibleTrendSchema.safeParse(rawData);
    
    if (flexResult.success) {
      const canonical = adaptTrendToCanonical(flexResult.data);
      return { success: true, data: canonical };
    }
    
    return { success: false, error: flexResult.error };
  } catch (error) {
    return { success: false, error };
  }
}
