/**
 * Phase 2 Decision Engine - Performance Monitor Tests
 * 
 * Unit tests for performance monitoring and metrics collection.
 */

import { PerformanceMonitor } from '../services/performance-monitor';
import { Logger } from '../services/logger';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('error'); // Suppress logs during tests
    performanceMonitor = new PerformanceMonitor(logger);
  });

  describe('Request Recording', () => {
    test('should record successful requests', () => {
      performanceMonitor.recordRequest(100, true);
      performanceMonitor.recordRequest(150, true);
      performanceMonitor.recordRequest(200, true);

      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.requestCount).toBe(3);
      expect(metrics.averageLatency).toBe(150); // (100 + 150 + 200) / 3
      expect(metrics.errorRate).toBe(0);
    });

    test('should calculate P95 latency correctly', () => {
      // Add 100 requests with known distribution
      for (let i = 1; i <= 100; i++) {
        performanceMonitor.recordRequest(i * 10, true); // 10ms, 20ms, ..., 1000ms
      }

      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.requestCount).toBe(100);
      expect(metrics.p95Latency).toBe(960); // 95th percentile of 10-1000ms range
    });

    test('should track error rate', () => {
      // Record some successful and failed requests
      performanceMonitor.recordRequest(100, true);
      performanceMonitor.recordRequest(150, false); // Error
      performanceMonitor.recordRequest(200, true);
      performanceMonitor.recordRequest(250, false); // Error

      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.requestCount).toBe(4);
      expect(metrics.errorRate).toBeGreaterThan(0);
    });

    test('should limit stored request times', () => {
      // Add more than maxSamples (1000) requests
      for (let i = 0; i < 1200; i++) {
        performanceMonitor.recordRequest(100, true);
      }

      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.requestCount).toBe(1200);
      expect(metrics.averageLatency).toBe(100);
    });
  });

  describe('Provider Failure Tracking', () => {
    test('should record provider failures', () => {
      performanceMonitor.recordProviderFailure('tradier');
      performanceMonitor.recordProviderFailure('twelveData');

      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.providerFailureRates.tradier).toBe(0.01);
      expect(metrics.providerFailureRates.twelveData).toBe(0.01);
      expect(metrics.providerFailureRates.alpaca).toBe(0);
    });

    test('should record provider successes', () => {
      // First record some failures
      performanceMonitor.recordProviderFailure('tradier');
      performanceMonitor.recordProviderFailure('tradier');
      
      let metrics = performanceMonitor.getMetrics();
      expect(metrics.providerFailureRates.tradier).toBe(0.02);

      // Then record successes
      performanceMonitor.recordProviderSuccess('tradier');
      performanceMonitor.recordProviderSuccess('tradier');
      
      metrics = performanceMonitor.getMetrics();
      expect(metrics.providerFailureRates.tradier).toBeCloseTo(0.01, 2); // 0.02 - 0.005 - 0.005
    });

    test('should cap failure rates at 100%', () => {
      // Record many failures
      for (let i = 0; i < 200; i++) {
        performanceMonitor.recordProviderFailure('alpaca');
      }

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.providerFailureRates.alpaca).toBe(1.0); // Capped at 100%
    });

    test('should not go below 0% on successes', () => {
      // Record successes without prior failures
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordProviderSuccess('tradier');
      }

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.providerFailureRates.tradier).toBe(0); // Cannot go below 0%
    });
  });

  describe('Health Assessment', () => {
    test('should report healthy performance', () => {
      // Record good performance
      performanceMonitor.recordRequest(100, true);
      performanceMonitor.recordRequest(150, true);
      performanceMonitor.recordRequest(200, true);

      expect(performanceMonitor.isPerformanceHealthy()).toBe(true);
    });

    test('should detect high latency issues', () => {
      // Record high latency requests
      performanceMonitor.recordRequest(1000, true); // Above 500ms threshold
      performanceMonitor.recordRequest(1200, true);
      performanceMonitor.recordRequest(800, true);

      expect(performanceMonitor.isPerformanceHealthy()).toBe(false);
    });

    test('should detect high error rate', () => {
      // Record high error rate
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordRequest(100, false); // All errors
      }

      expect(performanceMonitor.isPerformanceHealthy()).toBe(false);
    });

    test('should detect provider failures', () => {
      // Record high provider failure rate
      for (let i = 0; i < 20; i++) {
        performanceMonitor.recordProviderFailure('tradier');
      }

      expect(performanceMonitor.isPerformanceHealthy()).toBe(false);
    });
  });

  describe('Health Summary', () => {
    test('should provide detailed health summary', () => {
      performanceMonitor.recordRequest(100, true);
      performanceMonitor.recordRequest(150, true);

      const summary = performanceMonitor.getHealthSummary();
      
      expect(summary.healthy).toBe(true);
      expect(summary.metrics).toBeDefined();
      expect(summary.issues).toEqual([]);
      expect(summary.metrics.requestCount).toBe(2);
    });

    test('should identify specific performance issues', () => {
      // Create high latency
      performanceMonitor.recordRequest(1000, true);
      performanceMonitor.recordRequest(1200, true);
      
      // Create provider failures
      for (let i = 0; i < 15; i++) {
        performanceMonitor.recordProviderFailure('alpaca');
      }

      const summary = performanceMonitor.getHealthSummary();
      
      expect(summary.healthy).toBe(false);
      expect(summary.issues.length).toBeGreaterThan(0);
      expect(summary.issues.some(issue => issue.includes('latency'))).toBe(true);
      expect(summary.issues.some(issue => issue.includes('alpaca'))).toBe(true);
    });
  });

  describe('Reset Functionality', () => {
    test('should reset all metrics', () => {
      // Record some data
      performanceMonitor.recordRequest(100, true);
      performanceMonitor.recordProviderFailure('tradier');
      
      let metrics = performanceMonitor.getMetrics();
      expect(metrics.requestCount).toBe(1);
      expect(metrics.providerFailureRates.tradier).toBe(0.01);

      // Reset
      performanceMonitor.reset();
      
      metrics = performanceMonitor.getMetrics();
      expect(metrics.requestCount).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.providerFailureRates.tradier).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero requests gracefully', () => {
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.requestCount).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.p95Latency).toBe(0);
    });

    test('should handle single request', () => {
      performanceMonitor.recordRequest(250, true);
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.requestCount).toBe(1);
      expect(metrics.averageLatency).toBe(250);
      expect(metrics.p95Latency).toBe(250);
    });
  });
});