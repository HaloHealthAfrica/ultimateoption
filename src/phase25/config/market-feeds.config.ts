/**
 * Market Feed Configuration for Phase 2.5 Decision Engine
 * 
 * Defines API endpoints, timeouts, and fallback values for all market data providers.
 */

import { FeedConfig } from '../types';

// Default configuration for all market data feeds
export const MARKET_FEEDS_CONFIG = {
  tradier: {
    enabled: true,
    timeout: 600, // 600ms as per requirements
    retries: 2,
    apiKey: process.env.TRADIER_API_KEY || '',
    baseUrl: 'https://api.tradier.com',
    fallbackValues: {
      options: {
        putCallRatio: 1.0,
        ivPercentile: 50,
        gammaBias: 'NEUTRAL' as const,
        optionVolume: 0,
        maxPain: 0
      }
    }
  } as FeedConfig,

  twelveData: {
    enabled: true,
    timeout: 600, // 600ms as per requirements
    retries: 2,
    apiKey: process.env.TWELVE_DATA_API_KEY || '',
    baseUrl: 'https://api.twelvedata.com',
    fallbackValues: {
      stats: {
        atr14: 2.0, // Conservative default ATR
        rv20: 20.0, // Conservative default realized volatility
        trendSlope: 0.0, // Neutral trend
        rsi: 50.0, // Neutral RSI
        volume: 1000000, // Default volume
        volumeRatio: 1.0 // Normal volume ratio
      }
    }
  } as FeedConfig,

  alpaca: {
    enabled: true,
    timeout: 600, // 600ms as per requirements
    retries: 2,
    apiKey: process.env.ALPACA_API_KEY || '',
    baseUrl: 'https://data.alpaca.markets',
    fallbackValues: {
      liquidity: {
        spreadBps: 15.0, // Conservative default spread (above 12bps threshold)
        depthScore: 50.0, // Moderate depth score
        tradeVelocity: 'NORMAL' as const,
        bidSize: 100,
        askSize: 100
      }
    }
  } as FeedConfig
};

// Environment-specific overrides
export const getMarketFeedsConfig = () => {
  // Deep clone the configuration to prevent mutations
  const config = {
    tradier: { ...MARKET_FEEDS_CONFIG.tradier },
    twelveData: { ...MARKET_FEEDS_CONFIG.twelveData },
    alpaca: { ...MARKET_FEEDS_CONFIG.alpaca }
  };
  
  // Disable feeds in test environment
  if (process.env.NODE_ENV === 'test') {
    config.tradier.enabled = false;
    config.twelveData.enabled = false;
    config.alpaca.enabled = false;
  }
  
  // Use shorter timeouts in development
  if (process.env.NODE_ENV === 'development') {
    config.tradier.timeout = 300;
    config.twelveData.timeout = 300;
    config.alpaca.timeout = 300;
  }
  
  return config;
};

// Validation for required API keys
export const validateMarketFeedsConfig = (config: typeof MARKET_FEEDS_CONFIG): string[] => {
  const errors: string[] = [];
  
  if (config.tradier.enabled && !config.tradier.apiKey) {
    errors.push('TRADIER_API_KEY environment variable is required when Tradier feed is enabled');
  }
  
  if (config.twelveData.enabled && !config.twelveData.apiKey) {
    errors.push('TWELVE_DATA_API_KEY environment variable is required when TwelveData feed is enabled');
  }
  
  if (config.alpaca.enabled && !config.alpaca.apiKey) {
    errors.push('ALPACA_API_KEY environment variable is required when Alpaca feed is enabled');
  }
  
  return errors;
};

// Market session configuration
export const MARKET_SESSIONS = {
  PREMARKET: {
    start: '04:00',
    end: '09:30',
    timezone: 'America/New_York'
  },
  REGULAR: {
    start: '09:30',
    end: '16:00',
    timezone: 'America/New_York'
  },
  AFTERHOURS: {
    start: '16:00',
    end: '20:00',
    timezone: 'America/New_York'
  }
};

// Get current market session
export const getCurrentMarketSession = (): 'PREMARKET' | 'REGULAR' | 'AFTERHOURS' | 'CLOSED' => {
  const now = new Date();
  const nyTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  }).format(now);
  
  const [hours, minutes] = nyTime.split(':').map(Number);
  const currentTime = hours * 100 + minutes;
  
  // Check if it's a weekend
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'CLOSED';
  }
  
  if (currentTime >= 400 && currentTime < 930) {
    return 'PREMARKET';
  } else if (currentTime >= 930 && currentTime < 1600) {
    return 'REGULAR';
  } else if (currentTime >= 1600 && currentTime < 2000) {
    return 'AFTERHOURS';
  } else {
    return 'CLOSED';
  }
};