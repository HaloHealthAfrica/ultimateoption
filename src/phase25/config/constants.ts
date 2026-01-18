/**
 * Constants for Phase 2.5 Decision Engine
 * 
 * Frozen constants and configuration values used throughout the system.
 * These values are immutable in production to ensure deterministic behavior.
 */

// Engine version for audit trails and reproducibility
export const ENGINE_VERSION = "2.5.0";

// Phase rules for SATY market cycle phases
export const PHASE_RULES = Object.freeze({
  1: { allowed: ["LONG", "SHORT"] as const, sizeCap: 1.0 }, // ACCUMULATION
  2: { allowed: ["LONG"] as const, sizeCap: 2.0 },          // MARKUP  
  3: { allowed: ["SHORT"] as const, sizeCap: 0.5 },         // DISTRIBUTION - Allow SHORT trades during distribution
  4: { allowed: ["SHORT"] as const, sizeCap: 2.0 }          // MARKDOWN
} as const);

// Volatility-based position size caps
export const VOLATILITY_CAPS = Object.freeze({
  LOW: 1.0,
  NORMAL: 1.5,
  HIGH: 1.2
} as const);

// Quality-based confidence boosts
export const QUALITY_BOOSTS = Object.freeze({
  EXTREME: 1.3,
  HIGH: 1.1,
  MEDIUM: 1.0
} as const);

// Risk gate thresholds
export const RISK_GATES = Object.freeze({
  MAX_SPREAD_BPS: 12,
  MAX_ATR_SPIKE: 2.5,
  MIN_DEPTH_SCORE: 30,
  MIN_CONFIDENCE: 65,
  RESTRICTED_SESSIONS: ['AFTERHOURS']
} as const);

// Position sizing bounds
export const SIZE_BOUNDS = Object.freeze({
  MIN: 0.5,
  MAX: 3.0
} as const);

// Confidence scoring thresholds
export const CONFIDENCE_THRESHOLDS = Object.freeze({
  EXECUTE: 80,
  WAIT: 65,
  SKIP: 0
} as const);

// AI score thresholds
export const AI_SCORE_THRESHOLDS = Object.freeze({
  MINIMUM: 7.0,
  PENALTY_BELOW: 0.8
} as const);

// Multi-timeframe alignment thresholds
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
Object.freeze(RISK_GATES);
Object.freeze(SIZE_BOUNDS);
Object.freeze(CONFIDENCE_THRESHOLDS);
Object.freeze(AI_SCORE_THRESHOLDS);
Object.freeze(ALIGNMENT_THRESHOLDS);
Object.freeze(CONTEXT_RULES);
Object.freeze(API_TIMEOUTS);