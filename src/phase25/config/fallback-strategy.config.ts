/**
 * Fallback Strategy Configuration
 * Defines how the system behaves when market data providers fail
 */

export const FALLBACK_STRATEGY = {
  // When to use fallbacks
  triggers: {
    TIMEOUT: true,           // Use fallback on timeout (600ms)
    AUTH_ERROR: true,        // Use fallback on 401 Unauthorized
    RATE_LIMIT: true,        // Use fallback on 429 Too Many Requests
    SERVER_ERROR: true,      // Use fallback on 5xx errors
    NETWORK_ERROR: true,     // Use fallback on network issues
    INVALID_RESPONSE: true   // Use fallback on malformed responses
  },
  
  // Fallback values with rationale
  values: {
    tradier: {
      options: {
        putCallRatio: 1.0,      // Neutral - no directional bias
        ivPercentile: 50,       // Mid-range - average volatility
        gammaBias: 'NEUTRAL' as const,   // No gamma exposure assumption
        optionVolume: 0,        // Unknown - can't assess flow
        maxPain: 0,             // Unknown - can't calculate
        confidence: 0,          // Zero confidence in fallback data
        reason: 'Using conservative neutral values due to provider failure'
      }
    },
    
    twelveData: {
      stats: {
        atr14: 2.0,            // Conservative ATR (typical for SPY)
        rv20: 20.0,            // Conservative realized volatility
        trendSlope: 0.0,       // Neutral trend - no directional bias
        rsi: 50.0,             // Neutral RSI - neither overbought nor oversold
        volume: 1000000,       // Placeholder volume
        volumeRatio: 1.0,      // Normal volume - no unusual activity
        confidence: 0,         // Zero confidence in fallback data
        reason: 'Using conservative neutral values due to provider failure'
      },
      
      liquidity: {
        spreadBps: 15.0,       // Conservative spread (above 12bps threshold)
        depthScore: 50.0,      // Moderate depth - neither thin nor deep
        tradeVelocity: 'NORMAL' as const,
        bidSize: 100,          // Placeholder size
        askSize: 100,          // Placeholder size
        confidence: 0,         // Zero confidence in fallback data
        reason: 'Using conservative neutral values due to provider failure'
      }
    }
  },
  
  // Confidence adjustments when using fallbacks
  confidencePenalty: {
    ONE_PROVIDER_FALLBACK: -10,    // -10 points if 1 provider fails
    TWO_PROVIDERS_FALLBACK: -20,   // -20 points if 2 providers fail
    ALL_PROVIDERS_FALLBACK: -30,   // -30 points if all providers fail
    
    rationale: {
      ONE_PROVIDER: 'Missing one data source reduces decision quality by ~10%',
      TWO_PROVIDERS: 'Missing two data sources significantly reduces decision quality by ~20%',
      ALL_PROVIDERS: 'Missing all market data makes decisions highly uncertain, reduce by ~30%'
    }
  },
  
  // Retry strategy
  retry: {
    maxAttempts: 2,
    backoffMs: [1000, 2000],  // 1s, 2s exponential backoff
    retryOn: ['TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR'],
    
    rationale: 'Retry transient failures (timeouts, network, server errors) but not auth/rate limit issues'
  },
  
  // Logging configuration
  logging: {
    logFallbackUsage: true,
    logRetryAttempts: true,
    logProviderErrors: true,
    
    rationale: 'Track fallback usage to identify persistent provider issues'
  }
};

/**
 * Get fallback value for a specific provider and data type
 */
export function getFallbackValue(provider: 'tradier' | 'twelveData', dataType: string): unknown {
  if (provider === 'tradier' && dataType === 'options') {
    return FALLBACK_STRATEGY.values.tradier.options;
  }
  
  if (provider === 'twelveData' && dataType === 'stats') {
    return FALLBACK_STRATEGY.values.twelveData.stats;
  }
  
  if (provider === 'twelveData' && dataType === 'liquidity') {
    return FALLBACK_STRATEGY.values.twelveData.liquidity;
  }
  
  return null;
}

/**
 * Calculate confidence penalty based on number of failed providers
 */
export function calculateFallbackPenalty(failedProviders: number): number {
  if (failedProviders === 0) return 0;
  if (failedProviders === 1) return FALLBACK_STRATEGY.confidencePenalty.ONE_PROVIDER_FALLBACK;
  if (failedProviders === 2) return FALLBACK_STRATEGY.confidencePenalty.TWO_PROVIDERS_FALLBACK;
  return FALLBACK_STRATEGY.confidencePenalty.ALL_PROVIDERS_FALLBACK;
}

/**
 * Check if error should trigger fallback
 */
export function shouldUseFallback(errorType: string): boolean {
  const triggers = FALLBACK_STRATEGY.triggers;
  
  switch (errorType) {
    case 'TIMEOUT':
      return triggers.TIMEOUT;
    case 'AUTH_ERROR':
      return triggers.AUTH_ERROR;
    case 'RATE_LIMIT':
      return triggers.RATE_LIMIT;
    case 'SERVER_ERROR':
      return triggers.SERVER_ERROR;
    case 'NETWORK_ERROR':
      return triggers.NETWORK_ERROR;
    case 'INVALID_RESPONSE':
      return triggers.INVALID_RESPONSE;
    default:
      return true; // Default to using fallback for unknown errors
  }
}
