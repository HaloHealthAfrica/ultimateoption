/**
 * Phase 2 Decision Engine - Health Service
 * 
 * Provides health monitoring capabilities including provider connectivity
 * testing and overall system health assessment.
 */

import { Logger } from './logger';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { MarketContextBuilder } from './market-context-builder';
import { PerformanceTracker } from './performance-tracker';
import { ENGINE_VERSION } from '../types';

export interface ProviderHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  engineVersion: string;
  providers: ProviderHealth[];
  performance: {
    healthy: boolean;
    issues: string[];
  };
  uptime: number;
}

export class HealthService {
  private logger: Logger;
  private tradierClient: TradierClient;
  private twelveDataClient: TwelveDataClient;
  private alpacaClient: AlpacaClient;
  private marketContextBuilder: MarketContextBuilder;
  private performanceTracker: PerformanceTracker;
  private startTime: number;

  constructor(
    logger: Logger,
    tradierClient: TradierClient,
    twelveDataClient: TwelveDataClient,
    alpacaClient: AlpacaClient,
    marketContextBuilder: MarketContextBuilder,
    performanceTracker: PerformanceTracker
  ) {
    this.logger = logger;
    this.tradierClient = tradierClient;
    this.twelveDataClient = twelveDataClient;
    this.alpacaClient = alpacaClient;
    this.marketContextBuilder = marketContextBuilder;
    this.performanceTracker = performanceTracker;
    this.startTime = Date.now();
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<SystemHealth> {
    const timestamp = new Date().toISOString();
    
    this.logger.info('Starting health check', {
      timestamp,
      engineVersion: ENGINE_VERSION
    });

    // Test provider connectivity in parallel
    const providerChecks = await Promise.allSettled([
      this.checkProviderHealth('tradier', () => this.tradierClient.testConnection()),
      this.checkProviderHealth('twelveData', () => this.twelveDataClient.testConnection()),
      this.checkProviderHealth('alpaca', () => this.alpacaClient.testConnection())
    ]);

    const providers: ProviderHealth[] = providerChecks.map((result, index) => {
      const providerNames = ['tradier', 'twelveData', 'alpaca'];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: providerNames[index],
          status: 'unhealthy' as const,
          error: result.reason?.message || 'Unknown error',
          lastChecked: timestamp
        };
      }
    });

    // Check performance health
    const performance = this.performanceTracker.isPerformanceHealthy();

    // Determine overall system status
    const unhealthyProviders = providers.filter(p => p.status === 'unhealthy');
    const degradedProviders = providers.filter(p => p.status === 'degraded');
    
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy';
    
    if (unhealthyProviders.length > 0 || !performance.healthy) {
      systemStatus = 'unhealthy';
    } else if (degradedProviders.length > 0) {
      systemStatus = 'degraded';
    } else {
      systemStatus = 'healthy';
    }

    const health: SystemHealth = {
      status: systemStatus,
      timestamp,
      engineVersion: ENGINE_VERSION,
      providers,
      performance,
      uptime: Date.now() - this.startTime
    };

    this.logger.info('Health check completed', {
      status: systemStatus,
      providerCount: providers.length,
      unhealthyProviders: unhealthyProviders.length,
      degradedProviders: degradedProviders.length,
      performanceHealthy: performance.healthy,
      uptime: health.uptime
    });

    return health;
  }

  /**
   * Check individual provider health
   */
  private async checkProviderHealth(
    name: string, 
    testFn: () => Promise<boolean>
  ): Promise<ProviderHealth> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const isHealthy = await testFn();
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (!isHealthy) {
        status = 'unhealthy';
      } else if (responseTime > 1000) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      this.logger.debug('Provider health check completed', {
        provider: name,
        status,
        responseTime,
        healthy: isHealthy
      });

      return {
        name,
        status,
        responseTime,
        lastChecked: timestamp
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.warn('Provider health check failed', {
        provider: name,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      });

      return {
        name,
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: timestamp
      };
    }
  }

  /**
   * Get quick health status (for load balancer checks)
   */
  async getQuickHealth(): Promise<{ status: 'healthy' | 'unhealthy'; timestamp: string }> {
    const performance = this.performanceTracker.isPerformanceHealthy();
    
    return {
      status: performance.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test connectivity to all providers using market context builder
   */
  async testProviderConnectivity(): Promise<boolean> {
    try {
      const connectivity = await this.marketContextBuilder.testConnectivity();
      return connectivity.tradier && connectivity.twelveData && connectivity.alpaca;
    } catch (error) {
      this.logger.error('Provider connectivity test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get system uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset uptime counter (for testing)
   */
  resetUptime(): void {
    this.startTime = Date.now();
  }
}