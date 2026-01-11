/**
 * Phase 2 Decision Engine - Risk Gate Constants
 * 
 * All risk gate definitions, thresholds, and logic are frozen here.
 * These values are immutable in production and cannot be changed at runtime.
 */

import { ENGINE_VERSION } from '../types';

// Gate Names (IMMUTABLE)
export const GATE_NAMES = Object.freeze({
  SPREAD_GATE: 'SPREAD_GATE',
  VOLATILITY_GATE: 'VOLATILITY_GATE',
  GAMMA_GATE: 'GAMMA_GATE',
  PHASE_GATE: 'PHASE_GATE',
  SESSION_GATE: 'SESSION_GATE'
} as const);

// Gate Thresholds (IMMUTABLE)
export const GATE_THRESHOLDS = Object.freeze({
  SPREAD_BPS: 12,           // Maximum allowed spread in basis points
  VOLATILITY_SPIKE: 2.0,    // Maximum ATR14/RV20 ratio
  PHASE_CONFIDENCE: 65,     // Minimum absolute satyPhase value
  
  // Confidence calculation thresholds
  SATY_PHASE_BOOST_THRESHOLD: 80,  // |satyPhase| >= 80 adds 0.5 to confidence
  SPREAD_BOOST_THRESHOLD: 5,       // spreadBps <= 5 adds 0.3 to confidence
  MAX_CONFIDENCE: 10.0             // Maximum confidence value
} as const);

// Gate Reason Codes (IMMUTABLE)
export const GATE_REASONS = Object.freeze({
  SPREAD_TOO_WIDE: 'SPREAD_TOO_WIDE',
  VOLATILITY_SPIKE: 'VOLATILITY_SPIKE',
  GAMMA_HEADWIND: 'GAMMA_HEADWIND',
  PHASE_CONFIDENCE_LOW: 'PHASE_CONFIDENCE_LOW',
  AFTERHOURS_BLOCKED: 'AFTERHOURS_BLOCKED'
} as const);

// Confidence Boosts (IMMUTABLE)
export const CONFIDENCE_BOOSTS = Object.freeze({
  SATY_PHASE_BOOST: 0.5,    // Added when |satyPhase| >= 80
  SPREAD_BOOST: 0.3         // Added when spreadBps <= 5
} as const);

// Engine Metadata (IMMUTABLE)
export const ENGINE_METADATA = Object.freeze({
  VERSION: ENGINE_VERSION,
  BUILD_DATE: new Date().toISOString(),
  DETERMINISTIC: true,
  LEARNING_ENABLED: false
} as const);

// Validation Constants (IMMUTABLE)
export const VALIDATION_CONSTANTS = Object.freeze({
  AI_SCORE_MIN: 0,
  AI_SCORE_MAX: 10.5,
  SATY_PHASE_MIN: -100,
  SATY_PHASE_MAX: 100,
  VALID_SESSIONS: ['OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS'] as const,
  VALID_SIGNAL_TYPES: ['LONG', 'SHORT'] as const,
  VALID_GAMMA_BIAS: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'] as const
} as const);

// Rate Limiting Constants (IMMUTABLE)
export const RATE_LIMITS = Object.freeze({
  REQUESTS_PER_MINUTE: 1000,
  WINDOW_MS: 60 * 1000,     // 1 minute
  MAX_REQUESTS: 1000,
  RETRY_AFTER_SECONDS: 60
} as const);

// HTTP Status Codes (IMMUTABLE)
export const HTTP_STATUS = Object.freeze({
  OK: 200,
  BAD_REQUEST: 400,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const);

// Logging Levels (IMMUTABLE)
export const LOG_LEVELS = Object.freeze({
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
} as const);

/**
 * Freeze all exported constants to ensure immutability
 * This prevents any runtime modifications to gate logic
 */
Object.freeze(GATE_NAMES);
Object.freeze(GATE_THRESHOLDS);
Object.freeze(GATE_REASONS);
Object.freeze(CONFIDENCE_BOOSTS);
Object.freeze(ENGINE_METADATA);
Object.freeze(VALIDATION_CONSTANTS);
Object.freeze(RATE_LIMITS);
Object.freeze(HTTP_STATUS);
Object.freeze(LOG_LEVELS);