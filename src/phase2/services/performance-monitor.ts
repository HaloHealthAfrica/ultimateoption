/**
 * Phase 2 Decision Engine - Performance Monitor
 * 
 * Tracks and reports performance metrics for the decision engine.
 */

import { Logger } from './logger';
import { PERFORMANCE_TARGETS } from '../config/index';
import { PerformanceMetrics } from '../types';

export class PerformanceMonitor {
  private logger: Logger;
  private metrics: PerformanceMetrics;
  private requestTimes: number[] = [];
  private maxSamples = 1000; // Keep last 1000 request times for calculations

  constructor(logger: Logger) {
    this.logger = logger;
    this.metrics = {
      requestCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      errorRate: 0,
      providerFailureRates: {
        tradier: 0,
        twelveData: 0,
        alpaca: 0
      }
    };
  }

  /**
   * Record a request completion
   */
  recordRequest(duration: number, success: boolean = true): void {
    this.metrics.requestCount++;
    
    // Add to request times array
    this.requestTimes.push(duration);
    
    // Keep only the last maxSamples
    if (this.requestTimes.length > this.maxSamples) {
      this.requestTimes.shift();
    }

    // Update metrics
    this.updateLatencyMetrics();

    // Log performance warnings
    if (duration > PERFORMANCE_TARGETS.webhookResponse) {
      this.logger.warn('Slow request detected', {
        duration,
        threshold: PERFORMANCE_TARGETS.webhookResponse,
        requestCount: this.metrics.requestCount
      });
    }

    // Update error rate
    if (!success) {
      // Simple error rate calculation (could be enhanced with time windows)
      const recentErrors = this.requestTimes.length > 100 ? 
        this.requestTimes.slice(-100).filter((_, i) => i % 10 === 0).length : // Simplified
        1;
      this.metrics.errorRate = recentErrors / Math.min(this.requestTimes.length, 100);
    }
  }

  /**
   * Record provider failure
   */
  recordProviderFailure(provider: 'tradier' | 'twelveData' | 'alpaca'): void {
    // Increment failure count (simplified - in production would use time windows)
    this.metrics.providerFailureRates[provider] += 0.01; // Increment by 1%
    
    // Cap at 100%
    this.metrics.providerFailureRates[provider] = Math.min(
      this.metrics.providerFailureRates[provider], 
      1.0
    );

    this.logger.warn('Provider failure recorded', {
      provider,
      failureRate: this.metrics.providerFailureRates[provider]
    });
  }

  /**
   * Record provider success (to decrease failure rate)
   */
  recordProviderSuccess(provider: 'tradier' | 'twelveData' | 'alpaca'): void {
    // Decrease failure rate on success
    this.metrics.providerFailureRates[provider] = Math.max(
      this.metrics.providerFailureRates[provider] - 0.005, // Decrease by 0.5%
      0
    );
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if performance is within acceptable thresholds
   */
  isPerformanceHealthy(): boolean {
    const healthy = 
      this.metrics.averageLatency <= PERFORMANCE_TARGETS.webhookResponse &&
      this.metrics.p95Latency <= PERFORMANCE_TARGETS.webhookResponse * 2 &&
      this.metrics.errorRate <= 0.05 && // 5% error rate threshold
      Object.values(this.metrics.providerFailureRates).every(rate => rate <= 0.1); // 10% provider failure threshold

    if (!healthy) {
      this.logger.warn('Performance degradation detected', {
        metrics: this.metrics,
        thresholds: {
          maxLatency: PERFORMANCE_TARGETS.webhookResponse,
          maxP95: PERFORMANCE_TARGETS.webhookResponse * 2,
          maxErrorRate: 0.05,
          maxProviderFailure: 0.1
        }
      });
    }

    return healthy;
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics = {
      requestCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      errorRate: 0,
      providerFailureRates: {
        tradier: 0,
        twelveData: 0,
        alpaca: 0
      }
    };
    this.requestTimes = [];
  }

  /**
   * Get performance summary for health checks
   */
  getHealthSummary(): {
    healthy: boolean;
    metrics: PerformanceMetrics;
    issues: string[];
  } {
    const issues: string[] = [];
    
    if (this.metrics.averageLatency > PERFORMANCE_TARGETS.webhookResponse) {
      issues.push(`High average latency: ${this.metrics.averageLatency}ms`);
    }
    
    if (this.metrics.p95Latency > PERFORMANCE_TARGETS.webhookResponse * 2) {
      issues.push(`High P95 latency: ${this.metrics.p95Latency}ms`);
    }
    
    if (this.metrics.errorRate > 0.05) {
      issues.push(`High error rate: ${(this.metrics.errorRate * 100).toFixed(1)}%`);
    }

    Object.entries(this.metrics.providerFailureRates).forEach(([providerName, rate]) => {
      if (rate > 0.1) {
        issues.push(`High ${providerName} failure rate: ${(rate * 100).toFixed(1)}%`);
      }
    });

    return {
      healthy: issues.length === 0,
      metrics: this.getMetrics(),
      issues
    };
  }

  private updateLatencyMetrics(): void {
    if (this.requestTimes.length === 0) return;

    // Calculate average latency
    const sum = this.requestTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageLatency = sum / this.requestTimes.length;

    // Calculate P95 latency
    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.p95Latency = sorted[p95Index] || 0;
  }
}