/**
 * Phase 2 Decision Engine - Configuration Management
 * 
 * Environment-based configuration with validation and fallbacks.
 * All configuration is loaded at startup and validated.
 */

import { Config } from '../types';

// Performance Targets (IMMUTABLE)
export const PERFORMANCE_TARGETS = Object.freeze({
  webhookResponse: 500,    // ms - webhook must respond within 500ms
  endToEnd: 1000,         // ms - total processing time
  decisionLogic: 10,      // ms - pure decision logic
  providerTimeout: 600,   // ms - max time per external API call
  
  // Throughput targets
  requestsPerSecond: 100, // Peak load handling
  concurrentRequests: 50  // Max concurrent processing
});

// Provider Configuration (IMMUTABLE)
export const PROVIDER_CONFIG = Object.freeze({
  tradier: {
    timeout: 600, // ms
    retries: 1,
    fallback: {
      putCallRatio: 1.0,
      ivPercentile: 50,
      gammaBias: 'NEUTRAL' as const
    }
  },
  twelveData: {
    timeout: 600, // ms
    retries: 1,
    fallback: {
      atr14: 0,
      rv20: 0,
      trendSlope: 0
    }
  },
  alpaca: {
    timeout: 600, // ms
    retries: 1,
    fallback: {
      spreadBps: 999, // Conservative - will likely trigger spread gate
      depthScore: 0,
      tradeVelocity: 'SLOW' as const
    }
  }
});

// Normalization Rules (IMMUTABLE)
export const NORMALIZATION_RULES = Object.freeze({
  aiScore: {
    min: 0,
    max: 10.5,
    default: 0
  },
  satyPhase: {
    min: -100,
    max: 100,
    default: 0
  },
  validSessions: ['OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS'] as const
});

/**
 * Load configuration from environment variables
 * Throws error if required variables are missing
 */
export function loadConfig(): Config {
  // Required environment variables
  const requiredVars = [
    'TRADIER_API_KEY',
    'TWELVEDATA_API_KEY',
    'ALPACA_API_KEY',
    'ALPACA_SECRET_KEY'
  ];

  // Check for missing required variables
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    tradier: {
      apiKey: process.env.TRADIER_API_KEY!,
      baseUrl: process.env.TRADIER_BASE_URL || 'https://api.tradier.com'
    },
    twelveData: {
      apiKey: process.env.TWELVEDATA_API_KEY!,
      baseUrl: process.env.TWELVEDATA_BASE_URL || 'https://api.twelvedata.com'
    },
    alpaca: {
      apiKey: process.env.ALPACA_API_KEY!,
      secretKey: process.env.ALPACA_SECRET_KEY!,
      baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets'
    },
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      webhookSecret: process.env.WEBHOOK_SECRET
    }
  };
}

/**
 * Validate configuration at startup
 * Ensures all URLs are valid and API keys are present
 */
export function validateConfig(config: Config): void {
  // Validate URLs
  const urls = [
    config.tradier.baseUrl,
    config.twelveData.baseUrl,
    config.alpaca.baseUrl
  ];

  for (const url of urls) {
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL in configuration: ${url}`);
    }
  }

  // Validate port
  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error(`Invalid port: ${config.server.port}`);
  }

  // Validate API keys are not empty
  if (!config.tradier.apiKey.trim()) {
    throw new Error('Tradier API key cannot be empty');
  }
  if (!config.twelveData.apiKey.trim()) {
    throw new Error('TwelveData API key cannot be empty');
  }
  if (!config.alpaca.apiKey.trim()) {
    throw new Error('Alpaca API key cannot be empty');
  }
  if (!config.alpaca.secretKey.trim()) {
    throw new Error('Alpaca secret key cannot be empty');
  }
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const masked = { ...data };
  const sensitiveKeys = ['apiKey', 'secretKey', 'password', 'token', 'key'];

  for (const key in masked) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      const value = masked[key];
      if (typeof value === 'string' && value.length > 0) {
        masked[key] = value.substring(0, 4) + '*'.repeat(Math.max(0, value.length - 4));
      }
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}