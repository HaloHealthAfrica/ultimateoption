/**
 * Webhook Validation Schemas
 * 
 * Zod schemas for validating incoming webhook payloads.
 * Provides security against malformed/malicious inputs.
 */

import { z } from 'zod';

/**
 * Signal Webhook Schema (TradingView)
 * Validates signal webhooks with strict type checking
 */
export const SignalWebhookSchema = z.object({
  signal: z.object({
    type: z.enum(['LONG', 'SHORT']),
    ai_score: z.number()
      .min(0, 'AI score must be >= 0')
      .max(10.5, 'AI score must be <= 10.5'),
    aiScore: z.number()
      .min(0, 'AI score must be >= 0')
      .max(10.5, 'AI score must be <= 10.5')
      .optional(),
    quality: z.enum(['EXTREME', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    timeframe: z.string()
      .regex(/^\d+$/, 'Timeframe must be numeric string')
      .max(10, 'Timeframe too long')
      .optional(),
    timestamp: z.number().int().positive().optional()
  }),
  instrument: z.object({
    ticker: z.string()
      .regex(/^[A-Z]{1,5}$/, 'Ticker must be 1-5 uppercase letters')
      .transform(val => val.toUpperCase()),
    exchange: z.string().max(20).optional(),
    current_price: z.number()
      .positive('Price must be positive')
      .max(1000000, 'Price unreasonably high')
      .optional()
  }),
  risk: z.object({
    rr_ratio_t1: z.number().min(0).max(100).optional(),
    rr_ratio_t2: z.number().min(0).max(100).optional(),
    amount: z.number().min(0).optional()
  }).optional(),
  satyPhase: z.object({
    phase: z.number().min(-100).max(100)
  }).optional()
});

/**
 * SATY Phase Webhook Schema
 */
export const SatyPhaseWebhookSchema = z.object({
  meta: z.object({
    engine: z.string().max(50)
  }).optional(),
  instrument: z.object({
    symbol: z.string()
      .regex(/^[A-Z]{1,5}$/, 'Symbol must be 1-5 uppercase letters')
      .transform(val => val.toUpperCase()),
    exchange: z.string().max(20).optional()
  }),
  timeframe: z.object({
    chart_tf: z.string().max(10)
  }).optional(),
  regime_context: z.object({
    local_bias: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']).optional(),
    phase: z.number().min(-100).max(100).optional()
  }).optional(),
  oscillator_state: z.object({
    value: z.number().min(0).max(100)
  }).optional(),
  confidence: z.object({
    confidence_score: z.number().min(0).max(100)
  }).optional()
});

/**
 * Generic Webhook Schema (for initial validation)
 */
export const GenericWebhookSchema = z.object({
  // Allow any structure but enforce size limits
}).passthrough().refine(
  (data) => {
    const jsonString = JSON.stringify(data);
    return jsonString.length < 100000; // 100KB max
  },
  { message: 'Payload too large (max 100KB)' }
);

/**
 * Validate signal webhook
 */
export function validateSignalWebhook(payload: unknown) {
  return SignalWebhookSchema.safeParse(payload);
}

/**
 * Validate SATY phase webhook
 */
export function validateSatyPhaseWebhook(payload: unknown) {
  return SatyPhaseWebhookSchema.safeParse(payload);
}

/**
 * Validate generic webhook (size check only)
 */
export function validateGenericWebhook(payload: unknown) {
  return GenericWebhookSchema.safeParse(payload);
}

/**
 * Format validation errors for user-friendly response
 */
export function formatValidationErrors(errors: z.ZodError) {
  return errors.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
}
