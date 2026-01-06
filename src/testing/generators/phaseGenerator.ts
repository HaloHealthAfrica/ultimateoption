/**
 * Phase Generator
 * 
 * Generates realistic SatyPhaseWebhook payloads for testing.
 * Supports configurable parameters and multi-timeframe generation.
 * 
 * Requirements: 19.3, 21.3, 21.4
 */

import { 
  SatyPhaseWebhook, 
  EventType,
  PhaseEventName,
  DirectionalImplication,
  TimeframeRole,
  Bias,
  ConfidenceTier,
  Direction,
} from '../../types/saty';

// Re-export Timeframe from signal types for consistency
type Timeframe = '3' | '5' | '15' | '30' | '60' | '240';

/**
 * Phase type for simplified generation
 */
export type PhaseType = 'REGIME' | 'BIAS';

/**
 * Phase direction for simplified generation
 */
export type PhaseDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

/**
 * Phase generation options
 */
export interface PhaseGeneratorOptions {
  phase_type?: PhaseType;
  timeframe?: Timeframe;
  ticker?: string;
  direction?: PhaseDirection;
  price?: number;
  
  // Seed for deterministic generation
  seed?: number;
}

/**
 * Default generation options
 */
const DEFAULT_OPTIONS: Required<PhaseGeneratorOptions> = {
  phase_type: 'REGIME',
  timeframe: '60',
  ticker: 'SPY',
  direction: 'BULLISH',
  price: 450,
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
  
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

/**
 * Generate a unique event ID
 */
function generateEventId(seed: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  let s = seed;
  for (let i = 0; i < 8; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    result += chars[s % chars.length];
  }
  return `saty_${result}`;
}


/**
 * Generate a single SatyPhaseWebhook
 * Requirement 19.3
 * 
 * @param options - Generation options
 * @returns Generated SatyPhaseWebhook
 */
export function generatePhase(options: PhaseGeneratorOptions = {}): SatyPhaseWebhook {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rng = new SeededRandom(opts.seed);
  
  const isBullish = opts.direction === 'BULLISH';
  const isBearish = opts.direction === 'BEARISH';
  
  // Determine event type and name based on direction
  const eventType: EventType = opts.phase_type === 'REGIME' 
    ? (isBullish ? 'REGIME_PHASE_ENTRY' : 'REGIME_PHASE_EXIT')
    : 'REGIME_REVERSAL';
  
  const eventName: PhaseEventName = isBullish 
    ? rng.pick(['ENTER_ACCUMULATION', 'ZERO_CROSS_UP'])
    : isBearish 
      ? rng.pick(['ENTER_DISTRIBUTION', 'ZERO_CROSS_DOWN'])
      : rng.pick(['EXIT_ACCUMULATION', 'EXIT_DISTRIBUTION']);
  
  const directionalImplication: DirectionalImplication = isBullish 
    ? 'UPSIDE_POTENTIAL' 
    : isBearish 
      ? 'DOWNSIDE_POTENTIAL' 
      : 'NEUTRAL';
  
  const tfRole: TimeframeRole = opts.phase_type === 'REGIME' ? 'REGIME' : 'BIAS';
  
  const bias: Bias = opts.direction;
  
  const oscValue = isBullish 
    ? rng.range(20, 80) 
    : isBearish 
      ? rng.range(-80, -20) 
      : rng.range(-20, 20);
  
  const confidenceScore = rng.range(60, 95);
  const confidenceTier: ConfidenceTier = 
    confidenceScore >= 85 ? 'EXTREME' :
    confidenceScore >= 70 ? 'HIGH' :
    confidenceScore >= 50 ? 'MEDIUM' : 'LOW';
  
  const allowedDirections: Direction[] = isBullish 
    ? ['LONG'] 
    : isBearish 
      ? ['SHORT'] 
      : ['LONG', 'SHORT'];
  
  return {
    meta: {
      engine: 'SATY_PO',
      engine_version: '2.0.0',
      event_id: generateEventId(opts.seed),
      event_type: eventType,
      generated_at: new Date().toISOString(),
    },
    instrument: {
      symbol: opts.ticker,
      exchange: 'NYSE',
      asset_class: 'EQUITY',
      session: 'RTH',
    },
    timeframe: {
      chart_tf: `${opts.timeframe}`,
      event_tf: `${opts.timeframe}M`,
      tf_role: tfRole,
      bar_close_time: new Date().toISOString(),
    },
    event: {
      name: eventName,
      description: `${eventName.replace(/_/g, ' ')} on ${opts.timeframe} timeframe`,
      directional_implication: directionalImplication,
      event_priority: rng.int(5, 9),
    },
    oscillator_state: {
      value: Math.round(oscValue * 100) / 100,
      previous_value: Math.round((oscValue - rng.range(-5, 5)) * 100) / 100,
      zone_from: isBullish ? 'NEUTRAL' : 'ACCUMULATION',
      zone_to: isBullish ? 'ACCUMULATION' : 'NEUTRAL',
      distance_from_zero: Math.abs(Math.round(oscValue * 100) / 100),
      distance_from_extreme: Math.round((100 - Math.abs(oscValue)) * 100) / 100,
      velocity: oscValue > 0 ? 'INCREASING' : 'DECREASING',
    },
    regime_context: {
      local_bias: bias,
      htf_bias: {
        tf: '240',
        bias: bias,
        osc_value: Math.round(rng.range(-50, 50) * 100) / 100,
      },
      macro_bias: {
        tf: 'D',
        bias: bias,
      },
    },
    market_structure: {
      mean_reversion_phase: isBullish ? 'OVERSOLD_BOUNCE' : 'OVERBOUGHT_PULLBACK',
      trend_phase: isBullish ? 'UPTREND' : 'DOWNTREND',
      is_counter_trend: rng.next() > 0.7,
      compression_state: rng.pick(['EXPANDING', 'CONTRACTING', 'NEUTRAL']),
    },
    confidence: {
      raw_strength: Math.round(rng.range(50, 90) * 100) / 100,
      htf_alignment: rng.next() > 0.3,
      confidence_score: Math.round(confidenceScore * 100) / 100,
      confidence_tier: confidenceTier,
    },
    execution_guidance: {
      trade_allowed: true,
      allowed_directions: allowedDirections,
      recommended_execution_tf: ['15', '30'],
      requires_confirmation: ['VOLUME', 'PRICE_ACTION'],
    },
    risk_hints: {
      avoid_if: ['LOW_VOLUME', 'NEWS_EVENT'],
      time_decay_minutes: getDecayMinutes(opts.timeframe),
      cooldown_tf: opts.timeframe,
    },
    audit: {
      source: 'SATY_PHASE_OSCILLATOR',
      alert_frequency: 'ONCE_PER_BAR',
      deduplication_key: `${opts.ticker}_${opts.timeframe}_${eventType}_${Date.now()}`,
    },
  };
}

/**
 * Get decay time in minutes based on timeframe
 */
function getDecayMinutes(timeframe: string): number {
  const decayMap: Record<string, number> = {
    '3': 6,
    '5': 10,
    '15': 30,
    '30': 60,
    '60': 120,
    '240': 480,
  };
  return decayMap[timeframe] || 60;
}

/**
 * Generate multiple phases across timeframes
 * Requirement 21.3, 21.4
 * 
 * @param baseOptions - Base options for all phases
 * @param timeframes - Timeframes to generate
 * @returns Array of phases
 */
export function generateMultiTimeframePhases(
  baseOptions: PhaseGeneratorOptions = {},
  timeframes: Timeframe[] = ['15', '60', '240']
): SatyPhaseWebhook[] {
  return timeframes.map((timeframe, index) => 
    generatePhase({
      ...baseOptions,
      timeframe,
      seed: (baseOptions.seed || 0) + index,
    })
  );
}

/**
 * Generate a batch of random phases
 * 
 * @param count - Number of phases to generate
 * @param baseSeed - Base seed for deterministic generation
 * @returns Array of phases
 */
export function generatePhaseBatch(count: number, baseSeed: number = 0): SatyPhaseWebhook[] {
  const phases: SatyPhaseWebhook[] = [];
  const rng = new SeededRandom(baseSeed);
  
  const phaseTypes: PhaseType[] = ['REGIME', 'BIAS'];
  const timeframes: Timeframe[] = ['15', '30', '60', '240'];
  const directions: PhaseDirection[] = ['BULLISH', 'BEARISH', 'NEUTRAL'];
  
  for (let i = 0; i < count; i++) {
    phases.push(generatePhase({
      phase_type: rng.pick(phaseTypes),
      timeframe: rng.pick(timeframes),
      direction: rng.pick(directions),
      price: rng.range(400, 500),
      seed: baseSeed + i,
    }));
  }
  
  return phases;
}

/**
 * Wrap phase in webhook payload format
 * 
 * @param phase - SatyPhaseWebhook to wrap
 * @returns Webhook payload with text field
 */
export function wrapPhaseAsWebhookPayload(phase: SatyPhaseWebhook): { text: string } {
  return {
    text: JSON.stringify(phase),
  };
}

/**
 * Generate aligned phase for a signal
 * Creates a phase that confirms the signal direction
 * 
 * @param signalType - Signal type (LONG/SHORT)
 * @param timeframe - Timeframe for the phase
 * @param seed - Seed for deterministic generation
 * @returns Aligned phase
 */
export function generateAlignedPhase(
  signalType: 'LONG' | 'SHORT',
  timeframe: Timeframe,
  seed: number = 0
): SatyPhaseWebhook {
  return generatePhase({
    phase_type: 'REGIME',
    timeframe,
    direction: signalType === 'LONG' ? 'BULLISH' : 'BEARISH',
    seed,
  });
}

/**
 * Generate counter phase for a signal
 * Creates a phase that contradicts the signal direction
 * 
 * @param signalType - Signal type (LONG/SHORT)
 * @param timeframe - Timeframe for the phase
 * @param seed - Seed for deterministic generation
 * @returns Counter phase
 */
export function generateCounterPhase(
  signalType: 'LONG' | 'SHORT',
  timeframe: Timeframe,
  seed: number = 0
): SatyPhaseWebhook {
  return generatePhase({
    phase_type: 'REGIME',
    timeframe,
    direction: signalType === 'LONG' ? 'BEARISH' : 'BULLISH',
    seed,
  });
}
