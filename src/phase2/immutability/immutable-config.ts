/**
 * Phase 2 Decision Engine - Immutability Enforcement
 * 
 * This module ensures all configuration objects are deeply frozen
 * and provides runtime immutability checks to prevent modifications.
 */

import { 
  PERFORMANCE_TARGETS, 
  PROVIDER_CONFIG, 
  NORMALIZATION_RULES 
} from '../config';
import { 
  GATE_NAMES,
  GATE_THRESHOLDS,
  GATE_REASONS,
  CONFIDENCE_BOOSTS,
  ENGINE_METADATA,
  VALIDATION_CONSTANTS,
  RATE_LIMITS,
  HTTP_STATUS,
  LOG_LEVELS
} from '../constants/gates';

/**
 * Deep freeze an object and all its nested properties
 * This ensures complete immutability at all levels
 */
function deepFreeze<T>(obj: T): T {
  // Get property names
  const propNames = Object.getOwnPropertyNames(obj);

  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = (obj as any)[name];

    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

/**
 * Verify that an object is frozen (including nested objects)
 */
function verifyFrozen(obj: any, path = 'root'): void {
  if (!Object.isFrozen(obj)) {
    throw new Error(`Object at path '${path}' is not frozen`);
  }

  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        verifyFrozen(value, `${path}.${key}`);
      }
    }
  }
}

/**
 * Runtime immutability check - throws error if modification is attempted
 */
function createImmutabilityProxy<T extends object>(obj: T, name: string): T {
  return new Proxy(obj, {
    set(target, property, value) {
      throw new Error(
        `Attempted to modify frozen configuration '${name}.${String(property)}'. ` +
        `Engine configuration is immutable in production.`
      );
    },
    deleteProperty(target, property) {
      throw new Error(
        `Attempted to delete property '${name}.${String(property)}' from frozen configuration. ` +
        `Engine configuration is immutable in production.`
      );
    },
    defineProperty(target, property, descriptor) {
      throw new Error(
        `Attempted to define property '${name}.${String(property)}' on frozen configuration. ` +
        `Engine configuration is immutable in production.`
      );
    }
  });
}

/**
 * Gate Definitions Registry (IMMUTABLE)
 * All gate classes and their configurations
 */
export const GATE_REGISTRY = deepFreeze({
  SPREAD_GATE: {
    name: GATE_NAMES.SPREAD_GATE,
    threshold: GATE_THRESHOLDS.SPREAD_BPS,
    reason: GATE_REASONS.SPREAD_TOO_WIDE,
    fallbackValue: 999,
    description: 'Blocks trades with spreads wider than 12 basis points'
  },
  VOLATILITY_GATE: {
    name: GATE_NAMES.VOLATILITY_GATE,
    threshold: GATE_THRESHOLDS.VOLATILITY_SPIKE,
    reason: GATE_REASONS.VOLATILITY_SPIKE,
    fallbackRatio: 1.0,
    description: 'Blocks trades during volatility spikes (ATR/RV > 2.0)'
  },
  GAMMA_GATE: {
    name: GATE_NAMES.GAMMA_GATE,
    reason: GATE_REASONS.GAMMA_HEADWIND,
    fallbackBias: 'NEUTRAL',
    description: 'Blocks trades against gamma bias direction'
  },
  PHASE_GATE: {
    name: GATE_NAMES.PHASE_GATE,
    threshold: GATE_THRESHOLDS.PHASE_CONFIDENCE,
    reason: GATE_REASONS.PHASE_CONFIDENCE_LOW,
    fallbackPhase: 0,
    description: 'Blocks trades with low phase confidence (|phase| < 65)'
  },
  SESSION_GATE: {
    name: GATE_NAMES.SESSION_GATE,
    reason: GATE_REASONS.AFTERHOURS_BLOCKED,
    blockedSessions: ['AFTERHOURS'],
    description: 'Blocks trades during afterhours session'
  }
} as const);

/**
 * Confidence Calculation Matrix (IMMUTABLE)
 */
export const CONFIDENCE_MATRIX = deepFreeze({
  base: {
    source: 'aiScore',
    description: 'Base confidence from AI score (0-10.5)'
  },
  boosts: {
    satyPhase: {
      threshold: GATE_THRESHOLDS.SATY_PHASE_BOOST_THRESHOLD,
      boost: CONFIDENCE_BOOSTS.SATY_PHASE_BOOST,
      description: 'Added when |satyPhase| >= 80'
    },
    spread: {
      threshold: GATE_THRESHOLDS.SPREAD_BOOST_THRESHOLD,
      boost: CONFIDENCE_BOOSTS.SPREAD_BOOST,
      description: 'Added when spreadBps <= 5'
    }
  },
  limits: {
    minimum: 0,
    maximum: GATE_THRESHOLDS.MAX_CONFIDENCE
  }
} as const);

/**
 * Fallback Values Matrix (IMMUTABLE)
 * Used when external providers fail or timeout
 */
export const FALLBACK_MATRIX = deepFreeze({
  tradier: PROVIDER_CONFIG.tradier.fallback,
  twelveData: PROVIDER_CONFIG.twelveData.fallback,
  alpaca: PROVIDER_CONFIG.alpaca.fallback,
  
  // Conservative fallback strategy
  strategy: 'CONSERVATIVE_REJECTION',
  description: 'Fallback values bias toward rejection to avoid poor trades'
} as const);

/**
 * Performance Constraints (IMMUTABLE)
 */
export const PERFORMANCE_CONSTRAINTS = deepFreeze({
  timing: PERFORMANCE_TARGETS,
  validation: {
    maxPayloadSize: 1024 * 1024, // 1MB
    maxFieldLength: 1000,
    requiredFields: ['signal', 'symbol', 'aiScore']
  },
  rateLimiting: RATE_LIMITS
} as const);

/**
 * Initialize immutability system
 * This function must be called at startup to freeze all configurations
 */
export function initializeImmutability(): void {
  // Deep freeze all configuration objects
  deepFreeze(PERFORMANCE_TARGETS);
  deepFreeze(PROVIDER_CONFIG);
  deepFreeze(NORMALIZATION_RULES);
  deepFreeze(GATE_NAMES);
  deepFreeze(GATE_THRESHOLDS);
  deepFreeze(GATE_REASONS);
  deepFreeze(CONFIDENCE_BOOSTS);
  deepFreeze(ENGINE_METADATA);
  deepFreeze(VALIDATION_CONSTANTS);
  deepFreeze(RATE_LIMITS);
  deepFreeze(HTTP_STATUS);
  deepFreeze(LOG_LEVELS);

  // Verify all objects are properly frozen
  verifyFrozen(PERFORMANCE_TARGETS, 'PERFORMANCE_TARGETS');
  verifyFrozen(PROVIDER_CONFIG, 'PROVIDER_CONFIG');
  verifyFrozen(NORMALIZATION_RULES, 'NORMALIZATION_RULES');
  verifyFrozen(GATE_REGISTRY, 'GATE_REGISTRY');
  verifyFrozen(CONFIDENCE_MATRIX, 'CONFIDENCE_MATRIX');
  verifyFrozen(FALLBACK_MATRIX, 'FALLBACK_MATRIX');
  verifyFrozen(PERFORMANCE_CONSTRAINTS, 'PERFORMANCE_CONSTRAINTS');

  console.log('✅ Immutability system initialized - all configurations frozen');
}

/**
 * Runtime immutability check for critical objects
 * Call this periodically to ensure no modifications have occurred
 */
export function validateImmutability(): void {
  try {
    verifyFrozen(GATE_REGISTRY, 'GATE_REGISTRY');
    verifyFrozen(CONFIDENCE_MATRIX, 'CONFIDENCE_MATRIX');
    verifyFrozen(FALLBACK_MATRIX, 'FALLBACK_MATRIX');
    verifyFrozen(PERFORMANCE_CONSTRAINTS, 'PERFORMANCE_CONSTRAINTS');
  } catch (error) {
    throw new Error(`Immutability violation detected: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get immutable configuration with runtime protection
 * Returns a proxy that throws errors on modification attempts
 */
export function getImmutableConfig<T extends object>(obj: T, name: string): T {
  if (!Object.isFrozen(obj)) {
    throw new Error(`Configuration '${name}' is not frozen. Call initializeImmutability() first.`);
  }
  
  return createImmutabilityProxy(obj, name);
}

/**
 * Immutability status report
 */
export function getImmutabilityStatus() {
  return deepFreeze({
    initialized: true,
    frozenObjects: [
      'PERFORMANCE_TARGETS',
      'PROVIDER_CONFIG', 
      'NORMALIZATION_RULES',
      'GATE_REGISTRY',
      'CONFIDENCE_MATRIX',
      'FALLBACK_MATRIX',
      'PERFORMANCE_CONSTRAINTS'
    ],
    lastValidation: new Date().toISOString(),
    engineVersion: ENGINE_METADATA.VERSION,
    deterministic: ENGINE_METADATA.DETERMINISTIC
  });
}