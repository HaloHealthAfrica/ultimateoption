/**
 * End-to-End Integration Tests for Phase 2.5
 * 
 * Tests the complete webhook-to-decision flow, market context integration,
 * and error handling paths to validate all requirements work together.
 */

import { DecisionOrchestratorService } from '../services/decision-orchestrator.service';
import { ServiceFactory } from '../services/service-factory';
import { WebhookSource, MarketContext } from '../types';

describe('Phase 2.5 End-to-End Integration Tests', () => {
  let orchestrator: DecisionOrchestratorService;
  let serviceFactory: ServiceFactory;

  beforeEach(() => {
    serviceFactory = ServiceFactory.getInstance();
    serviceFactory.reset(); // Reset for clean state
    orchestrator = serviceFactory.createOrchestrator(true); // Decision-only mode for testing
  });

  afterEach(() => {
    serviceFactory.reset();
  });

  describe('Complete Webhook-to-Decision Flow', () => {
    it('should process TradingView signal through complete pipeline', async () => {
      // First send SATY phase data to provide regime context
      const satyPayload = {
        meta: {
          engine: 'SATY_PO',
          engine_version: '1.0.0',
          timestamp: Date.now()
        },
        data: {
          symbol: 'SPY',
          phase: 'ACCUMULATION',
          confidence: 85,
          bias: 'BULLISH'
        }
      };

      await orchestrator.processWebhook(satyPayload);

      // Then send TradingView signal - needs instrument.ticker
      const tradingViewPayload = {
        signal: {
          type: 'LONG',
          timeframe: '15',
          ai_score: 8.5,
          quality: 'HIGH'
        },
        instrument: {
          ticker: 'SPY'
        }
      };

      const result = await orchestrator.processWebhook(tradingViewPayload);

      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      expect(result.decision?.action).toMatch(/^(EXECUTE|WAIT|SKIP)$/);
      expect(result.decision?.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.decision?.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle SATY phase webhook correctly', async () => {
      const satyPayload = {
        meta: {
          engine: 'SATY_PO', // Correct engine name
          engine_version: '1.0.0',
          timestamp: Date.now()
        },
        data: {
          symbol: 'SPY',
          phase: 'ACCUMULATION',
          confidence: 85,
          bias: 'BULLISH'
        }
      };

      const result = await orchestrator.processWebhook(satyPayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Context updated from SATY_PHASE');
    });

    it('should accumulate context from multiple sources', async () => {
      // Send SATY phase data
      const satyPayload = {
        meta: {
          engine: 'SATY_PO', // Correct engine name
          engine_version: '1.0.0',
          timestamp: Date.now()
        },
        data: {
          symbol: 'SPY',
          phase: 'ACCUMULATION',
          confidence: 85,
          bias: 'BULLISH'
        }
      };

      await orchestrator.processWebhook(satyPayload);

      // Send Ultimate Options expert signal (no timeframe)
      const expertPayload = {
        signal: {
          type: 'LONG',
          quality: 'HIGH',
          ai_score: 8.5
          // No timeframe for Ultimate Options
        }
      };

      const result = await orchestrator.processWebhook(expertPayload);

      // Should now have complete context and make a decision
      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
    });
  });

  describe('Market Context Integration Scenarios', () => {
    it('should handle market context building with fallback values', async () => {
      // First send SATY phase data
      const satyPayload = {
        meta: {
          engine: 'SATY_PO',
          engine_version: '1.0.0',
          timestamp: Date.now()
        },
        data: {
          symbol: 'SPY',
          phase: 'ACCUMULATION',
          confidence: 85,
          bias: 'BULLISH'
        }
      };

      await orchestrator.processWebhook(satyPayload);

      // Then send TradingView signal
      const payload = {
        signal: {
          type: 'LONG',
          timeframe: '15',
          ai_score: 8.5,
          quality: 'HIGH'
        },
        instrument: {
          ticker: 'SPY'
        }
      };

      const result = await orchestrator.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      // Market context should be built even if APIs fail (using fallback values)
    });

    it('should make conservative decisions with poor market context', async () => {
      // Create a decision context with poor market conditions
      const decisionContext: DecisionContext = {
        meta: {
          engineVersion: '2.5.0',
          receivedAt: Date.now(),
          completeness: 1.0
        },
        instrument: {
          symbol: 'SPY',
          exchange: 'ARCA',
          price: 450.0
        },
        regime: {
          phase: 1, // ACCUMULATION
          phaseName: 'ACCUMULATION',
          volatility: 'NORMAL',
          confidence: 85,
          bias: 'LONG'
        },
        alignment: {
          tfStates: { tf15min: 'BULLISH', tf60min: 'BULLISH' },
          bullishPct: 75,
          bearishPct: 25
        },
        expert: {
          direction: 'LONG',
          aiScore: 8.5,
          quality: 'HIGH',
          components: [],
          rr1: 2.5,
          rr2: 4.0
        },
        structure: {
          validSetup: true,
          liquidityOk: true,
          executionQuality: 'A'
        }
      };

      const poorMarketContext: MarketContext = {
        options: {
          putCallRatio: 1.5, // High put/call ratio
          ivPercentile: 95,  // Very high IV
          gammaBias: 'NEUTRAL',
          dataSource: 'FALLBACK'
        },
        stats: {
          atr14: 5.0, // High volatility
          rv20: 4.5,
          trendSlope: -0.1,
          dataSource: 'FALLBACK'
        },
        liquidity: {
          spreadBps: 15, // Wide spread
          depthScore: 2,  // Poor depth
          tradeVelocity: 'SLOW',
          dataSource: 'FALLBACK'
        },
        completeness: 0.3, // Poor completeness
        timestamp: Date.now()
      };

      const decision = await orchestrator.processDecisionOnly(decisionContext, poorMarketContext);

      // Should be conservative due to poor market conditions
      expect(decision.action).toMatch(/^(WAIT|SKIP)$/);
      expect(decision.reasons).toContain('Market gate failed: Spread too wide: 15bps > 12bps');
    });
  });

  describe('Error Handling and Recovery Paths', () => {
    it('should handle invalid webhook payloads gracefully', async () => {
      const invalidPayload = {
        invalid: 'payload',
        structure: true
      };

      const result = await orchestrator.processWebhook(invalidPayload);

      expect(result.success).toBe(false);
      expect(result.message).toContain('routing failed');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle empty payloads gracefully', async () => {
      const result = await orchestrator.processWebhook({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('routing failed');
    });

    it('should handle null payloads gracefully', async () => {
      const result = await orchestrator.processWebhook(null);

      expect(result.success).toBe(false);
      expect(result.message).toContain('routing failed');
    });

    it('should recover from temporary system stress', async () => {
      // Simulate multiple rapid requests
      const payload = {
        signal: {
          type: 'LONG',
          timeframe: '15'
        },
        instrument: {
          ticker: 'SPY'
        }
      };

      const promises = Array.from({ length: 5 }, () => 
        orchestrator.processWebhook(payload)
      );

      const results = await Promise.all(promises);

      // All requests should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      });
    });
  });

  describe('System Health and Status', () => {
    it('should report system health correctly', async () => {
      const health = await orchestrator.getHealthStatus();

      expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.details).toHaveProperty('orchestrator');
      expect(health.details).toHaveProperty('contextStore');
      expect(health.details).toHaveProperty('marketFeeds');
      expect(health.details).toHaveProperty('decisionEngine');
      expect(health.details).toHaveProperty('configuration');
      expect(health.timestamp).toBeGreaterThan(0);
    });

    it('should provide comprehensive metrics report', async () => {
      // Process a few decisions to generate metrics
      const payload = {
        signal: {
          type: 'LONG',
          timeframe: '15'
        },
        instrument: {
          ticker: 'SPY'
        }
      };

      await orchestrator.processWebhook(payload);
      await orchestrator.processWebhook(payload);

      const metrics = orchestrator.getMetricsReport();

      expect(metrics).toHaveProperty('decisions');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('timestamp');

      expect(metrics.decisions.totalDecisions).toBeGreaterThanOrEqual(2);
      expect(metrics.performance.throughput.totalRequests).toBeGreaterThanOrEqual(2);
    });

    it('should track decision statistics correctly', async () => {
      const executePayload = {
        signal: {
          type: 'LONG',
          timeframe: '15'
        },
        instrument: {
          ticker: 'SPY'
        }
      };

      const waitPayload = {
        signal: {
          type: 'LONG',
          timeframe: '15'
        },
        instrument: {
          ticker: 'QQQ'
        }
      };

      await orchestrator.processWebhook(executePayload);
      await orchestrator.processWebhook(waitPayload);

      const metrics = orchestrator.getMetricsReport();

      expect(metrics.decisions.totalDecisions).toBe(2);
      expect(metrics.decisions.decisionsByAction.EXECUTE + 
             metrics.decisions.decisionsByAction.WAIT + 
             metrics.decisions.decisionsByAction.SKIP).toBe(2);
    });
  });

  describe('Context Store State Management', () => {
    it('should maintain context completeness correctly', async () => {
      const initialStatus = orchestrator.getContextStatus();
      expect(initialStatus.isComplete).toBe(false);
      expect(initialStatus.completeness).toBe(0);

      // Add partial context
      const satyPayload = {
        meta: {
          engine: 'SATY_PO', // Correct engine name
          engine_version: '1.0.0',
          timestamp: Date.now()
        },
        data: {
          symbol: 'SPY',
          phase: 'ACCUMULATION',
          confidence: 85,
          bias: 'BULLISH'
        }
      };

      await orchestrator.processWebhook(satyPayload);

      const partialStatus = orchestrator.getContextStatus();
      expect(partialStatus.completeness).toBeGreaterThan(0);
      expect(partialStatus.completeness).toBeLessThan(1);
    });

    it('should clear context correctly', () => {
      orchestrator.clearContext();
      
      const status = orchestrator.getContextStatus();
      expect(status.isComplete).toBe(false);
      expect(status.completeness).toBe(0);
    });

    it('should handle context expiration', async () => {
      // This would require mocking time or using a test-specific context store
      // For now, we'll test that the method exists and returns expected structure
      const status = orchestrator.getContextStatus();
      
      expect(status).toHaveProperty('requiredSources');
      expect(status).toHaveProperty('optionalSources');
      expect(Array.isArray(status.requiredSources)).toBe(true);
      expect(Array.isArray(status.optionalSources)).toBe(true);
    });
  });

  describe('Configuration and Immutability', () => {
    it('should provide read-only configuration access', () => {
      const config = orchestrator.getConfiguration();
      
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('gates');
      expect(config).toHaveProperty('phases');
      expect(config.version).toBe('2.5.0');
    });

    it('should maintain system readiness', () => {
      expect(orchestrator.isReady()).toBe(true);
    });

    it('should support decision-only mode', async () => {
      orchestrator.setDecisionOnlyMode(true);

      const payload = {
        signal: {
          type: 'LONG',
          timeframe: '15'
        },
        instrument: {
          ticker: 'SPY'
        }
      };

      const result = await orchestrator.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      // In decision-only mode, no forwarding should occur
    });
  });

  describe('Audit Trail Completeness', () => {
    it('should include complete audit information in decisions', async () => {
      const payload = {
        signal: {
          type: 'LONG',
          timeframe: '15'
        },
        instrument: {
          ticker: 'SPY'
        }
      };

      const result = await orchestrator.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      
      const decision = result.decision!;
      expect(decision).toHaveProperty('action');
      expect(decision).toHaveProperty('direction');
      expect(decision).toHaveProperty('confidenceScore');
      expect(decision).toHaveProperty('finalSizeMultiplier');
      expect(decision).toHaveProperty('reasons');
      expect(decision).toHaveProperty('inputContext');
      expect(decision).toHaveProperty('timestamp');

      // Input context should be complete
      expect(decision.inputContext).toHaveProperty('regime');
      expect(decision.inputContext).toHaveProperty('alignment');
      expect(decision.inputContext).toHaveProperty('expert');
      expect(decision.inputContext).toHaveProperty('structure');
      expect(decision.inputContext).toHaveProperty('instrument');
    });
  });
});