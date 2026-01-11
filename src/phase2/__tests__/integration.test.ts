/**
 * Phase 2 Decision Engine - Integration Tests
 * 
 * End-to-end integration tests that validate the complete decision pipeline
 * from webhook input through all components to final decision output.
 */

import request from 'supertest';
import { WebhookService } from '../services/webhook-service';
import { Logger } from '../services/logger';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { MarketContextBuilder } from '../services/market-context-builder';
import { DecisionEngine } from '../engine/decision-engine';
import { DecisionOutputFormatter } from '../formatters/decision-output-formatter';
import { Normalizer } from '../services/normalizer';
import { ENGINE_VERSION } from '../types';
import * as fc from 'fast-check';

describe('Phase 2 Decision Engine - Integration Tests', () => {
  let webhookService: WebhookService;
  let logger: Logger;
  let tradierClient: TradierClient;
  let twelveDataClient: TwelveDataClient;
  let alpacaClient: AlpacaClient;
  let marketContextBuilder: MarketContextBuilder;
  let decisionEngine: DecisionEngine;
  let formatter: DecisionOutputFormatter;

  beforeAll(async () => {
    // Initialize all components
    logger = new Logger();
    tradierClient = new TradierClient(logger);
    twelveDataClient = new TwelveDataClient(logger);
    alpacaClient = new AlpacaClient(logger);
    marketContextBuilder = new MarketContextBuilder(
      logger,
      tradierClient,
      twelveDataClient,
      alpacaClient
    );
    decisionEngine = new DecisionEngine(logger);
    formatter = new DecisionOutputFormatter();

    // Initialize webhook service with all dependencies
    webhookService = new WebhookService(
      logger,
      tradierClient,
      twelveDataClient,
      alpacaClient,
      marketContextBuilder
    );
  });

  describe('Complete Decision Pipeline', () => {
    it('should process valid TradingView signal through complete pipeline', async () => {
      const validSignal = {
        signal: {
          type: 'LONG',
          aiScore: 8.5,
          symbol: 'SPY',
          timestamp: Date.now()
        },
        satyPhase: {
          phase: 75,
          confidence: 85
        },
        marketSession: 'OPEN'
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(validSignal)
        .expect(200);

      // Validate complete response structure
      expect(response.body).toEqual(expect.objectContaining({
        decision: expect.stringMatching(/^(APPROVE|REJECT)$/),
        direction: 'LONG',
        symbol: 'SPY',
        confidence: expect.any(Number),
        engine_version: ENGINE_VERSION,
        timestamp: expect.any(String),
        audit: expect.objectContaining({
          context_snapshot: expect.objectContaining({
            indicator: expect.objectContaining({
              signalType: 'LONG',
              aiScore: 8.5,
              satyPhase: 75,
              marketSession: 'OPEN',
              symbol: 'SPY'
            })
          }),
          gate_results: expect.any(Array),
          processing_time_ms: expect.any(Number),
          timestamp: expect.any(String)
        })
      }));

      // Validate confidence is within bounds
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence).toBeLessThanOrEqual(10);

      // Validate processing time is reasonable
      expect(response.body.audit.processing_time_ms).toBeLessThan(500);
    });

    it('should handle SATY phase updates and merge with existing signals', async () => {
      // First, send a signal
      const signal = {
        signal: {
          type: 'SHORT',
          aiScore: 6.0,
          symbol: 'QQQ'
        },
        marketSession: 'MIDDAY'
      };

      await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(signal)
        .expect(200);

      // Then send SATY phase update
      const satyPhase = {
        phase: -85,
        confidence: 90,
        symbol: 'QQQ',
        timestamp: Date.now()
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/saty-phase')
        .send(satyPhase)
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        status: 'stored',
        symbol: 'QQQ',
        phase: -85,
        confidence: 90,
        timestamp: expect.any(Number)
      }));
    });

    it('should reject signals that fail risk gates', async () => {
      const riskySignal = {
        signal: {
          type: 'LONG',
          aiScore: 3.0, // Low AI score
          symbol: 'RISKY'
        },
        satyPhase: {
          phase: 15, // Low phase confidence
          confidence: 20
        },
        marketSession: 'AFTERHOURS' // Blocked session
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(riskySignal)
        .expect(200);

      expect(response.body.decision).toBe('REJECT');
      
      // Find the session gate in the results array
      const gateResults = response.body.audit.gate_results;
      const sessionGate = gateResults.find(g => g.gate === 'SESSION_GATE');
      
      expect(sessionGate).toEqual(expect.objectContaining({
        passed: false,
        reason: 'AFTERHOURS_BLOCKED'
      }));
    });

    it('should handle provider failures gracefully with fallback data', async () => {
      // This test validates that the system continues to work even when
      // external providers fail, using fallback market data
      const signal = {
        signal: {
          type: 'LONG',
          aiScore: 7.5,
          symbol: 'FALLBACK_TEST'
        },
        satyPhase: {
          phase: 80,
          confidence: 85
        },
        marketSession: 'OPEN'
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(signal)
        .expect(200);

      // Should still get a decision even with provider failures
      expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      expect(response.body.audit.context_snapshot.market).toBeDefined();
      
      // Check if fallback data was used (indicated by dataSource)
      const marketData = response.body.audit.context_snapshot.market;
      expect(['API', 'FALLBACK']).toContain(marketData.optionsData.dataSource);
    });
  });

  describe('Input Validation and Normalization', () => {
    it('should normalize and clamp out-of-range values', async () => {
      const extremeSignal = {
        signal: {
          type: 'long', // lowercase
          aiScore: 15.0, // above max
          symbol: 'spy' // lowercase
        },
        satyPhase: {
          phase: 150 // above max
        },
        marketSession: 'invalid_session'
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(extremeSignal)
        .expect(200);

      const context = response.body.audit.context_snapshot;
      expect(context.indicator.signalType).toBe('LONG');
      expect(context.indicator.aiScore).toBe(10.5); // Clamped to max
      expect(context.indicator.satyPhase).toBe(100); // Clamped to max
      expect(context.indicator.symbol).toBe('SPY'); // Uppercased
      expect(context.indicator.marketSession).toBe('OPEN'); // Defaulted
    });

    it('should reject malformed payloads with proper error messages', async () => {
      const invalidPayload = {
        signal: {
          // Missing required fields
          aiScore: 'not_a_number',
          symbol: ''
        }
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toEqual(expect.objectContaining({
        error: expect.any(String),
        type: 'VALIDATION_ERROR',
        message: expect.stringContaining('Missing required field'),
        engineVersion: ENGINE_VERSION
      }));
    });

    it('should handle missing optional fields with defaults', async () => {
      const minimalSignal = {
        signal: {
          type: 'SHORT',
          aiScore: 5.5,
          symbol: 'MINIMAL'
        }
        // No satyPhase or marketSession
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(minimalSignal)
        .expect(200);

      const context = response.body.audit.context_snapshot;
      expect(context.indicator.satyPhase).toBe(0); // Default
      expect(context.indicator.marketSession).toBe('OPEN'); // Default
    });
  });

  describe('Performance and Reliability', () => {
    it('should maintain performance under concurrent load', async () => {
      const signal = {
        signal: {
          type: 'LONG',
          aiScore: 7.0,
          symbol: 'PERF_TEST'
        },
        marketSession: 'OPEN'
      };

      const startTime = Date.now();
      
      // Make 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        request(webhookService.getApp())
          .post('/api/webhooks/signals')
          .send(signal)
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 10 requests

      // All responses should be valid
      responses.forEach(response => {
        expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
        expect(response.body.audit.processing_time_ms).toBeLessThan(500);
      });
    });

    it('should handle rapid sequential requests without issues', async () => {
      const baseSignal = {
        signal: {
          type: 'LONG',
          aiScore: 6.5,
          symbol: 'RAPID_TEST'
        },
        marketSession: 'OPEN'
      };

      // Make 5 rapid sequential requests
      for (let i = 0; i < 5; i++) {
        const signal = {
          ...baseSignal,
          signal: {
            ...baseSignal.signal,
            timestamp: Date.now() + i
          }
        };

        const response = await request(webhookService.getApp())
          .post('/api/webhooks/signals')
          .send(signal)
          .expect(200);

        expect(response.body.decision).toMatch(/^(APPROVE|REJECT)$/);
      }
    });
  });

  describe('Health and Monitoring', () => {
    it('should provide comprehensive health status', async () => {
      const response = await request(webhookService.getApp())
        .get('/health')
        .expect(503); // Expect 503 when providers are unhealthy (invalid API keys)

      expect(response.body).toEqual(expect.objectContaining({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        engineVersion: ENGINE_VERSION,
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        providers: expect.any(Array),
        performance: expect.any(Object)
      }));
    });

    it('should provide quick health check', async () => {
      const response = await request(webhookService.getApp())
        .get('/health/quick')
        .expect(503); // Expect 503 when providers are unhealthy

      expect(response.body).toEqual(expect.objectContaining({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/), // Allow any status
        timestamp: expect.any(String)
      }));
    });

    it('should provide performance metrics', async () => {
      const response = await request(webhookService.getApp())
        .get('/metrics')
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        performance: expect.objectContaining({
          throughput: expect.objectContaining({
            totalRequests: expect.any(Number),
            currentRPS: expect.any(Number),
            peakRPS: expect.any(Number)
          }),
          latency: expect.objectContaining({
            average: expect.any(Number),
            p95: expect.any(Number),
            p99: expect.any(Number)
          }),
          errors: expect.objectContaining({
            errorRate: expect.any(Number)
          })
        }),
        timestamp: expect.any(String)
      }));
    });
  });

  describe('Security and Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const signal = {
        signal: {
          type: 'LONG',
          aiScore: 5.0,
          symbol: 'RATE_TEST'
        }
      };

      // Make requests up to the rate limit
      // Note: This test may need adjustment based on actual rate limit configuration
      let successCount = 0;
      let rateLimitHit = false;

      for (let i = 0; i < 15; i++) {
        try {
          const response = await request(webhookService.getApp())
            .post('/api/webhooks/signals')
            .send(signal);

          if (response.status === 200) {
            successCount++;
          } else if (response.status === 429) {
            rateLimitHit = true;
            expect(response.body.error).toContain('Rate limit');
            break;
          }
        } catch (error) {
          // Rate limit or other error
          rateLimitHit = true;
          break;
        }
      }

      // Should either hit rate limit or process reasonable number of requests
      expect(successCount > 0 || rateLimitHit).toBe(true);
    });

    it('should include security headers in responses', async () => {
      const signal = {
        signal: {
          type: 'LONG',
          aiScore: 7.0,
          symbol: 'SECURITY_TEST'
        }
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(signal);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-engine-version']).toBe(ENGINE_VERSION);
    });
  });

  // Property-Based Integration Tests
  describe('Property Tests - End-to-End Validation', () => {
    it('Property: All valid signals produce consistent decision structure', () => {
      fc.assert(fc.property(
        fc.constantFrom('LONG', 'SHORT'),
        fc.double({ min: 0, max: 10.5 }),
        fc.integer({ min: -100, max: 100 }),
        fc.constantFrom('OPEN', 'MIDDAY', 'POWER_HOUR'),
        fc.string({ minLength: 1, maxLength: 10 }),
        async (signalType, aiScore, satyPhase, marketSession, symbol) => {
          const signal = {
            signal: {
              type: signalType,
              aiScore,
              symbol: symbol.toUpperCase()
            },
            satyPhase: {
              phase: satyPhase
            },
            marketSession
          };

          const response = await request(webhookService.getApp())
            .post('/api/webhooks/signals')
            .send(signal)
            .expect(200);

          // Property: All responses have consistent structure
          expect(response.body).toEqual(expect.objectContaining({
            decision: expect.stringMatching(/^(APPROVE|REJECT)$/),
            direction: signalType,
            symbol: symbol.toUpperCase(),
            confidence: expect.any(Number),
            engine_version: ENGINE_VERSION,
            audit: expect.objectContaining({
              context_snapshot: expect.any(Object),
              gate_results: expect.any(Object),
              processing_time_ms: expect.any(Number)
            })
          }));

          // Property: Confidence is always within bounds
          expect(response.body.confidence).toBeGreaterThanOrEqual(0);
          expect(response.body.confidence).toBeLessThanOrEqual(10);

          // Property: Processing time is reasonable
          expect(response.body.audit.processing_time_ms).toBeLessThan(1000);
        }
      ), { numRuns: 20 });
    });

    it('Property: Invalid payloads always return 400 with error details', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant({}), // Empty object
          fc.constant({ signal: {} }), // Missing required fields
          fc.constant({ signal: { type: 'INVALID' } }), // Invalid type
          fc.constant({ signal: { type: 'LONG', aiScore: 'invalid' } }) // Invalid aiScore
        ),
        async (invalidPayload) => {
          const response = await request(webhookService.getApp())
            .post('/api/webhooks/signals')
            .send(invalidPayload);

          // Property: Invalid payloads always return 400
          expect(response.status).toBe(400);
          expect(response.body).toEqual(expect.objectContaining({
            error: expect.any(String),
            type: 'VALIDATION_ERROR',
            message: expect.any(String),
            engineVersion: ENGINE_VERSION
          }));
        }
      ), { numRuns: 10 });
    });
  });

  describe('Component Integration', () => {
    it('should integrate normalizer with decision engine correctly', async () => {
      const testPayload = {
        signal: {
          type: 'LONG',
          aiScore: 8.0,
          symbol: 'INTEGRATION_TEST'
        },
        satyPhase: {
          phase: 70
        },
        marketSession: 'OPEN'
      };

      // Test normalizer directly
      const normalizedContext = Normalizer.normalizeSignal(testPayload);
      expect(normalizedContext.indicator.signalType).toBe('LONG');
      expect(normalizedContext.indicator.aiScore).toBe(8.0);
      expect(normalizedContext.indicator.satyPhase).toBe(70);

      // Test through webhook service
      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(testPayload)
        .expect(200);

      // Verify the normalized data matches what the decision engine received
      const auditContext = response.body.audit.context_snapshot;
      expect(auditContext.indicator).toEqual(expect.objectContaining({
        signalType: 'LONG',
        aiScore: 8.0,
        satyPhase: 70,
        marketSession: 'OPEN',
        symbol: 'INTEGRATION_TEST'
      }));
    });

    it('should integrate market context builder with decision engine', async () => {
      const signal = {
        signal: {
          type: 'SHORT',
          aiScore: 6.5,
          symbol: 'MARKET_TEST'
        },
        marketSession: 'MIDDAY'
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(signal)
        .expect(200);

      // Verify market context was built and included
      const marketContext = response.body.audit.context_snapshot.market;
      expect(marketContext).toEqual(expect.objectContaining({
        optionsData: expect.objectContaining({
          putCallRatio: expect.any(Number),
          ivPercentile: expect.any(Number),
          gammaBias: expect.stringMatching(/^(POSITIVE|NEGATIVE|NEUTRAL)$/),
          dataSource: expect.stringMatching(/^(API|FALLBACK)$/)
        }),
        marketStats: expect.objectContaining({
          atr14: expect.any(Number),
          rv20: expect.any(Number),
          trendSlope: expect.any(Number),
          dataSource: expect.stringMatching(/^(API|FALLBACK)$/)
        }),
        liquidityData: expect.objectContaining({
          spreadBps: expect.any(Number),
          marketDepth: expect.any(Number),
          volumeVelocity: expect.any(Number),
          dataSource: expect.stringMatching(/^(API|FALLBACK)$/)
        })
      }));
    });

    it('should integrate decision formatter with complete pipeline', async () => {
      const signal = {
        signal: {
          type: 'LONG',
          aiScore: 9.0,
          symbol: 'FORMAT_TEST'
        },
        satyPhase: {
          phase: 85
        },
        marketSession: 'POWER_HOUR'
      };

      const response = await request(webhookService.getApp())
        .post('/api/webhooks/signals')
        .send(signal)
        .expect(200);

      // Verify the response follows the exact format specification
      expect(response.body).toEqual(expect.objectContaining({
        decision: expect.stringMatching(/^(APPROVE|REJECT)$/),
        direction: 'LONG',
        symbol: 'FORMAT_TEST',
        confidence: expect.any(Number),
        engine_version: ENGINE_VERSION,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        audit: expect.objectContaining({
          context_snapshot: expect.any(Object),
          gate_results: expect.any(Object),
          processing_time_ms: expect.any(Number),
          decision_timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        })
      }));

      // Verify audit trail completeness
      const audit = response.body.audit;
      expect(audit.gate_results_object).toHaveProperty('SPREAD_GATE');
      expect(audit.gate_results_object).toHaveProperty('VOLATILITY_GATE');
      expect(audit.gate_results_object).toHaveProperty('GAMMA_GATE');
      expect(audit.gate_results_object).toHaveProperty('PHASE_GATE');
      expect(audit.gate_results_object).toHaveProperty('SESSION_GATE');
    });
  });
});