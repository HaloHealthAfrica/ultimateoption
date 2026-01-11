/**
 * Phase 2 Decision Engine - Health Middleware
 * 
 * Express middleware for health check endpoints with proper
 * HTTP status codes and response formatting.
 */

import { Request, Response } from 'express';
import { HealthService } from '../services/health-service';
import { Logger } from '../services/logger';

export class HealthMiddleware {
  private healthService: HealthService;
  private logger: Logger;

  constructor(healthService: HealthService, logger: Logger) {
    this.healthService = healthService;
    this.logger = logger;
  }

  /**
   * Full health check endpoint handler
   * GET /health
   */
  getHealthHandler() {
    return async (req: Request, res: Response) => {
      const requestId = (req as any).requestId || `health_${Date.now()}`;
      
      try {
        this.logger.info('Health check requested', {
          requestId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        const health = await this.healthService.checkHealth();
        
        // Set appropriate HTTP status code
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
          ...health,
          requestId
        });

        this.logger.info('Health check completed', {
          requestId,
          status: health.status,
          statusCode,
          responseTime: Date.now() - parseInt(requestId.split('_')[1] || '0'),
          providerCount: health.providers.length
        });

      } catch (error) {
        this.logger.error('Health check failed', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });

        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed',
          requestId
        });
      }
    };
  }

  /**
   * Quick health check endpoint handler (for load balancers)
   * GET /health/quick
   */
  getQuickHealthHandler() {
    return async (req: Request, res: Response) => {
      const requestId = (req as any).requestId || `quick_health_${Date.now()}`;
      
      try {
        const health = await this.healthService.getQuickHealth();
        
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
          ...health,
          requestId
        });

      } catch (error) {
        this.logger.error('Quick health check failed', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          requestId
        });
      }
    };
  }

  /**
   * Readiness probe endpoint handler (for Kubernetes)
   * GET /health/ready
   */
  getReadinessHandler() {
    return async (req: Request, res: Response) => {
      const requestId = (req as any).requestId || `readiness_${Date.now()}`;
      
      try {
        // Test provider connectivity
        const isReady = await this.healthService.testProviderConnectivity();
        
        if (isReady) {
          res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
            requestId
          });
        } else {
          res.status(503).json({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            message: 'Provider connectivity issues',
            requestId
          });
        }

      } catch (error) {
        this.logger.error('Readiness check failed', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          error: 'Readiness check failed',
          requestId
        });
      }
    };
  }

  /**
   * Liveness probe endpoint handler (for Kubernetes)
   * GET /health/live
   */
  getLivenessHandler() {
    return (req: Request, res: Response) => {
      const requestId = (req as any).requestId || `liveness_${Date.now()}`;
      
      // Simple liveness check - if we can respond, we're alive
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: this.healthService.getUptime(),
        requestId
      });
    };
  }
}