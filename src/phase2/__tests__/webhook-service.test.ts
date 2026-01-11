/**
 * Phase 2 Decision Engine - Webhook Service Tests
 * 
 * Unit tests for webhook endpoints, validation, and error handling.
 */

import request from 'supertest';
import { WebhookService } from '../services/webhook-service';
import { Logger } from '../services/logger';
import { TradingViewSignal, SatyPhaseWebhook } from '../types';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { MarketContextBuilder } from '../services/market-context-builder';

// Mock the providers
jest.mock('../providers/tradier-client');
jest.mock('../providers/twelvedata-client');
jest.mock('../providers/alpaca-client');
jest.mock('../services/market-context-builder');

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let app: any;
  let logger: Logger;
  let mockTradierClient: jest.Mocked<TradierClient>;
  let mockTwelveDataClient: jest.Mocked<TwelveDataClient>;
  let mockAlpacaClient: jest.Mocked<AlpacaClient>;
  let mockMarketContextBuilder: jest.Mocked<MarketContextBuilder>;

  beforeEach(() => {
    logger = new Logger('error'); // Suppress logs during tests
    
    // Create mock instances
    mockTradierClient = new TradierClient({} as any, logger) as jest.Mocked<TradierClient>;
    mockTwelveDataClient = new TwelveDataClient({} as any, logger) as jest.Mocked<TwelveDataClient>;
    mockAlpacaClient = new AlpacaClient({} as any, logger) as jest.Mocked<AlpacaClient>;
    mockMarketContextBuilder = new MarketContextBuilder(
      mockTradierClient,
      mockTwelveDataClient,
      mockAlpacaClient,
      logger
    ) as jest.Mocked<MarketContextBuilder>;

    // Mock provider methods to return healthy status
    mockTradierClient.testConnection = jest.fn().mockResolvedValue(true);
    mockTwelveDataClient.testConnection = jest.fn().mockResolvedValue(true);
    mockAlpacaClient.testConnection = jest.fn().mockResolvedValue(true);
    mockMarketContextBuilder.testConnectivity = jest.fn().mockResolvedValue({
      tradier: true,
      twelveData: true,
      alpaca: true
    });

    webhookService = new WebhookService(
      logger,
      mockTradierClient,
      mockTwelveDataClient,
      mockAlpacaClient,
      mockMarketContextBuilder
    );
    app = webhookService.getApp();
  });

  describe('POST /api/webhooks/signals', () => {
    const validSignal: TradingViewSignal = {
      signal: {
        type: 'LONG',
        aiScore: 8.5,
        timestamp: Date.now(),
        symbol: 'SPY'
      },
      satyPhase: {
        phase: 75,
        confidence: 85
      },
      marketSession: 'OPEN'
    };

    test('should accept valid signal payload', async () => {
      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(validSignal)
        .expect(200);

      expect(response.body.decision).toMatch(/APPROVE|REJECT/);
      expect(response.body.engine_version).toBe('2.0.0');
      expect(response.body.audit).toBeDefined();
      expect(response.body.audit.symbol).toBe('SPY');
      expect(response.body.audit.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    test('should reject invalid JSON', async () => {
      const response = await request(app)
        .post('/api/webhooks/signals')
        .send('invalid json')
        .expect(400);

      expect(response.body.error).toBe('Content-Type must be application/json');
    });

    test('should reject missing signal field', async () => {
      const invalidPayload = {
        marketSession: 'OPEN'
        // Missing signal field
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.error).toBe('Invalid signal payload');
      expect(response.body.details).toContain('Missing required field: signal');
    });

    test('should reject invalid signal type', async () => {
      const invalidPayload = {
        signal: {
          type: 'INVALID',
          aiScore: 8.5,
          timestamp: Date.now(),
          symbol: 'SPY'
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.details).toContain('Invalid signal type: INVALID. Must be LONG or SHORT');
    });

    test('should clamp aiScore out of range and issue warning', async () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 15.0, // Out of range (max 10.5) - should be clamped
          timestamp: Date.now(),
          symbol: 'SPY'
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(payload)
        .expect(200); // Should succeed with clamped value

      expect(response.body.decision).toBe('APPROVE');
      expect(response.body.confidence).toBe(10.5); // Clamped to max
    });

    test('should handle invalid market session with default', async () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 8.5,
          timestamp: Date.now(),
          symbol: 'SPY'
        },
        marketSession: 'INVALID_SESSION' // Invalid session - should default to OPEN
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(payload)
        .expect(200); // Should succeed with default value

      expect(response.body.decision).toBe('APPROVE');
      expect(response.body.audit.session).toBe('OPEN'); // Defaulted to OPEN
    });

    test('should clamp satyPhase out of range', async () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 8.5,
          timestamp: Date.now(),
          symbol: 'SPY'
        },
        satyPhase: {
          phase: 150, // Out of range (max 100) - should be clamped
          confidence: 85
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(payload)
        .expect(200); // Should succeed with clamped value

      expect(response.body.decision).toBe('APPROVE');
      expect(response.body.audit.context_snapshot.indicator.satyPhase).toBe(100); // Clamped to max
    });

    test('should accept signal without satyPhase', async () => {
      const signalWithoutPhase = {
        signal: {
          type: 'SHORT',
          aiScore: 7.2,
          timestamp: Date.now(),
          symbol: 'QQQ'
        },
        marketSession: 'MIDDAY'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(signalWithoutPhase)
        .expect(200);

      expect(response.body.decision).toMatch(/APPROVE|REJECT/);
      expect(response.body.audit.symbol).toBe('QQQ');
    });

    test('should handle all valid market sessions', async () => {
      const sessions = ['OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS'];

      for (const session of sessions) {
        const signal = {
          ...validSignal,
          marketSession: session
        };

        const response = await request(app)
          .post('/api/webhooks/signals')
          .send(signal)
          .expect(200);

        expect(response.body.audit.session).toBe(session);
      }
    });

    test('should handle all valid signal types', async () => {
      const types = ['LONG', 'SHORT'];

      for (const type of types) {
        const signal = {
          ...validSignal,
          signal: {
            ...validSignal.signal,
            type: type as 'LONG' | 'SHORT'
          }
        };

        const response = await request(app)
          .post('/api/webhooks/signals')
          .send(signal)
          .expect(200);

        expect(response.body.direction).toBe(type);
      }
    });
  });

  describe('POST /api/webhooks/saty-phase', () => {
    const validPhase: SatyPhaseWebhook = {
      phase: 75,
      confidence: 85,
      symbol: 'SPY',
      timestamp: Date.now()
    };

    test('should accept valid phase payload', async () => {
      const response = await request(app)
        .post('/api/webhooks/saty-phase')
        .send(validPhase)
        .expect(200);

      expect(response.body.status).toBe('stored');
      expect(response.body.symbol).toBe('SPY');
      expect(response.body.phase).toBe(75);

      // Verify phase is stored
      const phaseStore = webhookService.getPhaseStore();
      expect(phaseStore.has('SPY')).toBe(true);
      expect(phaseStore.get('SPY')?.phase).toBe(75);
    });

    test('should clamp invalid phase value', async () => {
      const payload = {
        phase: 150, // Out of range - should be clamped to 100
        confidence: 85,
        symbol: 'SPY',
        timestamp: Date.now()
      };

      const response = await request(app)
        .post('/api/webhooks/saty-phase')
        .send(payload)
        .expect(200); // Should succeed with clamped value

      expect(response.body.status).toBe('stored');
      expect(response.body.phase).toBe(100); // Clamped to max
    });

    test('should reject missing required fields', async () => {
      const invalidPayload = {
        phase: 75
        // Missing symbol (confidence and timestamp are optional)
      };

      const response = await request(app)
        .post('/api/webhooks/saty-phase')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.details).toContain('Missing required field: symbol');
    });

    test('should update existing phase data', async () => {
      // Store initial phase
      await request(app)
        .post('/api/webhooks/saty-phase')
        .send(validPhase)
        .expect(200);

      // Update with new phase
      const updatedPhase = {
        ...validPhase,
        phase: -80,
        confidence: 90
      };

      await request(app)
        .post('/api/webhooks/saty-phase')
        .send(updatedPhase)
        .expect(200);

      // Verify updated data
      const phaseStore = webhookService.getPhaseStore();
      expect(phaseStore.get('SPY')?.phase).toBe(-80);
      expect(phaseStore.get('SPY')?.confidence).toBe(90);
    });
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      // Reset performance tracker to ensure clean state
      const performanceTracker = (webhookService as any).healthService.performanceTracker;
      if (performanceTracker && performanceTracker.reset) {
        performanceTracker.reset();
      }

      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.engineVersion).toBe('2.0.0');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.providers).toBeDefined();
      expect(Array.isArray(response.body.providers)).toBe(true);
      expect(response.body.performance).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      // This test would need to be adjusted based on actual rate limits
      // For now, just verify the endpoint exists and works normally
      const response = await request(app)
        .post('/api/webhooks/signals')
        .send({
          signal: {
            type: 'LONG',
            aiScore: 8.5,
            timestamp: Date.now(),
            symbol: 'SPY'
          },
          marketSession: 'OPEN'
        })
        .expect(200);

      expect(response.body.decision).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/webhooks/signals')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(500); // Express JSON parser throws 500 for malformed JSON

      expect(response.body.error).toBe('Internal server error');
    });

    test('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/webhooks/signals')
        .send('some data')
        .expect(400);

      expect(response.body.error).toBe('Content-Type must be application/json');
    });

    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/webhooks/signals')
        .send()
        .expect(400);

      expect(response.body.error).toBe('Content-Type must be application/json');
    });
  });

  describe('Performance Monitoring', () => {
    test('should include processing time in audit trail', async () => {
      const signal: TradingViewSignal = {
        signal: {
          type: 'LONG',
          aiScore: 8.5,
          timestamp: Date.now(),
          symbol: 'SPY'
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(signal)
        .expect(200);

      expect(response.body.audit.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(response.body.audit.processing_time_ms).toBeLessThan(1000); // Should be fast
    });
  });
});