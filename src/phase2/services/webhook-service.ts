/**
 * Phase 2 Decision Engine - Webhook Service
 * 
 * Express-based webhook service for receiving TradingView signals and SATY phase data.
 * Implements strict validation, performance monitoring, error handling, and health monitoring.
 */

import express, { Request, Response, NextFunction } from 'express';
import { TradingViewSignal, SatyPhaseWebhook, DecisionOutput, ENGINE_VERSION } from '../types';
import { PERFORMANCE_TARGETS } from '../config/index';
import { RATE_LIMITS, HTTP_STATUS } from '../constants/gates';
import { Logger } from './logger';
import { PerformanceMonitor } from './performance-monitor';
import { HealthService } from './health-service';
import { HealthMiddleware } from '../middleware/health-middleware';
import { performanceMiddleware } from '../middleware/performance-middleware';
import { 
  rateLimitMiddleware, 
  strictRateLimitMiddleware, 
  burstRateLimitMiddleware 
} from '../middleware/rate-limiter';
import { Normalizer } from './normalizer';
import { DecisionEngine } from '../engine/decision-engine';
import { DecisionOutputFormatter } from '../formatters/decision-output-formatter';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { MarketContextBuilder } from './market-context-builder';

export class WebhookService {
  private app: express.Application;
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private healthService: HealthService;
  private healthMiddleware: HealthMiddleware;
  private phaseStore: Map<string, SatyPhaseWebhook> = new Map();
  private decisionEngine: DecisionEngine;
  private formatter: DecisionOutputFormatter;
  private marketContextBuilder: MarketContextBuilder;

  constructor(
    logger: Logger,
    tradierClient: TradierClient,
    twelveDataClient: TwelveDataClient,
    alpacaClient: AlpacaClient,
    marketContextBuilder: MarketContextBuilder
  ) {
    this.app = express();
    this.logger = logger;
    this.performanceMonitor = new PerformanceMonitor(logger);
    this.marketContextBuilder = marketContextBuilder;
    
    // Initialize decision engine and formatter
    this.decisionEngine = new DecisionEngine();
    this.formatter = new DecisionOutputFormatter();
    
    // Initialize health service
    this.healthService = new HealthService(
      logger,
      tradierClient,
      twelveDataClient,
      alpacaClient,
      marketContextBuilder,
      performanceMiddleware.getTracker()
    );
    
    this.healthMiddleware = new HealthMiddleware(this.healthService, logger);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // JSON body parser with size limit (first)
    this.app.use(express.json({ limit: '1mb' }));

    // Basic security headers
    this.app.use((req, res, next) => {
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-Engine-Version': ENGINE_VERSION,
        'X-Service': 'Phase2-Decision-Engine'
      });
      next();
    });

    // Performance monitoring middleware
    this.app.use(performanceMiddleware.trackRequest());
    this.app.use(performanceMiddleware.trackDecisionEngine());
    this.app.use(performanceMiddleware.monitorThroughput());

    // Request timing and logging middleware
    this.app.use(this.requestLoggingMiddleware.bind(this));

    // Enhanced rate limiting middleware
    this.app.use(rateLimitMiddleware);
    
    // Strict rate limiting for sensitive endpoints
    this.app.use('/api/webhooks/signals', strictRateLimitMiddleware);
    
    // Burst rate limiting for high-frequency endpoints
    this.app.use('/metrics', burstRateLimitMiddleware);

    // Validation middleware for webhook endpoints
    this.app.use('/api/webhooks', this.validationMiddleware.bind(this));
  }

  private setupRoutes(): void {
    // Health check endpoints
    this.app.get('/health', this.healthMiddleware.getHealthHandler());
    this.app.get('/health/quick', this.healthMiddleware.getQuickHealthHandler());
    this.app.get('/health/ready', this.healthMiddleware.getReadinessHandler());
    this.app.get('/health/live', this.healthMiddleware.getLivenessHandler());

    // Main signals webhook endpoint
    this.app.post('/api/webhooks/signals', this.handleSignalsWebhook.bind(this));

    // SATY phase webhook endpoint
    this.app.post('/api/webhooks/saty-phase', this.handleSatyPhaseWebhook.bind(this));

    // Performance metrics endpoint
    this.app.get('/metrics', performanceMiddleware.getMetricsHandler());

    // Error handling middleware
    this.app.use(this.errorHandler.bind(this));
  }

  private requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request ID to request object
    (req as any).requestId = requestId;
    
    // Log incoming request
    this.logger.info('Incoming request', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      headers: this.sanitizeHeaders(req.headers),
      query: req.query,
      body: req.method === 'POST' ? req.body : undefined,
      timestamp: new Date().toISOString(),
      engineVersion: ENGINE_VERSION
    });
    
    // Add timing to response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      // Record performance metrics
      this.performanceMonitor.recordRequest(duration, success);
      
      // Log request completion with structured logging
      this.logger.logRequestEvent(
        req.method,
        req.path,
        res.statusCode,
        duration,
        req.ip || 'unknown',
        requestId,
        req.get('User-Agent')
      );

      // Log performance warnings
      if (duration > PERFORMANCE_TARGETS.webhookResponse) {
        this.logger.logPerformanceWarning(
          'webhook_response_time',
          duration,
          PERFORMANCE_TARGETS.webhookResponse,
          'warning'
        );
      }
    });

    next();
  }

  private validationMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Validate Content-Type
    if (!req.is('application/json')) {
      const error = new Error('Content-Type must be application/json');
      this.logger.logError('Validation failed', error, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId: (req as any).requestId
      });
      
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Content-Type must be application/json'
      });
      return;
    }

    // Validate JSON body exists
    if (!req.body || typeof req.body !== 'object') {
      const error = new Error('Request body must be valid JSON');
      this.logger.logError('Validation failed', error, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId: (req as any).requestId,
        body: req.body
      });
      
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Request body must be valid JSON'
      });
      return;
    }

    next();
  }

  private async handleSignalsWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = (req as any).requestId;
    
    try {
      // Use normalizer for validation and normalization
      const context = Normalizer.normalizeSignal(req.body);
      
      this.logger.info('Signal normalized successfully', {
        requestId,
        symbol: context.indicator.symbol,
        type: context.indicator.signalType,
        aiScore: context.indicator.aiScore
      });

      // Build market context
      const marketResult = await this.marketContextBuilder.buildMarketContext(context.indicator.symbol);
      const marketContext = marketResult.context;
      
      // Create complete decision context
      const completeContext = {
        ...context,
        market: marketContext
      };

      // Process decision through decision engine
      const decisionOutput = this.decisionEngine.makeDecision(completeContext);
      
      // Format response (DecisionEngine already returns properly formatted output)
      const formattedResponse = decisionOutput;

      // Log decision event
      this.logger.logDecisionEvent(
        completeContext,
        decisionOutput,
        Date.now() - startTime
      );

      res.status(HTTP_STATUS.OK).json(formattedResponse);

    } catch (error) {
      this.logger.logError('Signal processing failed', error as Error, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId,
        body: req.body
      });

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid signal payload',
        type: 'VALIDATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        message: error instanceof Error ? error.message : 'Unknown error',
        engineVersion: ENGINE_VERSION,
        requestId
      });
    }
  }

  private async handleSatyPhaseWebhook(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId;
    
    try {
      const phaseData = Normalizer.normalizeSatyPhase(req.body);
      
      // Store phase data
      this.phaseStore.set(phaseData.symbol, phaseData);
      
      this.logger.info('SATY phase stored successfully', {
        requestId,
        symbol: phaseData.symbol,
        phase: phaseData.phase
      });

      res.status(HTTP_STATUS.OK).json({
        status: 'stored',
        symbol: phaseData.symbol,
        phase: phaseData.phase,
        confidence: phaseData.confidence,
        timestamp: phaseData.timestamp,
        requestId
      });

    } catch (error) {
      this.logger.logError('SATY phase processing failed', error as Error, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId,
        body: req.body
      });

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid phase payload',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
    }
  }

  private errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
    const requestId = (req as any).requestId;
    
    this.logger.logError('Unhandled error in webhook service', error, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      requestId,
      body: req.body
    });

    if (res.headersSent) {
      return next(error);
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      requestId
    });
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    
    return sanitized;
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getHealthService(): HealthService {
    return this.healthService;
  }

  public getPhaseStore(): Map<string, SatyPhaseWebhook> {
    return this.phaseStore;
  }

  public getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  public async start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        this.logger.info('Webhook service started', {
          port,
          timestamp: new Date().toISOString(),
          engineVersion: ENGINE_VERSION
        });
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    // Graceful shutdown logic would go here
    this.logger.info('Webhook service stopping', {
      timestamp: new Date().toISOString()
    });
  }
}