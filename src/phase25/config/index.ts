/**
 * Configuration Management for Decision Engine Phase 2.5
 * 
 * Loads and validates configuration from environment variables
 * and provides typed configuration objects for the entire system.
 */

import { EngineConfig, FeedConfig, AuthConfig, WebhookSource } from '../types';
import { ENGINE_VERSION, validateRulesImmutability } from './rules';

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * Loads configuration from environment variables with validation
 */
export function loadConfiguration(): EngineConfig {
  // Validate rules immutability at startup
  if (!validateRulesImmutability()) {
    throw new Error('CRITICAL: Decision rules are not properly frozen');
  }

  const config: EngineConfig = {
    version: ENGINE_VERSION,
    
    gates: {
      maxSpreadBps: parseFloat(process.env.PHASE25_MAX_SPREAD_BPS || '12'),
      maxAtrSpike: parseFloat(process.env.PHASE25_MAX_ATR_SPIKE || '50'),
      minDepthScore: parseFloat(process.env.PHASE25_MIN_DEPTH_SCORE || '60'),
      minConfidence: parseFloat(process.env.PHASE25_MIN_CONFIDENCE || '65'),
      restrictedSessions: (process.env.PHASE25_RESTRICTED_SESSIONS || 'AFTERHOURS').split(',')
    },
    
    phases: {
      1: { allowed: ['LONG', 'SHORT'], sizeCap: 1.0 },
      2: { allowed: ['LONG'], sizeCap: 2.0 },
      3: { allowed: [], sizeCap: 0.5 },
      4: { allowed: ['SHORT'], sizeCap: 2.0 }
    },
    
    volatilityCaps: {
      LOW: 1.0,
      NORMAL: 1.5,
      HIGH: 0.5
    },
    
    qualityBoosts: {
      EXTREME: 1.15,
      HIGH: 1.05,
      MEDIUM: 1.0
    },
    
    sizeBounds: {
      min: parseFloat(process.env.PHASE25_MIN_SIZE || '0.5'),
      max: parseFloat(process.env.PHASE25_MAX_SIZE || '3.0')
    },
    
    // Confidence and scoring thresholds
    confidenceThresholds: {
      execute: parseFloat(process.env.PHASE25_CONFIDENCE_EXECUTE || '75'),
      wait: parseFloat(process.env.PHASE25_CONFIDENCE_WAIT || '60'),
      skip: parseFloat(process.env.PHASE25_CONFIDENCE_SKIP || '40')
    },
    
    aiScoreThresholds: {
      minimum: parseFloat(process.env.PHASE25_AI_SCORE_MIN || '5.0'),
      penaltyBelow: parseFloat(process.env.PHASE25_AI_SCORE_PENALTY || '4.0')
    },
    
    alignmentThresholds: {
      strongAlignment: parseFloat(process.env.PHASE25_ALIGNMENT_STRONG || '0.8'),
      bonusMultiplier: parseFloat(process.env.PHASE25_ALIGNMENT_BONUS || '1.2')
    },
    
    // Context rules
    contextRules: {
      maxAge: parseInt(process.env.PHASE25_CONTEXT_MAX_AGE || '300000'), // 5 minutes
      requiredSources: ['TRADINGVIEW_SIGNAL'] as WebhookSource[],
      optionalSources: ['SATY_PHASE', 'MTF_DOTS', 'ULTIMATE_OPTIONS', 'STRAT_EXEC'] as WebhookSource[]
    },
    
    feeds: {
      tradier: createFeedConfig('TRADIER'),
      twelveData: createFeedConfig('TWELVE_DATA'),
      alpaca: createFeedConfig('ALPACA')
    },
    
    timeouts: {
      webhookProcessing: parseInt(process.env.PHASE25_WEBHOOK_TIMEOUT || '500'),
      marketContext: parseInt(process.env.PHASE25_MARKET_TIMEOUT || '600'),
      decisionEngine: parseInt(process.env.PHASE25_ENGINE_TIMEOUT || '10')
    }
  };

  validateConfiguration(config);
  return Object.freeze(config); // Freeze entire config
}

/**
 * Creates feed configuration from environment variables
 */
function createFeedConfig(provider: string): FeedConfig {
  const prefix = `PHASE25_${provider}`;
  
  return {
    enabled: process.env[`${prefix}_ENABLED`] !== 'false',
    timeout: parseInt(process.env[`${prefix}_TIMEOUT`] || '600'),
    retries: parseInt(process.env[`${prefix}_RETRIES`] || '2'),
    apiKey: process.env[`${prefix}_API_KEY`],
    baseUrl: process.env[`${prefix}_BASE_URL`] || getDefaultBaseUrl(provider),
    fallbackValues: getFallbackValues(provider)
  };
}

/**
 * Gets default base URLs for API providers
 */
function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'TRADIER':
      return 'https://api.tradier.com/v1';
    case 'TWELVE_DATA':
      return 'https://api.twelvedata.com';
    case 'ALPACA':
      return 'https://data.alpaca.markets/v2';
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Gets fallback values for each provider
 */
function getFallbackValues(provider: string): Record<string, unknown> {
  switch (provider) {
    case 'TRADIER':
      return {
        putCallRatio: 0.8,
        ivPercentile: 50,
        gammaBias: 'NEUTRAL',
        optionVolume: 0,
        maxPain: 0
      };
    case 'TWELVE_DATA':
      return {
        atr14: 2.0,
        rv20: 20,
        trendSlope: 0,
        rsi: 50,
        volume: 0,
        volumeRatio: 1.0
      };
    case 'ALPACA':
      return {
        spreadBps: 5,
        depthScore: 70,
        tradeVelocity: 'NORMAL',
        bidSize: 0,
        askSize: 0
      };
    default:
      return {};
  }
}

/**
 * Validates configuration parameters
 */
function validateConfiguration(config: EngineConfig): void {
  const errors: string[] = [];

  // Validate numeric ranges
  if (config.gates.maxSpreadBps <= 0 || config.gates.maxSpreadBps > 100) {
    errors.push('maxSpreadBps must be between 0 and 100');
  }

  if (config.gates.minConfidence < 0 || config.gates.minConfidence > 100) {
    errors.push('minConfidence must be between 0 and 100');
  }

  if (config.sizeBounds.min <= 0 || config.sizeBounds.min >= config.sizeBounds.max) {
    errors.push('sizeBounds.min must be positive and less than sizeBounds.max');
  }

  if (config.sizeBounds.max <= 0 || config.sizeBounds.max > 10) {
    errors.push('sizeBounds.max must be positive and reasonable (<=10)');
  }

  // Validate timeouts
  if (config.timeouts.webhookProcessing <= 0 || config.timeouts.webhookProcessing > 5000) {
    errors.push('webhookProcessing timeout must be between 0 and 5000ms');
  }

  if (config.timeouts.marketContext <= 0 || config.timeouts.marketContext > 2000) {
    errors.push('marketContext timeout must be between 0 and 2000ms');
  }

  // Validate feed configurations
  Object.entries(config.feeds).forEach(([name, feedConfig]) => {
    if (feedConfig.timeout <= 0 || feedConfig.timeout > 2000) {
      errors.push(`${name} feed timeout must be between 0 and 2000ms`);
    }
    
    if (feedConfig.retries < 0 || feedConfig.retries > 5) {
      errors.push(`${name} feed retries must be between 0 and 5`);
    }
    
    if (!feedConfig.baseUrl) {
      errors.push(`${name} feed baseUrl is required`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Creates authentication configuration
 */
export function createAuthConfig(): AuthConfig {
  return {
    hmacSecret: process.env.PHASE25_HMAC_SECRET,
    bearerToken: process.env.PHASE25_BEARER_TOKEN,
    requireAuth: process.env.PHASE25_REQUIRE_AUTH === 'true'
  };
}

/**
 * Gets configuration hash for versioning and change detection
 */
export function getConfigurationHash(config: EngineConfig): string {
  const configString = JSON.stringify(config, null, 0);
  
  // Simple hash function (for production, use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < configString.length; i++) {
    const char = configString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Validates that configuration hasn't changed since startup
 */
export function validateConfigurationIntegrity(
  originalConfig: EngineConfig,
  originalHash: string
): boolean {
  const currentHash = getConfigurationHash(originalConfig);
  return currentHash === originalHash;
}

// ============================================================================
// SINGLETON CONFIGURATION INSTANCE
// ============================================================================

let configInstance: EngineConfig | null = null;
let configHash: string | null = null;

/**
 * Gets the singleton configuration instance
 */
export function getConfiguration(): EngineConfig {
  if (!configInstance) {
    configInstance = loadConfiguration();
    configHash = getConfigurationHash(configInstance);
  }
  
  return configInstance;
}

/**
 * Gets the configuration hash
 */
export function getConfigHash(): string {
  if (!configHash) {
    getConfiguration(); // Initialize if needed
  }
  
  return configHash!;
}

/**
 * Resets configuration (for testing only)
 */
export function resetConfiguration(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Configuration reset only allowed in test environment');
  }
  
  configInstance = null;
  configHash = null;
}