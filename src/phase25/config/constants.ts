/**
 * Constants for Phase 2.5 Decision Engine
 * 
 * All magic numbers should be defined here with clear documentation.
 * Values are frozen to ensure deterministic behavior.
 */

// =============================================================================
// ENGINE METADATA
// =============================================================================

/** Engine version for audit trails and reproducibility */
export const ENGINE_VERSION = "2.5.0";

// =============================================================================
// SCORE NORMALIZATION
// =============================================================================

/** Maximum possible AI score from the expert system */
export const AI_SCORE_MAX = 10.5;

/** Neutral score used when data is unavailable but gate passes */
export const NEUTRAL_SCORE = 50;

// =============================================================================
// GATE FAILURE SCORES
// =============================================================================

/**
 * Scores assigned to specific failure conditions.
 * Higher scores indicate "closer to passing" for debugging/analytics.
 */
export const FAILURE_SCORES = Object.freeze({
  /** Complete failure - invalid setup or missing critical data */
  CRITICAL: 0,
  /** Liquidity insufficient */
  LIQUIDITY: 25,
  /** Execution quality too poor */
  QUALITY: 40,
} as const);

// =============================================================================
// PHASE RULES (SATY Framework)
// =============================================================================

export type TradeDirection = 'LONG' | 'SHORT';

export interface PhaseRule {
  allowed: readonly TradeDirection[];
  sizeCap: number;
  description: string;
}

// Phase rules for SATY market cycle phases
export const PHASE_RULES: Record<number, PhaseRule> = Object.freeze({
  1: { 
    allowed: ['LONG'] as const, 
    sizeCap: 0.5,
    description: 'Accumulation - Longs only, reduced size'
  },
  2: { 
    allowed: ['LONG', 'SHORT'] as const, 
    sizeCap: 1.0,
    description: 'Markup - Full flexibility'
  },
  3: { 
    allowed: ['SHORT'] as const, 
    sizeCap: 0.5,
    description: 'Distribution - Shorts only, reduced size'
  },
  4: { 
    allowed: ['SHORT'] as const, 
    sizeCap: 0.75,
    description: 'Decline - Shorts preferred'
  }
} as const);

// =============================================================================
// VOLATILITY CAPS
// =============================================================================

/** Volatility-based position size caps */
export const VOLATILITY_CAPS: Record<string, number> = Object.freeze({
  LOW: 1.2,
  NORMAL: 1.0,
  HIGH: 0.7,
  EXTREME: 0.4,
} as const);

// =============================================================================
// QUALITY BOOSTS
// =============================================================================

/** Quality-based multipliers (applied in sizing only, not confidence) */
export const QUALITY_BOOSTS: Record<string, number> = Object.freeze({
  HIGH: 1.15,
  MEDIUM: 1.0,
  LOW: 0.85,
} as const);

// =============================================================================
// LEDGER DEFAULTS
// =============================================================================

/** Default values for ledger entries when data is unavailable */
export const LEDGER_DEFAULTS = Object.freeze({
  timeframe: '15',
  exchange: 'NASDAQ',
  stopReason: 'ATR_BASED',
} as const);

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility)
// =============================================================================

// Risk gate thresholds - DEPRECATED: Use trading-rules.config.ts instead
export const RISK_GATES = Object.freeze({
  MAX_SPREAD_BPS: 12,
  MAX_ATR_SPIKE: 2.5,
  MIN_DEPTH_SCORE: 30,
  MIN_CONFIDENCE: 65,
  RESTRICTED_SESSIONS: ['AFTERHOURS']
} as const);

// Position sizing bounds - DEPRECATED: Use trading-rules.config.ts instead
export const SIZE_BOUNDS = Object.freeze({
  MIN: 0.5,
  MAX: 3.0
} as const);

// Confidence scoring thresholds - DEPRECATED: Use trading-rules.config.ts instead
export const CONFIDENCE_THRESHOLDS = Object.freeze({
  EXECUTE: 80,
  WAIT: 65,
  SKIP: 0
} as const);

// AI score thresholds - DEPRECATED: Use trading-rules.config.ts instead
export const AI_SCORE_THRESHOLDS = Object.freeze({
  MINIMUM: 7.0,
  PENALTY_BELOW: 0.8
} as const);

// Multi-timeframe alignment thresholds - DEPRECATED: Use trading-rules.config.ts instead
export const ALIGNMENT_THRESHOLDS = Object.freeze({
  STRONG_ALIGNMENT: 75,
  BONUS_MULTIPLIER: 1.2
} as const);

// Context expiration and completeness rules
export const CONTEXT_RULES = Object.freeze({
  MAX_AGE_MS: 5 * 60 * 1000, // 5 minutes
  REQUIRED_SOURCES: ['SATY_PHASE', 'ULTIMATE_OPTIONS'],
  OPTIONAL_SOURCES: ['MTF_DOTS', 'STRAT_EXEC', 'TRADINGVIEW_SIGNAL']
} as const);

// API timeout configurations
export const API_TIMEOUTS = Object.freeze({
  WEBHOOK_PROCESSING: 2000,
  MARKET_CONTEXT: 1000,
  DECISION_ENGINE: 500
} as const);

// Freeze all exports to prevent runtime modifications
Object.freeze(PHASE_RULES);
Object.freeze(VOLATILITY_CAPS);
Object.freeze(QUALITY_BOOSTS);
Object.freeze(FAILURE_SCORES);
Object.freeze(LEDGER_DEFAULTS);
