/**
 * Phase 2 Decision Engine - End-to-End Tests
 * 
 * Complete system validation tests that simulate real-world usage scenarios
 * and validate the entire decision-making process from start to finish.
 */

import request from 'supertest';
import { WebhookService } from '../services/webhook-service';
import { Logger } from '../services/logger';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { MarketContextBuilder } from '../services/market-context-builder';
import { ENGINE_VERSION } from '../types';

describe('Phase 2 Decision Engine - End-to-End Tests', () => {
  let webhookService: WebhookService;
  let app: any;

  beforeAll(async () => {
    // Initialize complete system
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

  describe('Real-World Trading Scenarios', () => {
    it('should handle typical bullish signal during market hours', async () => {
      const bullishSignal = {
        signal: {
          type: 'LONG',
          aiScore: 8.2,
          symbol: 'SPY',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: 78,
          confidence: 85
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(bullishSignal)
        .expect(200);

      // Validate decision logic for strong bullish signal
      expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      expect(response.body.direction).toBe('LONG');
      expect(response.body.symbol).toBe('SPY');
      
      // Confidence depends on decision - only APPROVE has confidence > 0
      if (response.body.decision === 'APPROVE') {
        expect(response.body.confidence).toBeGreaterThan(7); // Should be high confidence
      } else {
        expect(response.body.confidence).toBe(0); // REJECT always has 0 confidence
      }

      // Validate audit trail shows proper gate evaluation
      const gateResults = response.body.audit.gate_results_object;
      expect(gateResults.SESSION_GATE.passed).toBe(true); // Market hours
      expect(gateResults.PHASE_GATE.passed).toBe(true); // Strong phase
      
      // Processing should be fast
      expect(response.body.audit.processing_time_ms).toBeLessThan(500);
    });

    it('should handle bearish signal with moderate confidence', async () => {
      const bearishSignal = {
        signal: {
          type: 'SHORT',
          aiScore: 6.5,
          symbol: 'QQQ',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: -65,
          confidence: 70
        },
        marketSession: 'MIDDAY'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(bearishSignal)
        .expect(200);

      expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      expect(response.body.direction).toBe('SHORT');
      expect(response.body.symbol).toBe('QQQ');
      
      // Confidence depends on decision
      if (response.body.decision === 'APPROVE') {
        expect(response.body.confidence).toBeGreaterThan(5);
        expect(response.body.confidence).toBeLessThan(8);
      } else {
        expect(response.body.confidence).toBe(0);
      }

      // Validate negative phase handling
      const context = response.body.audit.context_snapshot;
      expect(context.indicator.satyPhase).toBe(-65);
    });

    it('should reject weak signals during power hour', async () => {
      const weakSignal = {
        signal: {
          type: 'LONG',
          aiScore: 4.2, // Below typical threshold
          symbol: 'IWM',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: 25, // Low phase confidence
          confidence: 30
        },
        marketSession: 'POWER_HOUR'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(weakSignal)
        .expect(200);

      // Weak signals should likely be rejected
      expect(response.body.decision).toBe('REJECT');
      expect(response.body.confidence).toBeLessThan(6);

      // Should show which gates failed
      const gateResults = response.body.audit.gate_results_object;
      expect(gateResults.PHASE_GATE.passed).toBe(false);
      expect(gateResults.PHASE_GATE.reason).toBe('PHASE_CONFIDENCE_LOW');
    });

    it('should block all signals during afterhours', async () => {
      const afterhoursSignal = {
        signal: {
          type: 'LONG',
          aiScore: 9.5, // Even strong signals
          symbol: 'SPY',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: 90,
          confidence: 95
        },
        marketSession: 'AFTERHOURS'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(afterhoursSignal)
        .expect(200);

      // Should be rejected due to session gate
      expect(response.body.decision).toBe('REJECT');
      
      const gateResults = response.body.audit.gate_results_object;
      expect(gateResults.SESSION_GATE.passed).toBe(false);
      expect(gateResults.SESSION_GATE.reason).toBe('AFTERHOURS_BLOCKED');
    });
  });

  describe('Market Condition Scenarios', () => {
    it('should handle high volatility market conditions', async () => {
      const volatileMarketSignal = {
        signal: {
          type: 'SHORT',
          aiScore: 7.8,
          symbol: 'VIX', // Volatility symbol
          timestamp: Date.now()
        },
        satyPhase: {
          phase: -70,
          confidence: 80
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(volatileMarketSignal)
        .expect(200);

      expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      
      // Check if volatility gate was evaluated
      const gateResults = response.body.audit.gate_results_object;
      expect(gateResults).toHaveProperty('VOLATILITY_GATE');
      
      // Market context should include volatility metrics
      const marketContext = response.body.audit.context_snapshot.market;
      expect(marketContext.marketStats).toHaveProperty('atr14');
      expect(marketContext.marketStats).toHaveProperty('rv20');
    });

    it('should handle wide spread conditions', async () => {
      const wideSpreadSignal = {
        signal: {
          type: 'LONG',
          aiScore: 8.0,
          symbol: 'ILLIQUID_STOCK',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: 75,
          confidence: 80
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(wideSpreadSignal)
        .expect(200);

      // Check spread gate evaluation
      const gateResults = response.body.audit.gate_results;
      const spreadGate = gateResults.find(g => g.gate === 'SPREAD_GATE');
      expect(spreadGate).toBeDefined();
      
      // Liquidity data should be present
      const liquidityData = response.body.audit.context_snapshot.market.liquidityData;
      expect(liquidityData).toHaveProperty('spreadBps');
      expect(liquidityData.spreadBps).toBeGreaterThan(0);
    });

    it('should handle gamma bias conditions', async () => {
      const gammaSignal = {
        signal: {
          type: 'LONG',
          aiScore: 7.5,
          symbol: 'SPX',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: 80,
          confidence: 85
        },
        marketSession: 'MIDDAY'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(gammaSignal)
        .expect(200);

      // Check gamma gate evaluation
      const gateResults = response.body.audit.gate_results;
      const gammaGate = gateResults.find(g => g.gate === 'GAMMA_GATE');
      expect(gammaGate).toBeDefined();
      
      // Options data should include gamma bias
      const optionsData = response.body.audit.context_snapshot.market.optionsData;
      expect(optionsData).toHaveProperty('gammaBias');
      expect(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).toContain(optionsData.gammaBias);
    });
  });

  describe('Data Provider Resilience', () => {
    it('should continue operating with partial provider failures', async () => {
      const resilientSignal = {
        signal: {
          type: 'LONG',
          aiScore: 7.0,
          symbol: 'RESILIENT_TEST',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: 70,
          confidence: 75
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(resilientSignal)
        .expect(200);

      // Should still get a decision
      expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      
      // Market context should be present (using fallback data if needed)
      const marketContext = response.body.audit.context_snapshot.market;
      expect(marketContext.optionsData.dataSource).toMatch(/^(API|FALLBACK)$/);
      expect(marketContext.marketStats.dataSource).toMatch(/^(API|FALLBACK)$/);
      expect(marketContext.liquidityData.dataSource).toMatch(/^(API|FALLBACK)$/);
      
      // Processing time should still be reasonable
      expect(response.body.audit.processing_time_ms).toBeLessThan(1000);
    });

    it('should provide fallback market data when all providers fail', async () => {
      const fallbackSignal = {
        signal: {
          type: 'SHORT',
          aiScore: 6.8,
          symbol: 'FALLBACK_TEST',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: -75,
          confidence: 80
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(fallbackSignal)
        .expect(200);

      // Should still make a decision with fallback data
      expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      
      // All market data should have fallback indicators
      const marketContext = response.body.audit.context_snapshot.market;
      
      // Verify fallback data structure
      expect(marketContext.optionsData).toEqual(expect.objectContaining({
        putCallRatio: expect.any(Number),
        ivPercentile: expect.any(Number),
        gammaBias: expect.stringMatching(/^(POSITIVE|NEGATIVE|NEUTRAL)$/),
        dataSource: expect.stringMatching(/^(API|FALLBACK)$/)
      }));
    });
  });

  describe('Performance Under Load', () => {
    it('should handle burst of signals efficiently', async () => {
      const baseSignal = {
        signal: {
          type: 'LONG',
          aiScore: 7.5,
          symbol: 'BURST_TEST'
        },
        satyPhase: {
          phase: 75,
          confidence: 80
        },
        marketSession: 'OPEN'
      };

      const startTime = Date.now();
      
      // Send 20 signals in rapid succession
      const promises = Array.from({ length: 20 }, (_, i) => 
        request(app)
          .post('/api/webhooks/signals')
          .send({
            ...baseSignal,
            signal: {
              ...baseSignal.signal,
              timestamp: Date.now() + i
            }
          })
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should handle burst efficiently
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 20 requests
      
      // All responses should be valid
      responses.forEach((response, index) => {
        expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
        expect(response.body.audit.processing_time_ms).toBeLessThan(1000);
      });

      // Average processing time should be reasonable
      const avgProcessingTime = responses.reduce((sum, r) => 
        sum + r.body.audit.processing_time_ms, 0) / responses.length;
      expect(avgProcessingTime).toBeLessThan(500);
    });

    it('should maintain decision consistency under load', async () => {
      const consistentSignal = {
        signal: {
          type: 'LONG',
          aiScore: 8.0,
          symbol: 'CONSISTENT_TEST',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: 80,
          confidence: 85
        },
        marketSession: 'OPEN'
      };

      // Make multiple identical requests
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/webhooks/signals')
          .send(consistentSignal)
          .expect(200)
      );

      const responses = await Promise.all(promises);
      
      // All responses should have the same decision for identical input
      const decisions = responses.map(r => r.body.decision);
      const uniqueDecisions = [...new Set(decisions)];
      expect(uniqueDecisions).toHaveLength(1); // All decisions should be the same
      
      // Confidence scores should be very similar (within small variance)
      const confidences = responses.map(r => r.body.confidence);
      const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
      confidences.forEach(confidence => {
        expect(Math.abs(confidence - avgConfidence)).toBeLessThan(0.1);
      });
    });
  });

  describe('Error Recovery and Graceful Degradation', () => {
    it('should recover from temporary system stress', async () => {
      // Simulate system stress with rapid requests
      const stressSignal = {
        signal: {
          type: 'LONG',
          aiScore: 7.0,
          symbol: 'STRESS_TEST'
        },
        marketSession: 'OPEN'
      };

      // Create stress with 50 rapid requests
      const stressPromises = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .post('/api/webhooks/signals')
          .send({
            ...stressSignal,
            signal: {
              ...stressSignal.signal,
              timestamp: Date.now() + i
            }
          })
      );

      // Don't wait for all to complete, just start them
      Promise.all(stressPromises).catch(() => {}); // Ignore failures during stress

      // Wait a moment for stress to build
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now send a normal request - should still work
      const normalSignal = {
        signal: {
          type: 'SHORT',
          aiScore: 8.5,
          symbol: 'RECOVERY_TEST',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: -85,
          confidence: 90
        },
        marketSession: 'OPEN'
      };

      const response = await request(app)
        .post('/api/webhooks/signals')
        .send(normalSignal)
        .expect(200);

      // Should still get valid response
      expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      expect(response.body.symbol).toBe('RECOVERY_TEST');
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        null,
        undefined,
        '',
        'invalid json',
        { invalid: 'structure' },
        { signal: { type: 'INVALID_TYPE' } }
      ];

      for (const malformed of malformedRequests) {
        const response = await request(app)
          .post('/api/webhooks/signals')
          .send(malformed);

        // Should return proper error response (400 or 500)
        expect([400, 500]).toContain(response.status);
        
        if (response.status === 400) {
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('type');
          expect(response.body.engineVersion).toBe(ENGINE_VERSION);
        }
      }
    });
  });

  describe('System State and Monitoring', () => {
    it('should maintain accurate system metrics', async () => {
      // Make some requests to generate metrics
      const testSignal = {
        signal: {
          type: 'LONG',
          aiScore: 7.0,
          symbol: 'METRICS_TEST'
        },
        marketSession: 'OPEN'
      };

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/webhooks/signals')
          .send(testSignal)
          .expect(200);
      }

      // Check metrics
      const metricsResponse = await request(app)
        .get('/metrics')
        .expect(200);

      expect(metricsResponse.body.performance.requests.total).toBeGreaterThan(0);
      expect(metricsResponse.body.performance.timing.average).toBeGreaterThan(0);
      expect(metricsResponse.body.performance.throughput.current).toBeGreaterThanOrEqual(0);
    });

    it('should provide comprehensive health information', async () => {
      const healthResponse = await request(app)
        .get('/health')
        .expect(503); // Expect 503 when providers are unhealthy

      expect(healthResponse.body).toEqual(expect.objectContaining({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        engineVersion: ENGINE_VERSION,
        uptime: expect.any(Number),
        providers: expect.any(Array),
        performance: expect.any(Object)
      }));
    });
  });

  describe('Complete Workflow Validation', () => {
    it('should handle complete trading workflow: signal -> phase -> decision', async () => {
      const symbol = 'WORKFLOW_TEST';
      
      // Step 1: Send initial signal
      const initialSignal = {
        signal: {
          type: 'LONG',
          aiScore: 7.5,
          symbol,
          timestamp: Date.now()
        },
        marketSession: 'OPEN'
      };

      const signalResponse = await request(app)
        .post('/api/webhooks/signals')
        .send(initialSignal)
        .expect(200);

      expect(signalResponse.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      expect(signalResponse.body.symbol).toBe(symbol);

      // Step 2: Update SATY phase
      const phaseUpdate = {
        phase: 85,
        confidence: 90,
        symbol,
        timestamp: Date.now()
      };

      const phaseResponse = await request(app)
        .post('/api/webhooks/saty-phase')
        .send(phaseUpdate)
        .expect(200);

      expect(phaseResponse.body.status).toBe('stored');
      expect(phaseResponse.body.symbol).toBe(symbol);
      expect(phaseResponse.body.phase).toBe(85);

      // Step 3: Send another signal (should use updated phase)
      const updatedSignal = {
        signal: {
          type: 'LONG',
          aiScore: 8.0,
          symbol,
          timestamp: Date.now() + 1000
        },
        marketSession: 'OPEN'
      };

      const finalResponse = await request(app)
        .post('/api/webhooks/signals')
        .send(updatedSignal)
        .expect(200);

      expect(finalResponse.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      
      // Should have higher confidence due to updated phase
      expect(finalResponse.body.confidence).toBeGreaterThan(signalResponse.body.confidence);
    });
  });
});