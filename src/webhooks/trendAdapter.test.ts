/**
 * Tests for Trend Adapter
 * 
 * Validates conversion of TradingView trend webhooks to canonical format
 */

import { parseAndAdaptTrend, adaptTrendToCanonical, FlexibleTrendSchema } from './trendAdapter';
import { TrendWebhookSchema } from '@/types/trend';

describe('Trend Adapter', () => {
  describe('parseAndAdaptTrend', () => {
    it('should adapt TradingView format to canonical format', () => {
      const tradingViewPayload = {
        event: 'trend_change',
        trigger_timeframe: '5m',
        ticker: 'SPY',
        exchange: 'AMEX',
        price: 686.44,
        timeframes: {
          '3m': { dir: 'neutral', chg: false },
          '5m': { dir: 'bearish', chg: true },
          '15m': { dir: 'bearish', chg: false },
          '30m': { dir: 'bearish', chg: false },
          '1h': { dir: 'bearish', chg: false },
          '4h': { dir: 'bearish', chg: false },
          '1w': { dir: 'bearish', chg: false },
          '1M': { dir: 'bullish', chg: false },
        },
      };

      const result = parseAndAdaptTrend(tradingViewPayload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ticker).toBe('SPY');
        expect(result.data.exchange).toBe('AMEX');
        expect(result.data.price).toBe(686.44);
        expect(result.data.timeframes.tf3min.direction).toBe('neutral');
        expect(result.data.timeframes.tf5min.direction).toBe('bearish');
        expect(result.data.timeframes.tf240min.direction).toBe('bearish');
        expect(result.data.timeframes.tf1month.direction).toBe('bullish');
        
        // Verify it matches canonical schema
        const validation = TrendWebhookSchema.safeParse(result.data);
        expect(validation.success).toBe(true);
      }
    });

    it('should handle multiple trigger timeframes', () => {
      const payload = {
        event: 'trend_change',
        trigger_timeframe: '3m,5m',
        ticker: 'QQQ',
        exchange: 'NASDAQ',
        price: 380.5,
        timeframes: {
          '3m': { dir: 'neutral', chg: true },
          '5m': { dir: 'neutral', chg: true },
          '15m': { dir: 'bearish', chg: false },
          '30m': { dir: 'bearish', chg: false },
          '1h': { dir: 'bearish', chg: false },
          '4h': { dir: 'bearish', chg: false },
          '1w': { dir: 'bearish', chg: false },
          '1M': { dir: 'bullish', chg: false },
        },
      };

      const result = parseAndAdaptTrend(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ticker).toBe('QQQ');
        expect(result.data.timeframes.tf3min.direction).toBe('neutral');
        expect(result.data.timeframes.tf5min.direction).toBe('neutral');
      }
    });

    it('should normalize direction strings', () => {
      const payload = {
        ticker: 'SPY',
        exchange: 'AMEX',
        price: 450,
        timeframes: {
          '3m': { dir: 'BULLISH', chg: false },
          '5m': { dir: 'bull', chg: false },
          '15m': { dir: 'BEARISH', chg: false },
          '30m': { dir: 'bear', chg: false },
          '1h': { dir: 'NEUTRAL', chg: false },
          '4h': { dir: 'neutral', chg: false },
          '1w': { dir: 'long', chg: false },
          '1M': { dir: 'short', chg: false },
        },
      };

      const result = parseAndAdaptTrend(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeframes.tf3min.direction).toBe('bullish');
        expect(result.data.timeframes.tf5min.direction).toBe('bullish');
        expect(result.data.timeframes.tf15min.direction).toBe('bearish');
        expect(result.data.timeframes.tf30min.direction).toBe('bearish');
        expect(result.data.timeframes.tf60min.direction).toBe('neutral');
        expect(result.data.timeframes.tf240min.direction).toBe('neutral');
        expect(result.data.timeframes.tf1week.direction).toBe('bullish');
        expect(result.data.timeframes.tf1month.direction).toBe('bearish');
      }
    });

    it('should use price for open and close when not provided', () => {
      const payload = {
        ticker: 'SPY',
        exchange: 'AMEX',
        price: 686.44,
        timeframes: {
          '3m': { dir: 'neutral', chg: false },
          '5m': { dir: 'bearish', chg: false },
          '15m': { dir: 'bearish', chg: false },
          '30m': { dir: 'bearish', chg: false },
          '1h': { dir: 'bearish', chg: false },
          '4h': { dir: 'bearish', chg: false },
          '1w': { dir: 'bearish', chg: false },
          '1M': { dir: 'bullish', chg: false },
        },
      };

      const result = parseAndAdaptTrend(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeframes.tf3min.open).toBe(686.44);
        expect(result.data.timeframes.tf3min.close).toBe(686.44);
        expect(result.data.timeframes.tf5min.open).toBe(686.44);
        expect(result.data.timeframes.tf5min.close).toBe(686.44);
      }
    });

    it('should generate timestamp if not provided', () => {
      const payload = {
        ticker: 'SPY',
        exchange: 'AMEX',
        price: 686.44,
        timeframes: {
          '3m': { dir: 'neutral', chg: false },
          '5m': { dir: 'bearish', chg: false },
          '15m': { dir: 'bearish', chg: false },
          '30m': { dir: 'bearish', chg: false },
          '1h': { dir: 'bearish', chg: false },
          '4h': { dir: 'bearish', chg: false },
          '1w': { dir: 'bearish', chg: false },
          '1M': { dir: 'bullish', chg: false },
        },
      };

      const result = parseAndAdaptTrend(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timestamp).toBeDefined();
        expect(typeof result.data.timestamp).toBe('string');
        // Should be valid ISO 8601 format
        expect(() => new Date(result.data.timestamp)).not.toThrow();
      }
    });

    it('should reject invalid payloads', () => {
      const invalidPayloads = [
        {},
        { ticker: 'SPY' }, // missing required fields
        { ticker: 'SPY', exchange: 'AMEX' }, // missing price and timeframes
        { ticker: 'SPY', exchange: 'AMEX', price: -100, timeframes: {} }, // negative price
      ];

      invalidPayloads.forEach(payload => {
        const result = parseAndAdaptTrend(payload);
        expect(result.success).toBe(false);
      });
    });

    it('should handle missing optional timeframes gracefully', () => {
      const payload = {
        ticker: 'SPY',
        exchange: 'AMEX',
        price: 450,
        timeframes: {
          '5m': { dir: 'bullish', chg: true },
          '1h': { dir: 'bullish', chg: false },
          // Missing other timeframes
        },
      };

      const result = parseAndAdaptTrend(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        // Missing timeframes should default to neutral
        expect(result.data.timeframes.tf3min.direction).toBe('neutral');
        expect(result.data.timeframes.tf5min.direction).toBe('bullish');
        expect(result.data.timeframes.tf15min.direction).toBe('neutral');
        expect(result.data.timeframes.tf60min.direction).toBe('bullish');
      }
    });
  });

  describe('FlexibleTrendSchema', () => {
    it('should validate TradingView format', () => {
      const payload = {
        event: 'trend_change',
        trigger_timeframe: '5m',
        ticker: 'SPY',
        exchange: 'AMEX',
        price: 686.44,
        timeframes: {
          '3m': { dir: 'neutral', chg: false },
          '5m': { dir: 'bearish', chg: true },
          '15m': { dir: 'bearish', chg: false },
          '30m': { dir: 'bearish', chg: false },
          '1h': { dir: 'bearish', chg: false },
          '4h': { dir: 'bearish', chg: false },
          '1w': { dir: 'bearish', chg: false },
          '1M': { dir: 'bullish', chg: false },
        },
      };

      const result = FlexibleTrendSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should allow optional event and trigger_timeframe', () => {
      const payload = {
        ticker: 'SPY',
        exchange: 'AMEX',
        price: 686.44,
        timeframes: {
          '5m': { dir: 'bearish', chg: true },
        },
      };

      const result = FlexibleTrendSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
