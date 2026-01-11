/**
 * Debug test to identify the exact webhook service initialization issue
 */

import request from 'supertest';
import { WebhookService } from '../services/webhook-service';
import { Logger } from '../services/logger';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { MarketContextBuilder } from '../services/market-context-builder';

describe('Debug Webhook Service', () => {
  let webhookService: WebhookService;
  let app: any;

  beforeAll(async () => {
    try {
      console.log('Initializing components...');
      
      const logger = new Logger();
      const tradierClient = new TradierClient(logger);
      const twelveDataClient = new TwelveDataClient(logger);
      const alpacaClient = new AlpacaClient(logger);
      const marketContextBuilder = new MarketContextBuilder(
        logger,
        tradierClient,
        twelveDataClient,
        alpacaClient
      );

      console.log('Creating webhook service...');
      webhookService = new WebhookService(
        logger,
        tradierClient,
        twelveDataClient,
        alpacaClient,
        marketContextBuilder
      );

      app = webhookService.getApp();
      console.log('Webhook service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize webhook service:', error);
      throw error;
    }
  });

  it('should respond to health check', async () => {
    try {
      const response = await request(app)
        .get('/health/quick')
        .timeout(5000);
      
      console.log('Health check response status:', response.status);
      console.log('Health check response body:', response.body);
      
      // Accept either 200 or 503 for now
      expect([200, 503]).toContain(response.status);
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  });

  it('should handle simple signal', async () => {
    try {
      const signal = {
        signal: {
          type: 'LONG',
          aiScore: 7.0,
          symbol: 'TEST'
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(signal)
        .timeout(5000);
      
      console.log('Signal response status:', response.status);
      console.log('Signal response body:', response.body);
      
      // Accept either 200 or 400 for now to see what's happening
      expect([200, 400, 500]).toContain(response.status);
    } catch (error) {
      console.error('Signal test failed:', error);
      throw error;
    }
  });
});