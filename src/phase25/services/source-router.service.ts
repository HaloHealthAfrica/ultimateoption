/**
 * Source Router Service for Phase 2.5 Decision Engine
 * 
 * Routes incoming webhooks to appropriate normalizers and handles
 * source detection errors with proper logging and error responses.
 */

import { NormalizerService } from './normalizer.service';
import { 
  WebhookSource, 
  NormalizedPayload, 
  WebhookError, 
  WebhookErrorType 
} from '../types';

export class SourceRouterService {
  private normalizer: NormalizerService;

  constructor() {
    this.normalizer = new NormalizerService();
  }

  /**
   * Route webhook payload to appropriate normalizer
   */
  routeWebhook(payload: any): {
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
  getSourceDetectionHints(payload: any): Record<string, boolean> {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    return {
      hasSatyMeta: payload.meta?.engine === 'SATY_PO',
      hasMtfTimeframes: !!(payload.timeframes?.tf3min && payload.timeframes?.tf5min),
      hasUltimateOptionsSignal: !!(payload.signal?.ai_score !== undefined && 
                                   payload.signal?.quality && 
                                   !payload.signal?.timeframe),
      hasStratFields: !!(payload.setup_valid !== undefined && 
                        payload.liquidity_ok !== undefined),
      hasTradingViewSignal: !!(payload.signal?.type && 
                              payload.signal?.timeframe && 
                              payload.instrument?.ticker)
    };
  }

  /**
   * Create appropriate error for routing failures
   */
  private createRoutingError(error: any, payload: any): WebhookError {
    if (error.message?.includes('Unknown webhook source')) {
      return {
        type: WebhookErrorType.UNKNOWN_SOURCE,
        message: `Unable to detect webhook source. ${this.getDetectionHelpText(payload)}`,
        details: {
          originalError: error.message,
          detectionHints: this.getSourceDetectionHints(payload),
          supportedSources: this.getSupportedSources()
        },
        timestamp: Date.now()
      };
    }

    if (error.message?.includes('Invalid payload')) {
      return {
        type: WebhookErrorType.SCHEMA_VALIDATION,
        message: `Invalid payload structure: ${error.message}`,
        details: {
          originalError: error.message,
          payloadType: typeof payload
        },
        timestamp: Date.now()
      };
    }

    // Generic processing error
    return {
      type: WebhookErrorType.PROCESSING_TIMEOUT,
      message: `Webhook processing failed: ${error.message || 'Unknown error'}`,
      details: {
        originalError: error.message,
        errorType: error.constructor.name
      },
      timestamp: Date.now()
    };
  }

  /**
   * Generate helpful text for source detection failures
   */
  private getDetectionHelpText(payload: any): string {
    const hints = this.getSourceDetectionHints(payload);
    const suggestions: string[] = [];

    if (!payload || typeof payload !== 'object') {
      return 'Payload must be a valid JSON object.';
    }

    // Provide specific suggestions based on what's missing
    if (!hints.hasSatyMeta && !hints.hasMtfTimeframes && !hints.hasUltimateOptionsSignal && 
        !hints.hasStratFields && !hints.hasTradingViewSignal) {
      suggestions.push('Payload does not match any known webhook format');
    }

    if (payload.signal && !hints.hasUltimateOptionsSignal && !hints.hasTradingViewSignal) {
      suggestions.push('Signal payload missing required fields (ai_score, quality, or timeframe)');
    }

    if (payload.timeframes && !hints.hasMtfTimeframes) {
      suggestions.push('Timeframes payload missing required fields (tf3min, tf5min)');
    }

    if (payload.meta && !hints.hasSatyMeta) {
      suggestions.push('Meta payload missing engine field or incorrect engine value');
    }

    return suggestions.length > 0 
      ? `Suggestions: ${suggestions.join('; ')}`
      : 'Check payload structure against supported webhook formats.';
  }

  /**
   * Sanitize payload for safe logging (remove sensitive data)
   */
  private sanitizePayloadForLogging(payload: any): any {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    // Create a copy and remove potentially sensitive fields
    const sanitized = { ...payload };
    
    // Remove any fields that might contain API keys or secrets
    delete sanitized.apiKey;
    delete sanitized.secret;
    delete sanitized.token;
    delete sanitized.auth;
    
    // Truncate large arrays or objects for logging
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 10) {
        sanitized[key] = [...sanitized[key].slice(0, 10), `... ${sanitized[key].length - 10} more items`];
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