/**
 * Webhook Service for Phase 2.5 Decision Engine
 * 
 * Handles incoming webhooks from TradingView and other sources with
 * authentication, validation, and routing to the decision pipeline.
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { SourceRouterService } from './source-router.service';
import { 
  IWebhookService, 
  WebhookResponse, 
  ValidationResult, 
  WebhookSource,
  WebhookErrorType,
  WebhookError,
  AuthConfig,
  NormalizedPayload
} from '../types';

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
  async handleSignalWebhook(payload: any): Promise<WebhookResponse> {
    const startTime = Date.now();
    
    try {
      // Route and normalize the webhook
      const normalized = await this.sourceRouter.routeWebhook(payload);
      
      // TODO: Forward to context store and decision pipeline
      console.log('Signal webhook processed:', {
        source: normalized.source,
        symbol: normalized.partial.instrument?.symbol,
        timestamp: normalized.timestamp
      });

      return {
        success: true,
        message: `${normalized.source} webhook processed successfully`,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Error processing signal webhook:', error);
      
      if (error.type) {
        // This is a WebhookError from the router
        return {
          success: false,
          message: error.message,
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
  async handleSatyPhaseWebhook(payload: any): Promise<WebhookResponse> {
    const startTime = Date.now();
    
    try {
      // Route and normalize the webhook
      const normalized = await this.sourceRouter.routeWebhook(payload);
      
      // TODO: Forward to context store and decision pipeline
      console.log('SATY phase webhook processed:', {
        source: normalized.source,
        symbol: normalized.partial.instrument?.symbol,
        phase: normalized.partial.regime?.phaseName,
        confidence: normalized.partial.regime?.confidence
      });

      return {
        success: true,
        message: `${normalized.source} webhook processed successfully`,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Error processing SATY phase webhook:', error);
      
      if (error.type) {
        // This is a WebhookError from the router
        return {
          success: false,
          message: error.message,
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
  validateSchema(payload: any, source: WebhookSource): ValidationResult {
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
  private validateTradingViewSignal(payload: any, errors: string[], warnings: string[]): void {
    // Validate signal section
    if (!payload.signal) {
      errors.push('Missing signal section');
      return;
    }

    if (!['LONG', 'SHORT'].includes(payload.signal.type)) {
      errors.push('Invalid signal type, must be LONG or SHORT');
    }

    if (!['3', '5', '15', '30', '60', '240'].includes(payload.signal.timeframe)) {
      errors.push('Invalid timeframe, must be 3, 5, 15, 30, 60, or 240');
    }

    if (!['EXTREME', 'HIGH', 'MEDIUM'].includes(payload.signal.quality)) {
      errors.push('Invalid quality, must be EXTREME, HIGH, or MEDIUM');
    }

    if (typeof payload.signal.ai_score !== 'number' || payload.signal.ai_score < 0 || payload.signal.ai_score > 10.5) {
      errors.push('Invalid ai_score, must be a number between 0 and 10.5');
    }

    // Validate instrument section
    if (!payload.instrument) {
      errors.push('Missing instrument section');
      return;
    }

    if (!payload.instrument.ticker || typeof payload.instrument.ticker !== 'string') {
      errors.push('Invalid or missing instrument ticker');
    }

    if (!payload.instrument.exchange || typeof payload.instrument.exchange !== 'string') {
      errors.push('Invalid or missing instrument exchange');
    }

    if (typeof payload.instrument.current_price !== 'number' || payload.instrument.current_price <= 0) {
      errors.push('Invalid current_price, must be a positive number');
    }

    // Validate risk section
    if (!payload.risk) {
      warnings.push('Missing risk section');
    } else {
      if (typeof payload.risk.rr_ratio_t1 !== 'number' || payload.risk.rr_ratio_t1 <= 0) {
        warnings.push('Invalid rr_ratio_t1, should be a positive number');
      }
    }
  }

  /**
   * Validate SATY phase payload
   */
  private validateSatyPhase(payload: any, errors: string[], warnings: string[]): void {
    // Validate meta section
    if (!payload.meta) {
      errors.push('Missing meta section');
      return;
    }

    if (payload.meta.engine !== 'SATY_PO') {
      errors.push('Invalid engine, must be SATY_PO');
    }

    // Validate instrument section
    if (!payload.instrument) {
      errors.push('Missing instrument section');
      return;
    }

    if (!payload.instrument.symbol || typeof payload.instrument.symbol !== 'string') {
      errors.push('Invalid or missing instrument symbol');
    }

    // Validate confidence section
    if (!payload.confidence) {
      errors.push('Missing confidence section');
      return;
    }

    if (typeof payload.confidence.confidence_score !== 'number' || 
        payload.confidence.confidence_score < 0 || 
        payload.confidence.confidence_score > 100) {
      errors.push('Invalid confidence_score, must be a number between 0 and 100');
    }

    // Validate execution guidance
    if (!payload.execution_guidance) {
      warnings.push('Missing execution_guidance section');
    } else {
      if (typeof payload.execution_guidance.trade_allowed !== 'boolean') {
        errors.push('Invalid trade_allowed, must be a boolean');
      }
    }
  }

  /**
   * Validate MTF Dots payload
   */
  private validateMtfDots(payload: any, errors: string[], warnings: string[]): void {
    if (!payload.ticker || typeof payload.ticker !== 'string') {
      errors.push('Invalid or missing ticker');
    }

    if (!payload.timeframes) {
      errors.push('Missing timeframes section');
      return;
    }

    const requiredTimeframes = ['tf3min', 'tf5min', 'tf15min', 'tf30min', 'tf60min', 'tf240min'];
    for (const tf of requiredTimeframes) {
      if (!payload.timeframes[tf]) {
        errors.push(`Missing timeframe: ${tf}`);
      } else {
        if (!['bullish', 'bearish', 'neutral'].includes(payload.timeframes[tf].direction)) {
          errors.push(`Invalid direction for ${tf}, must be bullish, bearish, or neutral`);
        }
      }
    }
  }

  /**
   * Validate Ultimate Options payload
   */
  private validateUltimateOptions(payload: any, errors: string[], warnings: string[]): void {
    if (!payload.signal) {
      errors.push('Missing signal section');
      return;
    }

    if (!['LONG', 'SHORT'].includes(payload.signal.type)) {
      errors.push('Invalid signal type, must be LONG or SHORT');
    }

    if (typeof payload.signal.ai_score !== 'number' || payload.signal.ai_score < 0 || payload.signal.ai_score > 10.5) {
      errors.push('Invalid ai_score, must be a number between 0 and 10.5');
    }

    if (!['EXTREME', 'HIGH', 'MEDIUM'].includes(payload.signal.quality)) {
      errors.push('Invalid quality, must be EXTREME, HIGH, or MEDIUM');
    }
  }

  /**
   * Validate STRAT execution payload
   */
  private validateStratExecution(payload: any, errors: string[], warnings: string[]): void {
    if (typeof payload.setup_valid !== 'boolean') {
      errors.push('Invalid setup_valid, must be a boolean');
    }

    if (typeof payload.liquidity_ok !== 'boolean') {
      errors.push('Invalid liquidity_ok, must be a boolean');
    }

    if (!['A', 'B', 'C'].includes(payload.quality)) {
      errors.push('Invalid quality, must be A, B, or C');
    }

    if (!payload.symbol || typeof payload.symbol !== 'string') {
      errors.push('Invalid or missing symbol');
    }
  }

  /**
   * Create a webhook error response
   */
  createErrorResponse(type: WebhookErrorType, message: string, details?: any): WebhookError {
    return {
      type,
      message,
      details,
      timestamp: Date.now()
    };
  }
}