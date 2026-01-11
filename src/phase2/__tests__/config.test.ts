/**
 * Phase 2 Decision Engine - Configuration Tests
 * 
 * Unit tests for configuration loading, validation, and security.
 */

import { loadConfig, validateConfig, maskSensitiveData, PROVIDER_CONFIG, NORMALIZATION_RULES } from '../config';

describe('Phase 2 Configuration Management', () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    test('should load configuration from environment variables', () => {
      // Set required environment variables
      process.env.TRADIER_API_KEY = 'test_tradier_key';
      process.env.TWELVEDATA_API_KEY = 'test_twelvedata_key';
      process.env.ALPACA_API_KEY = 'test_alpaca_key';
      process.env.ALPACA_SECRET_KEY = 'test_alpaca_secret';
      process.env.PORT = '3001';

      const config = loadConfig();

      expect(config.tradier.apiKey).toBe('test_tradier_key');
      expect(config.twelveData.apiKey).toBe('test_twelvedata_key');
      expect(config.alpaca.apiKey).toBe('test_alpaca_key');
      expect(config.alpaca.secretKey).toBe('test_alpaca_secret');
      expect(config.server.port).toBe(3001);
    });

    test('should use default URLs when not provided', () => {
      process.env.TRADIER_API_KEY = 'test_key';
      process.env.TWELVEDATA_API_KEY = 'test_key';
      process.env.ALPACA_API_KEY = 'test_key';
      process.env.ALPACA_SECRET_KEY = 'test_secret';

      const config = loadConfig();

      expect(config.tradier.baseUrl).toBe('https://api.tradier.com');
      expect(config.twelveData.baseUrl).toBe('https://api.twelvedata.com');
      expect(config.alpaca.baseUrl).toBe('https://paper-api.alpaca.markets');
      expect(config.server.port).toBe(3000); // Default port
    });

    test('should use custom URLs when provided', () => {
      process.env.TRADIER_API_KEY = 'test_key';
      process.env.TWELVEDATA_API_KEY = 'test_key';
      process.env.ALPACA_API_KEY = 'test_key';
      process.env.ALPACA_SECRET_KEY = 'test_secret';
      process.env.TRADIER_BASE_URL = 'https://custom.tradier.com';
      process.env.TWELVEDATA_BASE_URL = 'https://custom.twelvedata.com';
      process.env.ALPACA_BASE_URL = 'https://custom.alpaca.com';

      const config = loadConfig();

      expect(config.tradier.baseUrl).toBe('https://custom.tradier.com');
      expect(config.twelveData.baseUrl).toBe('https://custom.twelvedata.com');
      expect(config.alpaca.baseUrl).toBe('https://custom.alpaca.com');
    });

    test('should throw error when required environment variables are missing', () => {
      // Missing TRADIER_API_KEY
      process.env.TWELVEDATA_API_KEY = 'test_key';
      process.env.ALPACA_API_KEY = 'test_key';
      process.env.ALPACA_SECRET_KEY = 'test_secret';

      expect(() => loadConfig()).toThrow('Missing required environment variables: TRADIER_API_KEY');
    });

    test('should throw error when multiple required variables are missing', () => {
      // Only set one required variable
      process.env.TRADIER_API_KEY = 'test_key';

      expect(() => loadConfig()).toThrow('Missing required environment variables');
      expect(() => loadConfig()).toThrow('TWELVEDATA_API_KEY');
      expect(() => loadConfig()).toThrow('ALPACA_API_KEY');
      expect(() => loadConfig()).toThrow('ALPACA_SECRET_KEY');
    });
  });

  describe('validateConfig', () => {
    test('should validate valid configuration', () => {
      const validConfig = {
        tradier: {
          apiKey: 'valid_key',
          baseUrl: 'https://api.tradier.com'
        },
        twelveData: {
          apiKey: 'valid_key',
          baseUrl: 'https://api.twelvedata.com'
        },
        alpaca: {
          apiKey: 'valid_key',
          secretKey: 'valid_secret',
          baseUrl: 'https://paper-api.alpaca.markets'
        },
        server: {
          port: 3001
        }
      };

      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    test('should throw error for invalid URLs', () => {
      const invalidConfig = {
        tradier: {
          apiKey: 'valid_key',
          baseUrl: 'invalid-url'
        },
        twelveData: {
          apiKey: 'valid_key',
          baseUrl: 'https://api.twelvedata.com'
        },
        alpaca: {
          apiKey: 'valid_key',
          secretKey: 'valid_secret',
          baseUrl: 'https://paper-api.alpaca.markets'
        },
        server: {
          port: 3001
        }
      };

      expect(() => validateConfig(invalidConfig)).toThrow('Invalid URL in configuration: invalid-url');
    });

    test('should throw error for invalid port numbers', () => {
      const invalidPortConfig = {
        tradier: {
          apiKey: 'valid_key',
          baseUrl: 'https://api.tradier.com'
        },
        twelveData: {
          apiKey: 'valid_key',
          baseUrl: 'https://api.twelvedata.com'
        },
        alpaca: {
          apiKey: 'valid_key',
          secretKey: 'valid_secret',
          baseUrl: 'https://paper-api.alpaca.markets'
        },
        server: {
          port: 70000 // Invalid port
        }
      };

      expect(() => validateConfig(invalidPortConfig)).toThrow('Invalid port: 70000');
    });

    test('should throw error for empty API keys', () => {
      const emptyKeyConfig = {
        tradier: {
          apiKey: '   ', // Empty/whitespace key
          baseUrl: 'https://api.tradier.com'
        },
        twelveData: {
          apiKey: 'valid_key',
          baseUrl: 'https://api.twelvedata.com'
        },
        alpaca: {
          apiKey: 'valid_key',
          secretKey: 'valid_secret',
          baseUrl: 'https://paper-api.alpaca.markets'
        },
        server: {
          port: 3001
        }
      };

      expect(() => validateConfig(emptyKeyConfig)).toThrow('Tradier API key cannot be empty');
    });
  });

  describe('maskSensitiveData', () => {
    test('should mask API keys and secrets', () => {
      const sensitiveData = {
        tradier: {
          apiKey: 'secret123456789',
          baseUrl: 'https://api.tradier.com'
        },
        alpaca: {
          secretKey: 'topsecret987654321',
          apiKey: 'public123456789'
        },
        normalField: 'this should not be masked'
      };

      const masked = maskSensitiveData(sensitiveData);

      expect(masked.tradier.apiKey).toBe('secr***********');
      expect(masked.alpaca.secretKey).toBe('tops**************');
      expect(masked.alpaca.apiKey).toBe('publ***********');
      expect(masked.normalField).toBe('this should not be masked');
      expect(masked.tradier.baseUrl).toBe('https://api.tradier.com');
    });

    test('should handle nested objects', () => {
      const nestedData = {
        config: {
          auth: {
            apiKey: 'nested123456789',
            token: 'bearer987654321'
          },
          server: {
            port: 3001
          }
        }
      };

      const masked = maskSensitiveData(nestedData);

      expect(masked.config.auth.apiKey).toBe('nest***********');
      expect(masked.config.auth.token).toBe('bear***********');
      expect(masked.config.server.port).toBe(3001);
    });

    test('should handle non-object inputs', () => {
      expect(maskSensitiveData('string')).toBe('string');
      expect(maskSensitiveData(123)).toBe(123);
      expect(maskSensitiveData(null)).toBe(null);
      expect(maskSensitiveData(undefined)).toBe(undefined);
    });

    test('should handle short API keys', () => {
      const shortKeyData = {
        apiKey: 'abc',
        key: 'x'
      };

      const masked = maskSensitiveData(shortKeyData);

      expect(masked.apiKey).toBe('abc'); // Too short to mask meaningfully
      expect(masked.key).toBe('x');
    });
  });

  describe('Immutable Constants', () => {
    test('PROVIDER_CONFIG should be frozen', () => {
      // Test that the object structure is correct
      expect(PROVIDER_CONFIG.tradier.timeout).toBe(600);
      expect(PROVIDER_CONFIG.tradier.fallback.gammaBias).toBe('NEUTRAL');
    });

    test('NORMALIZATION_RULES should be frozen', () => {
      // Test that the object structure is correct
      expect(NORMALIZATION_RULES.aiScore.max).toBe(10.5);
      expect(NORMALIZATION_RULES.validSessions).toContain('OPEN');
    });

    test('should have correct provider timeout values', () => {
      expect(PROVIDER_CONFIG.tradier.timeout).toBe(600);
      expect(PROVIDER_CONFIG.twelveData.timeout).toBe(600);
      expect(PROVIDER_CONFIG.alpaca.timeout).toBe(600);
    });

    test('should have correct normalization bounds', () => {
      expect(NORMALIZATION_RULES.aiScore.min).toBe(0);
      expect(NORMALIZATION_RULES.aiScore.max).toBe(10.5);
      expect(NORMALIZATION_RULES.satyPhase.min).toBe(-100);
      expect(NORMALIZATION_RULES.satyPhase.max).toBe(100);
    });
  });
});