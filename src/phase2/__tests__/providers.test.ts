/**
 * Phase 2 Decision Engine - Provider Integration Tests
 * 
 * Integration tests for external API clients including timeout handling,
 * fallback behavior, and authentication scenarios.
 */

import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { PROVIDER_CONFIG } from '../config/index';
import * as fc from 'fast-check';

// Mock axios to control API responses
jest.mock('axios');
const mockedAxios = jest.mocked(import('axios'));

describe('Provider Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default axios mock
    mockedAxios.create.mockReturnValue({
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    });
  });

  describe('TradierClient', () => {
    let client: TradierClient;

    beforeEach(() => {
      client = new TradierClient('test-api-key');
    });

    it('should fetch options data successfully', async () => {
      const mockOptionsResponse = {
        data: {
          options: {
            option: [
              {
                symbol: 'SPY240112C450',
                type: 'call',
                strike: 450,
                bid: 2.5,
                ask: 2.7,
                volume: 100,
                open_interest: 500,
                implied_volatility: 0.25
              },
              {
                symbol: 'SPY240112P450',
                type: 'put',
                strike: 450,
                bid: 1.8,
                ask: 2.0,
                volume: 80,
                open_interest: 300,
                implied_volatility: 0.28
              }
            ]
          }
        },
        status: 200
      };

      const mockClient = {
        get: jest.fn().mockResolvedValue(mockOptionsResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new TradierClient('test-api-key');

      const result = await client.getOptionsData('SPY');

      expect(result.source).toBe('API');
      expect(result.data.putCallRatio).toBeGreaterThan(0);
      expect(result.data.ivPercentile).toBeGreaterThanOrEqual(0);
      expect(result.data.ivPercentile).toBeLessThanOrEqual(100);
      expect(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).toContain(result.data.gammaBias);
    });

    it('should handle API timeout and return fallback data', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue(new Error('timeout of 600ms exceeded')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new TradierClient('test-api-key');

      const result = await client.getOptionsData('SPY');

      expect(result.source).toBe('FALLBACK');
      expect(result.data).toEqual(PROVIDER_CONFIG.tradier.fallback);
      expect(result._error).toContain('timeout');
    });

    it('should handle authentication failure', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue({
          response: { status: 401 },
          message: 'Unauthorized'
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new TradierClient('invalid-key');

      const result = await client.getOptionsData('SPY');

      expect(result.source).toBe('FALLBACK');
      expect(result._error).toBeDefined();
    });

    it('should test connection successfully', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({ status: 200 }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new TradierClient('test-api-key');

      const connected = await client.testConnection();
      expect(connected).toBe(true);
    });
  });

  describe('TwelveDataClient', () => {
    let client: TwelveDataClient;

    beforeEach(() => {
      client = new TwelveDataClient('test-api-key');
    });

    it('should fetch market stats successfully', async () => {
      const mockATRResponse = {
        data: {
          values: [{ datetime: '2024-01-10', atr: '2.45' }],
          status: 'ok'
        }
      };

      const mockTimeSeriesResponse = {
        data: {
          values: Array.from({ length: 25 }, (_, i) => ({
            datetime: `2024-01-${String(i + 1).padStart(2, '0')}`,
            close: String(450 + Math.random() * 10 - 5)
          })),
          status: 'ok'
        }
      };

      const mockClient = {
        get: jest.fn()
          .mockResolvedValueOnce(mockATRResponse)
          .mockResolvedValueOnce(mockTimeSeriesResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new TwelveDataClient('test-api-key');

      const result = await client.getMarketStats('SPY');

      expect(result.source).toBe('API');
      expect(result.data.atr.value).toBeGreaterThan(0);
      expect(result.data.atr.period).toBe(14);
      expect(result.data.realizedVolatility.value).toBeGreaterThanOrEqual(0);
      expect(result.data.realizedVolatility.period).toBe(20);
      expect(typeof result.data.trendSlope).toBe('number');
    });

    it('should handle partial data failure gracefully', async () => {
      const mockATRResponse = {
        data: {
          values: [{ datetime: '2024-01-10', atr: '2.45' }],
          status: 'ok'
        }
      };

      const mockClient = {
        get: jest.fn()
          .mockResolvedValueOnce(mockATRResponse)
          .mockRejectedValueOnce(new Error('Time series API error')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new TwelveDataClient('test-api-key');

      const result = await client.getMarketStats('SPY');

      expect(result.source).toBe('API');
      expect(result.data.atr.value).toBe(2.45);
      expect(result.data.realizedVolatility.value).toBe(PROVIDER_CONFIG.twelveData.fallback.rv20);
      expect(result.data.trendSlope).toBe(PROVIDER_CONFIG.twelveData.fallback.trendSlope);
    });

    it('should handle complete API failure', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue(new Error('Network error')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new TwelveDataClient('test-api-key');

      const result = await client.getMarketStats('SPY');

      expect(result.source).toBe('FALLBACK');
      expect(result.data.atr.value).toBe(PROVIDER_CONFIG.twelveData.fallback.atr14);
      expect(result._error).toBeDefined();
    });
  });

  describe('AlpacaClient', () => {
    let client: AlpacaClient;

    beforeEach(() => {
      client = new AlpacaClient('test-key', 'test-secret');
    });

    it('should fetch liquidity data successfully', async () => {
      const mockQuoteResponse = {
        data: {
          symbol: 'SPY',
          bid: 449.50,
          ask: 449.55,
          bid_size: 100,
          ask_size: 200,
          timestamp: '2024-01-10T15:30:00Z'
        }
      };

      const mockTradesResponse = {
        data: {
          trades: Array.from({ length: 50 }, (_, i) => ({
            timestamp: `2024-01-10T15:${String(25 + i).padStart(2, '0')}:00Z`,
            price: 449.52 + Math.random() * 0.1 - 0.05,
            size: Math.floor(Math.random() * 100) + 10,
            conditions: []
          })),
          symbol: 'SPY'
        }
      };

      const mockOrderbookResponse = {
        data: {
          symbol: 'SPY',
          bids: [
            { price: 449.50, size: 100 },
            { price: 449.49, size: 150 }
          ],
          asks: [
            { price: 449.55, size: 200 },
            { price: 449.56, size: 180 }
          ],
          timestamp: '2024-01-10T15:30:00Z'
        }
      };

      const mockClient = {
        get: jest.fn()
          .mockResolvedValueOnce(mockQuoteResponse)
          .mockResolvedValueOnce(mockTradesResponse)
          .mockResolvedValueOnce(mockOrderbookResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new AlpacaClient('test-key', 'test-secret');

      const result = await client.getLiquidityData('SPY');

      expect(result.source).toBe('API');
      expect(result.data.spread.bps).toBeGreaterThan(0);
      expect(result.data.depth.score).toBeGreaterThanOrEqual(0);
      expect(result.data.depth.score).toBeLessThanOrEqual(100);
      expect(['SLOW', 'NORMAL', 'FAST']).toContain(result.data.velocity);
    });

    it('should handle orderbook fallback to quote data', async () => {
      const mockQuoteResponse = {
        data: {
          symbol: 'SPY',
          bid: 449.50,
          ask: 449.55,
          bid_size: 100,
          ask_size: 200,
          timestamp: '2024-01-10T15:30:00Z'
        }
      };

      const mockTradesResponse = {
        data: {
          trades: [],
          symbol: 'SPY'
        }
      };

      const mockClient = {
        get: jest.fn()
          .mockResolvedValueOnce(mockQuoteResponse)
          .mockResolvedValueOnce(mockTradesResponse)
          .mockRejectedValueOnce(new Error('Orderbook not available'))
          .mockResolvedValueOnce(mockQuoteResponse), // Fallback quote call
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);
      client = new AlpacaClient('test-key', 'test-secret');

      const result = await client.getLiquidityData('SPY');

      expect(result.source).toBe('API');
      expect(result.data.spread.bps).toBeGreaterThan(0);
    });
  });

  describe('Property Tests - Provider Resilience', () => {
    /**
     * Property 2: Parallel Provider Execution
     * Validates: Requirements 3.1, 12.3
     * 
     * This property ensures that provider failures don't block the entire system
     * and that fallback data is always provided when APIs fail.
     */
    it('Property 2: Providers always return valid data structure regardless of API state', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT'),
        fc.boolean(), // API success/failure
        fc.boolean(), // Timeout scenario
        async (symbol, apiSuccess, timeoutScenario) => {
          const mockError = timeoutScenario 
            ? new Error('timeout of 600ms exceeded')
            : new Error('API Error');

          // Test Tradier client
          const mockTradierClient = {
            get: apiSuccess 
              ? jest.fn().mockResolvedValue({
                  data: {
                    options: {
                      option: [
                        { type: 'call', volume: 100, implied_volatility: 0.25, strike: 450, open_interest: 500 },
                        { type: 'put', volume: 80, implied_volatility: 0.28, strike: 450, open_interest: 300 }
                      ]
                    }
                  }
                })
              : jest.fn().mockRejectedValue(mockError),
            interceptors: {
              request: { use: jest.fn() },
              response: { use: jest.fn() }
            }
          };

          mockedAxios.create.mockReturnValue(mockTradierClient);
          const tradierClient = new TradierClient('test-key');
          
          const tradierResult = await tradierClient.getOptionsData(symbol);
          
          // Property: Always returns valid structure
          expect(tradierResult).toHaveProperty('data');
          expect(tradierResult).toHaveProperty('source');
          expect(tradierResult.data).toHaveProperty('putCallRatio');
          expect(tradierResult.data).toHaveProperty('ivPercentile');
          expect(tradierResult.data).toHaveProperty('gammaBias');
          expect(['API', 'FALLBACK']).toContain(tradierResult.source);
          
          if (!apiSuccess) {
            expect(tradierResult.source).toBe('FALLBACK');
            expect(tradierResult._error).toBeDefined();
          }
        }
      ), { numRuns: 10 }); // Reduced runs for async test
    });

    it('Property 2: All providers respect timeout constraints', async () => {
      const startTime = Date.now();
      
      // Mock complete failure for all endpoints
      const failureMockClient = {
        get: jest.fn().mockRejectedValue(new Error('timeout of 600ms exceeded')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(failureMockClient);

      // Create clients after setting up mocks
      const tradierClient = new TradierClient('test-key');
      const twelveDataClient = new TwelveDataClient('test-key');
      const alpacaClient = new AlpacaClient('test-key', 'test-secret');

      // All should complete within reasonable time due to timeout + fallback
      const results = await Promise.all([
        tradierClient.getOptionsData('SPY'),
        twelveDataClient.getMarketStats('SPY'),
        alpacaClient.getLiquidityData('SPY')
      ]);

      const duration = Date.now() - startTime;
      
      // Should complete within timeout + some buffer for fallback processing
      expect(duration).toBeLessThan(1000); // 600ms timeout + 400ms buffer
      
      // All should return fallback data (Alpaca uses Promise.allSettled so may still return API)
      results.forEach((result, index) => {
        expect(result.source).toMatch(/^(API|FALLBACK)$/);
        expect(result.data).toBeDefined();
        
        // Tradier and TwelveData should definitely be FALLBACK
        if (index < 2) { // Tradier and TwelveData
          expect(result.source).toBe('FALLBACK');
          expect(result._error).toBeDefined();
        }
      });
    });
  });
});