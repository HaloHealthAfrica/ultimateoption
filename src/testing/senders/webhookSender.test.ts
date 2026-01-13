/**
 * Webhook Sender Tests
 * Tests for Phase 1B webhook sender functionality
 */

import { 
  sendTrendWebhook, 
  sendMixedBatch, 
  MixedWebhookItem,
  WebhookSenderConfig 
} from './webhookSender';
import { generateTrend } from '../generators/trendGenerator';
import { generateSignal } from '../generators/signalGenerator';
import { generatePhase } from '../generators/phaseGenerator';

describe('Webhook Sender - Phase 1B', () => {
  beforeEach(() => {
    // Ensure tests don't depend on localhost unless explicitly desired.
    process.env.WEBHOOK_BASE_URL = 'https://optionstrat.vercel.app';
  });

  afterEach(() => {
    delete process.env.WEBHOOK_BASE_URL;
  });

  const mockConfig: Partial<WebhookSenderConfig> = {
    trendEndpoint: 'https://optionstrat.vercel.app/api/webhooks/trend',
    timeout_ms: 1000,
  };

  describe('Trend Webhook Sending', () => {
    it('should send trend webhook with correct structure', async () => {
      const trend = generateTrend(12345, { ticker: 'SPY', alignment_score: 75 });
      
      // Mock fetch to avoid actual HTTP calls in tests
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      const result = await sendTrendWebhook(trend, mockConfig);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://optionstrat.vercel.app/api/webhooks/trend',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(trend),
        })
      );
    });
  });

  describe('Mixed Batch Sending', () => {
    it('should send mixed webhook types in correct order', async () => {
      const signal = generateSignal({ seed: 11111, ticker: "SPY" });
      const phase = generatePhase({ seed: 22222, symbol: "SPY" });
      const trend = generateTrend(33333, { ticker: 'SPY' });

      const mixedItems: MixedWebhookItem[] = [
        { type: 'signal', data: signal },
        { type: 'phase', data: phase },
        { type: 'trend', data: trend },
      ];

      // Mock fetch for all webhook types
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      const result = await sendMixedBatch(mixedItems, mockConfig);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // Verify correct endpoints were called
      expect(mockFetch).toHaveBeenNthCalledWith(1, 
        'https://optionstrat.vercel.app/api/webhooks/signals',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenNthCalledWith(2, 
        'https://optionstrat.vercel.app/api/webhooks/saty-phase',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenNthCalledWith(3, 
        'https://optionstrat.vercel.app/api/webhooks/trend',
        expect.any(Object)
      );
    });

    it('should handle mixed batch with delays', async () => {
      const mixedItems: MixedWebhookItem[] = [
        { type: 'signal', data: generateSignal({ seed: 11111 }) },
        { type: 'trend', data: generateTrend(22222) },
      ];

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      const startTime = Date.now();
      const result = await sendMixedBatch(mixedItems, mockConfig, 100); // 100ms delay
      const endTime = Date.now();

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(endTime - _startTime).toBeGreaterThanOrEqual(100); // Should have delay
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const trend = generateTrend(12345);

      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const result = await sendTrendWebhook(trend, mockConfig);

      expect(result.success).toBe(false);
      expect(result._error).toBe('Network error');
      expect(result.status).toBe(0);
    });

    it('should handle HTTP errors in mixed batch', async () => {
      const mixedItems: MixedWebhookItem[] = [
        { type: 'signal', data: generateSignal({ seed: 11111 }) },
        { type: 'trend', data: generateTrend(22222) },
      ];

      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' }),
        });
      global.fetch = mockFetch;

      const result = await sendMixedBatch(mixedItems, mockConfig);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });
  });
});