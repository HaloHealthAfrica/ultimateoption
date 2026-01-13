/**
 * Market Context Builder for Phase 2.5 Decision Engine
 * 
 * Fetches real-time market intelligence from multiple data providers
 * in parallel with timeout protection and fallback handling.
 */

import axios, { AxiosInstance } from 'axios';
import { IMarketContextBuilder, FeedConfig,
  FeedError,
  FeedErrorType } from '../types';
import { ConfigManagerService } from './config-manager.service';

export class MarketContextBuilder implements IMarketContextBuilder {
  private tradierClient: AxiosInstance;
  private twelveDataClient: AxiosInstance;
  private alpacaClient: AxiosInstance;
  private config: {
    tradier: FeedConfig;
    twelveData: FeedConfig;
    alpaca: FeedConfig;
  };

  constructor(config?: {
    tradier: FeedConfig;
    twelveData: FeedConfig;
    alpaca: FeedConfig;
  }) {
    // Use provided config or get from config manager
    if (config) {
      this.config = config;
    } else {
      const configManager = new ConfigManagerService();
      const engineConfig = configManager.getConfig();
      this.config = {
        tradier: engineConfig.feeds.tradier,
        twelveData: engineConfig.feeds.twelveData,
        alpaca: engineConfig.feeds.alpaca
      };
    }
    
    // Initialize API clients with timeout and retry configuration
    this.tradierClient = axios.create({
      baseURL: this.config.tradier.baseUrl,
      timeout: this.config.tradier.timeout,
      headers: {
        'Authorization': `Bearer ${process.env.TRADIER_API_KEY || 'demo'}`,
        'Accept': 'application/json'
      }
    });

    this.twelveDataClient = axios.create({
      baseURL: this.config.twelveData.baseUrl,
      timeout: this.config.twelveData.timeout,
      headers: {
        'Accept': 'application/json'
      }
    });

    this.alpacaClient = axios.create({
      baseURL: this.config.alpaca.baseUrl,
      timeout: this.config.alpaca.timeout,
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || 'demo',
        'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || 'demo',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Build complete market context by fetching from all providers in parallel
   */
  async buildContext(symbol: string): Promise<MarketContext> {
    const _startTime = Date.now();
    const errors: string[] = [];

    // Execute all API calls in parallel for minimum latency
    const [optionsResult, statsResult, liquidityResult] = await Promise.allSettled([
      this.getTradierOptions(symbol),
      this.getTwelveDataStats(symbol),
      this.getAlpacaLiquidity(symbol)
    ]);

    // Process results and collect any errors
    const options = optionsResult.status === 'fulfilled' ? optionsResult.value : undefined;
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : undefined;
    const liquidity = liquidityResult.status === 'fulfilled' ? liquidityResult.value : undefined;

    if (optionsResult.status === 'rejected') {
      errors.push(`Tradier: ${optionsResult.reason.message}`);
    }
    if (statsResult.status === 'rejected') {
      errors.push(`TwelveData: ${statsResult.reason.message}`);
    }
    if (liquidityResult.status === 'rejected') {
      errors.push(`Alpaca: ${liquidityResult.reason.message}`);
    }

    // Calculate completeness score (0-1 based on successful API calls)
    const successfulCalls = [options, stats, liquidity].filter(Boolean).length;
    const completeness = successfulCalls / 3;

    return {
      options,
      stats,
      liquidity,
      fetchTime: Date.now(),
      completeness,
      errors
    };
  }

  /**
   * Fetch options data from Tradier API
   */
  async getTradierOptions(symbol: string): Promise<MarketContext['options']> {
    if (!this.config.tradier.enabled) {
      throw this.createFeedError('tradier', FeedErrorType.API_ERROR, 'Tradier feed disabled');
    }

    try {
      // Fetch options chain data for put/call ratio and IV percentile
      const [chainResponse, quoteResponse] = await Promise.all([
        this.tradierClient.get(`/v1/markets/options/chains?symbol=${symbol}&expiration=2024-12-20`),
        this.tradierClient.get(`/v1/markets/quotes?symbols=${symbol}`)
      ]);

      const chainData = chainResponse.data;
      const quoteData = quoteResponse.data;

      // Calculate put/call ratio from options chain
      const putCallRatio = this.calculatePutCallRatio(chainData);
      
      // Extract IV percentile from quote data
      const ivPercentile = quoteData.quotes?.[0]?.iv_percentile || 50;
      
      // Determine gamma bias based on options flow
      const gammaBias = this.determineGammaBias(chainData);
      
      // Get options volume
      const optionVolume = chainData.options?.reduce((sum: number, opt: unknown) => 
        sum + (opt.volume || 0), 0) || 0;
      
      // Calculate max pain level
      const maxPain = this.calculateMaxPain(chainData);

      return {
        putCallRatio,
        ivPercentile,
        gammaBias,
        optionVolume,
        maxPain
      };

    } catch (error) {
      throw this.handleApiError('tradier', error);
    }
  }

  /**
   * Fetch market statistics from TwelveData API
   */
  async getTwelveDataStats(symbol: string): Promise<MarketContext['stats']> {
    if (!this.config.twelveData.enabled) {
      throw this.createFeedError('twelvedata', FeedErrorType.API_ERROR, 'TwelveData feed disabled');
    }

    try {
      // Fetch multiple technical indicators in parallel
      const [atrResponse, rsiResponse, volumeResponse] = await Promise.all([
        this.twelveDataClient.get(`/atr?symbol=${symbol}&interval=1day&outputsize=1&apikey=${this.config.twelveData.apiKey}`),
        this.twelveDataClient.get(`/rsi?symbol=${symbol}&interval=1day&outputsize=1&apikey=${this.config.twelveData.apiKey}`),
        this.twelveDataClient.get(`/time_series?symbol=${symbol}&interval=1day&outputsize=20&apikey=${this.config.twelveData.apiKey}`)
      ]);

      const atrData = atrResponse.data;
      const rsiData = rsiResponse.data;
      const volumeData = volumeResponse.data;

      // Extract ATR(14)
      const atr14 = parseFloat(atrData.values?.[0]?.atr) || 0;
      
      // Extract RSI
      const rsi = parseFloat(rsiData.values?.[0]?.rsi) || 50;
      
      // Calculate realized volatility (20-day)
      const rv20 = this.calculateRealizedVolatility(volumeData.values);
      
      // Calculate trend slope from price data
      const trendSlope = this.calculateTrendSlope(volumeData.values);
      
      // Get current volume and calculate volume ratio
      const currentVolume = parseFloat(volumeData.values?.[0]?.volume) || 0;
      const avgVolume = this.calculateAverageVolume(volumeData.values);
      const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

      return {
        atr14,
        rv20,
        trendSlope,
        rsi,
        volume: currentVolume,
        volumeRatio
      };

    } catch (error) {
      throw this.handleApiError('twelvedata', error);
    }
  }

  /**
   * Fetch liquidity data from Alpaca API
   */
  async getAlpacaLiquidity(symbol: string): Promise<MarketContext['liquidity']> {
    if (!this.config.alpaca.enabled) {
      throw this.createFeedError('alpaca', FeedErrorType.API_ERROR, 'Alpaca feed disabled');
    }

    try {
      // Fetch latest quote and order book data
      const [quoteResponse, tradesResponse] = await Promise.all([
        this.alpacaClient.get(`/v2/stocks/${symbol}/quotes/latest`),
        this.alpacaClient.get(`/v2/stocks/${symbol}/trades/latest`)
      ]);

      const quoteData = quoteResponse.data;
      const _tradesData = tradesResponse.data;

      // Calculate bid-ask spread in basis points
      const bid = quoteData.quote?.bid_price || 0;
      const ask = quoteData.quote?.ask_price || 0;
      const midPrice = (bid + ask) / 2;
      const spreadBps = midPrice > 0 ? ((ask - bid) / midPrice) * 10000 : 0;

      // Get bid/ask sizes
      const bidSize = quoteData.quote?.bid_size || 0;
      const askSize = quoteData.quote?.ask_size || 0;

      // Calculate depth score (0-100 based on bid/ask sizes)
      const depthScore = Math.min(100, Math.sqrt(bidSize + askSize) * 10);

      // Determine trade velocity based on recent trade frequency
      const tradeVelocity = this.determineTradeVelocity(_tradesData);

      return {
        spreadBps,
        depthScore,
        tradeVelocity,
        bidSize,
        askSize
      };

    } catch (error) {
      throw this.handleApiError('alpaca', error);
    }
  }

  // Helper methods for data processing

  private calculatePutCallRatio(chainData: unknown): number {
    if (!chainData.options) return 1.0;
    
    let putVolume = 0;
    const callVolume = 0;
    
    chainData.options.forEach((option: unknown) => {
      if (option.option_type === 'put') {
        putVolume += option.volume || 0;
      } else if (option.option_type === 'call') {
        callVolume += option.volume || 0;
      }
    });
    
    return callVolume > 0 ? putVolume / callVolume : 1.0;
  }

  private determineGammaBias(chainData: unknown): "POSITIVE" | "NEGATIVE" | "NEUTRAL" {
    // Simplified gamma bias calculation based on options flow
    // In a real implementation, this would be more sophisticated
    const putCallRatio = this.calculatePutCallRatio(chainData);
    
    if (putCallRatio > 1.2) return 'NEGATIVE';
    if (putCallRatio < 0.8) return 'POSITIVE';
    return 'NEUTRAL';
  }

  private calculateMaxPain(chainData: unknown): number {
    // Simplified max pain calculation
    // In a real implementation, this would calculate the strike with maximum open interest
    if (!chainData.options || chainData.options.length === 0) return 0;
    
    // Return the middle strike as a placeholder
    const strikes = chainData.options.map((opt: unknown) => opt.strike).sort((a: number, b: number) => a - b);
    return strikes[Math.floor(strikes.length / 2)] || 0;
  }

  private calculateRealizedVolatility(priceData: unknown[]): number {
    if (!priceData || priceData.length < 2) return 0;
    
    // Calculate 20-day realized volatility from price returns
    const returns = [];
    for (const i = 1; i < Math.min(priceData.length, 21); i++) {
      const currentPrice = parseFloat(priceData[i - 1].close);
      const previousPrice = parseFloat(priceData[i].close);
      if (currentPrice > 0 && previousPrice > 0) {
        returns.push(Math.log(currentPrice / previousPrice));
      }
    }
    
    if (returns.length === 0) return 0;
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    // Annualize (252 trading days)
    return Math.sqrt(variance * 252) * 100;
  }

  private calculateTrendSlope(priceData: unknown[]): number {
    if (!priceData || priceData.length < 2) return 0;
    
    // Simple linear regression slope over last 20 days
    const prices = priceData.slice(0, 20).map((d: unknown) => parseFloat(d.close)).filter(p => p > 0);
    if (prices.length < 2) return 0;
    
    const n = prices.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = prices;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Normalize slope to -1 to 1 range
    return Math.max(-1, Math.min(1, slope / 10));
  }

  private calculateAverageVolume(volumeData: unknown[]): number {
    if (!volumeData || volumeData.length === 0) return 0;
    
    const volumes = volumeData.slice(1, 21).map((d: unknown) => parseFloat(d.volume)).filter(v => v > 0);
    return volumes.length > 0 ? volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length : 0;
  }

  private determineTradeVelocity(_tradesData: unknown): "SLOW" | "NORMAL" | "FAST" {
    // Simplified trade velocity determination
    // In a real implementation, this would analyze recent trade frequency
    return "NORMAL";
  }

  private handleApiError(provider: string, error: unknown): FeedError {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return this.createFeedError(provider as unknown, FeedErrorType.TIMEOUT, `Request timeout: ${error.message}`);
    }
    
    if (error.response?.status === 429) {
      return this.createFeedError(provider as unknown, FeedErrorType.RATE_LIMITED, 'API rate limit exceeded');
    }
    
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return this.createFeedError(provider as unknown, FeedErrorType.API_ERROR, `API error: ${error.response.status}`);
    }
    
    return this.createFeedError(provider as unknown, FeedErrorType.NETWORK_ERROR, error.message || 'Unknown network error');
  }

  private createFeedError(provider: "tradier" | "twelvedata" | "alpaca", type: FeedErrorType, message: string): FeedError {
    return {
      _provider,
      type,
      message,
      timestamp: Date.now(),
      retryable: type === FeedErrorType.TIMEOUT || type === FeedErrorType.NETWORK_ERROR
    };
  }
}