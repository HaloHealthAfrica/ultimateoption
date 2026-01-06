/**
 * EnrichedSignal Types and Zod Schema
 * Canonical schema for incoming TradingView signals
 * 
 * Requirements: 1.1, 1.7
 */

import { z } from 'zod';

// Signal direction
export const SignalTypeSchema = z.enum(['LONG', 'SHORT']);
export type SignalType = z.infer<typeof SignalTypeSchema>;

// Valid timeframes (in minutes as strings)
export const TimeframeSchema = z.enum(['3', '5', '15', '30', '60', '240']);
export type Timeframe = z.infer<typeof TimeframeSchema>;

// Signal quality levels
export const SignalQualitySchema = z.enum(['EXTREME', 'HIGH', 'MEDIUM']);
export type SignalQuality = z.infer<typeof SignalQualitySchema>;

// Candle direction
export const CandleDirectionSchema = z.enum(['GREEN', 'RED']);
export type CandleDirection = z.infer<typeof CandleDirectionSchema>;

// Trend alignment
export const TrendAlignmentSchema = z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']);
export type TrendAlignment = z.infer<typeof TrendAlignmentSchema>;

// MACD signal
export const MacdSignalSchema = z.enum(['BULLISH', 'BEARISH']);
export type MacdSignal = z.infer<typeof MacdSignalSchema>;

// Market session
export const MarketSessionSchema = z.enum(['OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS']);
export type MarketSession = z.infer<typeof MarketSessionSchema>;

// Day of week
export const DayOfWeekSchema = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

// MTF Bias
export const MtfBiasSchema = z.enum(['LONG', 'SHORT']);
export type MtfBias = z.infer<typeof MtfBiasSchema>;


// Signal core info
export const SignalInfoSchema = z.object({
  type: SignalTypeSchema,
  timeframe: TimeframeSchema,
  quality: SignalQualitySchema,
  ai_score: z.number().min(0).max(10.5),
  timestamp: z.number(),
  bar_time: z.string(),
});
export type SignalInfo = z.infer<typeof SignalInfoSchema>;

// Instrument info
export const InstrumentSchema = z.object({
  exchange: z.string(),
  ticker: z.string(),
  current_price: z.number().positive(),
});
export type Instrument = z.infer<typeof InstrumentSchema>;

// Entry details
export const EntrySchema = z.object({
  price: z.number().positive(),
  stop_loss: z.number().positive(),
  target_1: z.number().positive(),
  target_2: z.number().positive(),
  stop_reason: z.string(),
});
export type Entry = z.infer<typeof EntrySchema>;

// Risk parameters
export const RiskSchema = z.object({
  amount: z.number(),
  rr_ratio_t1: z.number(),
  rr_ratio_t2: z.number(),
  stop_distance_pct: z.number(),
  recommended_shares: z.number().int().nonnegative(),
  recommended_contracts: z.number().int().nonnegative(),
  position_multiplier: z.number(),
  account_risk_pct: z.number(),
  max_loss_dollars: z.number(),
});
export type Risk = z.infer<typeof RiskSchema>;

// Market context
export const MarketContextSchema = z.object({
  vwap: z.number(),
  pmh: z.number(), // Previous market high
  pml: z.number(), // Previous market low
  day_open: z.number(),
  day_change_pct: z.number(),
  price_vs_vwap_pct: z.number(),
  distance_to_pmh_pct: z.number(),
  distance_to_pml_pct: z.number(),
  atr: z.number().positive(),
  volume_vs_avg: z.number().nonnegative(),
  candle_direction: CandleDirectionSchema,
  candle_size_atr: z.number(),
});
export type MarketContext = z.infer<typeof MarketContextSchema>;


// Trend info
export const TrendSchema = z.object({
  ema_8: z.number(),
  ema_21: z.number(),
  ema_50: z.number(),
  alignment: TrendAlignmentSchema,
  strength: z.number().min(0).max(100),
  rsi: z.number().min(0).max(100),
  macd_signal: MacdSignalSchema,
});
export type Trend = z.infer<typeof TrendSchema>;

// Multi-timeframe context
export const MtfContextSchema = z.object({
  '4h_bias': MtfBiasSchema,
  '4h_rsi': z.number().min(0).max(100),
  '1h_bias': MtfBiasSchema,
});
export type MtfContext = z.infer<typeof MtfContextSchema>;

// Score breakdown
export const ScoreBreakdownSchema = z.object({
  strat: z.number(),
  trend: z.number(),
  gamma: z.number(),
  vwap: z.number(),
  mtf: z.number(),
  golf: z.number(),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

// Time context
export const TimeContextSchema = z.object({
  market_session: MarketSessionSchema,
  day_of_week: DayOfWeekSchema,
});
export type TimeContext = z.infer<typeof TimeContextSchema>;

// Full EnrichedSignal schema
export const EnrichedSignalSchema = z.object({
  signal: SignalInfoSchema,
  instrument: InstrumentSchema,
  entry: EntrySchema,
  risk: RiskSchema,
  market_context: MarketContextSchema,
  trend: TrendSchema,
  mtf_context: MtfContextSchema,
  score_breakdown: ScoreBreakdownSchema,
  components: z.array(z.string()),
  time_context: TimeContextSchema,
});
export type EnrichedSignal = z.infer<typeof EnrichedSignalSchema>;

// Webhook payload wrapper (TradingView sends JSON as stringified text)
export const WebhookPayloadSchema = z.object({
  text: z.string(),
});
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

/**
 * Parse and validate an EnrichedSignal from a webhook payload
 * @param payload - The raw webhook payload with stringified JSON in "text" field
 * @returns Validated EnrichedSignal or throws ZodError
 */
export function parseEnrichedSignal(payload: unknown): EnrichedSignal {
  const webhookPayload = WebhookPayloadSchema.parse(payload);
  const signalData = JSON.parse(webhookPayload.text);
  return EnrichedSignalSchema.parse(signalData);
}

/**
 * Safely parse an EnrichedSignal, returning result object
 * @param payload - The raw webhook payload
 * @returns SafeParseResult with success/error
 */
export function safeParseEnrichedSignal(payload: unknown) {
  const webhookResult = WebhookPayloadSchema.safeParse(payload);
  if (!webhookResult.success) {
    return { success: false as const, error: webhookResult.error };
  }
  
  try {
    const signalData = JSON.parse(webhookResult.data.text);
    return EnrichedSignalSchema.safeParse(signalData);
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
