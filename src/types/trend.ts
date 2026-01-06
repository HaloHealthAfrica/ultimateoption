/**
 * TrendWebhook Types and Zod Schema
 * Canonical schema for multi-timeframe trend alignment data
 * 
 * Requirements: 24.1, 24.2
 */

import { z } from 'zod';

// Direction for each timeframe
export const DirectionSchema = z.enum(['bullish', 'bearish', 'neutral']);
export type Direction = z.infer<typeof DirectionSchema>;

// Timeframe data structure
export const TimeframeDataSchema = z.object({
  direction: DirectionSchema,
  open: z.number().positive(),
  close: z.number().positive(),
});
export type TimeframeData = z.infer<typeof TimeframeDataSchema>;

// Trend strength classification
export const TrendStrengthSchema = z.enum(['STRONG', 'MODERATE', 'WEAK', 'CHOPPY']);
export type TrendStrength = z.infer<typeof TrendStrengthSchema>;

// Main TrendWebhook schema
export const TrendWebhookSchema = z.object({
  ticker: z.string().min(1),
  exchange: z.string().min(1),
  timestamp: z.string(),
  price: z.number().positive(),
  timeframes: z.object({
    tf3min: TimeframeDataSchema,
    tf5min: TimeframeDataSchema,
    tf15min: TimeframeDataSchema,
    tf30min: TimeframeDataSchema,
    tf60min: TimeframeDataSchema,
    tf240min: TimeframeDataSchema,
    tf1week: TimeframeDataSchema,
    tf1month: TimeframeDataSchema,
  }),
});
export type TrendWebhook = z.infer<typeof TrendWebhookSchema>;

// Trend alignment calculation result
export const TrendAlignmentSchema = z.object({
  bullish_count: z.number().int().min(0).max(8),
  bearish_count: z.number().int().min(0).max(8),
  neutral_count: z.number().int().min(0).max(8),
  alignment_score: z.number().min(0).max(100),
  dominant_trend: DirectionSchema,
  strength: TrendStrengthSchema,
  htf_bias: DirectionSchema,  // 4H trend
  ltf_bias: DirectionSchema,  // 3M/5M average
});
export type TrendAlignment = z.infer<typeof TrendAlignmentSchema>;

/**
 * Parse and validate a TrendWebhook from a webhook payload
 * @param payload - The raw webhook payload with stringified JSON in "text" field
 * @returns Validated TrendWebhook or throws ZodError
 */
export function parseTrendWebhook(payload: unknown): TrendWebhook {
  const webhookPayload = z.object({ text: z.string() }).parse(payload);
  const trendData = JSON.parse(webhookPayload.text);
  return TrendWebhookSchema.parse(trendData);
}

/**
 * Safely parse a TrendWebhook, returning result object
 * @param payload - The raw webhook payload
 * @returns SafeParseResult with success/error
 */
export function safeParseTrendWebhook(payload: unknown) {
  const webhookResult = z.object({ text: z.string() }).safeParse(payload);
  if (!webhookResult.success) {
    return { success: false as const, error: webhookResult.error };
  }
  
  try {
    const trendData = JSON.parse(webhookResult.data.text);
    return TrendWebhookSchema.safeParse(trendData);
  } catch {
    return { 
      success: false as const, 
      error: new z.ZodError([{
        code: 'custom',
        message: 'Invalid JSON in text field',
        path: ['text'],
      }])
    };
  }
}

/**
 * Calculate trend alignment metrics from TrendWebhook data
 * Requirements: 24.4, 24.5
 */
export function calculateTrendAlignment(trend: TrendWebhook): TrendAlignment {
  const tfs = trend.timeframes;
  
  // Count directions across all 8 timeframes
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  
  Object.values(tfs).forEach(tf => {
    if (tf.direction === 'bullish') bullish++;
    else if (tf.direction === 'bearish') bearish++;
    else neutral++;
  });
  
  // Determine dominant trend
  let dominant: Direction = 'neutral';
  let dominant_count = neutral;
  
  if (bullish > bearish && bullish > neutral) {
    dominant = 'bullish';
    dominant_count = bullish;
  } else if (bearish > bullish && bearish > neutral) {
    dominant = 'bearish';
    dominant_count = bearish;
  } else if (neutral > bullish && neutral > bearish) {
    dominant = 'neutral';
    dominant_count = neutral;
  } else {
    // Handle ties - pick the one with highest count, prefer bullish > bearish > neutral
    const maxCount = Math.max(bullish, bearish, neutral);
    if (bullish === maxCount) {
      dominant = 'bullish';
      dominant_count = bullish;
    } else if (bearish === maxCount) {
      dominant = 'bearish';
      dominant_count = bearish;
    } else {
      dominant = 'neutral';
      dominant_count = neutral;
    }
  }
  
  // Calculate alignment score as (dominant_count / 8) × 100
  const alignment_score = (dominant_count / 8) * 100;
  
  // Classify strength based on alignment score
  let strength: TrendStrength;
  if (alignment_score >= 75) strength = 'STRONG';      // 6+ aligned (>=75%)
  else if (alignment_score >= 62.5) strength = 'MODERATE';  // 5 aligned (>=62.5%)
  else if (alignment_score >= 50) strength = 'WEAK';        // 4 aligned (>=50%)
  else strength = 'CHOPPY';  // Less than 4 aligned (<50%)
  
  // Get HTF bias from 4H timeframe
  const htf_bias = tfs.tf240min.direction;
  
  // Get LTF bias from 3M and 5M average
  const ltf_directions = [tfs.tf3min.direction, tfs.tf5min.direction];
  const ltf_bullish = ltf_directions.filter(d => d === 'bullish').length;
  const ltf_bearish = ltf_directions.filter(d => d === 'bearish').length;
  const ltf_bias: Direction = ltf_bullish > ltf_bearish ? 'bullish' :
                              ltf_bearish > ltf_bullish ? 'bearish' : 'neutral';
  
  return {
    bullish_count: bullish,
    bearish_count: bearish,
    neutral_count: neutral,
    alignment_score,
    dominant_trend: dominant,
    strength,
    htf_bias,
    ltf_bias
  };
}