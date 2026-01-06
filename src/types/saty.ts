/**
 * SatyPhaseWebhook Types and Zod Schema
 * Canonical schema for SATY Phase Oscillator events
 * 
 * Requirements: 18.1, 18.8
 */

import { z } from 'zod';

// Event types
export const EventTypeSchema = z.enum([
  'REGIME_PHASE_EXIT',
  'REGIME_PHASE_ENTRY',
  'REGIME_REVERSAL',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// Phase event names
export const PhaseEventNameSchema = z.enum([
  'EXIT_ACCUMULATION',
  'ENTER_ACCUMULATION',
  'EXIT_DISTRIBUTION',
  'ENTER_DISTRIBUTION',
  'ZERO_CROSS_UP',
  'ZERO_CROSS_DOWN',
]);
export type PhaseEventName = z.infer<typeof PhaseEventNameSchema>;

// Directional implication
export const DirectionalImplicationSchema = z.enum([
  'UPSIDE_POTENTIAL',
  'DOWNSIDE_POTENTIAL',
  'NEUTRAL',
]);
export type DirectionalImplication = z.infer<typeof DirectionalImplicationSchema>;

// Timeframe role
export const TimeframeRoleSchema = z.enum([
  'REGIME',
  'BIAS',
  'SETUP_FORMATION',
  'STRUCTURAL',
]);
export type TimeframeRole = z.infer<typeof TimeframeRoleSchema>;

// Bias types
export const BiasSchema = z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']);
export type Bias = z.infer<typeof BiasSchema>;

// Velocity
export const VelocitySchema = z.enum(['INCREASING', 'DECREASING']);
export type Velocity = z.infer<typeof VelocitySchema>;

// Confidence tier
export const ConfidenceTierSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']);
export type ConfidenceTier = z.infer<typeof ConfidenceTierSchema>;

// Direction for execution
export const DirectionSchema = z.enum(['LONG', 'SHORT']);
export type Direction = z.infer<typeof DirectionSchema>;


// Meta information
export const SatyMetaSchema = z.object({
  engine: z.literal('SATY_PO'),
  engine_version: z.string(),
  event_id: z.string(),
  event_type: EventTypeSchema,
  generated_at: z.string(),
});
export type SatyMeta = z.infer<typeof SatyMetaSchema>;

// Instrument info
export const SatyInstrumentSchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  asset_class: z.string(),
  session: z.string(),
});
export type SatyInstrument = z.infer<typeof SatyInstrumentSchema>;

// Timeframe info
export const SatyTimeframeSchema = z.object({
  chart_tf: z.string(),
  event_tf: z.string(),
  tf_role: TimeframeRoleSchema,
  bar_close_time: z.string(),
});
export type SatyTimeframe = z.infer<typeof SatyTimeframeSchema>;

// Event details
export const SatyEventSchema = z.object({
  name: PhaseEventNameSchema,
  description: z.string(),
  directional_implication: DirectionalImplicationSchema,
  event_priority: z.number().int().min(1).max(10),
});
export type SatyEvent = z.infer<typeof SatyEventSchema>;

// Oscillator state
export const OscillatorStateSchema = z.object({
  value: z.number(),
  previous_value: z.number(),
  zone_from: z.string(),
  zone_to: z.string(),
  distance_from_zero: z.number(),
  distance_from_extreme: z.number(),
  velocity: VelocitySchema,
});
export type OscillatorState = z.infer<typeof OscillatorStateSchema>;

// HTF bias info
export const HtfBiasSchema = z.object({
  tf: z.string(),
  bias: BiasSchema,
  osc_value: z.number(),
});
export type HtfBias = z.infer<typeof HtfBiasSchema>;

// Macro bias info
export const MacroBiasSchema = z.object({
  tf: z.string(),
  bias: BiasSchema,
});
export type MacroBias = z.infer<typeof MacroBiasSchema>;


// Regime context
export const RegimeContextSchema = z.object({
  local_bias: BiasSchema,
  htf_bias: HtfBiasSchema,
  macro_bias: MacroBiasSchema,
});
export type RegimeContext = z.infer<typeof RegimeContextSchema>;

// Confidence info
export const ConfidenceSchema = z.object({
  raw_strength: z.number(),
  htf_alignment: z.boolean(),
  confidence_score: z.number().min(0).max(100),
  confidence_tier: ConfidenceTierSchema,
});
export type Confidence = z.infer<typeof ConfidenceSchema>;

// Execution guidance
export const ExecutionGuidanceSchema = z.object({
  trade_allowed: z.boolean(),
  allowed_directions: z.array(DirectionSchema),
  recommended_execution_tf: z.array(z.string()),
  requires_confirmation: z.array(z.string()),
});
export type ExecutionGuidance = z.infer<typeof ExecutionGuidanceSchema>;

// Market structure
export const MarketStructureSchema = z.object({
  mean_reversion_phase: z.string(),
  trend_phase: z.string(),
  is_counter_trend: z.boolean(),
  compression_state: z.string(),
});
export type MarketStructure = z.infer<typeof MarketStructureSchema>;

// Risk hints
export const RiskHintsSchema = z.object({
  avoid_if: z.array(z.string()),
  time_decay_minutes: z.number().int().nonnegative(),
  cooldown_tf: z.string(),
});
export type RiskHints = z.infer<typeof RiskHintsSchema>;

// Full SatyPhaseWebhook schema
export const SatyPhaseWebhookSchema = z.object({
  meta: SatyMetaSchema,
  instrument: SatyInstrumentSchema,
  timeframe: SatyTimeframeSchema,
  event: SatyEventSchema,
  oscillator_state: OscillatorStateSchema,
  regime_context: RegimeContextSchema,
  market_structure: MarketStructureSchema,
  confidence: ConfidenceSchema,
  execution_guidance: ExecutionGuidanceSchema,
  risk_hints: RiskHintsSchema,
  audit: z.object({
    source: z.string(),
    alert_frequency: z.string(),
    deduplication_key: z.string(),
  }),
});
export type SatyPhaseWebhook = z.infer<typeof SatyPhaseWebhookSchema>;

/**
 * Parse and validate a SatyPhaseWebhook from a webhook payload
 * @param payload - The raw webhook payload with stringified JSON in "text" field
 * @returns Validated SatyPhaseWebhook or throws ZodError
 */
export function parseSatyPhaseWebhook(payload: unknown): SatyPhaseWebhook {
  const webhookPayload = z.object({ text: z.string() }).parse(payload);
  const phaseData = JSON.parse(webhookPayload.text);
  return SatyPhaseWebhookSchema.parse(phaseData);
}

/**
 * Safely parse a SatyPhaseWebhook, returning result object
 * @param payload - The raw webhook payload
 * @returns SafeParseResult with success/error
 */
export function safeParseSatyPhaseWebhook(payload: unknown) {
  const webhookResult = z.object({ text: z.string() }).safeParse(payload);
  if (!webhookResult.success) {
    return { success: false as const, error: webhookResult.error };
  }
  
  try {
    const phaseData = JSON.parse(webhookResult.data.text);
    return SatyPhaseWebhookSchema.safeParse(phaseData);
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
