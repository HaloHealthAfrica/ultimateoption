/**
 * MarketData.app Service for Phase 2.5 Decision Engine
 * 
 * Primary provider for options data and liquidity information.
 * Replaces problematic Tradier options and TwelveData liquidity endpoints.
 */

import axios, { AxiosInstance } from 'axios';
import { MarketContext, FeedError, FeedErrorType } from '../types';
import { MarketCacheService } from './market-cache.service';
import { RateLimitTracker } from './rate-limit-tracker.service';

interface MarketDataConfig {
  enabled: boolean;
  timeout: number;
  retries: number;
  apiKey: string;
  baseUrl: string;
}

// Unused interface - kept for future reference
// interface OptionQuote {
//   s: string;
//   optionSymbol: string[];
//   ask: number[];
//   askSize: number[];
//   bid: number[];
//   bidSize: number[];
//   mid: number[];
//   last: number[];
//   volume: number[];
//   openInterest: number[];
//   underlyingPrice: number[];
//   inTheMoney: boolean[];
//   updated: number[];
//   iv: number[];
//   delta: number[];
//   gamma: number[];
//   theta: number[];
//   vega: number[];
//   intrinsicValue: number[];
//   extrinsicValue: number[];
// }

interface StockQuote {
  s: string;
  symbol: string[];
  ask: number[];
  askSize: number[];
  bid: number[];
  bidSize: number[];
  mid: number[];
  last: number[];
  change: number[];
  changepct: number[];
  volume: number[];
  updated: number[];
}

interface OptionChainResponse {
  s: string;
  optionSymbol: string[];
  underlying: string[];
  expiration: number[];
  side: string[];
  strike: number[];
  firstTraded: number[];
  dte: number[];
  ask: number[];
  askSize: number[];
  bid: number[];
  bidSize: number[];
  mid: number[];
  last: number[];
  openInterest: number[];
  volume: number[];
  inTheMoney: boolean[];
  intrinsicValue: number[];
  extrinsicValue: number[];
  underlyingPrice: number[];
  iv: number[];
  delta: number[];
  gamma: number[];
  theta: number[];
  vega: number[];
  rho: number[];
  updated: number[];
}

export class MarketDataService {
  private client: AxiosInstance;
  private cache: MarketCacheService;
  private rateLimiter: RateLimitTracker;
  private config: MarketDataConfig;

  constructor(config?: MarketDataConfig) {
    this.config = config || {
      enabled: true,
      timeout: 600,
      retries: 2,
      apiKey: process.env.MARKETDATA_API_KEY || '',
      baseUrl: process.env.MARKETDATA_BASE_URL || 'https://api.marketdata.app'
    };

    this.cache = new MarketCacheService();
    this.rateLimiter = new RateLimitTracker();

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Get options data for a symbol
   * Provides put/call ratio, IV percentile, gamma bias, and volume
   */
  async getOptionsData(symbol: string): Promise<MarketContext['options']> {
    if (!this.config.enabled) {
      throw this.createFeedError(FeedErrorType.API_ERROR, 'MarketData feed disabled');
    }

    // Check cache first
    const cacheKey = `marketdata:options:${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as MarketContext['options'];
    }

    // Check rate limits
    if (!this.rateLimiter.canMakeRequest('marketdata')) {
      console.warn('[MarketData] Rate limit reached, using fallback');
      throw this.createFeedError(FeedErrorType.RATE_LIMITED, 'Rate limit exceeded');
    }

    try {
      this.rateLimiter.recordRequest('marketdata');

      // Get the nearest expiration date (typically weekly or monthly)
      const expirationsResponse = await this.client.get(
        `/v1/options/expirations/${symbol}/`
      );

      if (expirationsResponse.data.s !== 'ok' || !expirationsResponse.data.expirations?.length) {
        throw new Error('No option expirations available');
      }

      // Use the first available expiration (nearest term)
      const nearestExpiration = expirationsResponse.data.expirations[0];

      // Get full option chain for this expiration
      const chainResponse = await this.client.get<OptionChainResponse>(
        `/v1/options/chain/${symbol}/?expiration=${nearestExpiration}`
      );

      if (chainResponse.data.s !== 'ok') {
        throw new Error('Failed to fetch option chain');
      }

      const chain = chainResponse.data;

      // Calculate put/call ratio from volume
      let putVolume = 0;
      let callVolume = 0;
      let totalOpenInterest = 0;
      let weightedIV = 0;
      let totalVolume = 0;
      let gammaWeightedSum = 0;

      for (let i = 0; i < chain.optionSymbol.length; i++) {
        const volume = chain.volume[i] || 0;
        const openInterest = chain.openInterest[i] || 0;
        const iv = chain.iv[i] || 0;
        const gamma = chain.gamma[i] || 0;
        const side = chain.side[i];

        totalVolume += volume;
        totalOpenInterest += openInterest;

        if (side === 'put') {
          putVolume += volume;
        } else if (side === 'call') {
          callVolume += volume;
        }

        // Weight IV by volume
        if (volume > 0 && iv > 0) {
          weightedIV += iv * volume;
        }

        // Weight gamma by open interest
        if (openInterest > 0) {
          gammaWeightedSum += gamma * openInterest;
        }
      }

      const putCallRatio = callVolume > 0 ? putVolume / callVolume : 1.0;
      
      // Calculate average IV (convert to percentile approximation)
      const avgIV = totalVolume > 0 ? weightedIV / totalVolume : 0;
      // Simple percentile estimation: normalize IV to 0-100 scale
      // Typical IV ranges from 0.1 (10%) to 1.0 (100%), so we map this
      const ivPercentile = Math.min(100, Math.max(0, avgIV * 100));

      // Determine gamma bias
      const avgGamma = totalOpenInterest > 0 ? gammaWeightedSum / totalOpenInterest : 0;
      let gammaBias: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
      if (avgGamma > 0.02) {
        gammaBias = 'POSITIVE';
      } else if (avgGamma < -0.02) {
        gammaBias = 'NEGATIVE';
      } else {
        gammaBias = 'NEUTRAL';
      }

      // Calculate max pain (strike with highest open interest)
      let maxPainStrike = 0;
      let maxOI = 0;
      for (let i = 0; i < chain.strike.length; i++) {
        const oi = chain.openInterest[i] || 0;
        if (oi > maxOI) {
          maxOI = oi;
          maxPainStrike = chain.strike[i];
        }
      }

      const result = {
        putCallRatio,
        ivPercentile,
        gammaBias,
        optionVolume: totalVolume,
        maxPain: maxPainStrike
      };

      // Cache the result
      this.cache.set(cacheKey, result, this.cache.TTL.OPTIONS);

      return result;

    } catch (error) {
      console.error('[MarketData] Options fetch error:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Get liquidity data for a symbol
   * Provides spread, depth score, and trade velocity
   */
  async getLiquidityData(symbol: string): Promise<MarketContext['liquidity']> {
    if (!this.config.enabled) {
      throw this.createFeedError(FeedErrorType.API_ERROR, 'MarketData feed disabled');
    }

    // Check cache first
    const cacheKey = `marketdata:liquidity:${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as MarketContext['liquidity'];
    }

    // Check rate limits
    if (!this.rateLimiter.canMakeRequest('marketdata')) {
      console.warn('[MarketData] Rate limit reached, using fallback');
      throw this.createFeedError(FeedErrorType.RATE_LIMITED, 'Rate limit exceeded');
    }

    try {
      this.rateLimiter.recordRequest('marketdata');

      // Get stock quote with bid/ask data
      const quoteResponse = await this.client.get<StockQuote>(
        `/v1/stocks/quotes/${symbol}/`
      );

      if (quoteResponse.data.s !== 'ok') {
        throw new Error('Failed to fetch stock quote');
      }

      const quote = quoteResponse.data;
      const bid = quote.bid[0] || 0;
      const ask = quote.ask[0] || 0;
      const bidSize = quote.bidSize[0] || 0;
      const askSize = quote.askSize[0] || 0;
      const volume = quote.volume[0] || 0;
      const mid = quote.mid[0] || 0;

      // Calculate spread in basis points
      const spreadBps = mid > 0 && bid > 0 && ask > 0 
        ? ((ask - bid) / mid) * 10000 
        : 0;

      // Calculate depth score (0-100 based on bid/ask sizes)
      // Normalize to typical sizes: 100 shares = low, 10000+ = high
      const totalSize = bidSize + askSize;
      const depthScore = Math.min(100, Math.sqrt(totalSize / 100) * 10);

      // Determine trade velocity based on volume
      // We'll need to compare to average volume, so let's get historical data
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const candlesResponse = await this.client.get(
        `/v1/stocks/candles/D/${symbol}/?from=${thirtyDaysAgo.toISOString().split('T')[0]}&to=${today.toISOString().split('T')[0]}`
      );

      let tradeVelocity: "SLOW" | "NORMAL" | "FAST" = "NORMAL";
      
      if (candlesResponse.data.s === 'ok' && candlesResponse.data.v?.length > 0) {
        const volumes = candlesResponse.data.v as number[];
        const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
        const volumeRatio = avgVolume > 0 ? volume / avgVolume : 1;
        
        if (volumeRatio > 1.5) {
          tradeVelocity = 'FAST';
        } else if (volumeRatio < 0.5) {
          tradeVelocity = 'SLOW';
        }
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
      console.error('[MarketData] Liquidity fetch error:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Get market statistics for a symbol
   * Provides ATR, RSI, volume data, and trend information
   */
  async getMarketStats(symbol: string): Promise<MarketContext['stats']> {
    if (!this.config.enabled) {
      throw this.createFeedError(FeedErrorType.API_ERROR, 'MarketData feed disabled');
    }

    // Check cache first
    const cacheKey = `marketdata:stats:${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as MarketContext['stats'];
    }

    // Check rate limits
    if (!this.rateLimiter.canMakeRequest('marketdata')) {
      console.warn('[MarketData] Rate limit reached, using fallback');
      throw this.createFeedError(FeedErrorType.RATE_LIMITED, 'Rate limit exceeded');
    }

    try {
      this.rateLimiter.recordRequest('marketdata');

      // Get 30 days of daily candles for calculations
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const candlesResponse = await this.client.get(
        `/v1/stocks/candles/D/${symbol}/?from=${thirtyDaysAgo.toISOString().split('T')[0]}&to=${today.toISOString().split('T')[0]}`
      );

      if (candlesResponse.data.s !== 'ok') {
        throw new Error('Failed to fetch candles');
      }

      const candles = candlesResponse.data;
      const highs = candles.h as number[];
      const lows = candles.l as number[];
      const closes = candles.c as number[];
      const volumes = candles.v as number[];

      if (!highs?.length || highs.length < 14) {
        throw new Error('Insufficient candle data');
      }

      // Calculate ATR(14)
      const atr14 = this.calculateATR(highs, lows, closes, 14);

      // Calculate RSI(14)
      const rsi = this.calculateRSI(closes, 14);

      // Calculate 20-day realized volatility
      const rv20 = this.calculateRealizedVolatility(closes, 20);

      // Calculate trend slope
      const trendSlope = this.calculateTrendSlope(closes, 20);

      // Get current volume and calculate ratio
      const currentVolume = volumes[volumes.length - 1] || 0;
      const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / Math.min(20, volumes.length);
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
      console.error('[MarketData] Stats fetch error:', error);
      throw this.handleApiError(error);
    }
  }

  // ============================================================================
  // CALCULATION HELPERS
  // ============================================================================

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period + 1) return 0;

    const trueRanges: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      trueRanges.push(tr);
    }

    // Calculate initial ATR (simple average of first period)
    let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

    // Calculate smoothed ATR for remaining periods
    for (let i = period; i < trueRanges.length; i++) {
      atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    }

    return atr;
  }

  private calculateRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;

    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    // Calculate initial averages
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    // Calculate smoothed averages
    for (let i = period; i < changes.length; i++) {
      if (changes[i] > 0) {
        avgGain = ((avgGain * (period - 1)) + changes[i]) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = ((avgLoss * (period - 1)) + Math.abs(changes[i])) / period;
      }
    }

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  private calculateRealizedVolatility(closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;

    const returns: number[] = [];
    for (let i = 1; i <= period && i < closes.length; i++) {
      const ret = Math.log(closes[closes.length - i] / closes[closes.length - i - 1]);
      returns.push(ret);
    }

    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    // Annualize (252 trading days)
    const annualizedVol = Math.sqrt(variance * 252) * 100;

    return annualizedVol;
  }

  private calculateTrendSlope(closes: number[], period: number): number {
    if (closes.length < period) return 0;

    const recentCloses = closes.slice(-period);
    const n = recentCloses.length;
    
    // Simple linear regression
    const x = Array.from({ length: n }, (_, i) => i);
    const y = recentCloses;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Normalize to -1 to 1 range (divide by average price)
    const avgPrice = sumY / n;
    const normalizedSlope = avgPrice > 0 ? slope / avgPrice : 0;
    
    return Math.max(-1, Math.min(1, normalizedSlope * 100));
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  private handleApiError(error: unknown): FeedError {
    const err = error as { response?: { status?: number }; code?: string; message?: string };
    
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return this.createFeedError(FeedErrorType.TIMEOUT, `Request timeout: ${err.message}`);
    }
    
    if (err.response?.status === 429) {
      return this.createFeedError(FeedErrorType.RATE_LIMITED, 'API rate limit exceeded');
    }
    
    if (err.response?.status === 401) {
      return this.createFeedError(FeedErrorType.API_ERROR, 'Authentication failed: Invalid API key');
    }
    
    if (err.response?.status && err.response.status >= 400 && err.response.status < 500) {
      return this.createFeedError(FeedErrorType.API_ERROR, `API error: ${err.response.status}`);
    }
    
    return this.createFeedError(FeedErrorType.NETWORK_ERROR, err.message || 'Unknown network error');
  }

  private createFeedError(type: FeedErrorType, message: string): FeedError {
    return {
      provider: 'marketdata' as 'tradier' | 'twelvedata' | 'alpaca',
      type,
      message,
      timestamp: Date.now(),
      retryable: type === FeedErrorType.TIMEOUT || type === FeedErrorType.NETWORK_ERROR
    };
  }
}
