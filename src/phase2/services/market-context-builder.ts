/**
 * Phase 2 Decision Engine - Market Context Builder
 * 
 * Orchestrates parallel calls to all external providers to build complete market context.
 * Implements graceful degradation when providers fail and ensures deterministic fallback behavior.
 */

import { DecisionContext, DataSource, MarketContext } from '../types';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { PROVIDER_CONFIG } from '../config/index';
import { Logger } from './logger';
import { PerformanceMonitor } from './performance-monitor';

export interface MarketContextResult {
  context: MarketContext;
  providerResults: {
    tradier: {
      success: boolean;
      source: DataSource;
      error?: string;
      duration: number;
    };
    twelveData: {
      success: boolean;
      source: DataSource;
      error?: string;
      duration: number;
    };
    alpaca: {
      success: boolean;
      source: DataSource;
      error?: string;
      duration: number;
    };
  };
  totalDuration: number;
}

export class MarketContextBuilder {
  private tradierClient: TradierClient;
  private twelveDataClient: TwelveDataClient;
  private alpacaClient: AlpacaClient;
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    logger: Logger,
    tradierClient: TradierClient,
    twelveDataClient: TwelveDataClient,
    alpacaClient: AlpacaClient,
    performanceMonitor?: PerformanceMonitor
  );
  constructor(
    tradierApiKey: string,
    twelveDataApiKey: string,
    alpacaApiKey: string,
    alpacaSecretKey: string,
    performanceMonitor?: PerformanceMonitor
  );
  constructor(
    loggerOrTradierApiKey: Logger | string,
    tradierClientOrTwelveDataApiKey?: TradierClient | string,
    twelveDataClientOrAlpacaApiKey?: TwelveDataClient | string,
    alpacaClientOrAlpacaSecretKey?: AlpacaClient | string,
    performanceMonitor?: PerformanceMonitor
  ) {
    this.logger = loggerOrTradierApiKey instanceof Logger 
      ? loggerOrTradierApiKey 
      : new Logger('MarketContextBuilder');
    
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor(this.logger);

    // Check if we're using the provider clients constructor (first overload)
    if (loggerOrTradierApiKey instanceof Logger && 
        tradierClientOrTwelveDataApiKey instanceof TradierClient &&
        twelveDataClientOrAlpacaApiKey instanceof TwelveDataClient &&
        alpacaClientOrAlpacaSecretKey instanceof AlpacaClient) {
      
      // Use provided clients
      this.tradierClient = tradierClientOrTwelveDataApiKey;
      this.twelveDataClient = twelveDataClientOrAlpacaApiKey;
      this.alpacaClient = alpacaClientOrAlpacaSecretKey;
      
      this.logger.info('MarketContextBuilder initialized with provided clients', {
        providers: ['Tradier', 'TwelveData', 'Alpaca']
      });
    } else {
      // Use API keys constructor (second overload)
      const tradierApiKey = loggerOrTradierApiKey as string;
      const twelveDataApiKey = tradierClientOrTwelveDataApiKey as string;
      const alpacaApiKey = twelveDataClientOrAlpacaApiKey as string;
      const alpacaSecretKey = alpacaClientOrAlpacaSecretKey as string;

      // Initialize provider clients
      this.tradierClient = new TradierClient(this.logger);
      this.twelveDataClient = new TwelveDataClient(this.logger);
      this.alpacaClient = new AlpacaClient(this.logger);

      this.logger.info('MarketContextBuilder initialized with API keys', {
        providers: ['Tradier', 'TwelveData', 'Alpaca']
      });
    }
  }

  /**
   * Build complete market context for a symbol using parallel provider calls
   */
  async buildMarketContext(symbol: string): Promise<MarketContextResult> {
    const startTime = Date.now();
    
    this.logger.info('Building market context', { symbol });

    try {
      // Execute all provider calls in parallel using Promise.allSettled
      // This ensures that failure of one provider doesn't block others
      const [tradierResult, twelveDataResult, alpacaResult] = await Promise.allSettled([
        this.fetchTradierData(symbol),
        this.fetchTwelveDataData(symbol),
        this.fetchAlpacaData(symbol)
      ]);

      // Process results and build market context
      const marketContext = this.assembleMarketContext(
        tradierResult,
        twelveDataResult,
        alpacaResult
      );

      // Calculate provider performance metrics
      const providerResults = this.calculateProviderResults(
        tradierResult,
        twelveDataResult,
        alpacaResult
      );

      const totalDuration = Date.now() - startTime;

      // Record performance metrics
      this.performanceMonitor.recordRequest(totalDuration, true);
      this.recordProviderPerformance(providerResults);

      this.logger.info('Market context built successfully', {
        symbol,
        totalDuration,
        tradierSource: providerResults.tradier.source,
        twelveDataSource: providerResults.twelveData.source,
        alpacaSource: providerResults.alpaca.source
      });

      return {
        context: marketContext,
        providerResults,
        totalDuration
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to build market context', {
        symbol,
        totalDuration,
        error: errorMessage
      });

      // Record failed request
      this.performanceMonitor.recordRequest(totalDuration, false);

      // Return fallback market context
      return {
        context: this.createFallbackMarketContext(),
        providerResults: {
          tradier: { success: false, source: 'FALLBACK', error: errorMessage, duration: totalDuration },
          twelveData: { success: false, source: 'FALLBACK', error: errorMessage, duration: totalDuration },
          alpaca: { success: false, source: 'FALLBACK', error: errorMessage, duration: totalDuration }
        },
        totalDuration
      };
    }
  }

  /**
   * Fetch data from Tradier with timing
   */
  private async fetchTradierData(symbol: string) {
    const startTime = Date.now();
    const result = await this.tradierClient.getOptionsData(symbol);
    const duration = Date.now() - startTime;
    return { ...result, duration };
  }

  /**
   * Fetch data from TwelveData with timing
   */
  private async fetchTwelveDataData(symbol: string) {
    const startTime = Date.now();
    const result = await this.twelveDataClient.getMarketStats(symbol);
    const duration = Date.now() - startTime;
    return { ...result, duration };
  }

  /**
   * Fetch data from Alpaca with timing
   */
  private async fetchAlpacaData(symbol: string) {
    const startTime = Date.now();
    const result = await this.alpacaClient.getLiquidityData(symbol);
    const duration = Date.now() - startTime;
    return { ...result, duration };
  }

  /**
   * Assemble market context from provider results
   */
  private assembleMarketContext(
    tradierResult: PromiseSettledResult<any>,
    twelveDataResult: PromiseSettledResult<any>,
    alpacaResult: PromiseSettledResult<any>
  ): MarketContext {
    // Extract Tradier options data
    const optionsData = tradierResult.status === 'fulfilled' 
      ? tradierResult.value.data 
      : PROVIDER_CONFIG.tradier.fallback;
    
    const optionsSource = tradierResult.status === 'fulfilled' 
      ? tradierResult.value.source 
      : 'FALLBACK';

    // Extract TwelveData stats
    const statsData = twelveDataResult.status === 'fulfilled' 
      ? twelveDataResult.value.data 
      : {
          atr: { value: PROVIDER_CONFIG.twelveData.fallback.atr14, period: 14 },
          realizedVolatility: { value: PROVIDER_CONFIG.twelveData.fallback.rv20, period: 20 },
          trendSlope: PROVIDER_CONFIG.twelveData.fallback.trendSlope
        };
    
    const statsSource = twelveDataResult.status === 'fulfilled' 
      ? twelveDataResult.value.source 
      : 'FALLBACK';

    // Extract Alpaca liquidity data
    const liquidityData = alpacaResult.status === 'fulfilled' 
      ? alpacaResult.value.data 
      : PROVIDER_CONFIG.alpaca.fallback;
    
    const liquiditySource = alpacaResult.status === 'fulfilled' 
      ? alpacaResult.value.source 
      : 'FALLBACK';

    return {
      optionsData: {
        putCallRatio: optionsData.putCallRatio,
        ivPercentile: optionsData.ivPercentile,
        gammaBias: optionsData.gammaBias,
        dataSource: optionsSource
      },
      marketStats: {
        atr14: statsData.atr.value,
        rv20: statsData.realizedVolatility.value,
        trendSlope: statsData.trendSlope,
        dataSource: statsSource
      },
      liquidityData: {
        spreadBps: liquidityData.spreadBps || liquidityData.spread?.bps,
        depthScore: liquidityData.depthScore || liquidityData.depth?.score,
        tradeVelocity: liquidityData.tradeVelocity || liquidityData.velocity,
        dataSource: liquiditySource
      }
    };
  }

  /**
   * Calculate provider performance results
   */
  private calculateProviderResults(
    tradierResult: PromiseSettledResult<any>,
    twelveDataResult: PromiseSettledResult<any>,
    alpacaResult: PromiseSettledResult<any>
  ) {
    return {
      tradier: {
        success: tradierResult.status === 'fulfilled',
        source: tradierResult.status === 'fulfilled' ? tradierResult.value.source : 'FALLBACK' as DataSource,
        error: tradierResult.status === 'rejected' ? String(tradierResult.reason) : undefined,
        duration: tradierResult.status === 'fulfilled' ? (tradierResult.value.duration || 0) : 0
      },
      twelveData: {
        success: twelveDataResult.status === 'fulfilled',
        source: twelveDataResult.status === 'fulfilled' ? twelveDataResult.value.source : 'FALLBACK' as DataSource,
        error: twelveDataResult.status === 'rejected' ? String(twelveDataResult.reason) : undefined,
        duration: twelveDataResult.status === 'fulfilled' ? (twelveDataResult.value.duration || 0) : 0
      },
      alpaca: {
        success: alpacaResult.status === 'fulfilled',
        source: alpacaResult.status === 'fulfilled' ? alpacaResult.value.source : 'FALLBACK' as DataSource,
        error: alpacaResult.status === 'rejected' ? String(alpacaResult.reason) : undefined,
        duration: alpacaResult.status === 'fulfilled' ? (alpacaResult.value.duration || 0) : 0
      }
    };
  }

  /**
   * Record provider performance metrics
   */
  private recordProviderPerformance(providerResults: MarketContextResult['providerResults']) {
    // Record individual provider performance
    Object.entries(providerResults).forEach(([providerName, result]) => {
      if (result.success) {
        this.performanceMonitor.recordProviderSuccess(providerName as 'tradier' | 'twelveData' | 'alpaca');
      } else {
        this.performanceMonitor.recordProviderFailure(providerName as 'tradier' | 'twelveData' | 'alpaca');
      }
    });
  }

  /**
   * Create fallback market context when all providers fail
   */
  private createFallbackMarketContext(): MarketContext {
    return {
      optionsData: {
        putCallRatio: PROVIDER_CONFIG.tradier.fallback.putCallRatio,
        ivPercentile: PROVIDER_CONFIG.tradier.fallback.ivPercentile,
        gammaBias: PROVIDER_CONFIG.tradier.fallback.gammaBias,
        dataSource: 'FALLBACK'
      },
      marketStats: {
        atr14: PROVIDER_CONFIG.twelveData.fallback.atr14,
        rv20: PROVIDER_CONFIG.twelveData.fallback.rv20,
        trendSlope: PROVIDER_CONFIG.twelveData.fallback.trendSlope,
        dataSource: 'FALLBACK'
      },
      liquidityData: {
        spreadBps: PROVIDER_CONFIG.alpaca.fallback.spreadBps,
        depthScore: PROVIDER_CONFIG.alpaca.fallback.depthScore,
        tradeVelocity: PROVIDER_CONFIG.alpaca.fallback.tradeVelocity,
        dataSource: 'FALLBACK'
      }
    };
  }

  /**
   * Enrich DecisionContext with market data
   */
  async enrichDecisionContext(context: DecisionContext): Promise<DecisionContext> {
    const marketResult = await this.buildMarketContext(context.indicator.symbol);
    
    return {
      ...context,
      market: marketResult.context
    };
  }

  /**
   * Test connectivity to all providers
   */
  async testConnectivity(): Promise<{
    tradier: boolean;
    twelveData: boolean;
    alpaca: boolean;
    overall: boolean;
  }> {
    const [tradierTest, twelveDataTest, alpacaTest] = await Promise.allSettled([
      this.tradierClient.testConnection(),
      this.twelveDataClient.testConnection(),
      this.alpacaClient.testConnection()
    ]);

    const results = {
      tradier: tradierTest.status === 'fulfilled' && tradierTest.value,
      twelveData: twelveDataTest.status === 'fulfilled' && twelveDataTest.value,
      alpaca: alpacaTest.status === 'fulfilled' && alpacaTest.value,
      overall: false
    };

    results.overall = results.tradier && results.twelveData && results.alpaca;

    this.logger.info('Provider connectivity test completed', results);

    return results;
  }

  /**
   * Get performance summary for all providers
   */
  getPerformanceSummary() {
    return this.performanceMonitor.getHealthSummary();
  }
}