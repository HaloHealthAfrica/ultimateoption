/**
 * SATY Phase Adapter for TradingView Webhooks
 * 
 * Converts incoming TradingView indicator data to SatyPhaseWebhook format.
 * Handles flexible input formats and provides sensible defaults.
 */

import { z } from 'zod';
import type { PhaseEventName, SatyPhaseWebhook } from '@/types/saty';

/**
 * Indicator v5 payload (new structure you described)
 */
const IndicatorV5Schema = z.object({
  meta: z
    .object({
      version: z.string().optional(),
      source: z.string().optional(),
      indicator_name: z.string().optional(),
    })
    .optional(),
  timeframe: z.object({
    chart_tf: z.string(),
    event_tf: z.string().optional(),
    tf_role: z.string().optional(),
    bar_close_time: z.string().optional(),
  }),
  instrument: z.object({
    exchange: z.string().optional().default('AMEX'),
    symbol: z.string(),
    current_price: z.number().optional(),
  }),
  event: z.object({
    type: z.string().optional(),
    timestamp: z.number().optional(),
    phase_from: z.number().optional(),
    phase_to: z.number().optional(),
    phase_name: z.string().optional(),
    description: z.string().optional(),
  }),
  oscillator_state: z
    .object({
      rsi_14: z.number().optional(),
      rsi_state: z.string().optional(),
      macd_signal: z.string().optional(),
      macd_histogram: z.number().optional(),
    })
    .optional(),
  regime_context: z
    .object({
      regime: z.string().optional(),
      volatility_state: z.string().optional(),
      atr: z.number().optional(),
      atr_normalized: z.number().optional(),
      trend_strength: z.number().optional(),
    })
    .optional(),
  market_structure: z
    .object({
      structure: z.string().optional(),
      ema_8: z.number().optional(),
      ema_21: z.number().optional(),
      ema_50: z.number().optional(),
      price_vs_ema50: z.string().optional(),
      price_vs_ema21: z.string().optional(),
      vwap: z.number().optional(),
      pmh: z.number().optional(),
      pml: z.number().optional(),
    })
    .optional(),
  confidence: z
    .object({
      score: z.number().optional(),
      ai_score_bull: z.number().optional(),
      ai_score_bear: z.number().optional(),
      dominant: z.string().optional(),
    })
    .optional(),
  execution_guidance: z
    .object({
      bias: z.string().optional(),
      urgency: z.string().optional(),
      session: z.string().optional(),
      day_of_week: z.string().optional(),
    })
    .optional(),
  risk_hints: z
    .object({
      suggested_stop_pct: z.number().optional(),
      atr_multiplier: z.number().optional(),
      position_size_hint: z.string().optional(),
    })
    .optional(),
  audit: z
    .object({
      generated_at: z.string().optional(),
      bar_index: z.number().optional(),
      volume: z.number().optional(),
      volume_vs_avg: z.number().optional(),
    })
    .optional(),
});
type IndicatorV5 = z.infer<typeof IndicatorV5Schema>;

/**
 * Phase-lite schema (what your indicator is currently sending)
 * Example:
 * {
 *   phase: { current: 2, name: "MARKUP", description: "...", changed: true },
 *   instrument: { exchange: "AMEX", ticker: "SPY", current_price: 693.82 },
 *   timestamp: 1767983100,
 *   bar_time: "2026-01-09T18:25:00Z",
 *   timeframe: "5",
 *   ... volatility/trend/market_context/ai_score/time_context ...
 * }
 */
const PhaseLiteSchema = z.object({
  phase: z.object({
    current: z.number(),
    name: z.string(),
    description: z.string().optional(),
    changed: z.boolean().optional(),
  }),
  instrument: z.object({
    exchange: z.string().optional().default('AMEX'),
    ticker: z.string(),
    current_price: z.number().optional(),
  }),
  timestamp: z.number().optional(),
  bar_time: z.string().optional(),
  timeframe: z.string().optional(),
  volatility: z
    .object({
      atr: z.number().optional(),
      atr_normalized: z.number().optional(),
      atr_sma: z.number().optional(),
      condition: z.string().optional(),
    })
    .optional(),
  trend: z
    .object({
      alignment: z.string().optional(),
      ema_8: z.number().optional(),
      ema_21: z.number().optional(),
      ema_50: z.number().optional(),
      price_vs_ema50: z.string().optional(),
      price_vs_ema21: z.string().optional(),
      strength: z.number().optional(),
    })
    .optional(),
  market_context: z
    .object({
      vwap: z.number().optional(),
      pmh: z.number().optional(),
      pml: z.number().optional(),
      rsi: z.number().optional(),
      macd_signal: z.string().optional(),
      volume_vs_avg: z.number().optional(),
    })
    .optional(),
  ai_score: z
    .union([
      z.number(),
      z.object({
        bull: z.number().optional(),
        bear: z.number().optional(),
        dominant: z.string().optional(),
      }),
    ])
    .optional(),
  time_context: z
    .object({
      market_session: z.string().optional(),
      day_of_week: z.string().optional(),
    })
    .optional(),
});
type PhaseLite = z.infer<typeof PhaseLiteSchema>;

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

function phaseNameToEventName(phaseName: string): PhaseEventName {
  const upper = phaseName.toUpperCase();
  if (upper.includes('ACCUM')) return 'ENTER_ACCUMULATION';
  if (upper.includes('DIST')) return 'ENTER_DISTRIBUTION';
  if (upper.includes('MARKUP')) return 'ZERO_CROSS_UP';
  if (upper.includes('MARKDOWN')) return 'ZERO_CROSS_DOWN';
  return 'ENTER_ACCUMULATION';
}

function toIsoFromTimestamp(ts?: number): string | undefined {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return undefined;
  const ms = ts > 1e12 ? ts : ts * 1000; // allow seconds or ms
  return new Date(ms).toISOString();
}

function phaseLiteToBias(input: PhaseLite): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  const a = input.ai_score;
  if (typeof a === 'object' && a && 'dominant' in a && typeof a.dominant === 'string') {
    const upper = a.dominant.toUpperCase();
    if (upper.includes('BULL')) return 'BULLISH';
    if (upper.includes('BEAR')) return 'BEARISH';
  }
  const align = input.trend?.alignment;
  if (typeof align === 'string') return normalizeBias(align);
  const p = input.phase.name.toUpperCase();
  if (p.includes('MARKDOWN')) return 'BEARISH';
  if (p.includes('MARKUP')) return 'BULLISH';
  return 'NEUTRAL';
}

function phaseLiteOscValue(input: PhaseLite): number {
  const a = input.ai_score;
  if (typeof a === 'object' && a) {
    const bull = typeof a.bull === 'number' ? a.bull : 0;
    const bear = typeof a.bear === 'number' ? a.bear : 0;
    const v = (bull - bear) * 10;
    if (Number.isFinite(v) && v !== 0) return v;
  }
  // fallback from phase code/name
  const name = input.phase.name.toUpperCase();
  if (name.includes('MARKUP')) return 50;
  if (name.includes('MARKDOWN')) return -50;
  if (name.includes('ACCUM')) return 20;
  if (name.includes('DIST')) return -20;
  return 0;
}

function phaseLiteDirectionalImplication(input: PhaseLite): 'UPSIDE_POTENTIAL' | 'DOWNSIDE_POTENTIAL' | 'NEUTRAL' {
  const bias = phaseLiteToBias(input);
  if (bias === 'BULLISH') return 'UPSIDE_POTENTIAL';
  if (bias === 'BEARISH') return 'DOWNSIDE_POTENTIAL';
  return 'NEUTRAL';
}

function normalizeTfRole(tfRole: unknown): 'REGIME' | 'BIAS' | 'SETUP_FORMATION' | 'STRUCTURAL' {
  if (typeof tfRole !== 'string') return 'REGIME';
  const upper = tfRole.toUpperCase();
  if (upper.includes('BIAS')) return 'BIAS';
  if (upper.includes('SETUP')) return 'SETUP_FORMATION';
  if (upper.includes('STRUCT')) return 'STRUCTURAL';
  // "PRIMARY" / "REGIME" / anything else
  return 'REGIME';
}

function indicatorBias(input: IndicatorV5): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  const eg = input.execution_guidance;
  if (eg?.bias) {
    const upper = eg.bias.toUpperCase();
    if (upper.includes('LONG') || upper.includes('BULL')) return 'BULLISH';
    if (upper.includes('SHORT') || upper.includes('BEAR')) return 'BEARISH';
  }

  const dom = input.confidence?.dominant;
  if (dom) {
    const upper = dom.toUpperCase();
    if (upper.includes('BULL')) return 'BULLISH';
    if (upper.includes('BEAR')) return 'BEARISH';
  }

  const rsiState = input.oscillator_state?.rsi_state;
  if (rsiState) {
    const upper = rsiState.toUpperCase();
    if (upper.includes('BULL')) return 'BULLISH';
    if (upper.includes('BEAR')) return 'BEARISH';
  }

  const macd = input.oscillator_state?.macd_signal;
  if (macd) return normalizeBias(macd);

  return 'NEUTRAL';
}

function indicatorDirectionalImplication(input: IndicatorV5): 'UPSIDE_POTENTIAL' | 'DOWNSIDE_POTENTIAL' | 'NEUTRAL' {
  const bias = indicatorBias(input);
  if (bias === 'BULLISH') return 'UPSIDE_POTENTIAL';
  if (bias === 'BEARISH') return 'DOWNSIDE_POTENTIAL';
  return 'NEUTRAL';
}

function indicatorEventName(input: IndicatorV5): PhaseEventName {
  const phaseName = input.event.phase_name || '';
  if (phaseName) return phaseNameToEventName(phaseName);

  // Fallback to phase_to if present (your older "phase-lite" used numeric phases)
  const p = input.event.phase_to;
  if (p === 1) return 'ENTER_ACCUMULATION';
  if (p === 2) return 'ZERO_CROSS_UP';
  if (p === 3) return 'ENTER_DISTRIBUTION';
  if (p === 4) return 'ZERO_CROSS_DOWN';
  return 'ENTER_ACCUMULATION';
}

function indicatorOscValue(input: IndicatorV5): number {
  const hist = input.oscillator_state?.macd_histogram;
  if (typeof hist === 'number' && Number.isFinite(hist)) {
    // Scale small MACD values into a +/-100-ish band
    return Math.max(-100, Math.min(100, hist * 100));
  }
  const rsi = input.oscillator_state?.rsi_14;
  if (typeof rsi === 'number' && Number.isFinite(rsi)) {
    // Convert RSI (0..100) into centered oscillator (-50..+50)
    return Math.max(-50, Math.min(50, rsi - 50));
  }
  return 0;
}

function indicatorVelocity(input: IndicatorV5): 'INCREASING' | 'DECREASING' {
  const bias = indicatorBias(input);
  return bias === 'BEARISH' ? 'DECREASING' : 'INCREASING';
}

function urgencyToPriority(urgency: unknown): number {
  if (typeof urgency !== 'string') return 5;
  const upper = urgency.toUpperCase();
  if (upper.includes('HIGH')) return 8;
  if (upper.includes('LOW')) return 3;
  return 5;
}

function confidenceToTier(score: unknown): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'MEDIUM';
  if (score >= 90) return 'EXTREME';
  if (score >= 75) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function adaptIndicatorV5ToPhaseWebhook(input: IndicatorV5): SatyPhaseWebhook {
  const nowIso = new Date().toISOString();

  const barClose =
    input.timeframe.bar_close_time ||
    input.audit?.generated_at ||
    toIsoFromTimestamp(input.event.timestamp) ||
    nowIso;

  const bias = indicatorBias(input);
  const oscValue = indicatorOscValue(input);

  return {
    meta: {
      engine: 'SATY_PO',
      engine_version: input.meta?.version || '1.0',
      event_id: generateEventId(),
      event_type: 'REGIME_PHASE_ENTRY',
      generated_at: input.audit?.generated_at || nowIso,
    },
    instrument: {
      symbol: input.instrument.symbol,
      exchange: input.instrument.exchange || 'AMEX',
      asset_class: 'EQUITY',
      session: 'REGULAR',
    },
    timeframe: {
      chart_tf: input.timeframe.chart_tf,
      event_tf: input.timeframe.event_tf || input.timeframe.chart_tf,
      tf_role: normalizeTfRole(input.timeframe.tf_role),
      bar_close_time: barClose,
    },
    event: {
      name: indicatorEventName(input),
      description:
        input.event.description ||
        (input.event.phase_name ? `Phase: ${input.event.phase_name}` : 'Phase event detected'),
      directional_implication: indicatorDirectionalImplication(input),
      event_priority: Math.min(10, Math.max(1, urgencyToPriority(input.execution_guidance?.urgency))),
    },
    oscillator_state: {
      value: oscValue,
      previous_value: oscValue,
      zone_from: input.oscillator_state?.rsi_state || 'NEUTRAL',
      zone_to: input.oscillator_state?.rsi_state || 'NEUTRAL',
      distance_from_zero: Math.abs(oscValue),
      distance_from_extreme: Math.abs(100 - Math.abs(oscValue)),
      velocity: indicatorVelocity(input),
    },
    regime_context: {
      local_bias: bias,
      htf_bias: { tf: '4H', bias: 'NEUTRAL', osc_value: 0 },
      macro_bias: { tf: '1D', bias: 'NEUTRAL' },
    },
    market_structure: {
      mean_reversion_phase: input.regime_context?.volatility_state || 'NEUTRAL',
      trend_phase: input.market_structure?.structure || input.regime_context?.regime || 'NEUTRAL',
      is_counter_trend: false,
      compression_state: input.regime_context?.volatility_state || 'NORMAL',
    },
    confidence: {
      raw_strength: Math.min(100, Math.max(0, input.regime_context?.trend_strength ?? input.confidence?.score ?? 50)),
      htf_alignment: false,
      confidence_score: Math.min(100, Math.max(0, input.confidence?.score ?? 50)),
      confidence_tier: confidenceToTier(input.confidence?.score),
    },
    execution_guidance: {
      trade_allowed: true,
      allowed_directions: bias === 'BEARISH' ? ['SHORT', 'LONG'] : ['LONG', 'SHORT'],
      recommended_execution_tf: [input.timeframe.event_tf || input.timeframe.chart_tf],
      requires_confirmation: [],
    },
    risk_hints: {
      avoid_if: [],
      time_decay_minutes: 60,
      cooldown_tf: input.timeframe.chart_tf,
    },
    audit: {
      source: input.meta?.source || 'TradingView',
      alert_frequency: 'once_per_bar',
      deduplication_key: `${input.instrument.symbol}_${input.timeframe.chart_tf}_${input.event.timestamp ?? Date.now()}`,
    },
  };
}

function adaptPhaseLiteToPhaseWebhook(input: PhaseLite): SatyPhaseWebhook {
  const nowIso = new Date().toISOString();
  const barClose = input.bar_time || toIsoFromTimestamp(input.timestamp) || nowIso;

  const oscValue = phaseLiteOscValue(input);
  const bias = phaseLiteToBias(input);

  return {
    meta: {
      engine: 'SATY_PO',
      engine_version: '1.0',
      event_id: generateEventId(),
      event_type: 'REGIME_PHASE_ENTRY',
      generated_at: nowIso,
    },
    instrument: {
      symbol: input.instrument.ticker,
      exchange: input.instrument.exchange || 'AMEX',
      asset_class: 'EQUITY',
      session: 'REGULAR',
    },
    timeframe: {
      chart_tf: input.timeframe || '15',
      event_tf: input.timeframe || '15',
      tf_role: 'REGIME',
      bar_close_time: barClose,
    },
    event: {
      name: phaseNameToEventName(input.phase.name),
      description: input.phase.description || `Phase: ${input.phase.name}`,
      directional_implication: phaseLiteDirectionalImplication(input),
      event_priority: input.phase.changed ? 7 : 3,
    },
    oscillator_state: {
      value: oscValue,
      previous_value: oscValue,
      zone_from: 'NEUTRAL',
      zone_to: 'NEUTRAL',
      distance_from_zero: Math.abs(oscValue),
      distance_from_extreme: Math.abs(100 - Math.abs(oscValue)),
      velocity: 'INCREASING',
    },
    regime_context: {
      local_bias: bias,
      htf_bias: { tf: '4H', bias: 'NEUTRAL', osc_value: 0 },
      macro_bias: { tf: '1D', bias: 'NEUTRAL' },
    },
    market_structure: {
      mean_reversion_phase: 'NEUTRAL',
      trend_phase: 'NEUTRAL',
      is_counter_trend: false,
      compression_state: 'NORMAL',
    },
    confidence: {
      raw_strength: Math.min(100, Math.max(0, input.trend?.strength ?? 50)),
      htf_alignment: false,
      confidence_score: Math.min(100, Math.max(0, input.trend?.strength ?? 50)),
      confidence_tier: 'MEDIUM',
    },
    execution_guidance: {
      trade_allowed: true,
      allowed_directions: ['LONG', 'SHORT'],
      recommended_execution_tf: ['15', '30'],
      requires_confirmation: [],
    },
    risk_hints: {
      avoid_if: [],
      time_decay_minutes: 60,
      cooldown_tf: '15',
    },
    audit: {
      source: 'TradingView',
      alert_frequency: 'once_per_bar',
      deduplication_key: generateEventId(),
    },
  };
}

/**
 * Ultra-flexible SATY adapter - constructs from minimal data
 */
function constructFromMinimalData(data: Record<string, unknown>): SatyPhaseWebhook | null {
  // Minimum requirements: symbol/ticker + some phase/trend/bias indicator
  const symbol = extractSymbol(data);
  if (!symbol) return null;

  const timeframe = extractTimeframe(data);
  const bias = extractBias(data);
  const phaseName = extractPhaseName(data);
  
  // If we can't determine any directional info, bail
  if (!bias && !phaseName) return null;

  const nowIso = new Date().toISOString();
  const oscValue = extractOscillatorValue(data);

  return {
    meta: {
      engine: 'SATY_PO',
      engine_version: '1.0',
      event_id: generateEventId(),
      event_type: 'REGIME_PHASE_ENTRY',
      generated_at: nowIso,
    },
    instrument: {
      symbol,
      exchange: (data.exchange as string) || 'AMEX',
      asset_class: 'EQUITY',
      session: 'REGULAR',
    },
    timeframe: {
      chart_tf: timeframe,
      event_tf: timeframe,
      tf_role: 'REGIME',
      bar_close_time: nowIso,
    },
    event: {
      name: phaseName || phaseNameToEventName(bias || 'NEUTRAL'),
      description: `Phase event detected from ${Object.keys(data).join(', ')}`,
      directional_implication: bias === 'BULLISH' ? 'UPSIDE_POTENTIAL' : 
                                bias === 'BEARISH' ? 'DOWNSIDE_POTENTIAL' : 'NEUTRAL',
      event_priority: 5,
    },
    oscillator_state: {
      value: oscValue,
      previous_value: oscValue,
      zone_from: 'NEUTRAL',
      zone_to: 'NEUTRAL',
      distance_from_zero: Math.abs(oscValue),
      distance_from_extreme: Math.abs(100 - Math.abs(oscValue)),
      velocity: 'INCREASING',
    },
    regime_context: {
      local_bias: bias || 'NEUTRAL',
      htf_bias: { tf: '4H', bias: 'NEUTRAL', osc_value: 0 },
      macro_bias: { tf: '1D', bias: 'NEUTRAL' },
    },
    market_structure: {
      mean_reversion_phase: 'NEUTRAL',
      trend_phase: 'NEUTRAL',
      is_counter_trend: false,
      compression_state: 'NORMAL',
    },
    confidence: {
      raw_strength: 50,
      htf_alignment: false,
      confidence_score: 50,
      confidence_tier: 'MEDIUM',
    },
    execution_guidance: {
      trade_allowed: true,
      allowed_directions: ['LONG', 'SHORT'],
      recommended_execution_tf: [timeframe],
      requires_confirmation: [],
    },
    risk_hints: {
      avoid_if: [],
      time_decay_minutes: 60,
      cooldown_tf: timeframe,
    },
    audit: {
      source: 'TradingView',
      alert_frequency: 'once_per_bar',
      deduplication_key: generateEventId(),
    },
  };
}

/**
 * Extract symbol from various possible locations
 */
function extractSymbol(data: Record<string, unknown>): string | null {
  // Direct fields
  if (data.symbol && typeof data.symbol === 'string') return data.symbol.toUpperCase();
  if (data.ticker && typeof data.ticker === 'string') return data.ticker.toUpperCase();
  
  // Nested in instrument
  if (data.instrument && typeof data.instrument === 'object') {
    const inst = data.instrument as Record<string, unknown>;
    if (inst.symbol && typeof inst.symbol === 'string') return inst.symbol.toUpperCase();
    if (inst.ticker && typeof inst.ticker === 'string') return inst.ticker.toUpperCase();
  }
  
  return null;
}

/**
 * Extract timeframe from various possible locations
 */
function extractTimeframe(data: Record<string, unknown>): string {
  // Direct field
  if (data.timeframe && typeof data.timeframe === 'string') return data.timeframe;
  if (data.tf && typeof data.tf === 'string') return data.tf;
  if (data.chart_tf && typeof data.chart_tf === 'string') return data.chart_tf;
  
  // Nested in timeframe object
  if (data.timeframe && typeof data.timeframe === 'object') {
    const tf = data.timeframe as Record<string, unknown>;
    if (tf.chart_tf && typeof tf.chart_tf === 'string') return tf.chart_tf;
    if (tf.event_tf && typeof tf.event_tf === 'string') return tf.event_tf;
  }
  
  // Default
  return '15';
}

/**
 * Extract bias from various possible locations
 */
function extractBias(data: Record<string, unknown>): 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null {
  // Direct fields
  if (data.bias && typeof data.bias === 'string') return normalizeBias(data.bias);
  if (data.local_bias && typeof data.local_bias === 'string') return normalizeBias(data.local_bias);
  if (data.direction && typeof data.direction === 'string') return normalizeBias(data.direction);
  if (data.trend && typeof data.trend === 'string') return normalizeBias(data.trend);
  
  // Nested in regime_context
  if (data.regime_context && typeof data.regime_context === 'object') {
    const regime = data.regime_context as Record<string, unknown>;
    if (regime.local_bias && typeof regime.local_bias === 'string') return normalizeBias(regime.local_bias);
    if (regime.bias && typeof regime.bias === 'string') return normalizeBias(regime.bias);
  }
  
  // Nested in execution_guidance
  if (data.execution_guidance && typeof data.execution_guidance === 'object') {
    const exec = data.execution_guidance as Record<string, unknown>;
    if (exec.bias && typeof exec.bias === 'string') return normalizeBias(exec.bias);
  }
  
  // From phase name
  if (data.phase && typeof data.phase === 'object') {
    const phase = data.phase as Record<string, unknown>;
    if (phase.name && typeof phase.name === 'string') {
      const name = phase.name.toUpperCase();
      if (name.includes('MARKUP')) return 'BULLISH';
      if (name.includes('MARKDOWN')) return 'BEARISH';
      if (name.includes('ACCUM')) return 'BULLISH';
      if (name.includes('DIST')) return 'BEARISH';
    }
  }
  
  return null;
}

/**
 * Extract phase name from various possible locations
 */
function extractPhaseName(data: Record<string, unknown>): PhaseEventName | null {
  // Direct field
  if (data.phase_name && typeof data.phase_name === 'string') {
    return phaseNameToEventName(data.phase_name);
  }
  
  // Nested in event
  if (data.event && typeof data.event === 'object') {
    const event = data.event as Record<string, unknown>;
    if (event.name && typeof event.name === 'string') return phaseNameToEventName(event.name);
    if (event.phase_name && typeof event.phase_name === 'string') return phaseNameToEventName(event.phase_name);
  }
  
  // Nested in phase
  if (data.phase && typeof data.phase === 'object') {
    const phase = data.phase as Record<string, unknown>;
    if (phase.name && typeof phase.name === 'string') return phaseNameToEventName(phase.name);
  }
  
  return null;
}

/**
 * Extract oscillator value from various possible locations
 */
function extractOscillatorValue(data: Record<string, unknown>): number {
  // Direct field
  if (data.oscillator_value && typeof data.oscillator_value === 'number') return data.oscillator_value;
  if (data.osc_value && typeof data.osc_value === 'number') return data.osc_value;
  
  // Nested in oscillator_state
  if (data.oscillator_state && typeof data.oscillator_state === 'object') {
    const osc = data.oscillator_state as Record<string, unknown>;
    if (osc.value && typeof osc.value === 'number') return osc.value;
  }
  
  // From MACD
  if (data.macd_histogram && typeof data.macd_histogram === 'number') {
    return Math.max(-100, Math.min(100, data.macd_histogram * 100));
  }
  
  // From RSI
  if (data.rsi && typeof data.rsi === 'number') {
    return Math.max(-50, Math.min(50, data.rsi - 50));
  }
  
  // Default
  return 0;
}

/**
 * Parse and adapt incoming webhook data to SatyPhaseWebhook
 * Enhanced with ultra-flexible fallback parsing
 */
export function parseAndAdaptSaty(
  rawData: unknown
): { success: true; data: SatyPhaseWebhook; adaptations?: string[] } | { success: false; error: string; details?: unknown } {
  const adaptations: string[] = [];
  
  try {
    // Validate input is an object
    if (!rawData || typeof rawData !== 'object') {
      return { 
        success: false, 
        error: 'Payload must be a valid JSON object',
        details: { received_type: typeof rawData }
      };
    }

    const data = rawData as Record<string, unknown>;

    // Try to parse as flexible SATY first
    const flexResult = FlexibleSatySchema.safeParse(rawData);
    
    if (flexResult.success) {
      const adapted = adaptSatyToPhaseWebhook(flexResult.data);
      adaptations.push('Parsed as FlexibleSaty format');
      return { success: true, data: adapted, adaptations };
    }

    // Second try: phase-lite format (what the indicator is currently emitting)
    const phaseLiteResult = PhaseLiteSchema.safeParse(rawData);
    if (phaseLiteResult.success) {
      adaptations.push('Parsed as PhaseLite format');
      return { success: true, data: adaptPhaseLiteToPhaseWebhook(phaseLiteResult.data), adaptations };
    }

    // Third try: indicator v5 format (new structured payload)
    const v5Result = IndicatorV5Schema.safeParse(rawData);
    if (v5Result.success) {
      adaptations.push('Parsed as IndicatorV5 format');
      return { success: true, data: adaptIndicatorV5ToPhaseWebhook(v5Result.data), adaptations };
    }
    
    // Fourth try: Ultra-flexible construction from minimal data
    adaptations.push('Attempting ultra-flexible construction from minimal data');
    const constructed = constructFromMinimalData(data);
    
    if (constructed) {
      adaptations.push('Successfully constructed from minimal data');
      adaptations.push(`Extracted: symbol=${constructed.instrument.symbol}, timeframe=${constructed.timeframe.chart_tf}, bias=${constructed.regime_context.local_bias}`);
      return { success: true, data: constructed, adaptations };
    }
    
    // All parsing attempts failed - provide detailed error
    const missingFields: string[] = [];
    if (!extractSymbol(data)) missingFields.push('symbol/ticker');
    if (!extractBias(data) && !extractPhaseName(data)) missingFields.push('bias/trend/phase_name');
    
    return { 
      success: false, 
      error: `Unable to parse SATY payload. Missing required fields: ${missingFields.join(', ')}`,
      details: {
        available_fields: Object.keys(data),
        missing_fields: missingFields,
        tried_formats: ['FlexibleSaty', 'PhaseLite', 'IndicatorV5', 'MinimalData'],
        hint: 'Payload must include at minimum: symbol/ticker and bias/trend/phase_name',
        sample_minimal_payload: {
          symbol: 'SPY',
          timeframe: '15',
          bias: 'BULLISH'
        }
      }
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown parsing error',
      details: error
    };
  }
}