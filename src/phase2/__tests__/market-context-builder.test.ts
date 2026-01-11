/**
 * Phase 2 Decision Engine - Market Context Builder Tests
 * 
 * Comprehensive tests for market context building including property-based testing
 * for parallel execution and fallback handling scenarios.
 */

import { MarketContextBuilder } from '../services/market-context-builder';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { Logger } from '../services/logger';
import { PerformanceMonitor } from '../services/performance-monitor';
import { PROVIDER_CONFIG } from '../config';
import * as fc from 'fast-check';

// Mock the provider clients and services
jest.mock('../providers/tradier-client');
jest.mock('../providers/twelvedata-client');
jest.mock('../providers/alpaca-client');
jest.mock('../services/logger');
jest.mock('../services/performance-monitor');

const MockedTradierClient = jest.mocked(TradierClient);
const MockedTwelveDataClient = jest.mocked(TwelveDataClient);
const MockedAlpacaClient = jest.mocked(AlpacaClient);
const MockedLogger = jest.mocked(Logger);
const MockedPerformanceMonitor = jest.mocked(PerformanceMonitor);

describe('MarketContextBuilder', () => {
  let builder: MarketContextBuilder;
  let mockTradierClient: jest.Mocked<TradierClient>;
  let mockTwelveDataClient: jest.Mocked<TwelveDataClient>;
  let mockAlpacaClient: jest.Mocked<AlpacaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock Logger
    MockedLogger.mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any));

    // Mock PerformanceMonitor
    MockedPerformanceMonitor.mockImplementation(() => ({
      recordRequest: jest.fn(),
      recordProviderSuccess: jest.fn(),
      recordProviderFailure: jest.fn(),
      getHealthSummary: jest.fn().mockReturnValue({
        healthy: true,
        metrics: {},
        issues: []
      })
    } as any));

    // Create fresh mock instances for each test
    mockTradierClient = {
      getOptionsData: jest.fn(),
      testConnection: jest.fn()
    } as any;

    mockTwelveDataClient = {
      getMarketStats: jest.fn(),
      testConnection: jest.fn()
    } as any;

    mockAlpacaClient = {
      getLiquidityData: jest.fn(),
      testConnection: jest.fn()
    } as any;

    // Mock constructors to return our mocked instances
    MockedTradierClient.mockImplementation(() => mockTradierClient);
    MockedTwelveDataClient.mockImplementation(() => mockTwelveDataClient);
    MockedAlpacaClient.mockImplementation(() => mockAlpacaClient);

    // Create a fresh builder instance for each test
    builder = new MarketContextBuilder(
      'test-tradier-key',
      'test-twelvedata-key',
      'test-alpaca-key',
      'test-alpaca-secret'
    );
  });

  describe('Successful Market Context Building', () => {
    it('should build complete market context when all providers succeed', async () => {
      // Mock successful responses from all providers
      mockTradierClient.getOptionsData.mockResolvedValue({
        data: {
          putCallRatio: 1.2,
          ivPercentile: 75,
          gammaBias: 'POSITIVE'
        },
        source: 'API'
      });

      mockTwelveDataClient.getMarketStats.mockResolvedValue({
        data: {
          atr: { value: 2.5, period: 14 },
          realizedVolatility: { value: 0.25, period: 20 },
          trendSlope: 0.15
        },
        source: 'API'
      });

      mockAlpacaClient.getLiquidityData.mockResolvedValue({
        data: {
          spread: { bps: 8 },
          depth: { score: 85 },
          velocity: 'NORMAL'
        },
        source: 'API'
      });

      const result = await builder.buildMarketContext('SPY');

      expect(result.context).toEqual({
        optionsData: {
          putCallRatio: 1.2,
          ivPercentile: 75,
          gammaBias: 'POSITIVE',
          dataSource: 'API'
        },
        marketStats: {
          atr14: 2.5,
          rv20: 0.25,
          trendSlope: 0.15,
          dataSource: 'API'
        },
        liquidityData: {
          spreadBps: 8,
          depthScore: 85,
          tradeVelocity: 'NORMAL',
          dataSource: 'API'
        }
      });

      expect(result.providerResults.tradier.success).toBe(true);
      expect(result.providerResults.twelveData.success).toBe(true);
      expect(result.providerResults.alpaca.success).toBe(true);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should enrich DecisionContext with market data', async () => {
      // Mock successful responses
      mockTradierClient.getOptionsData.mockResolvedValue({
        data: PROVIDER_CONFIG.tradier.fallback,
        source: 'API'
      });

      mockTwelveDataClient.getMarketStats.mockResolvedValue({
        data: {
          atr: { value: PROVIDER_CONFIG.twelveData.fallback.atr14, period: 14 },
          realizedVolatility: { value: PROVIDER_CONFIG.twelveData.fallback.rv20, period: 20 },
          trendSlope: PROVIDER_CONFIG.twelveData.fallback.trendSlope
        },
        source: 'API'
      });

      mockAlpacaClient.getLiquidityData.mockResolvedValue({
        data: PROVIDER_CONFIG.alpaca.fallback,
        source: 'API'
      });

      const originalContext = {
        indicator: {
          signalType: 'LONG' as const,
          aiScore: 8.5,
          satyPhase: 75,
          marketSession: 'OPEN' as const,
          symbol: 'SPY',
          timestamp: Date.now()
        }
      };

      const enrichedContext = await builder.enrichDecisionContext(originalContext);

      expect(enrichedContext.market).toBeDefined();
      expect(enrichedContext.market?.optionsData).toBeDefined();
      expect(enrichedContext.market?.marketStats).toBeDefined();
      expect(enrichedContext.market?.liquidityData).toBeDefined();
      expect(enrichedContext.indicator).toEqual(originalContext.indicator);
    });
  });

  describe('Individual Provider Failure Scenarios', () => {
    it('should handle Tradier failure with fallback', async () => {
      mockTradierClient.getOptionsData.mockRejectedValue(new Error('Tradier API error'));
      
      mockTwelveDataClient.getMarketStats.mockResolvedValue({
        data: {
          atr: { value: 2.5, period: 14 },
          realizedVolatility: { value: 0.25, period: 20 },
          trendSlope: 0.15
        },
        source: 'API'
      });

      mockAlpacaClient.getLiquidityData.mockResolvedValue({
        data: {
          spread: { bps: 8 },
          depth: { score: 85 },
          velocity: 'NORMAL'
        },
        source: 'API'
      });

      const result = await builder.buildMarketContext('SPY');

      expect(result.providerResults.tradier.success).toBe(false);
      expect(result.providerResults.twelveData.success).toBe(true);
      expect(result.providerResults.alpaca.success).toBe(true);

      // Should use fallback for Tradier data
      expect(result.context.optionsData.dataSource).toBe('FALLBACK');
      expect(result.context.optionsData.putCallRatio).toBe(PROVIDER_CONFIG.tradier.fallback.putCallRatio);
      
      // Should use API data for others
      expect(result.context.marketStats.dataSource).toBe('API');
      expect(result.context.liquidityData.dataSource).toBe('API');
    });

    it('should handle TwelveData failure with fallback', async () => {
      mockTradierClient.getOptionsData.mockResolvedValue({
        data: {
          putCallRatio: 1.2,
          ivPercentile: 75,
          gammaBias: 'POSITIVE'
        },
        source: 'API'
      });

      mockTwelveDataClient.getMarketStats.mockRejectedValue(new Error('TwelveData API error'));

      mockAlpacaClient.getLiquidityData.mockResolvedValue({
        data: {
          spread: { bps: 8 },
          depth: { score: 85 },
          velocity: 'NORMAL'
        },
        source: 'API'
      });

      const result = await builder.buildMarketContext('SPY');

      expect(result.providerResults.tradier.success).toBe(true);
      expect(result.providerResults.twelveData.success).toBe(false);
      expect(result.providerResults.alpaca.success).toBe(true);

      // Should use fallback for TwelveData
      expect(result.context.marketStats.dataSource).toBe('FALLBACK');
      expect(result.context.marketStats.atr14).toBe(PROVIDER_CONFIG.twelveData.fallback.atr14);
      
      // Should use API data for others
      expect(result.context.optionsData.dataSource).toBe('API');
      expect(result.context.liquidityData.dataSource).toBe('API');
    });

    it('should handle Alpaca failure with fallback', async () => {
      mockTradierClient.getOptionsData.mockResolvedValue({
        data: {
          putCallRatio: 1.2,
          ivPercentile: 75,
          gammaBias: 'POSITIVE'
        },
        source: 'API'
      });

      mockTwelveDataClient.getMarketStats.mockResolvedValue({
        data: {
          atr: { value: 2.5, period: 14 },
          realizedVolatility: { value: 0.25, period: 20 },
          trendSlope: 0.15
        },
        source: 'API'
      });

      mockAlpacaClient.getLiquidityData.mockRejectedValue(new Error('Alpaca API error'));

      const result = await builder.buildMarketContext('SPY');

      expect(result.providerResults.tradier.success).toBe(true);
      expect(result.providerResults.twelveData.success).toBe(true);
      expect(result.providerResults.alpaca.success).toBe(false);

      // Should use fallback for Alpaca
      expect(result.context.liquidityData.dataSource).toBe('FALLBACK');
      expect(result.context.liquidityData.spreadBps).toBe(PROVIDER_CONFIG.alpaca.fallback.spreadBps);
      
      // Should use API data for others
      expect(result.context.optionsData.dataSource).toBe('API');
      expect(result.context.marketStats.dataSource).toBe('API');
    });
  });

  describe('Partial Success Scenarios', () => {
    it('should handle mixed success/failure scenarios', async () => {
      mockTradierClient.getOptionsData.mockResolvedValue({
        data: {
          putCallRatio: 1.2,
          ivPercentile: 75,
          gammaBias: 'POSITIVE'
        },
        source: 'API'
      });

      mockTwelveDataClient.getMarketStats.mockRejectedValue(new Error('TwelveData timeout'));
      mockAlpacaClient.getLiquidityData.mockRejectedValue(new Error('Alpaca error'));

      const result = await builder.buildMarketContext('SPY');

      expect(result.providerResults.tradier.success).toBe(true);
      expect(result.providerResults.twelveData.success).toBe(false);
      expect(result.providerResults.alpaca.success).toBe(false);

      // Should have mixed data sources
      expect(result.context.optionsData.dataSource).toBe('API');
      expect(result.context.marketStats.dataSource).toBe('FALLBACK');
      expect(result.context.liquidityData.dataSource).toBe('FALLBACK');
    });
  });

  describe('Complete Failure Scenarios', () => {
    it('should handle all providers failing', async () => {
      mockTradierClient.getOptionsData.mockRejectedValue(new Error('Tradier error'));
      mockTwelveDataClient.getMarketStats.mockRejectedValue(new Error('TwelveData error'));
      mockAlpacaClient.getLiquidityData.mockRejectedValue(new Error('Alpaca error'));

      const result = await builder.buildMarketContext('SPY');

      expect(result.providerResults.tradier.success).toBe(false);
      expect(result.providerResults.twelveData.success).toBe(false);
      expect(result.providerResults.alpaca.success).toBe(false);

      // Should use fallback for all data
      expect(result.context.optionsData.dataSource).toBe('FALLBACK');
      expect(result.context.marketStats.dataSource).toBe('FALLBACK');
      expect(result.context.liquidityData.dataSource).toBe('FALLBACK');

      // Should match fallback configuration
      expect(result.context.options.putCallRatio).toBe(PROVIDER_CONFIG.tradier.fallback.putCallRatio);
      expect(result.context.stats.atr14).toBe(PROVIDER_CONFIG.twelveData.fallback.atr14);
      expect(result.context.liquidity.spreadBps).toBe(PROVIDER_CONFIG.alpaca.fallback.spreadBps);
    });
  });

  describe('Connectivity Testing', () => {
    it('should test connectivity to all providers', async () => {
      mockTradierClient.testConnection.mockResolvedValue(true);
      mockTwelveDataClient.testConnection.mockResolvedValue(true);
      mockAlpacaClient.testConnection.mockResolvedValue(true);

      const result = await builder.testConnectivity();

      expect(result.tradier).toBe(true);
      expect(result.twelveData).toBe(true);
      expect(result.alpaca).toBe(true);
      expect(result.overall).toBe(true);
    });

    it('should handle partial connectivity failures', async () => {
      mockTradierClient.testConnection.mockResolvedValue(true);
      mockTwelveDataClient.testConnection.mockResolvedValue(false);
      mockAlpacaClient.testConnection.mockRejectedValue(new Error('Connection failed'));

      const result = await builder.testConnectivity();

      expect(result.tradier).toBe(true);
      expect(result.twelveData).toBe(false);
      expect(result.alpaca).toBe(false);
      expect(result.overall).toBe(false);
    });
  });

  describe('Property Tests - Parallel Provider Execution', () => {
    /**
     * Property 2: Parallel Provider Execution
     * Validates: Requirements 3.1, 12.3
     * 
     * This property ensures that the market context builder always returns
     * a valid market context regardless of which providers succeed or fail.
     */
    it('Property 2: Market context is always complete regardless of provider failures', async () => {
      await fc.assert(fc.asyncProperty(
        fc.constantFrom('SPY', 'QQQ', 'IWM', 'AAPL'),
        fc.boolean(), // Tradier success
        fc.boolean(), // TwelveData success
        fc.boolean(), // Alpaca success
        async (symbol, tradierSuccess, twelveDataSuccess, alpacaSuccess) => {
          // Reset mocks for each property test run
          jest.clearAllMocks();
          
          // Setup mocks based on success flags
          if (tradierSuccess) {
            mockTradierClient.getOptionsData.mockResolvedValue({
              data: {
                putCallRatio: 1.0 + Math.random(),
                ivPercentile: Math.floor(Math.random() * 100),
                gammaBias: fc.sample(fc.constantFrom('POSITIVE', 'NEGATIVE', 'NEUTRAL'), 1)[0]
              },
              source: 'API'
            });
          } else {
            mockTradierClient.getOptionsData.mockRejectedValue(new Error('Tradier failed'));
          }

          if (twelveDataSuccess) {
            mockTwelveDataClient.getMarketStats.mockResolvedValue({
              data: {
                atr: { value: Math.random() * 5, period: 14 },
                realizedVolatility: { value: Math.random() * 0.5, period: 20 },
                trendSlope: (Math.random() - 0.5) * 2
              },
              source: 'API'
            });
          } else {
            mockTwelveDataClient.getMarketStats.mockRejectedValue(new Error('TwelveData failed'));
          }

          if (alpacaSuccess) {
            mockAlpacaClient.getLiquidityData.mockResolvedValue({
              data: {
                spreadBps: Math.random() * 20,
                depthScore: Math.floor(Math.random() * 100),
                tradeVelocity: fc.sample(fc.constantFrom('SLOW', 'NORMAL', 'FAST'), 1)[0]
              },
              source: 'API'
            });
          } else {
            mockAlpacaClient.getLiquidityData.mockRejectedValue(new Error('Alpaca failed'));
          }

          const result = await builder.buildMarketContext(symbol);

          // Property: Always returns complete market context
          expect(result.context).toBeDefined();
          expect(result.context.optionsData).toBeDefined();
          expect(result.context.marketStats).toBeDefined();
          expect(result.context.liquidityData).toBeDefined();

          // Property: Data sources are correctly marked
          expect(['API', 'FALLBACK']).toContain(result.context.options.dataSource);
          expect(['API', 'FALLBACK']).toContain(result.context.stats.dataSource);
          expect(['API', 'FALLBACK']).toContain(result.context.liquidity.dataSource);

          // Property: Provider results match expectations
          expect(result.providerResults.tradier.success).toBe(tradierSuccess);
          expect(result.providerResults.twelveData.success).toBe(twelveDataSuccess);
          expect(result.providerResults.alpaca.success).toBe(alpacaSuccess);

          // Property: Fallback data is used when providers fail
          if (!tradierSuccess) {
            expect(result.context.options.dataSource).toBe('FALLBACK');
          }
          if (!twelveDataSuccess) {
            expect(result.context.stats.dataSource).toBe('FALLBACK');
          }
          if (!alpacaSuccess) {
            expect(result.context.liquidity.dataSource).toBe('FALLBACK');
          }

          // Property: All numeric values are valid
          expect(typeof result.context.options.putCallRatio).toBe('number');
          expect(typeof result.context.options.ivPercentile).toBe('number');
          expect(typeof result.context.stats.atr14).toBe('number');
          expect(typeof result.context.stats.rv20).toBe('number');
          expect(typeof result.context.stats.trendSlope).toBe('number');
          expect(typeof result.context.liquidity.spreadBps).toBe('number');
          expect(typeof result.context.liquidity.depthScore).toBe('number');

          // Property: Execution time is reasonable
          expect(result.totalDuration).toBeGreaterThanOrEqual(0);
          expect(result.totalDuration).toBeLessThan(5000); // Should complete within 5 seconds
        }
      ), { numRuns: 20 });
    });

    it('Property 2: Parallel execution is faster than sequential', async () => {
      // Setup successful responses with artificial delays
      mockTradierClient.getOptionsData.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          data: PROVIDER_CONFIG.tradier.fallback,
          source: 'API'
        }), 100))
      );

      mockTwelveDataClient.getMarketStats.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          data: {
            atr: { value: PROVIDER_CONFIG.twelveData.fallback.atr14, period: 14 },
            realizedVolatility: { value: PROVIDER_CONFIG.twelveData.fallback.rv20, period: 20 },
            trendSlope: PROVIDER_CONFIG.twelveData.fallback.trendSlope
          },
          source: 'API'
        }), 100))
      );

      mockAlpacaClient.getLiquidityData.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          data: PROVIDER_CONFIG.alpaca.fallback,
          source: 'API'
        }), 100))
      );

      const result = await builder.buildMarketContext('SPY');

      // Property: Parallel execution should complete in roughly the time of the slowest provider
      // rather than the sum of all provider times (300ms vs ~100ms)
      expect(result.totalDuration).toBeLessThan(200); // Allow some overhead
      expect(result.providerResults.tradier.success).toBe(true);
      expect(result.providerResults.twelveData.success).toBe(true);
      expect(result.providerResults.alpaca.success).toBe(true);
    });
  });
});