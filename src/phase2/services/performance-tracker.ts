/**
 * Phase 2 Decision Engine - Advanced Performance Tracker
 * 
 * Enhanced performance monitoring with concurrent request tracking,
 * throughput monitoring, and detailed metrics collection.
 */

import { Logger } from './logger';
import { PERFORMANCE_TARGETS } from '../config';

export interface ThroughputMetrics {
  requestsPerSecond: number;
  peakRPS: number;
  averageRPS: number;
  concurrentRequests: number;
  maxConcurrentRequests: number;
  totalRequests: number;
  windowStartTime: number;
}

export interface DetailedPerformanceMetrics {
  // Latency metrics
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  
  // Throughput metrics
  throughput: ThroughputMetrics;
  
  // Decision engine specific metrics
  decisionLogicLatency: number;
  marketContextLatency: number;
  
  // Error metrics
  errorRate: number;
  timeoutRate: number;
  
  // Provider metrics
  providerLatencies: {
    tradier: number;
    twelveData: number;
    alpaca: number;
  };
  
  // System metrics
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
}

export class PerformanceTracker {
  private logger: Logger;
  private requestTimes: number[] = [];
  private decisionTimes: number[] = [];
  private marketContextTimes: number[] = [];
  private providerTimes: Map<string, number[]> = new Map();
  
  // Concurrent request tracking
  private activeRequests: Set<string> = new Set();
  private maxConcurrent = 0;
  
  // Throughput tracking
  private requestTimestamps: number[] = [];
  private windowSize = 60000; // 1 minute window
  private maxSamples = 10000; // Keep last 10k samples
  
  // Error tracking
  private errorCount = 0;
  private timeoutCount = 0;
  private totalRequests = 0;
  
  constructor(logger: Logger) {
    this.logger = logger;
    
    // Initialize provider time arrays
    this.providerTimes.set('tradier', []);
    this.providerTimes.set('twelveData', []);
    this.providerTimes.set('alpaca', []);
  }

  /**
   * Start tracking a request
   */
  startRequest(requestId: string): void {
    this.activeRequests.add(requestId);
    this.maxConcurrent = Math.max(this.maxConcurrent, this.activeRequests.size);
    
    // Log if approaching concurrent limit
    if (this.activeRequests.size > PERFORMANCE_TARGETS.concurrentRequests * 0.8) {
      this.logger.warn('High concurrent request load', {
        current: this.activeRequests.size,
        max: PERFORMANCE_TARGETS.concurrentRequests,
        utilization: (this.activeRequests.size / PERFORMANCE_TARGETS.concurrentRequests * 100).toFixed(1) + '%'
      });
    }
  }

  /**
   * Complete tracking a request
   */
  completeRequest(requestId: string, duration: number, success: boolean = true): void {
    this.activeRequests.delete(requestId);
    this.totalRequests++;
    
    // Record request timing
    this.requestTimes.push(duration);
    this.requestTimestamps.push(Date.now());
    
    // Maintain sample size limits
    if (this.requestTimes.length > this.maxSamples) {
      this.requestTimes.shift();
    }
    
    if (this.requestTimestamps.length > this.maxSamples) {
      this.requestTimestamps.shift();
    }
    
    // Track errors
    if (!success) {
      this.errorCount++;
    }
    
    // Check performance thresholds
    if (duration > PERFORMANCE_TARGETS.webhookResponse) {
      this.logger.warn('Slow request detected', {
        requestId,
        duration,
        threshold: PERFORMANCE_TARGETS.webhookResponse,
        slowBy: duration - PERFORMANCE_TARGETS.webhookResponse
      });
    }
  }

  /**
   * Record decision engine timing
   */
  recordDecisionTiming(duration: number): void {
    this.decisionTimes.push(duration);
    
    if (this.decisionTimes.length > 1000) {
      this.decisionTimes.shift();
    }
    
    // Check decision logic performance
    if (duration > PERFORMANCE_TARGETS.decisionLogic) {
      this.logger.warn('Slow decision logic', {
        duration,
        threshold: PERFORMANCE_TARGETS.decisionLogic,
        slowBy: duration - PERFORMANCE_TARGETS.decisionLogic
      });
    }
  }

  /**
   * Record market context building timing
   */
  recordMarketContextTiming(duration: number): void {
    this.marketContextTimes.push(duration);
    
    if (this.marketContextTimes.length > 1000) {
      this.marketContextTimes.shift();
    }
  }

  /**
   * Record provider timing
   */
  recordProviderTiming(provider: string, duration: number): void {
    const times = this.providerTimes.get(provider);
    if (times) {
      times.push(duration);
      
      if (times.length > 1000) {
        times.shift();
      }
    }
  }

  /**
   * Record timeout
   */
  recordTimeout(): void {
    this.timeoutCount++;
  }

  /**
   * Get current throughput metrics
   */
  getThroughputMetrics(): ThroughputMetrics {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    // Filter requests within the current window
    const recentRequests = this.requestTimestamps.filter(timestamp => timestamp >= windowStart);
    
    const currentRPS = recentRequests.length / (this.windowSize / 1000);
    
    // Calculate peak RPS (highest RPS in any 1-second window within the minute)
    let peakRPS = 0;
    for (let i = 0; i < 60; i++) {
      const secondStart = now - (i * 1000);
      const secondEnd = secondStart + 1000;
      const requestsInSecond = this.requestTimestamps.filter(
        timestamp => timestamp >= secondStart && timestamp < secondEnd
      ).length;
      peakRPS = Math.max(peakRPS, requestsInSecond);
    }
    
    return {
      requestsPerSecond: currentRPS,
      peakRPS,
      averageRPS: this.totalRequests > 0 ? this.totalRequests / ((now - (this.requestTimestamps[0] || now)) / 1000) : 0,
      concurrentRequests: this.activeRequests.size,
      maxConcurrentRequests: this.maxConcurrent,
      totalRequests: this.totalRequests,
      windowStartTime: windowStart
    };
  }

  /**
   * Get detailed performance metrics
   */
  getDetailedMetrics(): DetailedPerformanceMetrics {
    const sortedTimes = [...this.requestTimes].sort((a, b) => a - b);
    const throughput = this.getThroughputMetrics();
    
    return {
      // Latency metrics
      averageLatency: this.calculateAverage(this.requestTimes),
      p50Latency: this.calculatePercentile(sortedTimes, 0.5),
      p95Latency: this.calculatePercentile(sortedTimes, 0.95),
      p99Latency: this.calculatePercentile(sortedTimes, 0.99),
      minLatency: Math.min(...this.requestTimes) || 0,
      maxLatency: Math.max(...this.requestTimes) || 0,
      
      // Throughput metrics
      throughput,
      
      // Decision engine specific metrics
      decisionLogicLatency: this.calculateAverage(this.decisionTimes),
      marketContextLatency: this.calculateAverage(this.marketContextTimes),
      
      // Error metrics
      errorRate: this.totalRequests > 0 ? this.errorCount / this.totalRequests : 0,
      timeoutRate: this.totalRequests > 0 ? this.timeoutCount / this.totalRequests : 0,
      
      // Provider metrics
      providerLatencies: {
        tradier: this.calculateAverage(this.providerTimes.get('tradier') || []),
        twelveData: this.calculateAverage(this.providerTimes.get('twelveData') || []),
        alpaca: this.calculateAverage(this.providerTimes.get('alpaca') || [])
      },
      
      // System metrics
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage().user / 1000000 // Convert to milliseconds
    };
  }

  /**
   * Check if performance is within acceptable limits
   */
  isPerformanceHealthy(): { healthy: boolean; issues: string[] } {
    const metrics = this.getDetailedMetrics();
    const issues: string[] = [];
    
    // Check latency thresholds
    if (metrics.averageLatency > PERFORMANCE_TARGETS.webhookResponse) {
      issues.push(`High average latency: ${metrics.averageLatency.toFixed(1)}ms (target: ${PERFORMANCE_TARGETS.webhookResponse}ms)`);
    }
    
    if (metrics.p95Latency > PERFORMANCE_TARGETS.webhookResponse * 1.5) {
      issues.push(`High P95 latency: ${metrics.p95Latency.toFixed(1)}ms (target: ${PERFORMANCE_TARGETS.webhookResponse * 1.5}ms)`);
    }
    
    if (metrics.decisionLogicLatency > PERFORMANCE_TARGETS.decisionLogic) {
      issues.push(`Slow decision logic: ${metrics.decisionLogicLatency.toFixed(1)}ms (target: ${PERFORMANCE_TARGETS.decisionLogic}ms)`);
    }
    
    // Check throughput
    if (metrics.throughput.requestsPerSecond > PERFORMANCE_TARGETS.requestsPerSecond * 0.9) {
      issues.push(`High RPS load: ${metrics.throughput.requestsPerSecond.toFixed(1)} (target: ${PERFORMANCE_TARGETS.requestsPerSecond})`);
    }
    
    if (metrics.throughput.concurrentRequests > PERFORMANCE_TARGETS.concurrentRequests * 0.9) {
      issues.push(`High concurrent load: ${metrics.throughput.concurrentRequests} (target: ${PERFORMANCE_TARGETS.concurrentRequests})`);
    }
    
    // Check error rates
    if (metrics.errorRate > 0.05) {
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}% (target: <5%)`);
    }
    
    if (metrics.timeoutRate > 0.02) {
      issues.push(`High timeout rate: ${(metrics.timeoutRate * 100).toFixed(1)}% (target: <2%)`);
    }
    
    // Check memory usage
    const memoryUsageMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 512) {
      issues.push(`High memory usage: ${memoryUsageMB.toFixed(1)}MB (warning: >512MB)`);
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.requestTimes = [];
    this.decisionTimes = [];
    this.marketContextTimes = [];
    this.providerTimes.clear();
    this.providerTimes.set('tradier', []);
    this.providerTimes.set('twelveData', []);
    this.providerTimes.set('alpaca', []);
    
    this.activeRequests.clear();
    this.maxConcurrent = 0;
    this.requestTimestamps = [];
    this.errorCount = 0;
    this.timeoutCount = 0;
    this.totalRequests = 0;
  }

  /**
   * Get performance summary for monitoring
   */
  getPerformanceSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: DetailedPerformanceMetrics;
    health: { healthy: boolean; issues: string[] };
  } {
    const metrics = this.getDetailedMetrics();
    const health = this.isPerformanceHealthy();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (health.issues.length > 0) {
      // Determine severity based on issues
      const criticalIssues = health.issues.filter(issue => 
        issue.includes('High error rate') || 
        issue.includes('High timeout rate') ||
        issue.includes('Slow decision logic')
      );
      
      status = criticalIssues.length > 0 ? 'critical' : 'warning';
    }
    
    return { status, metrics, health };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.floor(sortedValues.length * percentile);
    return sortedValues[index] || 0;
  }
}