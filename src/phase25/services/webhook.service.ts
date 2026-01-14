/**
 * Webhook Service for Phase 2.5 Decision Engine
 * 
 * Handles incoming webhooks from TradingView and other sources with
 * authentication, validation, and routing to the decision pipeline.
 */

// import { Response } from 'express'; // Unused
import crypto from 'crypto';
import { SourceRouterService } from './source-router.service';
import { IWebhookService, 
  WebhookResponse, 
  ValidationResult, 
  WebhookSource,
  WebhookErrorType,
  WebhookError,
  AuthConfig } from '../types';

export class WebhookService implements IWebhookService {
  private authConfig: AuthConfig;
  private sourceRouter: SourceRouterService;

  constructor(authConfig: AuthConfig = { requireAuth: false }) {
    this.authConfig = authConfig;
    this.sourceRouter = new SourceRouterService();
  }

  /**
   * Handle TradingView signal webhooks
   */
  async handleSignalWebhook(payload: unknown): Promise<WebhookResponse> {
    const startTime = Date.now();
    
    try {
      // Route and normalize the webhook
      const result = this.sourceRouter.routeWebhook(payload);
      
      if (!result.success || !result.normalized) {
        return {
          success: false,
          message: result.error?.message || 'Failed to process webhook',
          processingTime: Date.now() - startTime
        };
      }
      
      // TODO: Forward to context store and decision pipeline
      console.log('Signal webhook processed:', {
        source: result.source,
        symbol: result.normalized.partial.instrument?.symbol,
        timestamp: result.normalized.timestamp
      });

      return {
        success: true,
        message: `${result.source} webhook processed successfully`,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Error processing signal webhook:', error);
      
      const err = error as WebhookError;
      if (err.type) {
        // This is a WebhookError from the router
        return {
          success: false,
          message: err.message,
          processingTime: Date.now() - startTime
        };
      }
      
      return {
        success: false,
        message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Handle SATY phase webhooks
   */
  async handleSatyPhaseWebhook(payload: unknown): Promise<WebhookResponse> {
    const startTime = Date.now();
    
    try {
      // Route and normalize the webhook
      const result = this.sourceRouter.routeWebhook(payload);
      
      if (!result.success || !result.normalized) {
        return {
          success: false,
          message: result.error?.message || 'Failed to process webhook',
          processingTime: Date.now() - startTime
        };
      }
      
      // TODO: Forward to context store and decision pipeline
      console.log('SATY phase webhook processed:', {
        source: result.source,
        symbol: result.normalized.partial.instrument?.symbol,
        phase: result.normalized.partial.regime?.phaseName,
        confidence: result.normalized.partial.regime?.confidence
      });

      return {
        success: true,
        message: `${result.source} webhook processed successfully`,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Error processing SATY phase webhook:', error);
      
      const err = error as WebhookError;
      if (err.type) {
        // This is a WebhookError from the router
        return {
          success: false,
          message: err.message,
          processingTime: Date.now() - startTime
        };
      }
      
      return {
        success: false,
        message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate HMAC signature for webhook authentication
   */
  validateSignature(payload: string, signature: string): boolean {
    if (!this.authConfig.requireAuth || !this.authConfig.hmacSecret) {
      return true; // No auth required or configured
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.authConfig.hmacSecret)
        .update(payload)
        .digest('hex');
      
      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error validating signature:', error);
      return false;
    }
  }

  /**
   * Validate bearer token authentication
   */
  validateBearerToken(token: string): boolean {
    if (!this.authConfig.requireAuth || !this.authConfig.bearerToken) {
      return true; // No auth required or configured
    }

    return token === this.authConfig.bearerToken;
  }

  /**
   * Validate webhook payload schema based on source
   */
  validateSchema(payload: unknown, source: WebhookSource): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!payload || typeof payload !== 'object') {
      errors.push('Payload must be a valid object');
      return { valid: false, errors, warnings };
    }

    switch (source) {
      case "TRADINGVIEW_SIGNAL":
        this.validateTradingViewSignal(payload, errors, warnings);
        break;
      case "SATY_PHASE":
        this.validateSatyPhase(payload, errors, warnings);
        break;
      case "MTF_DOTS":
        this.validateMtfDots(payload, errors, warnings);
        break;
      case "ULTIMATE_OPTIONS":
        this.validateUltimateOptions(payload, errors, warnings);
        break;
      case "STRAT_EXEC":
        this.validateStratExecution(payload, errors, warnings);
        break;
      default:
        errors.push(`Unknown webhook source: ${source}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate TradingView signal payload
   */
  private validateTradingViewSignal(payload: unknown, errors: string[], warnings: string[]): void {
    const data = payload as Record<string, unknown>;
    
    // Validate signal section
    if (!data.signal) {
      errors.push('Missing signal section');
      return;
    }

    const signal = data.signal as Record<string, unknown>;
    if (!['LONG', 'SHORT'].includes(signal.type as string)) {
      errors.push('Invalid signal type, must be LONG or SHORT');
    }

    if (!['3', '5', '15', '30', '60', '240'].includes(signal.timeframe as string)) {
      errors.push('Invalid timeframe, must be 3, 5, 15, 30, 60, or 240');
    }

    if (!['EXTREME', 'HIGH', 'MEDIUM'].includes(signal.quality as string)) {
      errors.push('Invalid quality, must be EXTREME, HIGH, or MEDIUM');
    }

    if (typeof signal.ai_score !== 'number' || signal.ai_score < 0 || signal.ai_score > 10.5) {
      errors.push('Invalid ai_score, must be a number between 0 and 10.5');
    }

    // Validate instrument section
    if (!data.instrument) {
      errors.push('Missing instrument section');
      return;
    }

    const instrument = data.instrument as Record<string, unknown>;
    if (!instrument.ticker || typeof instrument.ticker !== 'string') {
      errors.push('Invalid or missing instrument ticker');
    }

    if (!instrument.exchange || typeof instrument.exchange !== 'string') {
      errors.push('Invalid or missing instrument exchange');
    }

    if (typeof instrument.current_price !== 'number' || instrument.current_price <= 0) {
      errors.push('Invalid current_price, must be a positive number');
    }

    // Validate risk section
    if (!data.risk) {
      warnings.push('Missing risk section');
    } else {
      const risk = data.risk as Record<string, unknown>;
      if (typeof risk.rr_ratio_t1 !== 'number' || risk.rr_ratio_t1 <= 0) {
        warnings.push('Invalid rr_ratio_t1, should be a positive number');
      }
    }
  }

  /**
   * Validate SATY phase payload
   */
  private validateSatyPhase(payload: unknown, errors: string[], warnings: string[]): void {
    const data = payload as Record<string, unknown>;
    
    // Validate meta section
    if (!data.meta) {
      errors.push('Missing meta section');
      return;
    }

    const meta = data.meta as Record<string, unknown>;
    if (meta.engine !== 'SATY_PO') {
      errors.push('Invalid engine, must be SATY_PO');
    }

    // Validate instrument section
    if (!data.instrument) {
      errors.push('Missing instrument section');
      return;
    }

    const instrument = data.instrument as Record<string, unknown>;
    if (!instrument.symbol || typeof instrument.symbol !== 'string') {
      errors.push('Invalid or missing instrument symbol');
    }

    // Validate confidence section
    if (!data.confidence) {
      errors.push('Missing confidence section');
      return;
    }

    const confidence = data.confidence as Record<string, unknown>;
    if (typeof confidence.confidence_score !== 'number' || 
        confidence.confidence_score < 0 || 
        confidence.confidence_score > 100) {
      errors.push('Invalid confidence_score, must be a number between 0 and 100');
    }

    // Validate execution guidance
    if (!data.execution_guidance) {
      warnings.push('Missing execution_guidance section');
    } else {
      const executionGuidance = data.execution_guidance as Record<string, unknown>;
      if (typeof executionGuidance.trade_allowed !== 'boolean') {
        errors.push('Invalid trade_allowed, must be a boolean');
      }
    }
  }

  /**
   * Validate MTF Dots payload
   */
  private validateMtfDots(payload: unknown, errors: string[], _warnings: string[]): void {
    const data = payload as Record<string, unknown>;
    
    if (!data.ticker || typeof data.ticker !== 'string') {
      errors.push('Invalid or missing ticker');
    }

    if (!data.timeframes) {
      errors.push('Missing timeframes section');
      return;
    }

    const timeframes = data.timeframes as Record<string, unknown>;
    const requiredTimeframes = ['tf3min', 'tf5min', 'tf15min', 'tf30min', 'tf60min', 'tf240min'];
    for (const tf of requiredTimeframes) {
      if (!timeframes[tf]) {
        errors.push(`Missing timeframe: ${tf}`);
      } else {
        const tfData = timeframes[tf] as Record<string, unknown>;
        if (!['bullish', 'bearish', 'neutral'].includes(tfData.direction as string)) {
          errors.push(`Invalid direction for ${tf}, must be bullish, bearish, or neutral`);
        }
      }
    }
  }

  /**
   * Validate Ultimate Options payload
   */
  private validateUltimateOptions(payload: unknown, errors: string[], _warnings: string[]): void {
    const data = payload as Record<string, unknown>;
    
    if (!data.signal) {
      errors.push('Missing signal section');
      return;
    }

    const signal = data.signal as Record<string, unknown>;
    if (!['LONG', 'SHORT'].includes(signal.type as string)) {
      errors.push('Invalid signal type, must be LONG or SHORT');
    }

    if (typeof signal.ai_score !== 'number' || signal.ai_score < 0 || signal.ai_score > 10.5) {
      errors.push('Invalid ai_score, must be a number between 0 and 10.5');
    }

    if (!['EXTREME', 'HIGH', 'MEDIUM'].includes(signal.quality as string)) {
      errors.push('Invalid quality, must be EXTREME, HIGH, or MEDIUM');
    }
  }

  /**
   * Validate STRAT execution payload
   */
  private validateStratExecution(payload: unknown, errors: string[], _warnings: string[]): void {
    const data = payload as Record<string, unknown>;
    
    if (typeof data.setup_valid !== 'boolean') {
      errors.push('Invalid setup_valid, must be a boolean');
    }

    if (typeof data.liquidity_ok !== 'boolean') {
      errors.push('Invalid liquidity_ok, must be a boolean');
    }

    if (!['A', 'B', 'C'].includes(data.quality as string)) {
      errors.push('Invalid quality, must be A, B, or C');
    }

    if (!data.symbol || typeof data.symbol !== 'string') {
      errors.push('Invalid or missing symbol');
    }
  }

  /**
   * Create a webhook error response
   */
  createErrorResponse(type: WebhookErrorType, message: string, details?: unknown): WebhookError {
    return {
      type,
      message,
      details,
      timestamp: Date.now()
    };
  }
}