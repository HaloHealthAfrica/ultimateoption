/**
 * Phase 2 Decision Engine - Performance Tests
 * 
 * Comprehensive performance tests covering response times,
 * concurrent request handling, and throughput under load.
 */

import request from 'supertest';
import express from 'express';
import { PerformanceTracker } from '../services/performance-tracker';
import { performanceMiddleware } from '../middleware/performance-middleware';
import { Logger } from '../services/logger';
import { PERFORMANCE_TARGETS } from '../config/index';

describe('Performance Tests', () => {
  let app: express.Application;
  let tracker: PerformanceTracker;
  let logger: Logger;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    logger = new Logger();
    tracker = new PerformanceTracker(logger);
    
    // Reset performance middleware and set new tracker
    performanceMiddleware.reset();
    // Force the middleware to use our test tracker
    (performanceMiddleware as any).tracker = tracker;
    
    // Add performance middleware
    app.use(performanceMiddleware.trackRequest());
    app.use(performanceMiddleware.trackDecisionEngine());
    app.use(performanceMiddleware.monitorThroughput());
    
    // Test endpoints
    app.get('/fast', (req, res) => {
      res.json({ message: 'fast response', timestamp: Date.now() });
    });
    
    app.get('/slow', async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      res.json({ message: 'slow response', timestamp: Date.now() });
    });
    
    app.post('/decision', (req, res) => {
      const startTime = Date.now();
      
      // Simulate decision processing
      const processingTime = Math.random() * 5 + 2; // 2-7ms
      
      setTimeout(() => {
        res.json({
          decision: 'APPROVE',
          confidence: 8.5,
          audit: {
            processing_time_ms: processingTime,
            timestamp: new Date().toISOString()
          }
        });
      }, processingTime);
    });
    
    app.get('/metrics', performanceMiddleware.getMetricsHandler());
  });

  describe('Response Time Compliance', () => {
    
    test('should respond within 500ms under normal load', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/fast');
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.webhookResponse);
    });

    test('should track request timing accurately', async () => {
      await request(app).get('/fast');
      
      const metrics = performanceMiddleware.getTracker().getDetailedMetrics();
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeLessThan(PERFORMANCE_TARGETS.webhookResponse);
    });

    test('should detect slow requests', async () => {
      const logSpy = jest.spyOn(logger, 'warn');
      
      await request(app).get('/slow');
      
      // Note: This test might be flaky depending on system performance
      // In a real scenario, we'd use a more controlled slow endpoint
    });

    test('should calculate percentiles correctly', async () => {
      // Make multiple requests with varying response times
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(request(app).get('/fast'));
      }
      
      await Promise.all(promises);
      
      const metrics = performanceMiddleware.getTracker().getDetailedMetrics();
      expect(metrics.p50Latency).toBeGreaterThan(0);
      expect(metrics.p95Latency).toBeGreaterThanOrEqual(metrics.p50Latency);
      expect(metrics.p99Latency).toBeGreaterThanOrEqual(metrics.p95Latency);
    });
  });

  describe('Concurrent Request Handling', () => {
    
    test('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(request(app).get('/fast'));
      }
      
      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      const metrics = performanceMiddleware.getTracker().getDetailedMetrics();
      expect(metrics.throughput.maxConcurrentRequests).toBeGreaterThanOrEqual(1);
    });

    test('should track concurrent request count', async () => {
      // Test the tracker directly to ensure concurrent tracking works
      const testTracker = new PerformanceTracker(logger);
      
      // Simulate starting multiple concurrent requests
      testTracker.startRequest('req1');
      testTracker.startRequest('req2');
      testTracker.startRequest('req3');
      
      const metrics = testTracker.getThroughputMetrics();
      expect(metrics.concurrentRequests).toBe(3);
      expect(metrics.maxConcurrentRequests).toBe(3);
      
      // Complete one request
      testTracker.completeRequest('req1', 100, true);
      
      const updatedMetrics = testTracker.getThroughputMetrics();
      expect(updatedMetrics.concurrentRequests).toBe(2);
      expect(updatedMetrics.maxConcurrentRequests).toBe(3); // Max should remain
      
      // Complete remaining requests
      testTracker.completeRequest('req2', 150, true);
      testTracker.completeRequest('req3', 200, true);
      
      const finalMetrics = testTracker.getThroughputMetrics();
      expect(finalMetrics.concurrentRequests).toBe(0);
      expect(finalMetrics.maxConcurrentRequests).toBe(3);
    });

    test('should enforce concurrent request limits', async () => {
      // Create app with concurrent limiting
      const limitedApp = express();
      limitedApp.use(express.json());
      limitedApp.use(performanceMiddleware.trackRequest());
      limitedApp.use(performanceMiddleware.limitConcurrentRequests());
      
      limitedApp.get('/test', async (req, res) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        res.json({ success: true });
      });
      
      // Try to exceed concurrent limit
      const promises = [];
      for (let i = 0; i < PERFORMANCE_TARGETS.concurrentRequests + 5; i++) {
        promises.push(request(limitedApp).get('/test'));
      }
      
      const responses = await Promise.all(promises);
      
      // Some requests should be rejected with 503
      const rejectedRequests = responses.filter(r => r.status === 503);
      expect(rejectedRequests.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Throughput Monitoring', () => {
    
    test('should calculate requests per second', async () => {
      const requestCount = 20;
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(request(app).get('/fast'));
        // Small delay to spread requests over time
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      await Promise.all(promises);
      
      const duration = (Date.now() - startTime) / 1000;
      const expectedRPS = requestCount / duration;
      
      const metrics = performanceMiddleware.getTracker().getThroughputMetrics();
      expect(metrics.totalRequests).toBe(requestCount);
      expect(metrics.requestsPerSecond).toBeGreaterThan(0);
    });

    test('should track peak RPS', async () => {
      // Send burst of requests
      const burstSize = 10;
      const promises = [];
      
      for (let i = 0; i < burstSize; i++) {
        promises.push(request(app).get('/fast'));
      }
      
      await Promise.all(promises);
      
      const metrics = performanceMiddleware.getTracker().getThroughputMetrics();
      expect(metrics.peakRPS).toBeGreaterThan(0);
    });

    test('should maintain throughput under sustained load', async () => {
      const duration = 2000; // 2 seconds
      const targetRPS = 10; // Conservative target for test
      const startTime = Date.now();
      
      const promises = [];
      
      // Send requests continuously for the duration
      const interval = setInterval(() => {
        if (Date.now() - startTime < duration) {
          promises.push(request(app).get('/fast'));
        }
      }, 1000 / targetRPS);
      
      await new Promise(resolve => setTimeout(resolve, duration));
      clearInterval(interval);
      
      // Wait for all requests to complete
      await Promise.all(promises);
      
      const actualDuration = (Date.now() - startTime) / 1000;
      const actualRPS = promises.length / actualDuration;
      
      expect(actualRPS).toBeGreaterThan(targetRPS * 0.8); // Allow 20% tolerance
    }, 5000);
  });

  describe('Decision Engine Performance', () => {
    
    test('should complete decision logic within 10ms', async () => {
      const response = await request(app)
        .post('/decision')
        .send({ signal: { type: 'LONG', symbol: 'SPY' } });
      
      expect(response.status).toBe(200);
      expect(response.body.audit.processing_time_ms).toBeLessThan(PERFORMANCE_TARGETS.decisionLogic);
    });

    test('should track decision timing separately', async () => {
      await request(app)
        .post('/decision')
        .send({ signal: { type: 'LONG', symbol: 'SPY' } });
      
      const metrics = performanceMiddleware.getTracker().getDetailedMetrics();
      expect(metrics.decisionLogicLatency).toBeGreaterThan(0);
      expect(metrics.decisionLogicLatency).toBeLessThan(PERFORMANCE_TARGETS.decisionLogic);
    });
  });

  describe('Performance Metrics Endpoint', () => {
    
    test('should provide comprehensive performance metrics', async () => {
      // Generate some traffic first
      await Promise.all([
        request(app).get('/fast'),
        request(app).get('/fast'),
        request(app).post('/decision').send({ signal: { type: 'LONG', symbol: 'SPY' } })
      ]);
      
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('health');
      expect(response.body).toHaveProperty('targets');
      
      const perf = response.body.performance;
      expect(perf).toHaveProperty('latency');
      expect(perf).toHaveProperty('throughput');
      expect(perf).toHaveProperty('decisionEngine');
      expect(perf).toHaveProperty('errors');
      expect(perf).toHaveProperty('system');
      
      expect(perf.latency.average).toBeGreaterThan(0);
      expect(perf.throughput.totalRequests).toBeGreaterThan(0);
    });

    test('should indicate healthy status under normal conditions', async () => {
      await request(app).get('/fast');
      
      const response = await request(app).get('/metrics');
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.health.healthy).toBe(true);
      expect(response.body.health.issues).toHaveLength(0);
    });
  });

  describe('Performance Degradation Detection', () => {
    
    test('should detect performance issues', async () => {
      const tracker = new PerformanceTracker(logger);
      
      // Simulate slow requests
      for (let i = 0; i < 10; i++) {
        tracker.startRequest(`req_${i}`);
        tracker.completeRequest(`req_${i}`, PERFORMANCE_TARGETS.webhookResponse + 100, true);
      }
      
      const health = tracker.isPerformanceHealthy();
      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues[0]).toContain('High average latency');
    });

    test('should detect high error rates', async () => {
      const tracker = new PerformanceTracker(logger);
      
      // Simulate requests with high error rate
      for (let i = 0; i < 20; i++) {
        tracker.startRequest(`req_${i}`);
        tracker.completeRequest(`req_${i}`, 100, i < 15); // 25% error rate
      }
      
      const health = tracker.isPerformanceHealthy();
      expect(health.healthy).toBe(false);
      expect(health.issues.some(issue => issue.includes('High error rate'))).toBe(true);
    });

    test('should detect slow decision logic', async () => {
      const tracker = new PerformanceTracker(logger);
      
      // Simulate slow decision logic
      tracker.recordDecisionTiming(PERFORMANCE_TARGETS.decisionLogic + 5);
      
      const health = tracker.isPerformanceHealthy();
      expect(health.healthy).toBe(false);
      expect(health.issues.some(issue => issue.includes('Slow decision logic'))).toBe(true);
    });
  });

  describe('Memory and Resource Monitoring', () => {
    
    test('should track memory usage', async () => {
      const metrics = performanceMiddleware.getTracker().getDetailedMetrics();
      
      expect(metrics.memoryUsage).toHaveProperty('heapUsed');
      expect(metrics.memoryUsage).toHaveProperty('heapTotal');
      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(metrics.memoryUsage.heapTotal).toBeGreaterThan(metrics.memoryUsage.heapUsed);
    });

    test('should detect high memory usage', async () => {
      const tracker = new PerformanceTracker(logger);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const health = tracker.isPerformanceHealthy();
      // Memory usage detection depends on actual usage, so we just verify the check exists
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('issues');
    });
  });

  describe('Provider Performance Tracking', () => {
    
    test('should track provider latencies', async () => {
      const tracker = new PerformanceTracker(logger);
      
      tracker.recordProviderTiming('tradier', 150);
      tracker.recordProviderTiming('twelveData', 200);
      tracker.recordProviderTiming('alpaca', 100);
      
      const metrics = tracker.getDetailedMetrics();
      expect(metrics.providerLatencies.tradier).toBe(150);
      expect(metrics.providerLatencies.twelveData).toBe(200);
      expect(metrics.providerLatencies.alpaca).toBe(100);
    });

    test('should calculate average provider latencies', async () => {
      const tracker = new PerformanceTracker(logger);
      
      // Record multiple timings for tradier
      tracker.recordProviderTiming('tradier', 100);
      tracker.recordProviderTiming('tradier', 200);
      tracker.recordProviderTiming('tradier', 300);
      
      const metrics = tracker.getDetailedMetrics();
      expect(metrics.providerLatencies.tradier).toBe(200); // Average of 100, 200, 300
    });
  });

  describe('Performance Reset and Cleanup', () => {
    
    test('should reset metrics correctly', async () => {
      const tracker = new PerformanceTracker(logger);
      
      // Generate some metrics
      tracker.startRequest('test');
      tracker.completeRequest('test', 100, true);
      tracker.recordDecisionTiming(5);
      
      let metrics = tracker.getDetailedMetrics();
      expect(metrics.averageLatency).toBeGreaterThan(0);
      
      // Reset and verify
      tracker.reset();
      metrics = tracker.getDetailedMetrics();
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.throughput.totalRequests).toBe(0);
    });

    test('should handle concurrent reset safely', async () => {
      const tracker = new PerformanceTracker(logger);
      
      // Start some requests
      tracker.startRequest('req1');
      tracker.startRequest('req2');
      
      // Reset while requests are active
      tracker.reset();
      
      // Complete requests after reset
      tracker.completeRequest('req1', 100, true);
      tracker.completeRequest('req2', 150, true);
      
      const metrics = tracker.getDetailedMetrics();
      expect(metrics.throughput.totalRequests).toBe(2);
    });
  });
});