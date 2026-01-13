/**
 * Phase 2 Decision Engine - Performance Monitoring Middleware
 * 
 * Middleware for tracking request performance, concurrent load,
 * and throughput metrics across all endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { PerformanceTracker } from '../services/performance-tracker';
import { Logger } from '../services/logger';
import { PERFORMANCE_TARGETS } from '../config/index';

export class PerformanceMiddleware {
  private static instance: PerformanceMiddleware;
  private tracker: PerformanceTracker;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger();
    this.tracker = new PerformanceTracker(this.logger);
  }

  static getInstance(): PerformanceMiddleware {
    if (!PerformanceMiddleware.instance) {
      PerformanceMiddleware.instance = new PerformanceMiddleware();
    }
    return PerformanceMiddleware.instance;
  }

  /**
   * Get the performance tracker instance
   */
  getTracker(): PerformanceTracker {
    return this.tracker;
  }

  /**
   * Middleware for tracking request performance
   */
  trackRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId = (req as any).requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = process.hrtime.bigint();
      
      // Start tracking this request
      this.tracker.startRequest(requestId);
      
      // Add performance context to request
      (req as any).performanceContext = {
        requestId,
        startTime,
        tracker: this.tracker
      };

      // Track when response finishes
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const success = res.statusCode < 400;
        
        // Complete request tracking
        this.tracker.completeRequest(requestId, duration, success);
        
        // Log performance details
        this.logger.info('Request performance', {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
          success,
          concurrent: this.tracker.getThroughputMetrics().concurrentRequests
        });
      });

      // Track timeouts
      res.on('timeout', () => {
        this.tracker.recordTimeout();
        this.logger.warn('Request timeout', {
          requestId,
          method: req.method,
          path: req.path
        });
      });

      next();
    };
  }

  /**
   * Middleware for tracking decision engine performance
   */
  trackDecisionEngine() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      
      res.send = function(body: unknown) {
        // Extract decision timing from response if available
        if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            if (parsed.audit && parsed.audit.processing_time_ms) {
              const performanceContext = (req as any).performanceContext;
              if (performanceContext) {
                performanceContext.tracker.recordDecisionTiming(parsed.audit.processing_time_ms);
              }
            }
          } catch (e) {
            // Ignore JSON parsing errors
          }
        }
        
        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Middleware for concurrent request limiting
   */
  limitConcurrentRequests() {
    return (req: Request, res: Response, next: NextFunction) => {
      const currentConcurrent = this.tracker.getThroughputMetrics().concurrentRequests;
      
      if (currentConcurrent >= PERFORMANCE_TARGETS.concurrentRequests) {
        this.logger.warn('Concurrent request limit exceeded', {
          current: currentConcurrent,
          limit: PERFORMANCE_TARGETS.concurrentRequests,
          method: req.method,
          path: req.path,
          ip: req.ip
        });
        
        res.status(503).json({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Server is at maximum capacity. Please try again later.',
          details: {
            concurrentRequests: currentConcurrent,
            maxConcurrent: PERFORMANCE_TARGETS.concurrentRequests
          }
        });
        return;
      }
      
      next();
    };
  }

  /**
   * Middleware for throughput monitoring and alerting
   */
  monitorThroughput() {
    return (req: Request, res: Response, next: NextFunction) => {
      const throughput = this.tracker.getThroughputMetrics();
      
      // Alert on high throughput
      if (throughput.requestsPerSecond > PERFORMANCE_TARGETS.requestsPerSecond * 0.8) {
        this.logger.warn('High throughput detected', {
          currentRPS: throughput.requestsPerSecond,
          targetRPS: PERFORMANCE_TARGETS.requestsPerSecond,
          utilization: (throughput.requestsPerSecond / PERFORMANCE_TARGETS.requestsPerSecond * 100).toFixed(1) + '%',
          peakRPS: throughput.peakRPS
        });
      }
      
      next();
    };
  }

  /**
   * Get performance metrics endpoint handler
   */
  getMetricsHandler() {
    return (req: Request, res: Response) => {
      const summary = this.tracker.getPerformanceSummary();
      
      res.json({
        timestamp: new Date().toISOString(),
        status: summary.status,
        performance: {
          latency: {
            average: Math.round(summary.metrics.averageLatency * 100) / 100,
            p50: Math.round(summary.metrics.p50Latency * 100) / 100,
            p95: Math.round(summary.metrics.p95Latency * 100) / 100,
            p99: Math.round(summary.metrics.p99Latency * 100) / 100,
            min: Math.round(summary.metrics.minLatency * 100) / 100,
            max: Math.round(summary.metrics.maxLatency * 100) / 100
          },
          throughput: {
            currentRPS: Math.round(summary.metrics.throughput.requestsPerSecond * 100) / 100,
            peakRPS: summary.metrics.throughput.peakRPS,
            averageRPS: Math.round(summary.metrics.throughput.averageRPS * 100) / 100,
            concurrentRequests: summary.metrics.throughput.concurrentRequests,
            maxConcurrent: summary.metrics.throughput.maxConcurrentRequests,
            totalRequests: summary.metrics.throughput.totalRequests
          },
          decisionEngine: {
            averageDecisionTime: Math.round(summary.metrics.decisionLogicLatency * 100) / 100,
            averageMarketContextTime: Math.round(summary.metrics.marketContextLatency * 100) / 100
          },
          errors: {
            errorRate: Math.round(summary.metrics.errorRate * 10000) / 100, // Percentage with 2 decimals
            timeoutRate: Math.round(summary.metrics.timeoutRate * 10000) / 100
          },
          providers: {
            tradier: Math.round(summary.metrics.providerLatencies.tradier * 100) / 100,
            twelveData: Math.round(summary.metrics.providerLatencies.twelveData * 100) / 100,
            alpaca: Math.round(summary.metrics.providerLatencies.alpaca * 100) / 100
          },
          system: {
            memoryUsageMB: Math.round(summary.metrics.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
            memoryLimitMB: Math.round(summary.metrics.memoryUsage.heapTotal / 1024 / 1024 * 100) / 100
          }
        },
        health: summary.health,
        targets: {
          maxLatency: PERFORMANCE_TARGETS.webhookResponse,
          maxDecisionTime: PERFORMANCE_TARGETS.decisionLogic,
          maxRPS: PERFORMANCE_TARGETS.requestsPerSecond,
          maxConcurrent: PERFORMANCE_TARGETS.concurrentRequests
        }
      });
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.tracker.reset();
  }
}

// Export singleton instance
export const performanceMiddleware = PerformanceMiddleware.getInstance();