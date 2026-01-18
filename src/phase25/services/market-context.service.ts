/**
 * Market Context Builder for Phase 2.5 Decision Engine
 * 
 * Fetches real-time market intelligence from multiple data providers
 * in parallel with timeout protection and fallback handling.
 */

import axios, { AxiosInstance } from 'axios';
import { IMarketContextBuilder, FeedConfig,
  FeedError,
  FeedErrorType,
  MarketContext } from '../types';
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
    // Using Tradier for both options AND liquidity data
    const [optionsResult, statsResult, liquidityResult] = await Promise.allSettled([
      this.getTradierOptions(symbol),
      this.getTwelveDataStats(symbol),
      this.getTradierLiquidity(symbol)  // Changed from getAlpacaLiquidity
    ]);

    // Process results and collect any errors
    const options = optionsResult.status === 'fulfilled' ? optionsResult.value : undefined;
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : undefined;
    const liquidity = liquidityResult.status === 'fulfilled' ? liquidityResult.value : undefined;

    if (optionsResult.status === 'rejected') {
      errors.push(`Tradier Options: ${optionsResult.reason.message}`);
    }
    if (statsResult.status === 'rejected') {
      errors.push(`TwelveData: ${statsResult.reason.message}`);
    }
    if (liquidityResult.status === 'rejected') {
      errors.push(`Tradier Liquidity: ${liquidityResult.reason.message}`);
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
        sum + ((opt as Record<string, unknown>).volume as number || 0), 0) || 0;
      
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
   * Fetch liquidity data from Tradier API
   * Using Tradier instead of Alpaca to avoid subscription costs
   */
  async getTradierLiquidity(symbol: string): Promise<MarketContext['liquidity']> {
    if (!this.config.tradier.enabled) {
      throw this.createFeedError('tradier', FeedErrorType.API_ERROR, 'Tradier feed disabled');
    }

    try {
      // Fetch quote data with bid/ask information
      const response = await this.tradierClient.get(
        `/v1/markets/quotes?symbols=${symbol}`
      );

      const quoteData = response.data;
      
      // Handle both single quote and array of quotes
      let quote;
      if (quoteData.quotes?.quote) {
        // Single quote response
        quote = quoteData.quotes.quote;
      } else if (Array.isArray(quoteData.quotes) && quoteData.quotes.length > 0) {
        // Array of quotes
        quote = quoteData.quotes[0];
      } else if (quoteData.quote) {
        // Direct quote object
        quote = quoteData.quote;
      }

      if (!quote) {
        throw new Error('No quote data returned from Tradier');
      }

      // Calculate bid-ask spread in basis points
      const bid = parseFloat(quote.bid) || 0;
      const ask = parseFloat(quote.ask) || 0;
      const midPrice = (bid + ask) / 2;
      const spreadBps = midPrice > 0 ? ((ask - bid) / midPrice) * 10000 : 0;

      // Get bid/ask sizes
      const bidSize = parseInt(quote.bidsize) || 0;
      const askSize = parseInt(quote.asksize) || 0;

      // Calculate depth score (0-100 based on bid/ask sizes)
      const depthScore = Math.min(100, Math.sqrt(bidSize + askSize) * 10);

      // Determine trade velocity based on volume ratio
      const volume = parseInt(quote.volume) || 0;
      const avgVolume = parseInt(quote.average_volume) || 1000000;
      const volumeRatio = avgVolume > 0 ? volume / avgVolume : 1;
      
      const tradeVelocity = volumeRatio > 1.5 ? 'FAST' : 
                           volumeRatio < 0.5 ? 'SLOW' : 'NORMAL';

      return {
        spreadBps,
        depthScore,
        tradeVelocity,
        bidSize,
        askSize
      };

    } catch (error) {
      throw this.handleApiError('tradier', error);
    }
  }

  /**
   * Fetch liquidity data from Alpaca API
   * DEPRECATED: Using Tradier instead (getTradierLiquidity)
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
    const data = chainData as Record<string, unknown>;
    if (!data.options) return 1.0;
    
    let putVolume = 0;
    let callVolume = 0;
    
    (data.options as unknown[]).forEach((option: unknown) => {
      const opt = option as Record<string, unknown>;
      if (opt.option_type === 'put') {
        putVolume += (opt.volume as number) || 0;
      } else if (opt.option_type === 'call') {
        callVolume += (opt.volume as number) || 0;
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
    const data = chainData as Record<string, unknown>;
    if (!data.options || (data.options as unknown[]).length === 0) return 0;
    
    // Return the middle strike as a placeholder
    const strikes = (data.options as unknown[]).map((opt: unknown) => (opt as Record<string, unknown>).strike as number).sort((a: number, b: number) => a - b);
    return strikes[Math.floor(strikes.length / 2)] || 0;
  }

  private calculateRealizedVolatility(priceData: unknown[]): number {
    if (!priceData || priceData.length < 2) return 0;
    
    // Calculate 20-day realized volatility from price returns
    const returns = [];
    for (let i = 1; i < Math.min(priceData.length, 21); i++) {
      const currentPrice = parseFloat((priceData[i - 1] as Record<string, unknown>).close as string);
      const previousPrice = parseFloat((priceData[i] as Record<string, unknown>).close as string);
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
    const prices = priceData.slice(0, 20).map((d: unknown) => parseFloat((d as Record<string, unknown>).close as string)).filter(p => p > 0);
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
    
    const volumes = volumeData.slice(1, 21).map((d: unknown) => parseFloat((d as Record<string, unknown>).volume as string)).filter(v => v > 0);
    return volumes.length > 0 ? volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length : 0;
  }

  private determineTradeVelocity(_tradesData: unknown): "SLOW" | "NORMAL" | "FAST" {
    // Simplified trade velocity determination
    // In a real implementation, this would analyze recent trade frequency
    return "NORMAL";
  }

  private handleApiError(provider: string, error: unknown): FeedError {
    const err = error as Record<string, unknown>;
    const providerName = provider as "tradier" | "twelvedata" | "alpaca";
    
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return this.createFeedError(providerName, FeedErrorType.TIMEOUT, `Request timeout: ${err.message}`);
    }
    
    const response = err.response as Record<string, unknown>;
    if (response?.status === 429) {
      return this.createFeedError(providerName, FeedErrorType.RATE_LIMITED, 'API rate limit exceeded');
    }
    
    if (response?.status && (response.status as number) >= 400 && (response.status as number) < 500) {
      return this.createFeedError(providerName, FeedErrorType.API_ERROR, `API error: ${response.status}`);
    }
    
    return this.createFeedError(providerName, FeedErrorType.NETWORK_ERROR, (err.message as string) || 'Unknown network error');
  }

  private createFeedError(provider: "tradier" | "twelvedata" | "alpaca", type: FeedErrorType, message: string): FeedError {
    return {
      provider,
      type,
      message,
      timestamp: Date.now(),
      retryable: type === FeedErrorType.TIMEOUT || type === FeedErrorType.NETWORK_ERROR
    };
  }
}