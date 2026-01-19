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
import { MarketCacheService } from './market-cache.service';
import { RateLimitTracker } from './rate-limit-tracker.service';
import { getFallbackValue } from '../config/fallback-strategy.config';

export class MarketContextBuilder implements IMarketContextBuilder {
  private tradierClient: AxiosInstance;
  private twelveDataClient: AxiosInstance;
  private alpacaClient: AxiosInstance;
  private cache: MarketCacheService;
  private rateLimiter: RateLimitTracker;
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
    
    // Initialize cache and rate limiter
    this.cache = new MarketCacheService();
    this.rateLimiter = new RateLimitTracker();
    
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
    // Using Tradier for options and TwelveData for stats + liquidity
    const [optionsResult, statsResult, liquidityResult] = await Promise.allSettled([
      this.getTradierOptions(symbol),
      this.getTwelveDataStats(symbol),
      this.getTwelveDataLiquidity(symbol)  // Changed to TwelveData
    ]);

    // Process results and collect any errors
    const options = optionsResult.status === 'fulfilled' ? optionsResult.value : undefined;
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : undefined;
    const liquidity = liquidityResult.status === 'fulfilled' ? liquidityResult.value : undefined;

    if (optionsResult.status === 'rejected') {
      errors.push(`Tradier Options: ${optionsResult.reason.message}`);
    }
    if (statsResult.status === 'rejected') {
      errors.push(`TwelveData Stats: ${statsResult.reason.message}`);
    }
    if (liquidityResult.status === 'rejected') {
      errors.push(`TwelveData Liquidity: ${liquidityResult.reason.message}`);
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
   * Fetch options data from Tradier API with caching and rate limiting
   */
  async getTradierOptions(symbol: string): Promise<MarketContext['options']> {
    if (!this.config.tradier.enabled) {
      throw this.createFeedError('tradier', FeedErrorType.API_ERROR, 'Tradier feed disabled');
    }

    // Check cache first
    const cacheKey = `tradier:options:${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as MarketContext['options'];
    }

    // Check rate limits
    if (!this.rateLimiter.canMakeRequest('tradier')) {
      console.warn('[Tradier] Rate limit reached, using fallback');
      return getFallbackValue('tradier', 'options') as MarketContext['options'];
    }

    try {
      // Record request
      this.rateLimiter.recordRequest('tradier');

      // Fetch options chain data for put/call ratio and IV percentile
      const [chainResponse, quoteResponse] = await Promise.all([
        this.tradierClient.get(`/v1/markets/options/chains?symbol=${symbol}&expiration=2024-12-20`),
        this.tradierClient.get(`/v1/markets/quotes?symbols=${symbol}`)
      ]);

      const chainData = chainResponse.data;
      const quoteData = quoteResponse.data;

      // Check for API errors in response
      if (chainData.error || quoteData.error) {
        throw new Error(`Tradier API error: ${chainData.error || quoteData.error}`);
      }

      // Calculate put/call ratio from options chain
      const putCallRatio = this.calculatePutCallRatio(chainData);
      
      // Extract IV percentile from quote data - handle multiple response formats
      const ivPercentile = quoteData.quotes?.quote?.iv_percentile || 
                          quoteData.quotes?.[0]?.iv_percentile || 
                          50;
      
      // Determine gamma bias based on options flow
      const gammaBias = this.determineGammaBias(chainData);
      
      // Get options volume
      const optionVolume = chainData.options?.reduce((sum: number, opt: unknown) => 
        sum + ((opt as Record<string, unknown>).volume as number || 0), 0) || 0;
      
      // Calculate max pain level
      const maxPain = this.calculateMaxPain(chainData);

      const result = {
        putCallRatio,
        ivPercentile,
        gammaBias,
        optionVolume,
        maxPain
      };

      // Cache the result
      this.cache.set(cacheKey, result, this.cache.TTL.OPTIONS);

      return result;

    } catch (error) {
      const apiError = error as { response?: { status?: number; data?: unknown }; code?: string; message?: string };
      
      // Enhanced error handling with specific messages
      if (apiError.response?.status === 401) {
        console.error('[Tradier] Authentication failed - invalid API key');
        throw this.createFeedError('tradier', FeedErrorType.API_ERROR, 'Authentication failed: Invalid or expired API key');
      }
      
      if (apiError.response?.status === 429) {
        console.error('[Tradier] Rate limit exceeded');
        throw this.createFeedError('tradier', FeedErrorType.RATE_LIMITED, 'Rate limit exceeded');
      }
      
      if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
        console.error('[Tradier] Request timeout');
        throw this.createFeedError('tradier', FeedErrorType.TIMEOUT, 'Request timeout');
      }
      
      console.error('[Tradier] API error:', apiError.message);
      throw this.handleApiError('tradier', error);
    }
  }

  /**
   * Fetch liquidity data from TwelveData API with caching and rate limiting
   * Using TwelveData for liquidity to avoid Alpaca subscription and Tradier issues
   */
  async getTwelveDataLiquidity(symbol: string): Promise<MarketContext['liquidity']> {
    if (!this.config.twelveData.enabled) {
      throw this.createFeedError('twelvedata', FeedErrorType.API_ERROR, 'TwelveData feed disabled');
    }

    // Check cache first
    const cacheKey = `twelvedata:liquidity:${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as MarketContext['liquidity'];
    }

    // Check rate limits
    if (!this.rateLimiter.canMakeRequest('twelvedata')) {
      console.warn('[TwelveData] Rate limit reached, using fallback');
      return getFallbackValue('twelveData', 'liquidity') as MarketContext['liquidity'];
    }

    try {
      // Record request
      this.rateLimiter.recordRequest('twelvedata');

      // Fetch quote data with bid/ask information
      const response = await this.twelveDataClient.get(
        `/quote?symbol=${symbol}&apikey=${this.config.twelveData.apiKey}`
      );

      const quote = response.data;

      // Check for API errors
      if (quote.code === 401) {
        throw new Error('TwelveData authentication failed: Invalid API key');
      }
      if (quote.code === 429) {
        throw new Error('TwelveData rate limit exceeded');
      }
      if (quote.code === 400 || !quote.symbol) {
        throw new Error('No quote data returned from TwelveData');
      }
      if (quote.status === 'error') {
        throw new Error(`TwelveData API error: ${quote.message}`);
      }

      // Calculate bid-ask spread in basis points
      const bid = parseFloat(quote.bid) || 0;
      const ask = parseFloat(quote.ask) || 0;
      const close = parseFloat(quote.close) || 0;
      const midPrice = bid > 0 && ask > 0 ? (bid + ask) / 2 : close;
      const spreadBps = midPrice > 0 && bid > 0 && ask > 0 ? ((ask - bid) / midPrice) * 10000 : 0;

      // Estimate bid/ask sizes from volume (TwelveData doesn't provide sizes directly)
      const volume = parseInt(quote.volume) || 0;
      const avgVolume = parseInt(quote.average_volume) || 1000000;
      
      // Estimate sizes as a fraction of volume (conservative estimate)
      const estimatedSize = Math.floor(volume / 1000) || 100;
      const bidSize = estimatedSize;
      const askSize = estimatedSize;

      // Calculate depth score (0-100 based on volume)
      const depthScore = Math.min(100, Math.sqrt(volume / 10000));

      // Determine trade velocity based on volume ratio
      const volumeRatio = avgVolume > 0 ? volume / avgVolume : 1;
      
      // Explicit type annotation to satisfy TypeScript
      let tradeVelocity: 'FAST' | 'NORMAL' | 'SLOW';
      if (volumeRatio > 1.5) {
        tradeVelocity = 'FAST';
      } else if (volumeRatio < 0.5) {
        tradeVelocity = 'SLOW';
      } else {
        tradeVelocity = 'NORMAL';
      }

      const result = {
        spreadBps,
        depthScore,
        tradeVelocity,
        bidSize,
        askSize
      };

      // Cache the result
      this.cache.set(cacheKey, result, this.cache.TTL.LIQUIDITY);

      return result;

    } catch (error) {
      const apiError = error as { response?: { status?: number; data?: unknown }; code?: string; message?: string };
      
      // Enhanced error handling
      if (apiError.message?.includes('authentication failed')) {
        console.error('[TwelveData] Authentication failed - invalid API key');
        throw this.createFeedError('twelvedata', FeedErrorType.API_ERROR, 'Authentication failed: Invalid API key');
      }
      
      if (apiError.message?.includes('rate limit')) {
        console.error('[TwelveData] Rate limit exceeded');
        throw this.createFeedError('twelvedata', FeedErrorType.RATE_LIMITED, 'Rate limit exceeded');
      }
      
      if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
        console.error('[TwelveData] Request timeout');
        throw this.createFeedError('twelvedata', FeedErrorType.TIMEOUT, 'Request timeout');
      }
      
      console.error('[TwelveData] API error:', apiError.message);
      throw this.handleApiError('twelvedata', error);
    }
  }

  /**
   * Fetch market statistics from TwelveData API with caching and rate limiting
   */
  async getTwelveDataStats(symbol: string): Promise<MarketContext['stats']> {
    if (!this.config.twelveData.enabled) {
      throw this.createFeedError('twelvedata', FeedErrorType.API_ERROR, 'TwelveData feed disabled');
    }

    // Check cache first
    const cacheKey = `twelvedata:stats:${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as MarketContext['stats'];
    }

    // Check rate limits
    if (!this.rateLimiter.canMakeRequest('twelvedata')) {
      console.warn('[TwelveData] Rate limit reached, using fallback');
      return getFallbackValue('twelveData', 'stats') as MarketContext['stats'];
    }

    try {
      // Record requests (3 calls)
      this.rateLimiter.recordRequest('twelvedata');
      this.rateLimiter.recordRequest('twelvedata');
      this.rateLimiter.recordRequest('twelvedata');

      // Fetch multiple technical indicators in parallel
      const [atrResponse, rsiResponse, volumeResponse] = await Promise.all([
        this.twelveDataClient.get(`/atr?symbol=${symbol}&interval=1day&outputsize=1&apikey=${this.config.twelveData.apiKey}`),
        this.twelveDataClient.get(`/rsi?symbol=${symbol}&interval=1day&outputsize=1&apikey=${this.config.twelveData.apiKey}`),
        this.twelveDataClient.get(`/time_series?symbol=${symbol}&interval=1day&outputsize=20&apikey=${this.config.twelveData.apiKey}`)
      ]);

      const atrData = atrResponse.data;
      const rsiData = rsiResponse.data;
      const volumeData = volumeResponse.data;

      // Check for API errors in responses
      if (atrData.code === 401) {
        throw new Error('TwelveData authentication failed: Invalid API key');
      }
      if (atrData.code === 429 || rsiData.code === 429 || volumeData.code === 429) {
        throw new Error('TwelveData rate limit exceeded');
      }
      if (atrData.status === 'error' || rsiData.status === 'error' || volumeData.status === 'error') {
        throw new Error(`TwelveData API error: ${atrData.message || rsiData.message || volumeData.message}`);
      }

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

      const result = {
        atr14,
        rv20,
        trendSlope,
        rsi,
        volume: currentVolume,
        volumeRatio
      };

      // Cache the result
      this.cache.set(cacheKey, result, this.cache.TTL.ATR);

      return result;

    } catch (error) {
      const apiError = error as { response?: { status?: number; data?: unknown }; code?: string; message?: string };
      
      // Enhanced error handling
      if (apiError.message?.includes('authentication failed')) {
        console.error('[TwelveData] Authentication failed - invalid API key');
        throw this.createFeedError('twelvedata', FeedErrorType.API_ERROR, 'Authentication failed: Invalid API key');
      }
      
      if (apiError.message?.includes('rate limit')) {
        console.error('[TwelveData] Rate limit exceeded');
        throw this.createFeedError('twelvedata', FeedErrorType.RATE_LIMITED, 'Rate limit exceeded');
      }
      
      if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
        console.error('[TwelveData] Request timeout');
        throw this.createFeedError('twelvedata', FeedErrorType.TIMEOUT, 'Request timeout');
      }
      
      console.error('[TwelveData] API error:', apiError.message);
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