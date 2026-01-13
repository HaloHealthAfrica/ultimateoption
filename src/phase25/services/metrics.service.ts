/**
 * Metrics Collection Service for Phase 2.5
 * 
 * Collects and reports decision statistics, performance metrics,
 * and system health indicators for monitoring and analysis.
 */

import { DecisionPacket, EngineAction } from '../types';
import { ENGINE_VERSION } from '../config/constants';

export interface DecisionMetrics {
  totalDecisions: number;
  decisionsByAction: Record<EngineAction, number>;
  decisionsBySymbol: Record<string, number>;
  avgConfidenceScore: number;
  avgProcessingTime: number;
  gateRejectReasons: Record<string, number>;
  executeRate: number;
  waitRate: number;
  skipRate: number;
  lastDecisionTime: number;
  startTime: number;
}

export interface PerformanceMetrics {
  throughput: {
    totalRequests: number;
    currentRPS: number;
    peakRPS: number;
    avgRPS: number;
  };
  latency: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  errors: {
    totalErrors: number;
    errorRate: number;
    errorsByType: Record<string, number>;
  };
  marketFeeds: {
    tradierSuccess: number;
    tradierFailures: number;
    twelveDataSuccess: number;
    twelveDataFailures: number;
    alpacaSuccess: number;
    alpacaFailures: number;
    avgCompleteness: number;
  };
}

export interface SystemMetrics {
  uptime: number;
  engineVersion: string;
  configHash: string;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  contextStore: {
    totalUpdates: number;
    completenessRate: number;
    avgAge: number;
    expiredContexts: number;
  };
}

export class MetricsService {
  private decisionMetrics: DecisionMetrics;
  private performanceMetrics: PerformanceMetrics;
  private systemMetrics: SystemMetrics;
  private processingTimes: number[] = [];
  private requestTimes: number[] = [];
  private startTime: number;
  private lastRPSCalculation: number = 0;
  private requestCount: number = 0;

  constructor(configHash: string) {
    this.startTime = Date.now();
    
    this.decisionMetrics = {
      totalDecisions: 0,
      decisionsByAction: { EXECUTE: 0, WAIT: 0, SKIP: 0 },
      decisionsBySymbol: {},
      avgConfidenceScore: 0,
      avgProcessingTime: 0,
      gateRejectReasons: {},
      executeRate: 0,
      waitRate: 0,
      skipRate: 0,
      lastDecisionTime: 0,
      startTime: this.startTime
    };

    this.performanceMetrics = {
      throughput: {
        totalRequests: 0,
        currentRPS: 0,
        peakRPS: 0,
        avgRPS: 0
      },
      latency: {
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0
      },
      errors: {
        totalErrors: 0,
        errorRate: 0,
        errorsByType: {}
      },
      marketFeeds: {
        tradierSuccess: 0,
        tradierFailures: 0,
        twelveDataSuccess: 0,
        twelveDataFailures: 0,
        alpacaSuccess: 0,
        alpacaFailures: 0,
        avgCompleteness: 0
      }
    };

    this.systemMetrics = {
      uptime: 0,
      engineVersion: ENGINE_VERSION,
      configHash,
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0
      },
      contextStore: {
        totalUpdates: 0,
        completenessRate: 0,
        avgAge: 0,
        expiredContexts: 0
      }
    };
  }

  /**
   * Record a decision for metrics tracking
   */
  recordDecision(decision: DecisionPacket, processingTime: number): void {
    const now = Date.now();
    
    // Update decision metrics
    this.decisionMetrics.totalDecisions++;
    this.decisionMetrics.decisionsByAction[decision.action]++;
    
    const symbol = decision.inputContext.instrument.symbol;
    this.decisionMetrics.decisionsBySymbol[symbol] = 
      (this.decisionMetrics.decisionsBySymbol[symbol] || 0) + 1;
    
    this.decisionMetrics.lastDecisionTime = now;
    
    // Update confidence score average
    const totalConfidence = this.decisionMetrics.avgConfidenceScore * (this.decisionMetrics.totalDecisions - 1);
    this.decisionMetrics.avgConfidenceScore = 
      (totalConfidence + decision.confidenceScore) / this.decisionMetrics.totalDecisions;
    
    // Update processing time average
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 1000) {
      this.processingTimes = this.processingTimes.slice(-1000); // Keep last 1000 samples
    }
    this.decisionMetrics.avgProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    
    // Record gate rejection reasons
    if (decision.action !== 'EXECUTE') {
      decision.reasons.forEach(reason => {
        this.decisionMetrics.gateRejectReasons[reason] = 
          (this.decisionMetrics.gateRejectReasons[reason] || 0) + 1;
      });
    }
    
    // Update decision rates
    this.updateDecisionRates();
    
    console.log(`Decision recorded: ${decision.action} for ${symbol} (confidence: ${decision.confidenceScore}, time: ${processingTime}ms)`);
  }

  /**
   * Record a request for performance tracking
   */
  recordRequest(processingTime: number): void {
    this.requestCount++;
    this.performanceMetrics.throughput.totalRequests++;
    
    // Update processing times for latency calculations
    this.requestTimes.push(processingTime);
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000); // Keep last 1000 samples
    }
    
    this.updateLatencyMetrics();
    this.updateThroughputMetrics();
  }

  /**
   * Record an error for error tracking
   */
  recordError(errorType: string): void {
    this.performanceMetrics.errors.totalErrors++;
    this.performanceMetrics.errors.errorsByType[errorType] = 
      (this.performanceMetrics.errors.errorsByType[errorType] || 0) + 1;
    
    // Update error rate
    this.performanceMetrics.errors.errorRate = 
      this.performanceMetrics.errors.totalErrors / this.performanceMetrics.throughput.totalRequests;
  }

  /**
   * Record market feed performance
   */
  recordMarketFeed(provider: 'tradier' | 'twelvedata' | 'alpaca', success: boolean, completeness?: number): void {
    // Map provider names to property names
    const providerMap = {
      'tradier': 'tradier',
      'twelvedata': 'twelveData',
      'alpaca': 'alpaca'
    };
    
    const providerKey = providerMap[provider];
    
    if (success) {
      (this.performanceMetrics.marketFeeds as Record<string, number>)[`${providerKey}Success`]++;
    } else {
      (this.performanceMetrics.marketFeeds as Record<string, number>)[`${providerKey}Failures`]++;
    }
    
    if (completeness !== undefined) {
      // Update average completeness
      const totalFeeds = this.performanceMetrics.marketFeeds.tradierSuccess + 
                         this.performanceMetrics.marketFeeds.twelveDataSuccess + 
                         this.performanceMetrics.marketFeeds.alpacaSuccess;
      
      if (totalFeeds > 0) {
        const currentAvg = this.performanceMetrics.marketFeeds.avgCompleteness;
        this.performanceMetrics.marketFeeds.avgCompleteness = 
          ((currentAvg * (totalFeeds - 1)) + completeness) / totalFeeds;
      }
    }
  }

  /**
   * Record context store activity
   */
  recordContextUpdate(): void {
    this.systemMetrics.contextStore.totalUpdates++;
  }

  /**
   * Update context store metrics
   */
  updateContextStoreMetrics(completenessRate: number, avgAge: number, expiredContexts: number): void {
    this.systemMetrics.contextStore.completenessRate = completenessRate;
    this.systemMetrics.contextStore.avgAge = avgAge;
    this.systemMetrics.contextStore.expiredContexts = expiredContexts;
  }

  /**
   * Get current decision metrics
   */
  getDecisionMetrics(): DecisionMetrics {
    return { ...this.decisionMetrics };
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    this.updateSystemMetrics();
    return { ...this.performanceMetrics };
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    this.updateSystemMetrics();
    return { ...this.systemMetrics };
  }

  /**
   * Get comprehensive metrics report
   */
  getMetricsReport(): {
    decisions: DecisionMetrics;
    performance: PerformanceMetrics;
    system: SystemMetrics;
    timestamp: number;
  } {
    this.updateSystemMetrics();
    
    return {
      decisions: this.getDecisionMetrics(),
      performance: this.getPerformanceMetrics(),
      system: this.getSystemMetrics(),
      timestamp: Date.now()
    };
  }

  /**
   * Get health status based on metrics
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // Check error rate
    if (this.performanceMetrics.errors.errorRate > 0.1) {
      issues.push(`High error rate: ${(this.performanceMetrics.errors.errorRate * 100).toFixed(1)}%`);
      score -= 20;
    } else if (this.performanceMetrics.errors.errorRate > 0.05) {
      issues.push(`Elevated error rate: ${(this.performanceMetrics.errors.errorRate * 100).toFixed(1)}%`);
      score -= 10;
    }

    // Check average processing time
    if (this.decisionMetrics.avgProcessingTime > 1000) {
      issues.push(`Slow processing: ${this.decisionMetrics.avgProcessingTime.toFixed(0)}ms avg`);
      score -= 15;
    } else if (this.decisionMetrics.avgProcessingTime > 500) {
      issues.push(`Elevated processing time: ${this.decisionMetrics.avgProcessingTime.toFixed(0)}ms avg`);
      score -= 5;
    }

    // Check market feed completeness
    if (this.performanceMetrics.marketFeeds.avgCompleteness < 0.5) {
      issues.push(`Poor market feed completeness: ${(this.performanceMetrics.marketFeeds.avgCompleteness * 100).toFixed(0)}%`);
      score -= 25;
    } else if (this.performanceMetrics.marketFeeds.avgCompleteness < 0.8) {
      issues.push(`Reduced market feed completeness: ${(this.performanceMetrics.marketFeeds.avgCompleteness * 100).toFixed(0)}%`);
      score -= 10;
    }

    // Check context store completeness
    if (this.systemMetrics.contextStore.completenessRate < 0.7) {
      issues.push(`Low context completeness: ${(this.systemMetrics.contextStore.completenessRate * 100).toFixed(0)}%`);
      score -= 15;
    }

    // Check memory usage
    if (this.systemMetrics.memoryUsage.percentage > 90) {
      issues.push(`High memory usage: ${this.systemMetrics.memoryUsage.percentage.toFixed(0)}%`);
      score -= 20;
    } else if (this.systemMetrics.memoryUsage.percentage > 80) {
      issues.push(`Elevated memory usage: ${this.systemMetrics.memoryUsage.percentage.toFixed(0)}%`);
      score -= 10;
    }

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (score >= 90) {
      status = 'healthy';
    } else if (score >= 70) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, score, issues };
  }

  /**
   * Reset all metrics (for testing or maintenance)
   */
  reset(): void {
    this.decisionMetrics = {
      totalDecisions: 0,
      decisionsByAction: { EXECUTE: 0, WAIT: 0, SKIP: 0 },
      decisionsBySymbol: {},
      avgConfidenceScore: 0,
      avgProcessingTime: 0,
      gateRejectReasons: {},
      executeRate: 0,
      waitRate: 0,
      skipRate: 0,
      lastDecisionTime: 0,
      startTime: Date.now()
    };

    this.performanceMetrics.throughput.totalRequests = 0;
    this.performanceMetrics.errors.totalErrors = 0;
    this.performanceMetrics.errors.errorsByType = {};
    
    this.processingTimes = [];
    this.requestTimes = [];
    this.requestCount = 0;
    this.lastRPSCalculation = 0;

    console.log('Metrics reset');
  }

  // Private helper methods

  private updateDecisionRates(): void {
    const total = this.decisionMetrics.totalDecisions;
    if (total > 0) {
      this.decisionMetrics.executeRate = this.decisionMetrics.decisionsByAction.EXECUTE / total;
      this.decisionMetrics.waitRate = this.decisionMetrics.decisionsByAction.WAIT / total;
      this.decisionMetrics.skipRate = this.decisionMetrics.decisionsByAction.SKIP / total;
    }
  }

  private updateLatencyMetrics(): void {
    if (this.requestTimes.length === 0) return;

    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    
    this.performanceMetrics.latency.average = 
      this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length;
    
    this.performanceMetrics.latency.min = sorted[0];
    this.performanceMetrics.latency.max = sorted[sorted.length - 1];
    
    this.performanceMetrics.latency.p50 = this.getPercentile(sorted, 0.5);
    this.performanceMetrics.latency.p95 = this.getPercentile(sorted, 0.95);
    this.performanceMetrics.latency.p99 = this.getPercentile(sorted, 0.99);
  }

  private updateThroughputMetrics(): void {
    const now = Date.now();
    const timeSinceStart = (now - this.startTime) / 1000; // seconds
    
    if (timeSinceStart > 0) {
      this.performanceMetrics.throughput.avgRPS = 
        this.performanceMetrics.throughput.totalRequests / timeSinceStart;
    }

    // Calculate current RPS (requests in last 60 seconds)
    const _oneMinuteAgo = now - 60000;
    if (now - this.lastRPSCalculation > 10000) { // Update every 10 seconds
      // This is a simplified calculation - in production you'd want a sliding window
      this.performanceMetrics.throughput.currentRPS = 
        Math.min(this.requestCount, this.performanceMetrics.throughput.avgRPS);
      
      if (this.performanceMetrics.throughput.currentRPS > this.performanceMetrics.throughput.peakRPS) {
        this.performanceMetrics.throughput.peakRPS = this.performanceMetrics.throughput.currentRPS;
      }
      
      this.lastRPSCalculation = now;
    }
  }

  private updateSystemMetrics(): void {
    this.systemMetrics.uptime = Date.now() - this.startTime;
    
    // Update memory usage (Node.js specific)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.systemMetrics.memoryUsage.used = memUsage.heapUsed;
      this.systemMetrics.memoryUsage.total = memUsage.heapTotal;
      this.systemMetrics.memoryUsage.percentage = 
        (memUsage.heapUsed / memUsage.heapTotal) * 100;
    }
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }
}