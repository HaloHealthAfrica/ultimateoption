/**
 * Simple debug test to understand validation issues
 */

import request from 'supertest';
import { WebhookService } from '../services/webhook-service';
import { Logger } from '../services/logger';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { MarketContextBuilder } from '../services/market-context-builder';

describe('Debug Integration Issues', () => {
  let webhookService: WebhookService;
  let app: unknown;

  beforeAll(async () => {
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

    webhookService = new WebhookService(
      logger,
      tradierClient,
      twelveDataClient,
      alpacaClient,
      marketContextBuilder
    );

    app = webhookService.getApp();
  });

  it('should debug simple signal validation', async () => {
    const simpleSignal = {
      signal: {
        type: 'LONG',
        aiScore: 8.0,
        symbol: 'SPY'
      }
    };

    console.log('Sending signal:', JSON.stringify(simpleSignal, null, 2));

    const response = await request(app)
      .post('/api/webhooks/signals')
      .send(simpleSignal);

    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(response.body, null, 2));
    console.log('Response headers:', response.headers);

    // Don't expect anything, just log what we get
  });

  it('should debug health endpoint', async () => {
    const response = await request(app)
      .get('/health');

    console.log('Health status:', response.status);
    console.log('Health body:', JSON.stringify(response.body, null, 2));
  });

  it('should debug normalizer directly', async () => {
    const { Normalizer } = await import('../services/normalizer');
    
    const testPayload = {
      signal: {
        type: 'LONG',
        aiScore: 8.0,
        symbol: 'SPY'
      }
    };

    try {
      const normalized = Normalizer.normalizeSignal(testPayload);
      console.log('Normalized successfully:', JSON.stringify(normalized, null, 2));
    } catch (_error) {
      console.log('Normalization error:', _error);
    }
  });
});