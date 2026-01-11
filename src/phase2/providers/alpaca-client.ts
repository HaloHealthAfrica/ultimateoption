/**
 * Phase 2 Decision Engine - Alpaca API Client
 * 
 * Client for fetching liquidity data from Alpaca API.
 * Provides bid/ask spread, market depth, and trade velocity data.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { AlpacaLiquidityData, ProviderResult, TradeVelocity } from '../types';
import { PROVIDER_CONFIG } from '../config';
import { Logger } from '../services/logger';

export interface AlpacaQuoteResponse {
  symbol: string;
  bid: number;
  ask: number;
  bid_size: number;
  ask_size: number;
  timestamp: string;
}

export interface AlpacaTradesResponse {
  trades: Array<{
    timestamp: string;
    price: number;
    size: number;
    conditions: string[];
  }>;
  symbol: string;
  next_page_token?: string;
}

export interface AlpacaOrderbookResponse {
  symbol: string;
  bids: Array<{
    price: number;
    size: number;
  }>;
  asks: Array<{
    price: number;
    size: number;
  }>;
  timestamp: string;
}

export class AlpacaClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(apiKey: string, secretKey: string, baseUrl?: string);
  constructor(logger: Logger); // Test constructor
  constructor(apiKeyOrLogger: string | Logger, secretKey?: string, baseUrl: string = 'https://paper-api.alpaca.markets') {
    this.logger = apiKeyOrLogger instanceof Logger ? apiKeyOrLogger : new Logger('AlpacaClient');
    
    const apiKey = typeof apiKeyOrLogger === 'string' ? apiKeyOrLogger : 'test-api-key';
    const secret = typeof apiKeyOrLogger === 'string' ? secretKey! : 'test-secret-key';
    
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: PROVIDER_CONFIG.alpaca.timeout,
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secret,
        'Content-Type': 'application/json'
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('Alpaca API request', {
          url: config.url,
          method: config.method,
          params: config.params
        });
        return config;
      },
      (error) => {
        this.logger.error('Alpaca API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('Alpaca API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('Alpaca API response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch liquidity data for a symbol
   */
  async getLiquidityData(symbol: string): Promise<ProviderResult<AlpacaLiquidityData>> {
    const startTime = Date.now();
    
    try {
      // Fetch data in parallel
      const [quoteResponse, tradesResponse, orderbookResponse] = await Promise.allSettled([
        this.getLatestQuote(symbol),
        this.getRecentTrades(symbol),
        this.getOrderbook(symbol)
      ]);

      let spreadBps = PROVIDER_CONFIG.alpaca.fallback.spreadBps;
      let depthScore = PROVIDER_CONFIG.alpaca.fallback.depthScore;
      let tradeVelocity: TradeVelocity = PROVIDER_CONFIG.alpaca.fallback.tradeVelocity;

      // Process quote data for spread
      if (quoteResponse.status === 'fulfilled') {
        const quote = quoteResponse.value.data;
        spreadBps = this.calculateSpreadBps(quote.bid, quote.ask);
      } else {
        this.logger.warn('Quote data not available, using fallback spread', { symbol });
      }

      // Process orderbook data for depth score
      if (orderbookResponse.status === 'fulfilled') {
        const orderbook = orderbookResponse.value.data;
        depthScore = this.calculateDepthScore(orderbook);
      } else {
        this.logger.warn('Orderbook data not available, using fallback depth', { symbol });
      }

      // Process trades data for velocity
      if (tradesResponse.status === 'fulfilled') {
        const trades = tradesResponse.value.data.trades;
        tradeVelocity = this.calculateTradeVelocity(trades);
      } else {
        this.logger.warn('Trades data not available, using fallback velocity', { symbol });
      }

      const result: AlpacaLiquidityData = {
        spread: {
          bps: spreadBps
        },
        depth: {
          score: depthScore
        },
        velocity: tradeVelocity
      };

      const duration = Date.now() - startTime;
      this.logger.info('Alpaca liquidity data fetched successfully', {
        symbol,
        duration,
        spreadBps,
        depthScore,
        tradeVelocity
      });

      return {
        data: result,
        source: 'API'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Failed to fetch Alpaca liquidity data', {
        symbol,
        duration,
        error: errorMessage
      });

      // Return fallback data
      return {
        data: {
          spread: {
            bps: PROVIDER_CONFIG.alpaca.fallback.spreadBps
          },
          depth: {
            score: PROVIDER_CONFIG.alpaca.fallback.depthScore
          },
          velocity: PROVIDER_CONFIG.alpaca.fallback.tradeVelocity
        },
        source: 'FALLBACK',
        error: errorMessage
      };
    }
  }

  /**
   * Get latest quote for a symbol
   */
  private async getLatestQuote(symbol: string): Promise<AxiosResponse<AlpacaQuoteResponse>> {
    return await this.client.get(`/v2/stocks/${symbol}/quotes/latest`);
  }

  /**
   * Get recent trades for velocity calculation
   */
  private async getRecentTrades(symbol: string): Promise<AxiosResponse<AlpacaTradesResponse>> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes

    const params = {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      limit: 1000
    };

    return await this.client.get(`/v2/stocks/${symbol}/trades`, { params });
  }

  /**
   * Get orderbook data (Level II)
   */
  private async getOrderbook(symbol: string): Promise<AxiosResponse<AlpacaOrderbookResponse>> {
    // Note: This endpoint might not be available in all Alpaca plans
    // Fallback to quote data if orderbook is not available
    try {
      return await this.client.get(`/v2/stocks/${symbol}/orderbook`);
    } catch (error) {
      // If orderbook not available, simulate from quote data
      const quote = await this.getLatestQuote(symbol);
      const simulatedOrderbook: AlpacaOrderbookResponse = {
        symbol,
        bids: [{ price: quote.data.bid, size: quote.data.bid_size }],
        asks: [{ price: quote.data.ask, size: quote.data.ask_size }],
        timestamp: quote.data.timestamp
      };
      
      return { data: simulatedOrderbook } as AxiosResponse<AlpacaOrderbookResponse>;
    }
  }

  /**
   * Calculate bid-ask spread in basis points
   */
  private calculateSpreadBps(bid: number, ask: number): number {
    if (bid <= 0 || ask <= 0 || ask <= bid) {
      return PROVIDER_CONFIG.alpaca.fallback.spreadBps;
    }

    const midPrice = (bid + ask) / 2;
    const spread = ask - bid;
    const spreadBps = (spread / midPrice) * 10000; // Convert to basis points

    return Math.round(spreadBps * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate market depth score based on orderbook
   */
  private calculateDepthScore(orderbook: AlpacaOrderbookResponse): number {
    const { bids, asks } = orderbook;
    
    if (!bids.length || !asks.length) {
      return 0;
    }

    // Calculate total size within 1% of best bid/ask
    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const bidThreshold = bestBid * 0.99;
    const askThreshold = bestAsk * 1.01;

    const bidDepth = bids
      .filter(bid => bid.price >= bidThreshold)
      .reduce((sum, bid) => sum + bid.size, 0);

    const askDepth = asks
      .filter(ask => ask.price <= askThreshold)
      .reduce((sum, ask) => sum + ask.size, 0);

    const totalDepth = bidDepth + askDepth;
    
    // Normalize depth score (0-100 scale)
    // This is a simplified scoring - in production would use more sophisticated metrics
    if (totalDepth < 100) return 10;
    if (totalDepth < 500) return 30;
    if (totalDepth < 1000) return 50;
    if (totalDepth < 5000) return 70;
    return 90;
  }

  /**
   * Calculate trade velocity based on recent trades
   */
  private calculateTradeVelocity(trades: AlpacaTradesResponse['trades']): TradeVelocity {
    if (!trades || trades.length === 0) {
      return 'SLOW';
    }

    // Calculate trades per minute
    const timeSpan = 5; // 5 minutes
    const tradesPerMinute = trades.length / timeSpan;

    // Calculate average trade size
    const avgTradeSize = trades.reduce((sum, trade) => sum + trade.size, 0) / trades.length;

    // Calculate velocity score based on frequency and size
    const velocityScore = tradesPerMinute * Math.log(avgTradeSize + 1);

    if (velocityScore < 5) return 'SLOW';
    if (velocityScore < 20) return 'NORMAL';
    return 'FAST';
  }

  /**
   * Test connection to Alpaca API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/v2/account');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Alpaca connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}