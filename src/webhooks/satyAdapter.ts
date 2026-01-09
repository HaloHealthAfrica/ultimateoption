/**
 * SATY Phase Adapter for TradingView Webhooks
 * 
 * Converts incoming TradingView indicator data to SatyPhaseWebhook format.
 * Handles flexible input formats and provides sensible defaults.
 */

import { z } from 'zod';
import type { PhaseEventName, SatyPhaseWebhook } from '@/types/saty';

// Flexible input schema that matches TradingView indicator output
export const FlexibleSatySchema = z.object({
  // Meta information - can be minimal from TradingView
  meta: z.object({
    engine: z.string().optional().default('SATY_PO'),
    engine_version: z.string().optional().default('1.0'),
    event_id: z.string().optional(),
    event_type: z.string().optional().default('REGIME_PHASE_ENTRY'), // Will convert to valid enum
    generated_at: z.string().optional(),
  }).optional(),
  
  // Instrument info
  instrument: z.object({
    symbol: z.string(),
    exchange: z.string().optional().default('AMEX'),
    asset_class: z.string().optional().default('EQUITY'),
    session: z.string().optional().default('REGULAR'),
  }),
  
  // Timeframe info
  timeframe: z.object({
    chart_tf: z.string(),
    event_tf: z.string().optional(),
    tf_role: z.string().optional().default('REGIME'),
    bar_close_time: z.string().optional(),
  }),
  
  // Event details
  event: z.object({
    name: z.string(), // Will convert to valid enum
    description: z.string().optional().default('Phase event detected'),
    directional_implication: z.string().optional().default('NEUTRAL'),
    event_priority: z.number().optional().default(5),
  }),
  
  // Oscillator state - simplified for TradingView
  oscillator_state: z.object({
    value: z.number(),
    previous_value: z.number().optional(),
    zone_from: z.string().optional().default('NEUTRAL'),
    zone_to: z.string().optional().default('NEUTRAL'),
    distance_from_zero: z.number().optional(),
    distance_from_extreme: z.number().optional(),
    velocity: z.string().optional().default('INCREASING'),
  }),
  
  // Regime context - simplified
  regime_context: z.object({
    local_bias: z.string(), // Will convert to BULLISH/BEARISH/NEUTRAL
    htf_bias: z.object({
      tf: z.string().optional().default('4H'),
      bias: z.string().optional().default('NEUTRAL'),
      osc_value: z.number().optional().default(0),
    }).optional(),
    macro_bias: z.object({
      tf: z.string().optional().default('1D'),
      bias: z.string().optional().default('NEUTRAL'),
    }).optional(),
  }),
  
  // Market structure - optional
  market_structure: z.object({
    mean_reversion_phase: z.string().optional().default('NEUTRAL'),
    trend_phase: z.string().optional().default('NEUTRAL'),
    is_counter_trend: z.boolean().optional().default(false),
    compression_state: z.string().optional().default('NORMAL'),
  }).optional(),
  
  // Confidence - simplified
  confidence: z.object({
    raw_strength: z.number().optional().default(50),
    htf_alignment: z.boolean().optional().default(false),
    confidence_score: z.number().optional().default(50),
    confidence_tier: z.string().optional().default('MEDIUM'),
  }).optional(),
  
  // Execution guidance - optional
  execution_guidance: z.object({
    trade_allowed: z.boolean().optional().default(true),
    allowed_directions: z.array(z.string()).optional().default(['LONG', 'SHORT']),
    recommended_execution_tf: z.array(z.string()).optional().default(['15', '30']),
    requires_confirmation: z.array(z.string()).optional().default([]),
  }).optional(),
  
  // Risk hints - optional
  risk_hints: z.object({
    avoid_if: z.array(z.string()).optional().default([]),
    time_decay_minutes: z.number().optional().default(60),
    cooldown_tf: z.string().optional().default('15'),
  }).optional(),
  
  // Audit - optional
  audit: z.object({
    source: z.string().optional().default('TradingView'),
    alert_frequency: z.string().optional().default('once_per_bar'),
    deduplication_key: z.string().optional(),
  }).optional(),
});

export type FlexibleSaty = z.infer<typeof FlexibleSatySchema>;

/**
 * Convert event type to valid enum value
 */
function normalizeEventType(type: string): 'REGIME_PHASE_EXIT' | 'REGIME_PHASE_ENTRY' | 'REGIME_REVERSAL' {
  const upper = type.toUpperCase();
  if (upper.includes('EXIT')) return 'REGIME_PHASE_EXIT';
  if (upper.includes('ENTRY')) return 'REGIME_PHASE_ENTRY';
  if (upper.includes('REVERSAL')) return 'REGIME_REVERSAL';
  return 'REGIME_PHASE_ENTRY'; // Default
}

/**
 * Convert event name to valid enum value
 */
function normalizeEventName(name: string): PhaseEventName {
  const upper = name.toUpperCase();
  if (upper.includes('EXIT_ACCUMULATION')) return 'EXIT_ACCUMULATION';
  if (upper.includes('ENTER_ACCUMULATION')) return 'ENTER_ACCUMULATION';
  if (upper.includes('EXIT_DISTRIBUTION')) return 'EXIT_DISTRIBUTION';
  if (upper.includes('ENTER_DISTRIBUTION')) return 'ENTER_DISTRIBUTION';
  if (upper.includes('ZERO_CROSS_UP')) return 'ZERO_CROSS_UP';
  if (upper.includes('ZERO_CROSS_DOWN')) return 'ZERO_CROSS_DOWN';
  return 'ENTER_ACCUMULATION'; // Default
}

/**
 * Convert bias to valid enum value
 */
function normalizeBias(bias: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  const upper = bias.toUpperCase();
  if (upper.includes('BULL')) return 'BULLISH';
  if (upper.includes('BEAR')) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Convert directional implication to valid enum value
 */
function normalizeDirectionalImplication(implication: string): 'UPSIDE_POTENTIAL' | 'DOWNSIDE_POTENTIAL' | 'NEUTRAL' {
  const upper = implication.toUpperCase();
  if (upper.includes('UPSIDE') || upper.includes('UP')) return 'UPSIDE_POTENTIAL';
  if (upper.includes('DOWNSIDE') || upper.includes('DOWN')) return 'DOWNSIDE_POTENTIAL';
  return 'NEUTRAL';
}

/**
 * Convert confidence tier to valid enum value
 */
function normalizeConfidenceTier(tier: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  const upper = tier.toUpperCase();
  if (upper.includes('EXTREME')) return 'EXTREME';
  if (upper.includes('HIGH')) return 'HIGH';
  if (upper.includes('LOW')) return 'LOW';
  return 'MEDIUM';
}

/**
 * Convert velocity to valid enum value
 */
function normalizeVelocity(velocity: string): 'INCREASING' | 'DECREASING' {
  const upper = velocity.toUpperCase();
  if (upper.includes('DECREAS')) return 'DECREASING';
  return 'INCREASING';
}

/**
 * Convert direction to valid enum value
 */
function normalizeDirection(direction: string): 'LONG' | 'SHORT' {
  const upper = direction.toUpperCase();
  if (upper.includes('SHORT') || upper.includes('SELL')) return 'SHORT';
  return 'LONG';
}

/**
 * Generate event ID if not provided
 */
function generateEventId(): string {
  return `saty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert flexible SATY format to SatyPhaseWebhook
 */
export function adaptSatyToPhaseWebhook(input: FlexibleSaty): SatyPhaseWebhook {
  const now = new Date().toISOString();
  
  const adapted: SatyPhaseWebhook = {
    meta: {
      engine: 'SATY_PO',
      engine_version: input.meta?.engine_version || '1.0',
      event_id: input.meta?.event_id || generateEventId(),
      event_type: normalizeEventType(input.meta?.event_type || 'REGIME_PHASE_ENTRY'),
      generated_at: input.meta?.generated_at || now,
    },
    
    instrument: {
      symbol: input.instrument.symbol,
      exchange: input.instrument.exchange || 'AMEX',
      asset_class: input.instrument.asset_class || 'EQUITY',
      session: input.instrument.session || 'REGULAR',
    },
    
    timeframe: {
      chart_tf: input.timeframe.chart_tf,
      event_tf: input.timeframe.event_tf || input.timeframe.chart_tf,
      tf_role: input.timeframe.tf_role?.toUpperCase() === 'BIAS' ? 'BIAS' :
               input.timeframe.tf_role?.toUpperCase() === 'SETUP_FORMATION' ? 'SETUP_FORMATION' :
               input.timeframe.tf_role?.toUpperCase() === 'STRUCTURAL' ? 'STRUCTURAL' : 'REGIME',
      bar_close_time: input.timeframe.bar_close_time || now,
    },
    
    event: {
      name: normalizeEventName(input.event.name),
      description: input.event.description || 'Phase event detected',
      directional_implication: normalizeDirectionalImplication(input.event.directional_implication || 'NEUTRAL'),
      event_priority: Math.min(10, Math.max(1, input.event.event_priority || 5)),
    },
    
    oscillator_state: {
      value: input.oscillator_state.value,
      previous_value: input.oscillator_state.previous_value || input.oscillator_state.value,
      zone_from: input.oscillator_state.zone_from || 'NEUTRAL',
      zone_to: input.oscillator_state.zone_to || 'NEUTRAL',
      distance_from_zero: input.oscillator_state.distance_from_zero || Math.abs(input.oscillator_state.value),
      distance_from_extreme: input.oscillator_state.distance_from_extreme || Math.abs(100 - Math.abs(input.oscillator_state.value)),
      velocity: normalizeVelocity(input.oscillator_state.velocity || 'INCREASING'),
    },
    
    regime_context: {
      local_bias: normalizeBias(input.regime_context.local_bias),
      htf_bias: {
        tf: input.regime_context.htf_bias?.tf || '4H',
        bias: normalizeBias(input.regime_context.htf_bias?.bias || 'NEUTRAL'),
        osc_value: input.regime_context.htf_bias?.osc_value || 0,
      },
      macro_bias: {
        tf: input.regime_context.macro_bias?.tf || '1D',
        bias: normalizeBias(input.regime_context.macro_bias?.bias || 'NEUTRAL'),
      },
    },
    
    market_structure: {
      mean_reversion_phase: input.market_structure?.mean_reversion_phase || 'NEUTRAL',
      trend_phase: input.market_structure?.trend_phase || 'NEUTRAL',
      is_counter_trend: input.market_structure?.is_counter_trend || false,
      compression_state: input.market_structure?.compression_state || 'NORMAL',
    },
    
    confidence: {
      raw_strength: Math.min(100, Math.max(0, input.confidence?.raw_strength || 50)),
      htf_alignment: input.confidence?.htf_alignment || false,
      confidence_score: Math.min(100, Math.max(0, input.confidence?.confidence_score || 50)),
      confidence_tier: normalizeConfidenceTier(input.confidence?.confidence_tier || 'MEDIUM'),
    },
    
    execution_guidance: {
      trade_allowed: input.execution_guidance?.trade_allowed !== false,
      allowed_directions: (input.execution_guidance?.allowed_directions || ['LONG', 'SHORT']).map(normalizeDirection),
      recommended_execution_tf: input.execution_guidance?.recommended_execution_tf || ['15', '30'],
      requires_confirmation: input.execution_guidance?.requires_confirmation || [],
    },
    
    risk_hints: {
      avoid_if: input.risk_hints?.avoid_if || [],
      time_decay_minutes: Math.max(0, input.risk_hints?.time_decay_minutes || 60),
      cooldown_tf: input.risk_hints?.cooldown_tf || '15',
    },
    
    audit: {
      source: input.audit?.source || 'TradingView',
      alert_frequency: input.audit?.alert_frequency || 'once_per_bar',
      deduplication_key: input.audit?.deduplication_key || generateEventId(),
    },
  };
  
  return adapted;
}

/**
 * Parse and adapt incoming webhook data to SatyPhaseWebhook
 */
export function parseAndAdaptSaty(
  rawData: unknown
): { success: true; data: SatyPhaseWebhook } | { success: false; error: unknown } {
  try {
    // Try to parse as flexible SATY first
    const flexResult = FlexibleSatySchema.safeParse(rawData);
    
    if (flexResult.success) {
      const adapted = adaptSatyToPhaseWebhook(flexResult.data);
      return { success: true, data: adapted };
    }
    
    return { success: false, error: flexResult.error };
  } catch (error) {
    return { success: false, error };
  }
}