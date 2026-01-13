/**
 * Error Handler Service for Phase 2.5 Decision Engine
 * 
 * Provides comprehensive error handling with graceful degradation,
 * conservative bias under uncertainty, and consistent error responses.
 */

import { DecisionContext,
  DecisionPacket,
  FeedError,
  WebhookError,
  EngineError,
  WebhookErrorType,
  EngineErrorType,
  MarketContext } from '../types';
import { ConfigManagerService } from './config-manager.service';
import { AuditLoggerService } from './audit-logger.service';

export interface ErrorHandlingConfig {
  maxFeedFailures: number;
  conservativeBiasThreshold: number; // Confidence reduction when feeds fail
  fallbackTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  type: string;
  details?: unknown;
  timestamp: number;
  engineVersion: string;
}

export interface DegradationStatus {
  feedsAvailable: number;
  feedsTotal: number;
  degradationLevel: 'NONE' | 'MINOR' | 'MAJOR' | 'SEVERE';
  confidencePenalty: number;
  fallbacksUsed: string[];
}

export class ErrorHandlerService {
  private configManager: ConfigManagerService;
  private auditLogger: AuditLoggerService;
  private config: ErrorHandlingConfig;
  private feedFailureCount: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();

  constructor(
    configManager: ConfigManagerService,
    auditLogger: AuditLoggerService,
    config?: Partial<ErrorHandlingConfig>
  ) {
    this.configManager = configManager;
    this.auditLogger = auditLogger;
    
    // Default error handling configuration
    this.config = {
      maxFeedFailures: 3,
      conservativeBiasThreshold: 0.15, // 15% confidence reduction
      fallbackTimeoutMs: 100,
      retryAttempts: 2,
      retryDelayMs: 50,
      ...config
    };
  }

  /**
   * Handle market feed degradation with graceful fallbacks
   * Implements Requirements 6.2: Graceful market feed degradation
   */
  async handleMarketFeedDegradation(
    symbol: string,
    feedErrors: FeedError[]
  ): Promise<{ context: MarketContext; degradationStatus: DegradationStatus }> {
    const startTime = Date.now();
    const totalFeeds = 3; // tradier, twelveData, alpaca
    const failedFeeds = feedErrors.length;
    const availableFeeds = totalFeeds - failedFeeds;
    
    // Determine degradation level
    const degradationLevel = this.calculateDegradationLevel(availableFeeds, totalFeeds);
    const confidencePenalty = this.calculateConfidencePenalty(degradationLevel);
    
    // Build fallback market context
    const fallbackContext = await this.buildFallbackMarketContext(symbol, feedErrors);
    
    // Track fallbacks used
    const fallbacksUsed = feedErrors.map(error => `${error.provider}_fallback`);
    
    const degradationStatus: DegradationStatus = {
      feedsAvailable: availableFeeds,
      feedsTotal: totalFeeds,
      degradationLevel,
      confidencePenalty,
      fallbacksUsed
    };

    // Log degradation event
    await this.auditLogger.logError(
      new Error(`Market feed degradation: ${degradationLevel}`),
      {
        symbol,
        degradationStatus,
        feedErrors: feedErrors.map(e => ({
          provider: e.provider,
          type: e.type,
          message: e.message
        })),
        processingTime: Date.now() - startTime
      }
    );

    return {
      context: fallbackContext,
      degradationStatus
    };
  }

  /**
   * Apply conservative bias under uncertainty
   * Implements Requirements 6.3: Conservative bias under uncertainty
   */
  applyConservativeBias(
    decision: DecisionPacket,
    degradationStatus: DegradationStatus
  ): DecisionPacket {
    // Calculate uncertainty level based on degradation
    const uncertaintyLevel = this.calculateUncertaintyLevel(degradationStatus);
    
    // Apply conservative adjustments
    const adjustedDecision = { ...decision };
    
    // Handle NaN values
    if (isNaN(decision.confidenceScore)) {
      adjustedDecision.confidenceScore = 50; // Default safe value
    }
    if (!isFinite(decision.finalSizeMultiplier)) {
      adjustedDecision.finalSizeMultiplier = 0.5; // Default safe value
    }
    
    // Reduce confidence score based on uncertainty
    const originalConfidence = adjustedDecision.confidenceScore;
    const confidenceReduction = uncertaintyLevel * this.config.conservativeBiasThreshold * 100;
    adjustedDecision.confidenceScore = Math.max(0, originalConfidence - confidenceReduction);
    
    // Reduce position size multiplier
    const sizeReduction = uncertaintyLevel * 0.3; // Up to 30% size reduction
    adjustedDecision.finalSizeMultiplier = Math.max(
      0.1, // Minimum size
      adjustedDecision.finalSizeMultiplier * (1 - sizeReduction)
    );
    
    // Add conservative bias reasons
    const biasReasons = [];
    if (degradationStatus.degradationLevel !== 'NONE') {
      biasReasons.push(`Conservative bias applied due to ${degradationStatus.degradationLevel.toLowerCase()} market feed degradation`);
    }
    if (confidenceReduction > 5) {
      biasReasons.push(`Confidence reduced by ${confidenceReduction.toFixed(1)}% due to uncertainty`);
    }
    if (sizeReduction > 0.1) {
      biasReasons.push(`Position size reduced by ${(sizeReduction * 100).toFixed(1)}% for risk management`);
    }
    
    adjustedDecision.reasons = [...(decision.reasons || []), ...biasReasons];
    
    // Change action to WAIT if confidence drops too low
    if (adjustedDecision.confidenceScore < 65 && decision.action === 'EXECUTE') {
      adjustedDecision.action = 'WAIT';
      adjustedDecision.reasons.push('Action changed to WAIT due to low confidence under uncertainty');
    }
    
    return adjustedDecision;
  }

  /**
   * Create consistent error responses
   * Implements Requirements 8.5, 8.6: Error response consistency
   */
  createErrorResponse(error: Error | WebhookError | FeedError | EngineError): ErrorResponse {
    const timestamp = Date.now();
    const engineVersion = this.configManager.getEngineVersion();
    
    // Handle different error types
    if ('type' in error && error.type) {
      // Structured error (WebhookError, FeedError, EngineError)
      return {
        success: false,
        error: error.message,
        type: error.type,
        details: 'details' in error ? error.details : undefined,
        timestamp,
        engineVersion
      };
    }
    
    // Generic Error
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      type: 'INTERNAL_ERROR',
      details: {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      timestamp,
      engineVersion
    };
  }

  /**
   * Handle webhook processing errors with retries
   */
  async handleWebhookError(
    error: Error,
    payload: unknown,
    retryCount: number = 0
  ): Promise<ErrorResponse> {
    // Log the error
    await this.auditLogger.logError(error, {
      payload: this.sanitizePayload(payload),
      retryCount,
      timestamp: Date.now()
    });

    // Determine if error is retryable
    const isRetryable = this.isRetryableError(error);
    
    if (isRetryable && retryCount < this.config.retryAttempts) {
      // Wait before retry
      await this.delay(this.config.retryDelayMs * (retryCount + 1));
      
      // This would be handled by the calling service
      throw new Error(`Retryable error: ${error.message} (attempt ${retryCount + 1})`);
    }

    // Create structured error response
    const webhookError: WebhookError = {
      type: this.classifyWebhookError(error),
      message: error.message,
      details: {
        retryCount,
        isRetryable,
        originalError: error.name
      },
      timestamp: Date.now()
    };

    return this.createErrorResponse(webhookError);
  }

  /**
   * Handle decision engine errors with context preservation
   */
  async handleDecisionEngineError(
    error: Error,
    context?: DecisionContext,
    marketContext?: MarketContext
  ): Promise<ErrorResponse> {
    // Create engine-specific error
    const engineError: EngineError = Object.assign(error, {
      type: this.classifyEngineError(error),
      context,
      marketContext,
      timestamp: Date.now()
    });

    // Log with full context for debugging
    await this.auditLogger.logError(engineError, {
      hasContext: !!context,
      hasMarketContext: !!marketContext,
      contextCompleteness: context?.meta?.completeness || 0,
      marketCompleteness: marketContext?.completeness || 0
    });

    return this.createErrorResponse(engineError);
  }

  /**
   * Get current system health status
   */
  getSystemHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    feedFailures: Record<string, number>;
    lastFailures: Record<string, number>;
    degradationLevel: string;
  } {
    const totalFailures = Array.from(this.feedFailureCount.values()).reduce((sum, count) => sum + count, 0);
    const recentFailures = this.getRecentFailureCount();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let degradationLevel = 'NONE';
    
    if (recentFailures > 5) {
      status = 'unhealthy';
      degradationLevel = 'SEVERE';
    } else if (recentFailures > 2) {
      status = 'degraded';
      degradationLevel = 'MAJOR';
    } else if (totalFailures > 0) {
      degradationLevel = 'MINOR';
    }

    return {
      status,
      feedFailures: Object.fromEntries(this.feedFailureCount),
      lastFailures: Object.fromEntries(this.lastFailureTime),
      degradationLevel
    };
  }

  // Private helper methods

  private calculateDegradationLevel(available: number, total: number): DegradationStatus['degradationLevel'] {
    const ratio = available / total;
    
    if (ratio >= 1.0) return 'NONE';
    if (ratio > 0.67) return 'MINOR';   // More than 2/3 feeds working
    if (ratio > 0.33) return 'MAJOR';   // More than 1/3 feeds working  
    return 'SEVERE';                    // 1/3 or fewer feeds working
  }

  private calculateConfidencePenalty(degradationLevel: DegradationStatus['degradationLevel']): number {
    switch (degradationLevel) {
      case 'NONE': return 0;
      case 'MINOR': return 0.05;  // 5% penalty
      case 'MAJOR': return 0.15;  // 15% penalty
      case 'SEVERE': return 0.30; // 30% penalty
      default: return 0;
    }
  }

  private calculateUncertaintyLevel(degradationStatus: DegradationStatus): number {
    // Return 0-1 based on degradation severity
    switch (degradationStatus.degradationLevel) {
      case 'NONE': return 0;
      case 'MINOR': return 0.2;
      case 'MAJOR': return 0.5;
      case 'SEVERE': return 0.8;
      default: return 0;
    }
  }

  private async buildFallbackMarketContext(symbol: string, feedErrors: FeedError[]): Promise<MarketContext> {
    const config = this.configManager.getConfig();
    const failedProviders = new Set(feedErrors.map(e => e.provider));
    
    // Build context with fallback values for failed providers
    const context: MarketContext = {
      fetchTime: Date.now(),
      completeness: 0,
      errors: feedErrors.map(e => `${e.provider}: ${e.message}`)
    };

    // Use fallback values from configuration
    if (failedProviders.has('tradier')) {
      context.options = (config.feeds.tradier.fallbackValues as Record<string, unknown>).options as MarketContext['options'];
    }
    
    if (failedProviders.has('twelvedata')) {
      context.stats = (config.feeds.twelveData.fallbackValues as Record<string, unknown>).stats as MarketContext['stats'];
    }
    
    if (failedProviders.has('alpaca')) {
      context.liquidity = (config.feeds.alpaca.fallbackValues as Record<string, unknown>).liquidity as MarketContext['liquidity'];
    }

    // Calculate completeness based on available data
    const totalSections = 3;
    const availableSections = totalSections - failedProviders.size;
    context.completeness = availableSections / totalSections;

    return context;
  }

  private isRetryableError(error: Error): boolean {
    // Network errors and timeouts are retryable
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /ECONNRESET/i,
      /ENOTFOUND/i,
      /rate.?limit/i
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    );
  }

  private classifyWebhookError(error: Error): WebhookErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('json') || message.includes('parse')) {
      return WebhookErrorType.INVALID_JSON;
    }
    if (message.includes('schema') || message.includes('validation')) {
      return WebhookErrorType.SCHEMA_VALIDATION;
    }
    if (message.includes('auth') || message.includes('unauthorized')) {
      return WebhookErrorType.AUTHENTICATION_FAILED;
    }
    if (message.includes('timeout')) {
      return WebhookErrorType.PROCESSING_TIMEOUT;
    }
    
    return WebhookErrorType.UNKNOWN_SOURCE;
  }

  private classifyEngineError(error: Error): EngineErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('incomplete') || message.includes('missing')) {
      return EngineErrorType.INCOMPLETE_CONTEXT;
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return EngineErrorType.INVALID_INPUT;
    }
    if (message.includes('calculation') || message.includes('math')) {
      return EngineErrorType.CALCULATION_ERROR;
    }
    
    return EngineErrorType.RULE_VIOLATION;
  }

  private sanitizePayload(payload: unknown): unknown {
    if (typeof payload !== 'object' || payload === null) {
      return payload;
    }
    
    const sanitized = { ...payload } as Record<string, unknown>;
    
    // Remove sensitive fields
    const sensitiveFields = ['api_key', 'apiKey', 'secret', 'token', 'password', 'auth'];
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    });
    
    return sanitized;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRecentFailureCount(): number {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    let recentCount = 0;
    
    for (const [_provider, lastFailure] of this.lastFailureTime) {
      if (lastFailure > fiveMinutesAgo) {
        recentCount += 1; // Count recent failures, not total count
      }
    }
    
    return recentCount;
  }

  /**
   * Record a feed failure for tracking
   */
  recordFeedFailure(_provider: string): void {
    const currentCount = this.feedFailureCount.get(_provider) || 0;
    this.feedFailureCount.set(_provider, currentCount + 1);
    this.lastFailureTime.set(_provider, Date.now());
  }

  /**
   * Reset failure counts (useful for testing or recovery)
   */
  resetFailureCounts(): void {
    this.feedFailureCount.clear();
    this.lastFailureTime.clear();
  }
}