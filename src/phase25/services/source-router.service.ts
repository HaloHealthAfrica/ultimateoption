/**
 * Source Router Service for Phase 2.5 Decision Engine
 * 
 * Routes incoming webhooks to appropriate normalizers and handles
 * source detection errors with proper logging and error responses.
 */

import { NormalizerService } from './normalizer.service';
import { WebhookSource, WebhookError, 
  WebhookErrorType, NormalizedPayload } from '../types';

export class SourceRouterService {
  private normalizer: NormalizerService;

  constructor() {
    this.normalizer = new NormalizerService();
  }

  /**
   * Route webhook payload to appropriate normalizer
   */
  routeWebhook(payload: unknown): {
    success: boolean;
    source?: WebhookSource;
    normalized?: NormalizedPayload;
    error?: WebhookError;
  } {
    const startTime = Date.now();
    
    try {
      // Detect source and normalize
      const source = this.normalizer.detectSource(payload);
      const normalized = this.normalizer.normalize(payload, source);
      
      // Log successful routing
      console.log(`Webhook routed successfully:`, {
        source,
        symbol: normalized.partial.instrument?.symbol,
        processingTime: Date.now() - startTime
      });

      return {
        success: true,
        source,
        normalized
      };
      
    } catch (error) {
      // Handle routing errors
      const routingError = this.createRoutingError(error, payload);
      
      console.error('Webhook routing failed:', {
        error: routingError,
        payload: this.sanitizePayloadForLogging(payload),
        processingTime: Date.now() - startTime
      });
      
      return {
        success: false,
        error: routingError
      };
    }
  }

  /**
   * Get supported webhook sources
   */
  getSupportedSources(): WebhookSource[] {
    return [
      "SATY_PHASE",
      "MTF_DOTS", 
      "ULTIMATE_OPTIONS",
      "STRAT_EXEC",
      "TRADINGVIEW_SIGNAL"
    ];
  }

  /**
   * Validate that a source is supported
   */
  isSourceSupported(source: string): source is WebhookSource {
    return this.getSupportedSources().includes(source as WebhookSource);
  }

  /**
   * Get source detection hints for debugging
   */
  getSourceDetectionHints(payload: unknown): Record<string, boolean> {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const data = payload as Record<string, unknown>;

    return {
      hasSatyMeta: (data.meta as Record<string, unknown>)?.engine === 'SATY_PO',
      hasMtfTimeframes: !!((data.timeframes as Record<string, unknown>)?.tf3min && (data.timeframes as Record<string, unknown>)?.tf5min),
      hasUltimateOptionsSignal: !!((data.signal as Record<string, unknown>)?.ai_score !== undefined && 
                                   (data.signal as Record<string, unknown>)?.quality && 
                                   !(data.signal as Record<string, unknown>)?.timeframe),
      hasStratFields: !!(data.setup_valid !== undefined && 
                        data.liquidity_ok !== undefined),
      hasTradingViewSignal: !!((data.signal as Record<string, unknown>)?.type && 
                              (data.signal as Record<string, unknown>)?.timeframe && 
                              (data.instrument as Record<string, unknown>)?.ticker)
    };
  }

  /**
   * Create appropriate error for routing failures
   */
  private createRoutingError(error: unknown, payload: unknown): WebhookError {
    const err = error as Error;
    
    if (err.message?.includes('Unknown webhook source')) {
      return {
        type: WebhookErrorType.UNKNOWN_SOURCE,
        message: `Unable to detect webhook source. ${this.getDetectionHelpText(payload)}`,
        details: {
          originalError: err.message,
          detectionHints: this.getSourceDetectionHints(payload),
          supportedSources: this.getSupportedSources()
        },
        timestamp: Date.now()
      };
    }

    if (err.message?.includes('Invalid payload')) {
      return {
        type: WebhookErrorType.SCHEMA_VALIDATION,
        message: `Invalid payload structure: ${err.message}`,
        details: {
          originalError: err.message,
          payloadType: typeof payload
        },
        timestamp: Date.now()
      };
    }

    // Generic processing error
    return {
      type: WebhookErrorType.PROCESSING_TIMEOUT,
      message: `Webhook processing failed: ${err.message || 'Unknown error'}`,
      details: {
        originalError: err.message,
        errorType: err.constructor?.name || 'Error'
      },
      timestamp: Date.now()
    };
  }

  /**
   * Generate helpful text for source detection failures
   */
  private getDetectionHelpText(payload: unknown): string {
    const hints = this.getSourceDetectionHints(payload);
    const suggestions: string[] = [];

    if (!payload || typeof payload !== 'object') {
      return 'Payload must be a valid JSON object.';
    }

    const data = payload as Record<string, unknown>;

    // Provide specific suggestions based on what's missing
    if (!hints.hasSatyMeta && !hints.hasMtfTimeframes && !hints.hasUltimateOptionsSignal && 
        !hints.hasStratFields && !hints.hasTradingViewSignal) {
      suggestions.push('Payload does not match any known webhook format');
    }

    if (data.signal && !hints.hasUltimateOptionsSignal && !hints.hasTradingViewSignal) {
      suggestions.push('Signal payload missing required fields (ai_score, quality, or timeframe)');
    }

    if (data.timeframes && !hints.hasMtfTimeframes) {
      suggestions.push('Timeframes payload missing required fields (tf3min, tf5min)');
    }

    if (data.meta && !hints.hasSatyMeta) {
      suggestions.push('Meta payload missing engine field or incorrect engine value');
    }

    return suggestions.length > 0 
      ? `Suggestions: ${suggestions.join('; ')}`
      : 'Check payload structure against supported webhook formats.';
  }

  /**
   * Sanitize payload for safe logging (remove sensitive data)
   */
  private sanitizePayloadForLogging(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    // Create a copy and remove potentially sensitive fields
    const sanitized = { ...payload } as Record<string, unknown>;
    
    // Remove any fields that might contain API keys or secrets
    delete sanitized.apiKey;
    delete sanitized.secret;
    delete sanitized.token;
    delete sanitized.auth;
    
    // Truncate large arrays or objects for logging
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && (sanitized[key] as unknown[]).length > 10) {
        sanitized[key] = [...(sanitized[key] as unknown[]).slice(0, 10), `... ${(sanitized[key] as unknown[]).length - 10} more items`];
      }
    });

    return sanitized;
  }

  /**
   * Get routing statistics for monitoring
   */
  getRoutingStats(): Record<WebhookSource, number> {
    // In a real implementation, this would track routing counts
    // For now, return empty stats
    return {
      "SATY_PHASE": 0,
      "MTF_DOTS": 0,
      "ULTIMATE_OPTIONS": 0,
      "STRAT_EXEC": 0,
      "TRADINGVIEW_SIGNAL": 0
    };
  }
}