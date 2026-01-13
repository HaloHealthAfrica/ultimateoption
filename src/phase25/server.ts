/**
 * Phase 2.5 Decision Engine Server
 * 
 * Express.js server setup for the webhook endpoints and decision engine.
 */

import express from 'express';
import cors from 'cors';
import { WebhookRoutes } from './routes/webhook.routes';
import { ServiceFactory } from './services/service-factory';
import { AuthConfig } from './types';

export class Phase25Server {
  private app: express.Application;
  private port: number;
  private serviceFactory: ServiceFactory;

  constructor(port: number = 3001) {
    this.app = express();
    this.port = port;
    this.serviceFactory = ServiceFactory.getInstance();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Initialize the decision orchestrator
    const decisionOnlyMode = process.env.DECISION_ONLY_MODE === 'true';
    const orchestrator = this.serviceFactory.createOrchestrator(decisionOnlyMode);

    // Authentication configuration
    const authConfig: AuthConfig = {
      requireAuth: process.env.REQUIRE_WEBHOOK_AUTH === 'true',
      hmacSecret: process.env.WEBHOOK_HMAC_SECRET,
      bearerToken: process.env.WEBHOOK_BEARER_TOKEN
    };

    // Webhook routes with orchestrator integration
    const webhookRoutes = new WebhookRoutes(authConfig, orchestrator);
    this.app.use('/api/webhooks', webhookRoutes.getRouter());

    // Root health check
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Phase 2.5 Decision Engine',
        version: '1.0.0',
        status: 'running',
        timestamp: Date.now()
      });
    });

    // Global metrics endpoint
    this.app.get('/api/metrics', (req, res) => {
      try {
        const metricsReport = orchestrator.getMetricsReport();
        res.json({
          success: true,
          ...metricsReport,
          engine: 'Phase 2.5 Decision Engine',
          version: '1.0.0'
        });
      } catch {
        console.error('Error in global metrics endpoint:');
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve metrics',
          timestamp: Date.now()
        });
      }
    });

    // Global health endpoint
    this.app.get('/api/health', async (req, res) => {
      try {
        const healthStatus = await orchestrator.getSystemHealthStatus();
        const statusCode = healthStatus.status === 'healthy' ? 200 : 
                          healthStatus.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json({
          ...healthStatus,
          engine: 'Phase 2.5 Decision Engine',
          version: '1.0.0',
          uptime: process.uptime()
        });
      } catch {
        console.error('Error in global health check:');
        res.status(500).json({
          status: 'unhealthy',
          message: 'Health check failed',
          timestamp: Date.now()
        });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl,
        timestamp: Date.now()
      });
    });

    // Error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Unhandled error:');
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        timestamp: Date.now()
      });
    });
  }

  /**
   * Start the server
   */
  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`Phase 2.5 Decision Engine server running on port ${this.port}`);
        console.log(`Health check: http://localhost:${this.port}/`);
        console.log(`Webhook endpoints:`);
        console.log(`  POST http://localhost:${this.port}/api/webhooks/signals`);
        console.log(`  POST http://localhost:${this.port}/api/webhooks/saty-phase`);
        console.log(`Health and metrics endpoints:`);
        console.log(`  GET  http://localhost:${this.port}/api/health`);
        console.log(`  GET  http://localhost:${this.port}/api/metrics`);
        console.log(`  GET  http://localhost:${this.port}/api/webhooks/health`);
        console.log(`  GET  http://localhost:${this.port}/api/webhooks/health/detailed`);
        console.log(`  GET  http://localhost:${this.port}/api/webhooks/metrics`);
        resolve();
      });
    });
  }

  /**
   * Get the Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Phase25Server();
  server.start().catch(console.error);
}