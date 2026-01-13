/**
 * Phase 2.5 Decision Engine Configuration
 * 
 * This file contains the frozen configuration for the decision engine.
 * All values are immutable in production to ensure deterministic behavior.
 */

import { EngineConfig } from '../types';
import {
  ENGINE_VERSION,
  GATE_THRESHOLDS,
  PHASE_RULES,
  VOLATILITY_CAP,
  EXPERT_QUALITY_BOOST,
  SIZE_BOUNDS,
  TIMEOUTS,
  API_CONFIGS,
  FEED_FALLBACKS
} from '../types/constants';

/**
 * Default engine configuration
 * This configuration is frozen in production
 */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = Object.freeze({
  version: ENGINE_VERSION,
  
  // Gate thresholds
  gates: {
    maxSpreadBps: GATE_THRESHOLDS.MAX_SPREAD_BPS,
    maxAtrSpike: GATE_THRESHOLDS.MAX_ATR_SPIKE,
    minDepthScore: GATE_THRESHOLDS.MIN_DEPTH_SCORE,
    minConfidence: 65,
    restrictedSessions: [...GATE_THRESHOLDS.RESTRICTED_SESSIONS]
  },
  
  // Phase rules
  phases: {
    1: { allowed: [...PHASE_RULES[1].allowed], sizeCap: PHASE_RULES[1].sizeCap },
    2: { allowed: [...PHASE_RULES[2].allowed], sizeCap: PHASE_RULES[2].sizeCap },
    3: { allowed: [...PHASE_RULES[3].allowed], sizeCap: PHASE_RULES[3].sizeCap },
    4: { allowed: [...PHASE_RULES[4].allowed], sizeCap: PHASE_RULES[4].sizeCap }
  },
  
  // Multipliers
  volatilityCaps: { ...VOLATILITY_CAP },
  qualityBoosts: { ...EXPERT_QUALITY_BOOST },
  sizeBounds: { 
    min: SIZE_BOUNDS.MIN, 
    max: SIZE_BOUNDS.MAX 
  },
  
  // API configuration
  feeds: {
    tradier: {
      enabled: true,
      timeout: API_CONFIGS.tradier.timeout,
      retries: API_CONFIGS.tradier.retries,
      baseUrl: API_CONFIGS.tradier.baseUrl,
      fallbackValues: { ...FEED_FALLBACKS.tradier }
    },
    twelveData: {
      enabled: true,
      timeout: API_CONFIGS.twelvedata.timeout,
      retries: API_CONFIGS.twelvedata.retries,
      baseUrl: API_CONFIGS.twelvedata.baseUrl,
      fallbackValues: { ...FEED_FALLBACKS.twelvedata }
    },
    alpaca: {
      enabled: true,
      timeout: API_CONFIGS.alpaca.timeout,
      retries: API_CONFIGS.alpaca.retries,
      baseUrl: API_CONFIGS.alpaca.baseUrl,
      fallbackValues: { ...FEED_FALLBACKS.alpaca }
    }
  },
  
  // Timeouts
  timeouts: {
    webhookProcessing: TIMEOUTS.WEBHOOK_PROCESSING,
    marketContext: TIMEOUTS.MARKET_CONTEXT,
    decisionEngine: TIMEOUTS.DECISION_ENGINE
  }
});

/**
 * Environment-specific configuration overrides
 */
export const getEngineConfig = (): EngineConfig => {
  const config = { ...DEFAULT_ENGINE_CONFIG };
  
  // Override with environment variables if present
  if (process.env.TRADIER_API_KEY) {
    config.feeds.tradier.apiKey = process.env.TRADIER_API_KEY;
  }
  
  if (process.env.TWELVE_DATA_API_KEY) {
    config.feeds.twelveData.apiKey = process.env.TWELVE_DATA_API_KEY;
  }
  
  if (process.env.ALPACA_API_KEY) {
    config.feeds.alpaca.apiKey = process.env.ALPACA_API_KEY;
  }
  
  // Freeze the final configuration to prevent runtime modifications
  return Object.freeze(config);
};

/**
 * Validate configuration at startup
 */
export const validateEngineConfig = (config: EngineConfig): string[] => {
  const errors: string[] = [];
  
  // Validate version
  if (!config.version || config.version !== ENGINE_VERSION) {
    errors.push(`Invalid engine version: expected ${ENGINE_VERSION}, got ${config.version}`);
  }
  
  // Validate gate thresholds
  if (config.gates.maxSpreadBps <= 0) {
    errors.push('maxSpreadBps must be positive');
  }
  
  if (config.gates.minConfidence < 0 || config.gates.minConfidence > 100) {
    errors.push('minConfidence must be between 0 and 100');
  }
  
  // Validate phase rules
  for (const [phase, rules] of Object.entries(config.phases)) {
    if (rules.sizeCap <= 0) {
      errors.push(`Phase ${phase} sizeCap must be positive`);
    }
  }
  
  // Validate size bounds
  if (config.sizeBounds.min >= config.sizeBounds.max) {
    errors.push('sizeBounds.min must be less than sizeBounds.max');
  }
  
  // Validate timeouts
  if (config.timeouts.webhookProcessing <= 0) {
    errors.push('webhookProcessing timeout must be positive');
  }
  
  if (config.timeouts.marketContext <= 0) {
    errors.push('marketContext timeout must be positive');
  }
  
  if (config.timeouts.decisionEngine <= 0) {
    errors.push('decisionEngine timeout must be positive');
  }
  
  return errors;
};