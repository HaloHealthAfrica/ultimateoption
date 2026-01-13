/**
 * Tests for MetricsService
 * 
 * Validates metrics collection, performance tracking, and health status reporting.
 */

import { MetricsService } from '../services/metrics.service';
import { DecisionPacket, EngineAction } from '../types';

describe('MetricsService', () => {
  let metricsService: MetricsService;
  
  beforeEach(() => {
    metricsService = new MetricsService('test-config-hash');
  });

  describe('Constructor and Initial State', () => {
    it('should initialize with empty metrics', () => {
      const decisionMetrics = metricsService.getDecisionMetrics();
      
      expect(decisionMetrics.totalDecisions).toBe(0);
      expect(decisionMetrics.decisionsByAction.EXECUTE).toBe(0);
      expect(decisionMetrics.decisionsByAction.WAIT).toBe(0);
      expect(decisionMetrics.decisionsByAction.SKIP).toBe(0);
      expect(decisionMetrics.avgConfidenceScore).toBe(0);
      expect(decisionMetrics.avgProcessingTime).toBe(0);
    });

    it('should initialize with correct system metrics', () => {
      const systemMetrics = metricsService.getSystemMetrics();
      
      expect(systemMetrics.engineVersion).toBe('2.5.0');
      expect(systemMetrics.configHash).toBe('test-config-hash');
      expect(systemMetrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Decision Metrics Recording', () => {
    it('should record EXECUTE decisions correctly', () => {
      const decision: DecisionPacket = {
        action: 'EXECUTE' as EngineAction,
        direction: 'LONG',
        confidenceScore: 85,
        finalSizeMultiplier: 1.5,
        reasons: [],
        inputContext: {
          regime: { phase: 'ACCUMULATION', confidence: 80, timestamp: Date.now() },
          alignment: { mtfAlignment: 'BULLISH', strength: 75, timestamp: Date.now() },
          expert: { signal: 'LONG', quality: 'HIGH', aiScore: 8.5, timestamp: Date.now() },
          structure: { direction: 'LONG', confidence: 90, timestamp: Date.now() },
          instrument: { symbol: 'SPY', timestamp: Date.now() }
        },
        timestamp: Date.now()
      };

      metricsService.recordDecision(decision, 150);

      const metrics = metricsService.getDecisionMetrics();
      expect(metrics.totalDecisions).toBe(1);
      expect(metrics.decisionsByAction.EXECUTE).toBe(1);
      expect(metrics.decisionsBySymbol['SPY']).toBe(1);
      expect(metrics.avgConfidenceScore).toBe(85);
      expect(metrics.avgProcessingTime).toBe(150);
      expect(metrics.executeRate).toBe(1);
    });

    it('should record WAIT decisions with rejection reasons', () => {
      const decision: DecisionPacket = {
        action: 'WAIT' as EngineAction,
        direction: 'LONG',
        confidenceScore: 45,
        finalSizeMultiplier: 0,
        reasons: ['SPREAD_TOO_WIDE', 'LOW_CONFIDENCE'],
        inputContext: {
          regime: { phase: 'ACCUMULATION', confidence: 80, timestamp: Date.now() },
          alignment: { mtfAlignment: 'BULLISH', strength: 75, timestamp: Date.now() },
          expert: { signal: 'LONG', quality: 'MEDIUM', aiScore: 6.0, timestamp: Date.now() },
          structure: { direction: 'LONG', confidence: 50, timestamp: Date.now() },
          instrument: { symbol: 'QQQ', timestamp: Date.now() }
        },
        timestamp: Date.now()
      };

      metricsService.recordDecision(decision, 75);

      const metrics = metricsService.getDecisionMetrics();
      expect(metrics.totalDecisions).toBe(1);
      expect(metrics.decisionsByAction.WAIT).toBe(1);
      expect(metrics.gateRejectReasons['SPREAD_TOO_WIDE']).toBe(1);
      expect(metrics.gateRejectReasons['LOW_CONFIDENCE']).toBe(1);
      expect(metrics.waitRate).toBe(1);
    });

    it('should calculate averages correctly with multiple decisions', () => {
      const decisions = [
        { action: 'EXECUTE' as EngineAction, confidence: 80, processingTime: 100 },
        { action: 'WAIT' as EngineAction, confidence: 60, processingTime: 150 },
        { action: 'SKIP' as EngineAction, confidence: 30, processingTime: 50 }
      ];

      decisions.forEach((d, i) => {
        const decision: DecisionPacket = {
          action: d.action,
          direction: 'LONG',
          confidenceScore: d.confidence,
          finalSizeMultiplier: d.action === 'EXECUTE' ? 1.0 : 0,
          reasons: d.action !== 'EXECUTE' ? ['TEST_REASON'] : [],
          inputContext: {
            regime: { phase: 'ACCUMULATION', confidence: 80, timestamp: Date.now() },
            alignment: { mtfAlignment: 'BULLISH', strength: 75, timestamp: Date.now() },
            expert: { signal: 'LONG', quality: 'HIGH', aiScore: 8.0, timestamp: Date.now() },
            structure: { direction: 'LONG', confidence: 70, timestamp: Date.now() },
            instrument: { symbol: `TEST${i}`, timestamp: Date.now() }
          },
          timestamp: Date.now()
        };

        metricsService.recordDecision(decision, d.processingTime);
      });

      const metrics = metricsService.getDecisionMetrics();
      expect(metrics.totalDecisions).toBe(3);
      expect(metrics.avgConfidenceScore).toBeCloseTo((80 + 60 + 30) / 3, 1);
      expect(metrics.avgProcessingTime).toBeCloseTo((100 + 150 + 50) / 3, 1);
      expect(metrics.executeRate).toBeCloseTo(1/3, 2);
      expect(metrics.waitRate).toBeCloseTo(1/3, 2);
      expect(metrics.skipRate).toBeCloseTo(1/3, 2);
    });
  });

  describe('Performance Metrics Recording', () => {
    it('should record request metrics', () => {
      metricsService.recordRequest(100);
      metricsService.recordRequest(200);
      metricsService.recordRequest(150);

      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.throughput.totalRequests).toBe(3);
      expect(metrics.latency.average).toBeCloseTo(150, 1);
      expect(metrics.latency.min).toBe(100);
      expect(metrics.latency.max).toBe(200);
    });

    it('should record error metrics', () => {
      metricsService.recordError('ROUTING_ERROR');
      metricsService.recordError('VALIDATION_ERROR');
      metricsService.recordError('ROUTING_ERROR');

      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.errors.totalErrors).toBe(3);
      expect(metrics.errors.errorsByType['ROUTING_ERROR']).toBe(2);
      expect(metrics.errors.errorsByType['VALIDATION_ERROR']).toBe(1);
    });

    it('should record market feed performance', () => {
      metricsService.recordMarketFeed('tradier', true, 0.9);
      metricsService.recordMarketFeed('twelvedata', false);
      metricsService.recordMarketFeed('alpaca', true, 0.8);

      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.marketFeeds.tradierSuccess).toBe(1);
      expect(metrics.marketFeeds.twelveDataFailures).toBe(1);
      expect(metrics.marketFeeds.alpacaSuccess).toBe(1);
      expect(metrics.marketFeeds.avgCompleteness).toBeCloseTo(0.85, 2);
    });
  });

  describe('Health Status Assessment', () => {
    it('should report healthy status with good metrics', () => {
      // Record some good metrics with sufficient data
      for (let i = 0; i < 10; i++) {
        metricsService.recordRequest(50);
      }
      metricsService.recordMarketFeed('tradier', true, 0.95);
      metricsService.recordMarketFeed('twelvedata', true, 0.90);
      metricsService.recordMarketFeed('alpaca', true, 0.85);
      
      // Set good context store metrics to avoid penalty
      metricsService.updateContextStoreMetrics(0.95, 1000, 0);

      const health = metricsService.getHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.score).toBeGreaterThanOrEqual(90);
      expect(health.issues).toHaveLength(0);
    });

    it('should report degraded status with elevated error rate', () => {
      // Create a scenario that results in degraded status (score between 70-89)
      // Use 6% error rate (elevated but not high) with some other minor issues
      for (let i = 0; i < 17; i++) {
        metricsService.recordRequest(100);
      }
      metricsService.recordError('TEST_ERROR'); // 1/17 = 5.9% error rate
      
      // Set market feed completeness at 75% (reduced but not poor) to get -10 points
      metricsService.recordMarketFeed('tradier', true, 0.75);
      metricsService.updateContextStoreMetrics(0.95, 1000, 0);

      const health = metricsService.getHealthStatus();
      // Expected: 100 - 10 (elevated error rate) - 10 (reduced market feed) = 80 (degraded)
      expect(health.status).toBe('degraded');
      expect(health.score).toBeLessThan(90);
      expect(health.score).toBeGreaterThanOrEqual(70);
      expect(health.issues.some(issue => issue.includes('error rate'))).toBe(true);
    });

    it('should report unhealthy status with poor market feed completeness', () => {
      metricsService.recordMarketFeed('tradier', true, 0.3);
      metricsService.recordMarketFeed('twelvedata', true, 0.2);

      const health = metricsService.getHealthStatus();
      expect(health.status).toBe('unhealthy');
      expect(health.score).toBeLessThan(70);
      expect(health.issues.some(issue => issue.includes('market feed completeness'))).toBe(true);
    });
  });

  describe('Metrics Report', () => {
    it('should provide comprehensive metrics report', () => {
      // Add some test data
      const decision: DecisionPacket = {
        action: 'EXECUTE' as EngineAction,
        direction: 'LONG',
        confidenceScore: 75,
        finalSizeMultiplier: 1.2,
        reasons: [],
        inputContext: {
          regime: { phase: 'ACCUMULATION', confidence: 80, timestamp: Date.now() },
          alignment: { mtfAlignment: 'BULLISH', strength: 75, timestamp: Date.now() },
          expert: { signal: 'LONG', quality: 'HIGH', aiScore: 8.0, timestamp: Date.now() },
          structure: { direction: 'LONG', confidence: 70, timestamp: Date.now() },
          instrument: { symbol: 'SPY', timestamp: Date.now() }
        },
        timestamp: Date.now()
      };

      metricsService.recordDecision(decision, 120);
      metricsService.recordRequest(120);
      metricsService.recordMarketFeed('tradier', true, 0.9);

      const report = metricsService.getMetricsReport();
      
      expect(report).toHaveProperty('decisions');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('system');
      expect(report).toHaveProperty('timestamp');
      
      expect(report.decisions.totalDecisions).toBe(1);
      expect(report.performance.throughput.totalRequests).toBe(1);
      expect(report.system.engineVersion).toBe('2.5.0');
    });
  });

  describe('Context Store Integration', () => {
    it('should record context updates', () => {
      metricsService.recordContextUpdate();
      metricsService.recordContextUpdate();

      const systemMetrics = metricsService.getSystemMetrics();
      expect(systemMetrics.contextStore.totalUpdates).toBe(2);
    });

    it('should update context store metrics', () => {
      metricsService.updateContextStoreMetrics(0.85, 5000, 2);

      const systemMetrics = metricsService.getSystemMetrics();
      expect(systemMetrics.contextStore.completenessRate).toBe(0.85);
      expect(systemMetrics.contextStore.avgAge).toBe(5000);
      expect(systemMetrics.contextStore.expiredContexts).toBe(2);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      // Add some data
      const decision: DecisionPacket = {
        action: 'EXECUTE' as EngineAction,
        direction: 'LONG',
        confidenceScore: 75,
        finalSizeMultiplier: 1.0,
        reasons: [],
        inputContext: {
          regime: { phase: 'ACCUMULATION', confidence: 80, timestamp: Date.now() },
          alignment: { mtfAlignment: 'BULLISH', strength: 75, timestamp: Date.now() },
          expert: { signal: 'LONG', quality: 'HIGH', aiScore: 8.0, timestamp: Date.now() },
          structure: { direction: 'LONG', confidence: 70, timestamp: Date.now() },
          instrument: { symbol: 'SPY', timestamp: Date.now() }
        },
        timestamp: Date.now()
      };

      metricsService.recordDecision(decision, 100);
      metricsService.recordRequest(100);
      metricsService.recordError('TEST_ERROR');

      // Reset
      metricsService.reset();

      // Verify reset
      const decisionMetrics = metricsService.getDecisionMetrics();
      const performanceMetrics = metricsService.getPerformanceMetrics();

      expect(decisionMetrics.totalDecisions).toBe(0);
      expect(performanceMetrics.throughput.totalRequests).toBe(0);
      expect(performanceMetrics.errors.totalErrors).toBe(0);
    });
  });
});