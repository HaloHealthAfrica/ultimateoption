/**
 * Frozen constants for Phase 2.5 Decision Engine
 * 
 * These constants define the immutable rules and thresholds used by
 * the decision engine. They are frozen in production to ensure determinism.
 */

import { TradeDirection } from './core';

// ============================================================================
// ENGINE VERSION AND METADATA
// ============================================================================

export const ENGINE_VERSION = "2.5.0" as const;

// ============================================================================
// PHASE RULES (FROZEN)
// ============================================================================

export const PHASE_RULES = Object.freeze({
  1: { // ACCUMULATION
    allowed: ["LONG", "SHORT"] as TradeDirection[],
    sizeCap: 1.0
  },
  2: { // MARKUP
    allowed: ["LONG"] as TradeDirection[],
    sizeCap: 2.0
  },
  3: { // DISTRIBUTION
    allowed: [] as TradeDirection[],
    sizeCap: 0.5
  },
  4: { // MARKDOWN
    allowed: ["SHORT"] as TradeDirection[],
    sizeCap: 2.0
  }
} as const);

// ============================================================================
// VOLATILITY CAPS (FROZEN)
// ============================================================================

export const VOLATILITY_CAP = Object.freeze({
  LOW: 1.0,
  NORMAL: 1.5,
  HIGH: 0.5
} as const);

// ============================================================================
// CONFIDENCE AND SCORING THRESHOLDS (FROZEN)
// ============================================================================

export const CONFIDENCE_GATE = 65 as const;

export const EXPERT_QUALITY_BOOST = Object.freeze({
  EXTREME: 1.15,
  HIGH: 1.05,
  MEDIUM: 1.0
} as const);

export const SIZE_BOUNDS = Object.freeze({
  MIN: 0.5,
  MAX: 3.0
} as const);

// ============================================================================
// CONFLUENCE WEIGHTS (FROZEN)
// ============================================================================

export const CONFLUENCE_WEIGHTS = Object.freeze({
  "4H": 0.40,   // 4H = 40%
  "1H": 0.25,   // 1H = 25%
  "30M": 0.15,  // 30M = 15%
  "15M": 0.10,  // 15M = 10%
  "5M": 0.07,   // 5M = 7%
  "3M": 0.03    // 3M = 3%
} as const);

// ============================================================================
// GATE THRESHOLDS (FROZEN)
// ============================================================================

export const GATE_THRESHOLDS = Object.freeze({
  MAX_SPREAD_BPS: 12,
  MAX_ATR_SPIKE: 50,
  MIN_DEPTH_SCORE: 60,
  RESTRICTED_SESSIONS: ["AFTERHOURS"]
} as const);

// ============================================================================
// MULTIPLIER MATRICES (FROZEN)
// ============================================================================

export const CONFLUENCE_MULTIPLIERS = Object.freeze({
  90: 2.5,
  80: 2.0,
  70: 1.5,
  60: 1.0,
  50: 0.7
} as const);

export const QUALITY_MULTIPLIERS = Object.freeze({
  'EXTREME': 1.3,
  'HIGH': 1.1,
  'MEDIUM': 1.0
} as const);

export const HTF_ALIGNMENT_MULTIPLIERS = Object.freeze({
  'PERFECT': 1.3,  // 4H + 1H aligned
  'GOOD': 1.15,    // Either 4H or 1H aligned
  'WEAK': 0.85,    // Only 1H, not 4H
  'COUNTER': 0.5   // Against HTF bias
} as const);

export const RR_MULTIPLIERS = Object.freeze({
  5.0: 1.2,
  4.0: 1.15,
  3.0: 1.1,
  2.0: 1.0,
  1.5: 0.85
} as const);

export const VOLUME_MULTIPLIERS = Object.freeze({
  1.5: 1.1,   // High volume
  0.8: 1.0,   // Normal volume
  0.5: 0.7    // Low volume
} as const);

export const TREND_MULTIPLIERS = Object.freeze({
  80: 1.2,    // Strong trend
  60: 1.0,    // Moderate trend
  40: 0.8     // Weak trend
} as const);

export const SESSION_MULTIPLIERS = Object.freeze({
  'OPEN': 0.9,
  'MIDDAY': 1.0,
  'POWER_HOUR': 0.85,
  'AFTERHOURS': 0.5
} as const);

export const DAY_MULTIPLIERS = Object.freeze({
  'MONDAY': 0.95,
  'TUESDAY': 1.1,
  'WEDNESDAY': 1.0,
  'THURSDAY': 0.95,
  'FRIDAY': 0.85
} as const);

// ============================================================================
// FEED FALLBACK VALUES (FROZEN)
// ============================================================================

export const FEED_FALLBACKS = Object.freeze({
  tradier: {
    putCallRatio: 0.8,
    ivPercentile: 50,
    gammaBias: "NEUTRAL" as const,
    optionVolume: 1000,
    maxPain: 0
  },
  twelvedata: {
    atr14: 2.0,
    rv20: 20,
    trendSlope: 0,
    rsi: 50,
    volume: 1000000,
    volumeRatio: 1.0
  },
  alpaca: {
    spreadBps: 5,
    depthScore: 70,
    tradeVelocity: "NORMAL" as const,
    bidSize: 100,
    askSize: 100
  }
} as const);

// ============================================================================
// ERROR HANDLING STRATEGIES (FROZEN)
// ============================================================================

export const WEBHOOK_ERROR_HANDLING = Object.freeze({
  INVALID_JSON: {
    httpStatus: 400,
    retry: false,
    log: true
  },
  SCHEMA_VALIDATION: {
    httpStatus: 400,
    retry: false,
    log: true
  },
  AUTHENTICATION_FAILED: {
    httpStatus: 401,
    retry: false,
    log: true,
    alert: true
  },
  PROCESSING_TIMEOUT: {
    httpStatus: 500,
    retry: true,
    log: true,
    alert: true
  }
} as const);

export const ENGINE_ERROR_RECOVERY = Object.freeze({
  INCOMPLETE_CONTEXT: {
    action: "WAIT" as const,
    reason: "Insufficient context data"
  },
  INVALID_INPUT: {
    action: "SKIP" as const,
    reason: "Invalid input parameters"
  },
  CALCULATION_ERROR: {
    action: "SKIP" as const,
    reason: "Calculation error occurred"
  }
} as const);

// ============================================================================
// TIMEOUT CONFIGURATIONS (FROZEN)
// ============================================================================

export const TIMEOUTS = Object.freeze({
  WEBHOOK_PROCESSING: 500,    // 500ms
  MARKET_CONTEXT: 600,        // 600ms per API
  DECISION_ENGINE: 10,        // 10ms
  TOTAL_PIPELINE: 1000        // 1000ms end-to-end
} as const);

// ============================================================================
// API CONFIGURATIONS (FROZEN)
// ============================================================================

export const API_CONFIGS = Object.freeze({
  tradier: {
    baseUrl: "https://api.tradier.com/v1",
    timeout: 600,
    retries: 2
  },
  twelvedata: {
    baseUrl: "https://api.twelvedata.com",
    timeout: 600,
    retries: 2
  },
  alpaca: {
    baseUrl: "https://data.alpaca.markets/v2",
    timeout: 600,
    retries: 2
  }
} as const);

// ============================================================================
// UTILITY FUNCTIONS FOR CONSTANTS
// ============================================================================

/**
 * Get confluence multiplier for a given score
 */
export function getConfluenceMultiplier(score: number): number {
  if (score >= 90) return CONFLUENCE_MULTIPLIERS[90];
  if (score >= 80) return CONFLUENCE_MULTIPLIERS[80];
  if (score >= 70) return CONFLUENCE_MULTIPLIERS[70];
  if (score >= 60) return CONFLUENCE_MULTIPLIERS[60];
  if (score >= 50) return CONFLUENCE_MULTIPLIERS[50];
  return 0.5; // Below minimum threshold
}

/**
 * Get R:R multiplier for a given ratio
 */
export function getRRMultiplier(rr: number): number {
  if (rr >= 5.0) return RR_MULTIPLIERS[5.0];
  if (rr >= 4.0) return RR_MULTIPLIERS[4.0];
  if (rr >= 3.0) return RR_MULTIPLIERS[3.0];
  if (rr >= 2.0) return RR_MULTIPLIERS[2.0];
  if (rr >= 1.5) return RR_MULTIPLIERS[1.5];
  return 0.5; // Below minimum threshold
}

/**
 * Clamp a value between min and max bounds
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}