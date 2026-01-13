/**
 * Webhook Routes for Phase 2.5 Decision Engine
 * 
 * Express.js route handlers that use the WebhookService for processing
 * incoming webhooks with authentication and validation.
 */

import { Router, Request, Response } from 'express';
import { WebhookService } from '../services/webhook.service';
import { DecisionOrchestratorService } from '../services/decision-orchestrator.service';
import { AuthConfig } from '../types';

export class WebhookRoutes {
  private router: Router;
  private webhookService: WebhookService;
  private orchestrator?: DecisionOrchestratorService;

  constructor(authConfig?: AuthConfig, orchestrator?: DecisionOrchestratorService) {
    this.router = Router();
    this.webhookService = new WebhookService(authConfig);
    this.orchestrator = orchestrator;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Middleware for request logging
    this.router.use((req: Request, res: Response, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // Authentication middleware
    this.router.use(this.authenticationMiddleware.bind(this));

    // Signal webhook endpoint
    this.router.post('/signals', this.handleSignals.bind(this));

    // SATY phase webhook endpoint
    this.router.post('/saty-phase', this.handleSatyPhase.bind(this));

    // Health check endpoint
    this.router.get('/health', this.handleHealth.bind(this));

    // Detailed health endpoint with metrics
    this.router.get('/health/detailed', this.handleDetailedHealth.bind(this));

    // Metrics endpoint
    this.router.get('/metrics', this.handleMetrics.bind(this));
  }

  /**
   * Authentication middleware
   */
  private authenticationMiddleware(req: Request, res: Response, next: Function): void {
    const authHeader = req.headers.authorization;
    const signature = req.headers['x-signature'] as string;
    
    // Check bearer token if provided
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (!this.webhookService.validateBearerToken(token)) {
        res.status(401).json({
          success: false,
          message: 'Invalid bearer token',
          timestamp: Date.now()
        });
        return;
      }
    }

    // Check HMAC signature if provided
    if (signature) {
      const rawBody = JSON.stringify(req.body);
      if (!this.webhookService.validateSignature(rawBody, signature)) {
        res.status(401).json({
          success: false,
          message: 'Invalid signature',
          timestamp: Date.now()
        });
        return;
      }
    }

    next();
  }

  /**
   * Handle signal webhooks (TradingView, Ultimate Options, etc.)
   */
  private async handleSignals(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.webhookService.handleSignalWebhook(req.body);
      
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json({
        ...result,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error in signal webhook handler:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle SATY phase webhooks
   */
  private async handleSatyPhase(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.webhookService.handleSatyPhaseWebhook(req.body);
      
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json({
        ...result,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error in SATY phase webhook handler:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Health check endpoint
   */
  private handleHealth(req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      engine: 'Phase 2.5 Decision Engine',
      version: '1.0.0',
      timestamp: Date.now(),
      uptime: process.uptime()
    });
  }

  /**
   * Detailed health endpoint with metrics integration
   */
  private async handleDetailedHealth(req: Request, res: Response): Promise<void> {
    try {
      if (!this.orchestrator) {
        res.status(503).json({
          status: 'unhealthy',
          message: 'Decision orchestrator not available',
          timestamp: Date.now()
        });
        return;
      }

      const healthStatus = await this.orchestrator.getSystemHealthStatus();
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        ...healthStatus,
        engine: 'Phase 2.5 Decision Engine',
        version: '1.0.0',
        uptime: process.uptime()
      });
    } catch (error) {
      console.error('Error in detailed health check:', error);
      res.status(500).json({
        status: 'unhealthy',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Metrics endpoint
   */
  private handleMetrics(req: Request, res: Response): void {
    try {
      if (!this.orchestrator) {
        res.status(503).json({
          success: false,
          message: 'Decision orchestrator not available',
          timestamp: Date.now()
        });
        return;
      }

      const metricsReport = this.orchestrator.getMetricsReport();
      
      res.json({
        success: true,
        ...metricsReport,
        engine: 'Phase 2.5 Decision Engine',
        version: '1.0.0'
      });
    } catch (error) {
      console.error('Error in metrics endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get the configured router
   */
  getRouter(): Router {
    return this.router;
  }
}