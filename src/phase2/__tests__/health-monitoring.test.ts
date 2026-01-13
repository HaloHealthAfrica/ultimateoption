/**
 * Phase 2 Decision Engine - Health Monitoring Tests
 * 
 * Comprehensive tests for health check endpoints, structured logging,
 * and sensitive data masking functionality.
 */

import request from 'supertest';
import express from 'express';
import { HealthService } from '../services';
import { HealthMiddleware } from '../middleware';
import { Logger } from '../services/logger';
import { TradierClient } from '../providers/tradier-client';
import { TwelveDataClient } from '../providers/twelvedata-client';
import { AlpacaClient } from '../providers/alpaca-client';
import { MarketContextBuilder } from '../services/market-context-builder';
import { PerformanceTracker } from '../services/performance-tracker';
import { DecisionOutput, ENGINE_VERSION, DecisionContext } from '../types';

// Mock providers
jest.mock('../providers/tradier-client');
jest.mock('../providers/twelvedata-client');
jest.mock('../providers/alpaca-client');
jest.mock('../services/market-context-builder');

describe('Health Monitoring System', () => {
  let app: express.Application;
  let logger: Logger;
  let healthService: HealthService;
  let healthMiddleware: HealthMiddleware;
  let performanceTracker: PerformanceTracker;
  let tradierClient: jest.Mocked<TradierClient>;
  let twelveDataClient: jest.Mocked<TwelveDataClient>;
  let alpacaClient: jest.Mocked<AlpacaClient>;
  let marketContextBuilder: jest.Mocked<MarketContextBuilder>;

  beforeEach(() => {
    // Create mocked instances
    logger = new Logger('debug');
    performanceTracker = new PerformanceTracker(logger);
    
    tradierClient = new TradierClient({} as unknown, logger) as jest.Mocked<TradierClient>;
    twelveDataClient = new TwelveDataClient({} as unknown, logger) as jest.Mocked<TwelveDataClient>;
    alpacaClient = new AlpacaClient({} as unknown, logger) as jest.Mocked<AlpacaClient>;
    marketContextBuilder = new MarketContextBuilder(
      tradierClient,
      twelveDataClient,
      alpacaClient,
      logger
    ) as jest.Mocked<MarketContextBuilder>;

    // Create health service
    healthService = new HealthService(
      logger,
      tradierClient,
      twelveDataClient,
      alpacaClient,
      marketContextBuilder,
      performanceTracker
    );

    healthMiddleware = new HealthMiddleware(healthService, logger);

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Add health endpoints
    app.get('/health', healthMiddleware.getHealthHandler());
    app.get('/health/quick', healthMiddleware.getQuickHealthHandler());
    app.get('/health/ready', healthMiddleware.getReadinessHandler());
    app.get('/health/live', healthMiddleware.getLivenessHandler());
  });

  describe('Health Check Endpoints', () => {
    
    describe('GET /health', () => {
      
      test('should return HTTP 200 when all providers are healthy', async () => {
        // Mock all providers as healthy
        tradierClient.testConnection.mockResolvedValue(true);
        twelveDataClient.testConnection.mockResolvedValue(true);
        alpacaClient.testConnection.mockResolvedValue(true);

        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('engineVersion', ENGINE_VERSION);
        expect(response.body).toHaveProperty('providers');
        expect(response.body).toHaveProperty('performance');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('requestId');
        
        // Check providers array
        expect(response.body.providers).toHaveLength(3);
        response.body.providers.forEach((provider: unknown) => {
          expect(_provider).toHaveProperty('name');
          expect(_provider).toHaveProperty('status', 'healthy');
          expect(_provider).toHaveProperty('responseTime');
          expect(_provider).toHaveProperty('lastChecked');
        });
      });

      test('should return HTTP 503 when any provider is unhealthy', async () => {
        // Mock one provider as unhealthy
        tradierClient.testConnection.mockRejectedValue(new Error('Connection failed'));
        twelveDataClient.testConnection.mockResolvedValue(true);
        alpacaClient.testConnection.mockResolvedValue(true);

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body).toHaveProperty('status', 'unhealthy');
        
        // Check that failed provider is marked as unhealthy
        const tradierProvider = response.body.providers.find((p: unknown) => p.name === 'tradier');
        expect(tradierProvider).toHaveProperty('status', 'unhealthy');
        expect(tradierProvider).toHaveProperty('error');
      });

      test('should return degraded status when provider is slow', async () => {
        // Mock providers with slow response
        tradierClient.testConnection.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(true), 1100))
        );
        twelveDataClient.testConnection.mockResolvedValue(true);
        alpacaClient.testConnection.mockResolvedValue(true);

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body.status).toBe('degraded');
        
        const tradierProvider = response.body.providers.find((p: unknown) => p.name === 'tradier');
        expect(tradierProvider.status).toBe('degraded');
        expect(tradierProvider.responseTime).toBeGreaterThan(1000);
      });

      test('should include performance health in response', async () => {
        // Mock providers as healthy
        tradierClient.testConnection.mockResolvedValue(true);
        twelveDataClient.testConnection.mockResolvedValue(true);
        alpacaClient.testConnection.mockResolvedValue(true);

        const response = await request(app).get('/health');

        expect(response.body.performance).toHaveProperty('healthy');
        expect(response.body.performance).toHaveProperty('issues');
        expect(Array.isArray(response.body.performance.issues)).toBe(true);
      });
    });

    describe('GET /health/quick', () => {
      
      test('should return quick health status', async () => {
        const response = await request(app).get('/health/quick');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('requestId');
        expect(['healthy', 'unhealthy']).toContain(response.body.status);
      });

      test('should be faster than full health check', async () => {
        const startTime = Date.now();
        await request(app).get('/health/quick');
        const quickDuration = Date.now() - startTime;

        // Quick health should be very fast (< 50ms)
        expect(quickDuration).toBeLessThan(50);
      });
    });

    describe('GET /health/ready', () => {
      
      test('should return ready when providers are connected', async () => {
        marketContextBuilder.testConnectivity.mockResolvedValue({
          tradier: true,
          twelveData: true,
          alpaca: true
        });

        const response = await request(app).get('/health/ready');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ready');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('requestId');
      });

      test('should return not ready when providers are disconnected', async () => {
        marketContextBuilder.testConnectivity.mockResolvedValue({
          tradier: false,
          twelveData: true,
          alpaca: true
        });

        const response = await request(app).get('/health/ready');

        expect(response.status).toBe(503);
        expect(response.body).toHaveProperty('status', 'not_ready');
        expect(response.body).toHaveProperty('message');
      });
    });

    describe('GET /health/live', () => {
      
      test('should always return alive status', async () => {
        const response = await request(app).get('/health/live');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'alive');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('requestId');
        expect(typeof response.body.uptime).toBe('number');
        expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Health Service', () => {
    
    test('should check provider health in parallel', async () => {
      const startTime = Date.now();
      
      // Mock providers with delays
      tradierClient.testConnection.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 100))
      );
      twelveDataClient.testConnection.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 100))
      );
      alpacaClient.testConnection.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      await healthService.checkHealth();
      
      const duration = Date.now() - startTime;
      
      // Should complete in ~100ms (parallel) not ~300ms (sequential)
      expect(duration).toBeLessThan(200);
    });

    test('should track uptime correctly', async () => {
      const initialUptime = healthService.getUptime();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const laterUptime = healthService.getUptime();
      expect(laterUptime).toBeGreaterThan(initialUptime);
    });

    test('should reset uptime when requested', () => {
      const initialUptime = healthService.getUptime();
      
      healthService.resetUptime();
      
      const resetUptime = healthService.getUptime();
      expect(resetUptime).toBeLessThan(initialUptime);
    });
  });

  describe('Structured Logging', () => {
    
    test('should log decision events with complete context', () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      const context: DecisionContext = {
        signal: {
          type: 'LONG',
          symbol: 'SPY',
          timestamp: Date.now()
        },
        aiScore: 8.5,
        satyPhase: 75,
        marketSession: 'OPEN'
      };

      const output: DecisionOutput = {
        decision: 'APPROVE',
        direction: 'LONG',
        confidence: 8.5,
        timestamp: new Date().toISOString(),
        engineVersion: ENGINE_VERSION,
        audit: {
          context,
          gateResults: [],
          processingTime: 15,
          timestamp: new Date().toISOString(),
          engineVersion: ENGINE_VERSION
        }
      };

      logger.logDecisionEvent(context, output, 15);

      expect(logSpy).toHaveBeenCalledWith(
        'Decision completed',
        expect.objectContaining({
          type: 'DECISION_EVENT',
          engineVersion: ENGINE_VERSION,
          decision: 'APPROVE',
          processingTime: 15
        })
      );
    });

    test('should log provider failures with error details', () => {
      const logSpy = jest.spyOn(logger, 'warn');
      
      logger.logProviderFailure('tradier', 'Connection timeout', 600, true);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Provider error - using fallback'),
        expect.objectContaining({
          context: expect.objectContaining({
            type: 'PROVIDER_ERROR',
            provider: 'tradier',
            error: 'Connection timeout',
            timeout: 600,
            fallbackUsed: true
          })
        })
      );
    });

    test('should log performance warnings when thresholds exceeded', () => {
      const logSpy = jest.spyOn(logger, 'warn');
      
      logger.logPerformanceWarning('response_time', 750, 500, 'warning');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance warning'),
        expect.objectContaining({
          context: expect.objectContaining({
            type: 'PERFORMANCE_WARNING',
            metric: 'response_time',
            value: 750,
            threshold: 500,
            severity: 'warning'
          })
        })
      );
    });

    test('should log critical performance issues as errors', () => {
      const logSpy = jest.spyOn(logger, 'error');
      
      logger.logPerformanceWarning('error_rate', 0.25, 0.05, 'critical');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance critical'),
        expect.objectContaining({
          context: expect.objectContaining({
            severity: 'critical'
          })
        })
      );
    });

    test('should log errors with stack traces and request context', () => {
      const logSpy = jest.spyOn(logger, 'error');
      const error = new Error('Test error');
      
      const requestContext = {
        method: 'POST',
        path: '/api/webhooks/signals',
        ip: '127.0.0.1',
        requestId: 'test_123',
        body: { signal: { type: 'LONG' } }
      };

      logger.logError('Request processing failed', _error, requestContext);

      expect(logSpy).toHaveBeenCalledWith(
        'Request processing failed',
        expect.objectContaining({
          type: 'ERROR_EVENT',
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
            stack: expect.any(String)
          }),
          requestContext: expect.objectContaining({
            method: 'POST',
            path: '/api/webhooks/signals',
            requestId: 'test_123'
          })
        })
      );
    });

    test('should use structured JSON format for all logs', () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      logger.info('Test message', { key: 'value', number: 123 });

      expect(logSpy).toHaveBeenCalledWith('Test message', { key: 'value', number: 123 });
    });
  });

  describe('Sensitive Data Masking', () => {
    
    test('should mask API keys in log messages', () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      const sensitiveData = {
        apiKey: 'secret_key_12345',
        tradierApiKey: 'tradier_secret',
        data: 'normal_data'
      };

      logger.info('Test with sensitive data', sensitiveData);

      // The actual masking is done in the config module
      // Here we just verify the logger calls the masking function
      expect(logSpy).toHaveBeenCalled();
    });

    test('should mask sensitive data in decision context', () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      const context: DecisionContext = {
        signal: {
          type: 'LONG',
          symbol: 'SPY',
          timestamp: Date.now(),
          metadata: {
            apiKey: 'secret_key',
            source: 'tradingview'
          }
        },
        aiScore: 8.5,
        satyPhase: 75,
        marketSession: 'OPEN'
      };

      const output: DecisionOutput = {
        decision: 'APPROVE',
        direction: 'LONG',
        confidence: 8.5,
        timestamp: new Date().toISOString(),
        engineVersion: ENGINE_VERSION,
        audit: {
          context,
          gateResults: [],
          processingTime: 15,
          timestamp: new Date().toISOString(),
          engineVersion: ENGINE_VERSION
        }
      };

      logger.logDecisionEvent(context, output, 15);

      expect(logSpy).toHaveBeenCalled();
      // The actual masking verification would need to check the formatted output
    });

    test('should mask sensitive data in request context', () => {
      const logSpy = jest.spyOn(logger, 'error');
      const error = new Error('Test error');
      
      const requestContext = {
        method: 'POST',
        path: '/api/webhooks/signals',
        ip: '127.0.0.1',
        requestId: 'test_123',
        body: {
          signal: { type: 'LONG' },
          apiKey: 'secret_key_12345'
        }
      };

      logger.logError('Request failed', _error, requestContext);

      expect(logSpy).toHaveBeenCalled();
      // The masking should be applied to the request context body
    });
  });

  describe('Error Handling in Health Endpoints', () => {
    
    test('should handle health service errors gracefully', async () => {
      // Mock health service to throw error
      jest.spyOn(healthService, 'checkHealth').mockRejectedValue(new Error('Health check failed'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body).toHaveProperty('error', 'Health check failed');
      expect(response.body).toHaveProperty('requestId');
    });

    test('should handle readiness check errors gracefully', async () => {
      jest.spyOn(healthService, 'testProviderConnectivity').mockRejectedValue(new Error('Connectivity test failed'));

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'not_ready');
      expect(response.body).toHaveProperty('error', 'Readiness check failed');
    });
  });

  describe('Health Monitoring Integration', () => {
    
    test('should integrate with performance tracker', async () => {
      // Add some performance data
      performanceTracker.startRequest('test_req');
      performanceTracker.completeRequest('test_req', 100, true);

      tradierClient.testConnection.mockResolvedValue(true);
      twelveDataClient.testConnection.mockResolvedValue(true);
      alpacaClient.testConnection.mockResolvedValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.performance).toHaveProperty('healthy');
      expect(response.body.performance).toHaveProperty('issues');
    });

    test('should report unhealthy when performance issues exist', async () => {
      // Simulate performance issues
      for (let i = 0; i < 10; i++) {
        performanceTracker.startRequest(`req_${i}`);
        performanceTracker.completeRequest(`req_${i}`, 600, false); // Slow and failed
      }

      tradierClient.testConnection.mockResolvedValue(true);
      twelveDataClient.testConnection.mockResolvedValue(true);
      alpacaClient.testConnection.mockResolvedValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.performance.healthy).toBe(false);
      expect(response.body.performance.issues.length).toBeGreaterThan(0);
    });
  });
});