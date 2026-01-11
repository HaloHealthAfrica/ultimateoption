/**
 * Phase 2 Decision Engine - TwelveData API Client
 * 
 * Client for fetching market statistics from TwelveData API.
 * Provides ATR14, RV20, and trend slope data.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { TwelveDataStats, ProviderResult } from '../types';
import { PROVIDER_CONFIG } from '../config';
import { Logger } from '../services/logger';

export interface TwelveDataATRResponse {
  meta: {
    symbol: string;
    interval: string;
    time_period: number;
  };
  values: Array<{
    datetime: string;
    atr: string;
  }>;
  status: string;
}

export interface TwelveDataTimeSeriesResponse {
  meta: {
    symbol: string;
    interval: string;
  };
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
  status: string;
}

export class TwelveDataClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(apiKey: string, baseUrl?: string);
  constructor(logger: Logger); // Test constructor
  constructor(apiKeyOrLogger: string | Logger, baseUrl: string = 'https://api.twelvedata.com') {
    this.logger = apiKeyOrLogger instanceof Logger ? apiKeyOrLogger : new Logger('TwelveDataClient');
    
    const apiKey = typeof apiKeyOrLogger === 'string' ? apiKeyOrLogger : 'test-api-key';
    
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: PROVIDER_CONFIG.twelveData.timeout,
      params: {
        apikey: apiKey
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('TwelveData API request', {
          url: config.url,
          method: config.method,
          params: { ...config.params, apikey: '[MASKED]' }
        });
        return config;
      },
      (error) => {
        this.logger.error('TwelveData API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('TwelveData API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('TwelveData API response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch market statistics for a symbol
   */
  async getMarketStats(symbol: string): Promise<ProviderResult<TwelveDataStats>> {
    const startTime = Date.now();
    
    try {
      // Fetch data in parallel
      const [atrResponse, timeSeriesResponse] = await Promise.allSettled([
        this.getATR(symbol, 14),
        this.getTimeSeries(symbol, '1day', 30) // 30 days for RV20 calculation
      ]);

      let atr14 = 0;
      let rv20 = 0;
      let trendSlope = 0;
      let hasAnyData = false;

      // Process ATR data
      if (atrResponse.status === 'fulfilled' && atrResponse.value.data.values?.length > 0) {
        atr14 = parseFloat(atrResponse.value.data.values[0].atr);
        hasAnyData = true;
      } else {
        this.logger.warn('ATR data not available, using fallback', { symbol });
        atr14 = PROVIDER_CONFIG.twelveData.fallback.atr14;
      }

      // Process time series data for RV20 and trend slope
      if (timeSeriesResponse.status === 'fulfilled' && timeSeriesResponse.value.data.values?.length >= 20) {
        const prices = timeSeriesResponse.value.data.values
          .slice(0, 20)
          .map(v => parseFloat(v.close))
          .reverse(); // Reverse to get chronological order

        rv20 = this.calculateRealizedVolatility(prices, 20);
        trendSlope = this.calculateTrendSlope(prices);
        hasAnyData = true;
      } else {
        this.logger.warn('Time series data insufficient, using fallback', { symbol });
        rv20 = PROVIDER_CONFIG.twelveData.fallback.rv20;
        trendSlope = PROVIDER_CONFIG.twelveData.fallback.trendSlope;
      }

      // If no data was successfully fetched, treat as complete failure
      if (!hasAnyData) {
        throw new Error('No data available from any endpoint');
      }

      const result: TwelveDataStats = {
        atr: {
          value: atr14,
          period: 14
        },
        realizedVolatility: {
          value: rv20,
          period: 20
        },
        trendSlope
      };

      const duration = Date.now() - startTime;
      this.logger.info('TwelveData market stats fetched successfully', {
        symbol,
        duration,
        atr14,
        rv20,
        trendSlope
      });

      return {
        data: result,
        source: 'API'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Failed to fetch TwelveData market stats', {
        symbol,
        duration,
        error: errorMessage
      });

      // Return fallback data
      return {
        data: {
          atr: {
            value: PROVIDER_CONFIG.twelveData.fallback.atr14,
            period: 14
          },
          realizedVolatility: {
            value: PROVIDER_CONFIG.twelveData.fallback.rv20,
            period: 20
          },
          trendSlope: PROVIDER_CONFIG.twelveData.fallback.trendSlope
        },
        source: 'FALLBACK',
        error: errorMessage
      };
    }
  }

  /**
   * Get ATR (Average True Range) data
   */
  private async getATR(symbol: string, period: number): Promise<AxiosResponse<TwelveDataATRResponse>> {
    const params = {
      symbol,
      interval: '1day',
      time_period: period,
      outputsize: 1 // Only need the latest value
    };

    return await this.client.get('/atr', { params });
  }

  /**
   * Get time series data for calculations
   */
  private async getTimeSeries(symbol: string, interval: string, outputsize: number): Promise<AxiosResponse<TwelveDataTimeSeriesResponse>> {
    const params = {
      symbol,
      interval,
      outputsize
    };

    return await this.client.get('/time_series', { params });
  }

  /**
   * Calculate realized volatility over a period
   */
  private calculateRealizedVolatility(prices: number[], period: number): number {
    if (prices.length < period) {
      return 0;
    }

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length && i <= period; i++) {
      const dailyReturn = Math.log(prices[i] / prices[i - 1]);
      returns.push(dailyReturn);
    }

    if (returns.length === 0) return 0;

    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize the volatility (252 trading days)
    return stdDev * Math.sqrt(252);
  }

  /**
   * Calculate trend slope using linear regression
   */
  private calculateTrendSlope(prices: number[]): number {
    if (prices.length < 2) return 0;

    const n = prices.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = prices;

    // Calculate linear regression slope
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Normalize slope as percentage change per day
    const avgPrice = sumY / n;
    return (slope / avgPrice) * 100;
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / period;
  }

  /**
   * Test connection to TwelveData API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/time_series', {
        params: {
          symbol: 'SPY',
          interval: '1day',
          outputsize: 1
        }
      });
      return response.status === 200 && response.data.status === 'ok';
    } catch (error) {
      this.logger.error('TwelveData connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}