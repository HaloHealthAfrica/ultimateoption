/**
 * Market Context Builder Tests
 * 
 * Tests for API client implementations and market context building.
 */

import { MarketContextBuilder } from '../services/market-context.service';
import { MARKET_FEEDS_CONFIG } from '../config/market-feeds.config';
import { MarketContext, DecisionPacket } from '../types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MarketContextBuilder', () => {
  let marketContextBuilder: MarketContextBuilder;
  let mockTradierClient: unknown;
  let mockTwelveDataClient: unknown;
  let mockAlpacaClient: unknown;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock axios instances
    mockTradierClient = {
      get: jest.fn()
    };
    mockTwelveDataClient = {
      get: jest.fn()
    };
    mockAlpacaClient = {
      get: jest.fn()
    };

    // Mock axios.create to return our mock instances
    mockedAxios.create
      .mockReturnValueOnce(mockTradierClient)
      .mockReturnValueOnce(mockTwelveDataClient)
      .mockReturnValueOnce(mockAlpacaClient);

    // Create test configuration
    const testConfig = {
      tradier: {
        ...MARKET_FEEDS_CONFIG.tradier,
        apiKey: 'test-tradier-key'
      },
      twelveData: {
        ...MARKET_FEEDS_CONFIG.twelveData,
        apiKey: 'test-twelve-key'
      },
      alpaca: {
        ...MARKET_FEEDS_CONFIG.alpaca,
        apiKey: 'test-alpaca-key'
      }
    };

    marketContextBuilder = new MarketContextBuilder(testConfig);
  });

  describe('Constructor and Client Setup', () => {
    it('should create API clients with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledTimes(3);
      
      // Check that axios.create was called for each provider
      const calls = (mockedAxios.create as jest.Mock).mock.calls;
      
      // Verify Tradier client
      expect(calls[0][0]).toEqual({
        baseURL: MARKET_FEEDS_CONFIG.tradier.baseUrl,
        timeout: MARKET_FEEDS_CONFIG.tradier.timeout,
        headers: {
          'Authorization': 'Bearer demo', // Uses demo key in test environment
          'Accept': 'application/json'
        }
      });

      // Verify TwelveData client
      expect(calls[1][0]).toEqual({
        baseURL: MARKET_FEEDS_CONFIG.twelveData.baseUrl,
        timeout: MARKET_FEEDS_CONFIG.twelveData.timeout,
        headers: {
          'Accept': 'application/json'
        }
      });

      // Verify Alpaca client
      expect(calls[2][0]).toEqual({
        baseURL: MARKET_FEEDS_CONFIG.alpaca.baseUrl,
        timeout: MARKET_FEEDS_CONFIG.alpaca.timeout,
        headers: {
          'APCA-API-KEY-ID': 'demo',
          'APCA-API-SECRET-KEY': 'demo',
          'Accept': 'application/json'
        }
      });
    });
  });

  describe('buildContext', () => {
    it('should fetch data from all providers in parallel', async () => {
      // Mock successful responses from all providers
      mockTradierClient.get
        .mockResolvedValueOnce({ // options chain
          data: {
            options: [
              { option_type: 'call', volume: 100, strike: 450 },
              { option_type: 'put', volume: 80, strike: 450 }
            ]
          }
        })
        .mockResolvedValueOnce({ // quote
          data: {
            quotes: [{ iv_percentile: 75 }]
          }
        });

      mockTwelveDataClient.get
        .mockResolvedValueOnce({ // ATR
          data: { values: [{ atr: '2.5' }] }
        })
        .mockResolvedValueOnce({ // RSI
          data: { values: [{ rsi: '65' }] }
        })
        .mockResolvedValueOnce({ // Time series
          data: {
            values: [
              { close: '450.25', volume: '1500000' },
              { close: '448.50', volume: '1200000' }
            ]
          }
        });

      mockAlpacaClient.get
        .mockResolvedValueOnce({ // quote
          data: {
            quote: {
              bid_price: 449.50,
              ask_price: 450.50,
              bid_size: 200,
              ask_size: 150
            }
          }
        })
        .mockResolvedValueOnce({ // trades
          data: { trade: { timestamp: Date.now() } }
        });

      const result = await marketContextBuilder.buildContext('SPY');

      expect(result.completeness).toBe(1.0); // All feeds successful
      expect(result.options).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.liquidity).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(result.fetchTime).toBeGreaterThan(0);
    });

    it('should handle partial failures gracefully', async () => {
      // Mock Tradier success, TwelveData failure, Alpaca success
      mockTradierClient.get
        .mockResolvedValueOnce({
          data: { options: [], quotes: [{ iv_percentile: 50 }] }
        })
        .mockResolvedValueOnce({
          data: { quotes: [{ iv_percentile: 50 }] }
        });

      mockTwelveDataClient.get
        .mockRejectedValue(new Error('TwelveData API error'));

      mockAlpacaClient.get
        .mockResolvedValueOnce({
          data: {
            quote: { bid_price: 449, ask_price: 451, bid_size: 100, ask_size: 100 }
          }
        })
        .mockResolvedValueOnce({
          data: { trade: { timestamp: Date.now() } }
        });

      const result = await marketContextBuilder.buildContext('SPY');

      expect(result.completeness).toBe(2/3); // 2 out of 3 feeds successful
      expect(result.options).toBeDefined();
      expect(result.stats).toBeUndefined();
      expect(result.liquidity).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('TwelveData');
    });

    it('should handle complete failure gracefully', async () => {
      // Mock all providers failing
      mockTradierClient.get.mockRejectedValue(new Error('Tradier timeout'));
      mockTwelveDataClient.get.mockRejectedValue(new Error('TwelveData error'));
      mockAlpacaClient.get.mockRejectedValue(new Error('Alpaca error'));

      const result = await marketContextBuilder.buildContext('SPY');

      expect(result.completeness).toBe(0);
      expect(result.options).toBeUndefined();
      expect(result.stats).toBeUndefined();
      expect(result.liquidity).toBeUndefined();
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('getTradierOptions', () => {
    it('should fetch and process options data correctly', async () => {
      const mockChainData = {
        options: [
          { option_type: 'call', volume: 150, strike: 450, open_interest: 1000 },
          { option_type: 'put', volume: 100, strike: 450, open_interest: 800 },
          { option_type: 'call', volume: 200, strike: 455, open_interest: 1200 }
        ]
      };

      const mockQuoteData = {
        quotes: [{ iv_percentile: 85 }]
      };

      mockTradierClient.get
        .mockResolvedValueOnce({ data: mockChainData })
        .mockResolvedValueOnce({ data: mockQuoteData });

      const result = await marketContextBuilder.getTradierOptions('SPY');

      expect(result).toEqual({
        putCallRatio: 100 / 350, // 100 put volume / 350 call volume
        ivPercentile: 85,
        gammaBias: 'POSITIVE', // Low put/call ratio indicates positive gamma bias
        optionVolume: 450, // Total volume
        maxPain: 450 // Middle strike
      });

      expect(mockTradierClient.get).toHaveBeenCalledTimes(2);
    });

    it('should handle missing options data', async () => {
      mockTradierClient.get
        .mockResolvedValueOnce({ data: { options: [] } })
        .mockResolvedValueOnce({ data: { quotes: [] } });

      const result = await marketContextBuilder.getTradierOptions('SPY');

      expect(result.putCallRatio).toBe(1.0);
      expect(result.ivPercentile).toBe(50);
      expect(result.optionVolume).toBe(0);
      expect(result.maxPain).toBe(0);
    });

    it('should handle API errors correctly', async () => {
      const error = new Error('API timeout');
      error.code = 'ECONNABORTED';
      mockTradierClient.get.mockRejectedValue(_error);

      await expect(marketContextBuilder.getTradierOptions('SPY')).rejects.toMatchObject({
        provider: 'tradier',
        type: FeedErrorType.TIMEOUT,
        retryable: true
      });
    });

    it('should handle rate limiting', async () => {
      const error = { response: { status: 429 } };
      mockTradierClient.get.mockRejectedValue(_error);

      await expect(marketContextBuilder.getTradierOptions('SPY')).rejects.toMatchObject({
        provider: 'tradier',
        type: FeedErrorType.RATE_LIMITED,
        retryable: false
      });
    });
  });

  describe('getTwelveDataStats', () => {
    it('should fetch and process market statistics correctly', async () => {
      const mockAtrData = { values: [{ atr: '3.25' }] };
      const mockRsiData = { values: [{ rsi: '72' }] };
      const mockVolumeData = {
        values: [
          { close: '450.25', volume: '2000000' },
          { close: '448.50', volume: '1800000' },
          { close: '447.75', volume: '1600000' }
        ]
      };

      mockTwelveDataClient.get
        .mockResolvedValueOnce({ data: mockAtrData })
        .mockResolvedValueOnce({ data: mockRsiData })
        .mockResolvedValueOnce({ data: mockVolumeData });

      const result = await marketContextBuilder.getTwelveDataStats('SPY');

      expect(result.atr14).toBe(3.25);
      expect(result.rsi).toBe(72);
      expect(result.volume).toBe(2000000);
      expect(result.rv20).toBeGreaterThan(0);
      expect(result.trendSlope).toBeGreaterThanOrEqual(-1);
      expect(result.trendSlope).toBeLessThanOrEqual(1);
      expect(result.volumeRatio).toBeGreaterThan(0);
    });

    it('should handle missing data gracefully', async () => {
      mockTwelveDataClient.get
        .mockResolvedValueOnce({ data: { values: [] } })
        .mockResolvedValueOnce({ data: { values: [] } })
        .mockResolvedValueOnce({ data: { values: [] } });

      const result = await marketContextBuilder.getTwelveDataStats('SPY');

      expect(result.atr14).toBe(0);
      expect(result.rsi).toBe(50);
      expect(result.volume).toBe(0);
      expect(result.rv20).toBe(0);
      expect(result.trendSlope).toBe(0);
      expect(result.volumeRatio).toBe(1);
    });
  });

  describe('getAlpacaLiquidity', () => {
    it('should fetch and process liquidity data correctly', async () => {
      const mockQuoteData = {
        quote: {
          bid_price: 449.75,
          ask_price: 450.25,
          bid_size: 300,
          ask_size: 250
        }
      };

      const mockTradesData = {
        trade: { timestamp: Date.now() }
      };

      mockAlpacaClient.get
        .mockResolvedValueOnce({ data: mockQuoteData })
        .mockResolvedValueOnce({ data: mockTradesData });

      const result = await marketContextBuilder.getAlpacaLiquidity('SPY');

      expect(result.spreadBps).toBeCloseTo(11.11, 1); // (0.5 / 450) * 10000
      expect(result.bidSize).toBe(300);
      expect(result.askSize).toBe(250);
      expect(result.depthScore).toBeGreaterThan(0);
      expect(result.tradeVelocity).toBe('NORMAL');
    });

    it('should handle zero prices gracefully', async () => {
      const mockQuoteData = {
        quote: {
          bid_price: 0,
          ask_price: 0,
          bid_size: 0,
          ask_size: 0
        }
      };

      mockAlpacaClient.get
        .mockResolvedValueOnce({ data: mockQuoteData })
        .mockResolvedValueOnce({ data: {} });

      const result = await marketContextBuilder.getAlpacaLiquidity('SPY');

      expect(result.spreadBps).toBe(0);
      expect(result.bidSize).toBe(0);
      expect(result.askSize).toBe(0);
      expect(result.depthScore).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should classify timeout errors correctly', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.code = 'ETIMEDOUT';
      mockTradierClient.get.mockRejectedValue(timeoutError);

      await expect(marketContextBuilder.getTradierOptions('SPY')).rejects.toMatchObject({
        type: FeedErrorType.TIMEOUT,
        retryable: true
      });
    });

    it('should classify network errors correctly', async () => {
      const networkError = new Error('Network error');
      mockTradierClient.get.mockRejectedValue(networkError);

      await expect(marketContextBuilder.getTradierOptions('SPY')).rejects.toMatchObject({
        type: FeedErrorType.NETWORK_ERROR,
        retryable: true
      });
    });

    it('should classify API errors correctly', async () => {
      const apiError = { response: { status: 400 } };
      mockTradierClient.get.mockRejectedValue(apiError);

      await expect(marketContextBuilder.getTradierOptions('SPY')).rejects.toMatchObject({
        type: FeedErrorType.API_ERROR,
        retryable: false
      });
    });
  });

  describe('Data Processing Helpers', () => {
    it('should calculate put/call ratio correctly', async () => {
      const chainData = {
        options: [
          { option_type: 'call', volume: 200 },
          { option_type: 'call', volume: 300 },
          { option_type: 'put', volume: 150 },
          { option_type: 'put', volume: 100 }
        ]
      };

      mockTradierClient.get
        .mockResolvedValueOnce({ data: chainData })
        .mockResolvedValueOnce({ data: { quotes: [] } });

      const result = await marketContextBuilder.getTradierOptions('SPY');
      
      // Put volume (250) / Call volume (500) = 0.5
      expect(result.putCallRatio).toBe(0.5);
    });

    it('should determine gamma bias correctly', async () => {
      // Test high put/call ratio (negative gamma bias)
      const highPutCallData = {
        options: [
          { option_type: 'put', volume: 600 },
          { option_type: 'call', volume: 400 }
        ]
      };

      mockTradierClient.get
        .mockResolvedValueOnce({ data: highPutCallData })
        .mockResolvedValueOnce({ data: { quotes: [] } });

      const result = await marketContextBuilder.getTradierOptions('SPY');
      expect(result.gammaBias).toBe('NEGATIVE'); // 1.5 > 1.2
    });
  });
});