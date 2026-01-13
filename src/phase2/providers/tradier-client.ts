/**
 * Phase 2 Decision Engine - Tradier API Client
 * 
 * Client for fetching options market data from Tradier API.
 * Provides put/call ratio, IV percentile, and gamma bias data.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { TradierOptionsData, ProviderResult, GammaBias } from '../types';
import { PROVIDER_CONFIG } from '../config/index';
import { Logger } from '../services/logger';

export interface TradierQuoteResponse {
  quotes: {
    quote: {
      symbol: string;
      last: number;
      bid: number;
      ask: number;
      volume: number;
      open_interest?: number;
    }[];
  };
}

export interface TradierOptionsChainResponse {
  options: {
    option: Array<{
      symbol: string;
      type: 'call' | 'put';
      strike: number;
      bid: number;
      ask: number;
      volume: number;
      open_interest: number;
      implied_volatility: number;
    }>;
  };
}

export class TradierClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(apiKey: string, baseUrl?: string);
  constructor(logger: Logger); // Test constructor
  constructor(apiKeyOrLogger: string | Logger, baseUrl: string = 'https://api.tradier.com') {
    this.logger = apiKeyOrLogger instanceof Logger ? apiKeyOrLogger : new Logger('TradierClient');
    
    const apiKey = typeof apiKeyOrLogger === 'string' ? apiKeyOrLogger : 'test-api-key';
    
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: PROVIDER_CONFIG.tradier.timeout,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('Tradier API request', {
          url: config.url,
          method: config.method,
          params: config.params
        });
        return config;
      },
      (error) => {
        this.logger.error('Tradier API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('Tradier API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('Tradier API response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch options data for a symbol
   */
  async getOptionsData(symbol: string): Promise<ProviderResult<TradierOptionsData>> {
    const startTime = Date.now();
    
    try {
      // Get options chain for the symbol
      const optionsResponse = await this.getOptionsChain(symbol);
      
      if (!optionsResponse.data.options?.option) {
        throw new Error('No options data available');
      }

      const options = optionsResponse.data.options.option;
      
      // Calculate put/call ratio
      const putCallRatio = this.calculatePutCallRatio(options);
      
      // Calculate IV percentile (simplified - using current IV vs historical range)
      const ivPercentile = this.calculateIVPercentile(options);
      
      // Determine gamma bias based on put/call ratio and volume
      const gammaBias = this.determineGammaBias(options, putCallRatio);

      const result: TradierOptionsData = {
        putCallRatio,
        ivPercentile,
        gammaBias
      };

      const duration = Date.now() - startTime;
      this.logger.info('Tradier options data fetched successfully', {
        symbol,
        duration,
        putCallRatio,
        ivPercentile,
        gammaBias
      });

      return {
        data: result,
        source: 'API'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Failed to fetch Tradier options data', {
        symbol,
        duration,
        error: errorMessage
      });

      // Return fallback data
      return {
        data: PROVIDER_CONFIG.tradier.fallback,
        source: 'FALLBACK',
        error: errorMessage
      };
    }
  }

  /**
   * Get options chain for a symbol
   */
  private async getOptionsChain(symbol: string): Promise<AxiosResponse<TradierOptionsChainResponse>> {
    const params = {
      symbol,
      expiration: this.getNextFridayExpiration(), // Get weekly options
      greeks: 'true'
    };

    return await this.client.get('/v1/markets/options/chains', { params });
  }

  /**
   * Calculate put/call ratio from options data
   */
  private calculatePutCallRatio(options: TradierOptionsChainResponse['options']['option']): number {
    let putVolume = 0;
    let callVolume = 0;

    for (const option of options) {
      if (option.type === 'put') {
        putVolume += option.volume || 0;
      } else if (option.type === 'call') {
        callVolume += option.volume || 0;
      }
    }

    // Avoid division by zero
    if (callVolume === 0) {
      return putVolume > 0 ? 2.0 : 1.0; // High ratio if puts but no calls
    }

    return putVolume / callVolume;
  }

  /**
   * Calculate IV percentile (simplified implementation)
   */
  private calculateIVPercentile(options: TradierOptionsChainResponse['options']['option']): number {
    if (options.length === 0) return 50; // Default to middle

    // Calculate average IV for ATM options
    const atmOptions = options.filter(opt => 
      Math.abs(opt.strike - this.getATMStrike(options)) < 5
    );

    if (atmOptions.length === 0) return 50;

    const avgIV = atmOptions.reduce((sum, opt) => sum + (opt.implied_volatility || 0), 0) / atmOptions.length;
    
    // Simplified percentile calculation (in real implementation, would compare to historical data)
    // For now, map IV to percentile based on typical ranges
    if (avgIV < 0.15) return 10;      // Low IV
    if (avgIV < 0.25) return 30;      // Below average
    if (avgIV < 0.35) return 50;      // Average
    if (avgIV < 0.50) return 70;      // Above average
    return 90;                        // High IV
  }

  /**
   * Determine gamma bias based on options flow
   */
  private determineGammaBias(
    options: TradierOptionsChainResponse['options']['option'], 
    putCallRatio: number
  ): GammaBias {
    // Calculate total gamma exposure (simplified)
    let callGamma = 0;
    let putGamma = 0;

    for (const option of options) {
      const gamma = this.estimateGamma(option);
      const openInterest = option.open_interest || 0;
      
      if (option.type === 'call') {
        callGamma += gamma * openInterest;
      } else {
        putGamma += gamma * openInterest;
      }
    }

    const netGamma = callGamma - putGamma;
    
    // Determine bias based on net gamma and put/call ratio
    if (Math.abs(netGamma) < 1000) {
      return 'NEUTRAL';
    }
    
    if (netGamma > 0 && putCallRatio < 0.8) {
      return 'POSITIVE'; // Call heavy, positive gamma
    }
    
    if (netGamma < 0 && putCallRatio > 1.2) {
      return 'NEGATIVE'; // Put heavy, negative gamma
    }
    
    return 'NEUTRAL';
  }

  /**
   * Get ATM strike price from options
   */
  private getATMStrike(options: TradierOptionsChainResponse['options']['option']): number {
    if (options.length === 0) return 0;
    
    // Find the middle strike (simplified ATM detection)
    const strikes = options.map(opt => opt.strike).sort((a, b) => a - b);
    return strikes[Math.floor(strikes.length / 2)];
  }

  /**
   * Estimate gamma for an option (simplified Black-Scholes approximation)
   */
  private estimateGamma(option: any): number {
    // Simplified gamma estimation
    // In production, would use proper Black-Scholes calculation
    const iv = option.implied_volatility || 0.25;
    const timeToExpiry = 7 / 365; // Assume weekly options
    
    return iv * Math.sqrt(timeToExpiry) * 0.01; // Simplified formula
  }

  /**
   * Get next Friday expiration date in YYYY-MM-DD format
   */
  private getNextFridayExpiration(): string {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 7 - dayOfWeek + 5;
    
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    
    return nextFriday.toISOString().split('T')[0];
  }

  /**
   * Test connection to Tradier API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/user/profile');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Tradier connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}