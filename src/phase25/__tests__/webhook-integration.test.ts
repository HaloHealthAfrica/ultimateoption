/**
 * Phase 2.5 Webhook Integration Tests
 * 
 * Integration tests for webhook endpoints using supertest.
 */

import request from 'supertest';
import { Phase25Server } from '../server';

describe('Phase 2.5 Webhook Integration', () => {
  let server: Phase25Server;
  let app: any;

  beforeAll(() => {
    server = new Phase25Server(3002);
    app = server.getApp();
  });

  describe('Health Endpoints', () => {
    it('should return health status from root endpoint', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'Phase 2.5 Decision Engine',
        version: '1.0.0',
        status: 'running'
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return health status from webhook health endpoint', async () => {
      const response = await request(app)
        .get('/api/webhooks/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        engine: 'Phase 2.5 Decision Engine',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('Signal Webhook Endpoint', () => {
    it('should accept valid TradingView signal', async () => {
      const validSignal = {
        signal: {
          type: 'LONG',
          timeframe: '15',
          quality: 'HIGH',
          ai_score: 8.5,
          timestamp: Date.now(),
          bar_time: '2024-01-15T10:30:00Z'
        },
        instrument: {
          ticker: 'SPY',
          exchange: 'ARCA',
          current_price: 450.25
        },
        risk: {
          rr_ratio_t1: 2.5,
          rr_ratio_t2: 4.0
        }
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(validSignal)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'TRADINGVIEW_SIGNAL webhook processed successfully'
      });
      expect(response.body.processingTime).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should reject invalid signal payload', async () => {
      const invalidSignal = {
        signal: {
          type: 'INVALID_TYPE', // Invalid type
          timeframe: '15',
          quality: 'HIGH',
          ai_score: 8.5
        }
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(invalidSignal)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false
      });
      expect(response.body.message).toContain('Unable to detect webhook source');
    });
  });

  describe('SATY Phase Webhook Endpoint', () => {
    it('should accept valid SATY phase webhook', async () => {
      const validSatyPhase = {
        meta: {
          engine: 'SATY_PO',
          engine_version: '1.0.0',
          event_id: 'test-123',
          event_type: 'REGIME_PHASE_ENTRY',
          generated_at: '2024-01-15T10:30:00Z'
        },
        instrument: {
          symbol: 'SPY',
          exchange: 'ARCA',
          asset_class: 'equity',
          session: 'regular'
        },
        event: {
          name: 'ENTER_ACCUMULATION'
        },
        confidence: {
          confidence_score: 85
        },
        execution_guidance: {
          trade_allowed: true
        }
      };

      const response = await request(app)
        .post('/api/webhooks/saty-phase')
        .send(validSatyPhase)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'SATY_PHASE webhook processed successfully'
      });
      expect(response.body.processingTime).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should reject invalid SATY phase payload', async () => {
      const invalidSatyPhase = {
        meta: {
          engine: 'INVALID_ENGINE', // Invalid engine
          engine_version: '1.0.0'
        }
      };

      const response = await request(app)
        .post('/api/webhooks/saty-phase')
        .send(invalidSatyPhase)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false
      });
      expect(response.body.message).toContain('Unable to detect webhook source');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Endpoint not found',
        path: '/api/unknown-endpoint'
      });
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/webhooks/signals')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(500); // Our error handler catches JSON parsing errors

      expect(response.body).toMatchObject({
        success: false,
        message: 'Internal server error'
      });
    });
  });
});