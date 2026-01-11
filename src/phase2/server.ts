/**
 * Phase 2 Decision Engine - Main Server
 * 
 * Express server entry point for the deterministic decision engine.
 */

import { loadConfig, validateConfig } from './config';
import { WebhookService } from './services/webhook-service';
import { Logger } from './services/logger';
import { ENGINE_VERSION } from './types';

async function startServer(): Promise<void> {
  const logger = new Logger(process.env.LOG_LEVEL || 'info');

  try {
    // Load and validate configuration
    logger.info('Loading configuration...');
    const config = loadConfig();
    validateConfig(config);
    logger.info('Configuration loaded successfully');

    // Initialize webhook service
    logger.info('Initializing webhook service...');
    const webhookService = new WebhookService(logger);
    const app = webhookService.getApp();

    // Start server
    const server = app.listen(config.server.port, () => {
      logger.info('Phase 2 Decision Engine started', {
        version: ENGINE_VERSION,
        port: config.server.port,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
      });
    });

    // Graceful shutdown handling
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch(console.error);
}

export { startServer };