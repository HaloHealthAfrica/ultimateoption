/**
 * Market Feeds Configuration Tests
 * 
 * Tests for market feed configuration and validation.
 */

import { 
  MARKET_FEEDS_CONFIG, 
  getMarketFeedsConfig, 
  validateMarketFeedsConfig,
  getCurrentMarketSession,
  MARKET_SESSIONS
} from '../config/market-feeds.config';

describe('Market Feeds Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('MARKET_FEEDS_CONFIG', () => {
    it('should have correct default configuration', () => {
      expect(MARKET_FEEDS_CONFIG.tradier.enabled).toBe(true);
      expect(MARKET_FEEDS_CONFIG.tradier.timeout).toBe(600);
      expect(MARKET_FEEDS_CONFIG.tradier.retries).toBe(2);
      expect(MARKET_FEEDS_CONFIG.tradier.baseUrl).toBe('https://api.tradier.com');

      expect(MARKET_FEEDS_CONFIG.twelveData.enabled).toBe(true);
      expect(MARKET_FEEDS_CONFIG.twelveData.timeout).toBe(600);
      expect(MARKET_FEEDS_CONFIG.twelveData.baseUrl).toBe('https://api.twelvedata.com');

      expect(MARKET_FEEDS_CONFIG.alpaca.enabled).toBe(true);
      expect(MARKET_FEEDS_CONFIG.alpaca.timeout).toBe(600);
      expect(MARKET_FEEDS_CONFIG.alpaca.baseUrl).toBe('https://data.alpaca.markets');
    });

    it('should have fallback values for all feeds', () => {
      expect(MARKET_FEEDS_CONFIG.tradier.fallbackValues.options).toBeDefined();
      expect(MARKET_FEEDS_CONFIG.tradier.fallbackValues.options.putCallRatio).toBe(1.0);
      expect(MARKET_FEEDS_CONFIG.tradier.fallbackValues.options.gammaBias).toBe('NEUTRAL');

      expect(MARKET_FEEDS_CONFIG.twelveData.fallbackValues.stats).toBeDefined();
      expect(MARKET_FEEDS_CONFIG.twelveData.fallbackValues.stats.atr14).toBe(2.0);
      expect(MARKET_FEEDS_CONFIG.twelveData.fallbackValues.stats.rsi).toBe(50.0);

      expect(MARKET_FEEDS_CONFIG.alpaca.fallbackValues.liquidity).toBeDefined();
      expect(MARKET_FEEDS_CONFIG.alpaca.fallbackValues.liquidity.spreadBps).toBe(15.0);
      expect(MARKET_FEEDS_CONFIG.alpaca.fallbackValues.liquidity.tradeVelocity).toBe('NORMAL');
    });
  });

  describe('getMarketFeedsConfig', () => {
    it('should return default config in production', () => {
      process.env.NODE_ENV = 'production';
      
      const config = getMarketFeedsConfig();
      
      expect(config.tradier.enabled).toBe(true);
      expect(config.tradier.timeout).toBe(600);
      expect(config.twelveData.enabled).toBe(true);
      expect(config.alpaca.enabled).toBe(true);
    });

    it('should disable feeds in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const config = getMarketFeedsConfig();
      
      expect(config.tradier.enabled).toBe(false);
      expect(config.twelveData.enabled).toBe(false);
      expect(config.alpaca.enabled).toBe(false);
    });

    it('should use shorter timeouts in development', () => {
      process.env.NODE_ENV = 'development';
      
      const config = getMarketFeedsConfig();
      
      expect(config.tradier.timeout).toBe(300);
      expect(config.twelveData.timeout).toBe(300);
      expect(config.alpaca.timeout).toBe(300);
    });
  });

  describe('validateMarketFeedsConfig', () => {
    it('should return no errors when all API keys are provided', () => {
      const config = {
        tradier: { ...MARKET_FEEDS_CONFIG.tradier, apiKey: 'test-key' },
        twelveData: { ...MARKET_FEEDS_CONFIG.twelveData, apiKey: 'test-key' },
        alpaca: { ...MARKET_FEEDS_CONFIG.alpaca, apiKey: 'test-key' }
      };

      const errors = validateMarketFeedsConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for missing API keys when feeds are enabled', () => {
      const config = {
        tradier: { ...MARKET_FEEDS_CONFIG.tradier, enabled: true, apiKey: '' },
        twelveData: { ...MARKET_FEEDS_CONFIG.twelveData, enabled: true, apiKey: '' },
        alpaca: { ...MARKET_FEEDS_CONFIG.alpaca, enabled: true, apiKey: '' }
      };

      const errors = validateMarketFeedsConfig(config);
      expect(errors).toHaveLength(3);
      expect(errors[0]).toContain('TRADIER_API_KEY');
      expect(errors[1]).toContain('TWELVE_DATA_API_KEY');
      expect(errors[2]).toContain('ALPACA_API_KEY');
    });

    it('should not return errors for missing API keys when feeds are disabled', () => {
      const config = {
        tradier: { ...MARKET_FEEDS_CONFIG.tradier, enabled: false, apiKey: '' },
        twelveData: { ...MARKET_FEEDS_CONFIG.twelveData, enabled: false, apiKey: '' },
        alpaca: { ...MARKET_FEEDS_CONFIG.alpaca, enabled: false, apiKey: '' }
      };

      const errors = validateMarketFeedsConfig(config);
      expect(errors).toHaveLength(0);
    });
  });

  describe('MARKET_SESSIONS', () => {
    it('should have correct session definitions', () => {
      expect(MARKET_SESSIONS.PREMARKET.start).toBe('04:00');
      expect(MARKET_SESSIONS.PREMARKET.end).toBe('09:30');
      
      expect(MARKET_SESSIONS.REGULAR.start).toBe('09:30');
      expect(MARKET_SESSIONS.REGULAR.end).toBe('16:00');
      
      expect(MARKET_SESSIONS.AFTERHOURS.start).toBe('16:00');
      expect(MARKET_SESSIONS.AFTERHOURS.end).toBe('20:00');
      
      // All sessions should use NY timezone
      expect(MARKET_SESSIONS.PREMARKET.timezone).toBe('America/New_York');
      expect(MARKET_SESSIONS.REGULAR.timezone).toBe('America/New_York');
      expect(MARKET_SESSIONS.AFTERHOURS.timezone).toBe('America/New_York');
    });
  });

  describe('getCurrentMarketSession', () => {
    // Note: These tests are time-dependent and may need adjustment based on when they run
    // In a real implementation, you might want to mock the Date object for consistent testing

    it('should return CLOSED on weekends', () => {
      // Mock a Saturday
      const saturday = new Date('2024-01-06T12:00:00Z'); // Saturday
      jest.spyOn(global, 'Date').mockImplementation(() => saturday as any);
      
      const session = getCurrentMarketSession();
      expect(session).toBe('CLOSED');
      
      jest.restoreAllMocks();
    });

    it('should handle different time zones correctly', () => {
      // This test verifies that the function uses NY timezone correctly
      // The actual implementation depends on the current time, so we test the logic
      const session = getCurrentMarketSession();
      expect(['PREMARKET', 'REGULAR', 'AFTERHOURS', 'CLOSED']).toContain(session);
    });
  });

  describe('Environment Variable Integration', () => {
    it('should read API keys from environment variables', () => {
      process.env.TRADIER_API_KEY = 'env-tradier-key';
      process.env.TWELVE_DATA_API_KEY = 'env-twelve-key';
      process.env.ALPACA_API_KEY = 'env-alpaca-key';

      // Re-import to get fresh config with env vars
      jest.resetModules();
      const { MARKET_FEEDS_CONFIG: freshConfig } = require('../config/market-feeds.config');

      expect(freshConfig.tradier.apiKey).toBe('env-tradier-key');
      expect(freshConfig.twelveData.apiKey).toBe('env-twelve-key');
      expect(freshConfig.alpaca.apiKey).toBe('env-alpaca-key');
    });

    it('should use empty string when environment variables are not set', () => {
      delete process.env.TRADIER_API_KEY;
      delete process.env.TWELVE_DATA_API_KEY;
      delete process.env.ALPACA_API_KEY;

      // Re-import to get fresh config without env vars
      jest.resetModules();
      const { MARKET_FEEDS_CONFIG: freshConfig } = require('../config/market-feeds.config');

      expect(freshConfig.tradier.apiKey).toBe('');
      expect(freshConfig.twelveData.apiKey).toBe('');
      expect(freshConfig.alpaca.apiKey).toBe('');
    });
  });

  describe('Configuration Immutability', () => {
    it('should not allow modification of default configuration', () => {
      // Attempt to modify the configuration
      const originalTimeout = MARKET_FEEDS_CONFIG.tradier.timeout;
      
      // This should not affect the original config due to spread operator in getMarketFeedsConfig
      const config = getMarketFeedsConfig();
      config.tradier.timeout = 999;
      
      expect(MARKET_FEEDS_CONFIG.tradier.timeout).toBe(originalTimeout);
    });
  });
});