/**
 * Phase 2 Decision Engine - Error Handling Tests
 * 
 * Comprehensive tests for error handling middleware including
 * validation errors, internal errors, service degradation, and system overload.
 */

import request from 'supertest';
import express from 'express';
import {
  errorHandler,
  asyncHandler,
  validateRequest,
  timeoutHandler,
  ValidationError,
  InternalError,
  ServiceUnavailableError,
  ProviderError,
  TimeoutError,
  RateLimitError,
  ImmutabilityViolationError,
  ErrorType,
  ServiceHealthChecker,
  CircuitBreaker
} from '../middleware/error-handler';
import { rateLimitMiddleware } from '../middleware/rate-limiter';
import { requestLogger } from '../middleware/request-logger';
import { HTTP_STATUS } from '../constants/gates';
import { ENGINE_VERSION } from '../types';

describe('Error Handling System', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(requestLogger);
  });

  afterEach(() => {
    // Clean up any timers or intervals
    jest.clearAllTimers();
  });

  describe('Error Classes', () => {
    
    test('ValidationError should create proper error with HTTP 400', () => {
      const error = new ValidationError('Invalid input', { field: 'test' });
      
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.message).toBe('Invalid input');
      expect(error.context).toEqual({ field: 'test' });
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('InternalError should create proper error with HTTP 500', () => {
      const error = new InternalError('Database connection failed');
      
      expect(error.type).toBe(ErrorType.INTERNAL_ERROR);
      expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(error.message).toBe('Database connection failed');
    });

    test('ServiceUnavailableError should create proper error with HTTP 503', () => {
      const error = new ServiceUnavailableError('System overloaded');
      
      expect(error.type).toBe(ErrorType.SERVICE_UNAVAILABLE);
      expect(error.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      expect(error.message).toBe('System overloaded');
    });

    test('ProviderError should create proper error with HTTP 200 (fallback)', () => {
      const error = new ProviderError('Tradier API timeout', 'tradier');
      
      expect(error.type).toBe(ErrorType.PROVIDER_ERROR);
      expect(error.statusCode).toBe(HTTP_STATUS.OK);
      expect(error.context.provider).toBe('tradier');
    });

    test('TimeoutError should create proper error with timeout context', () => {
      const error = new TimeoutError('Request timeout', 5000);
      
      expect(error.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(error.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      expect(error.context.timeoutMs).toBe(5000);
    });

    test('RateLimitError should create proper error with retry info', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);
      
      expect(error.type).toBe(ErrorType.RATE_LIMIT_ERROR);
      expect(error.statusCode).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(error.context.retryAfter).toBe(60);
    });

    test('ImmutabilityViolationError should create critical error', () => {
      const error = new ImmutabilityViolationError('Configuration modified');
      
      expect(error.type).toBe(ErrorType.IMMUTABILITY_VIOLATION);
      expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Error Handler Middleware', () => {
    
    test('should handle ValidationError with HTTP 400', async () => {
      app.get('/test', (req, res, next) => {
        next(new ValidationError('Missing required field: symbol', { field: 'symbol' }));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toBe('Missing required field: symbol');
      expect(response.body.engineVersion).toBe(ENGINE_VERSION);
      expect(response.body.details.field).toBe('symbol');
    });

    test('should handle InternalError with HTTP 500', async () => {
      app.get('/test', (req, res, next) => {
        next(new InternalError('Database connection failed'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('INTERNAL_ERROR');
      expect(response.body.message).toBe('Database connection failed');
    });

    test('should handle ServiceUnavailableError with HTTP 503', async () => {
      app.get('/test', (req, res, next) => {
        next(new ServiceUnavailableError('System overloaded'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
    });

    test('should handle RateLimitError with Retry-After header', async () => {
      app.get('/test', (req, res, next) => {
        next(new RateLimitError('Rate limit exceeded', 60));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBe('60');
    });

    test('should convert generic errors to InternalError', async () => {
      app.get('/test', (req, res, next) => {
        next(new Error('Unexpected error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('INTERNAL_ERROR');
      expect(response.body.message).toBe('An internal error occurred. Please try again later.');
    });

    test('should include request ID in response', async () => {
      app.get('/test', (req, res, next) => {
        next(new ValidationError('Test error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });
  });

  describe('Validation Middleware', () => {
    
    test('should validate required fields successfully', async () => {
      app.post('/test', 
        validateRequest({
          name: (value) => typeof value === 'string' || 'Name must be a string',
          age: (value) => typeof value === 'number' || 'Age must be a number'
        }),
        (req, res) => res.json({ success: true })
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: 'John', age: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject invalid fields with detailed errors', async () => {
      app.post('/test', 
        validateRequest({
          name: (value) => typeof value === 'string' || 'Name must be a string',
          age: (value) => typeof value === 'number' || 'Age must be a number'
        }),
        (req, res) => res.json({ success: true })
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: 123, age: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Name must be a string');
      expect(response.body.message).toContain('Age must be a number');
    });

    test('should handle missing required fields', async () => {
      app.post('/test', 
        validateRequest({
          required: (value) => value !== undefined || 'Required field is missing'
        }),
        (req, res) => res.json({ success: true })
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Required field is missing');
    });
  });

  describe('Async Handler Wrapper', () => {
    
    test('should handle async errors properly', async () => {
      app.get('/test', asyncHandler(async (req, res, next) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new ValidationError('Async validation error');
      }));
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    test('should handle async promise rejections', async () => {
      app.get('/test', asyncHandler(async (req, res, next) => {
        await Promise.reject(new Error('Promise rejection'));
      }));
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('INTERNAL_ERROR');
    });
  });

  describe('Timeout Handler', () => {
    
    test('should handle request timeouts', async () => {
      app.use(timeoutHandler(100)); // 100ms timeout
      app.get('/test', asyncHandler(async (req, res, next) => {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
        res.json({ success: true });
      }));
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('TIMEOUT_ERROR');
    }, 10000);

    test('should not timeout for fast requests', async () => {
      app.use(timeoutHandler(1000)); // 1 second timeout
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Service Health Checker', () => {
    let healthChecker: ServiceHealthChecker;

    beforeEach(() => {
      healthChecker = ServiceHealthChecker.getInstance();
    });

    test('should track service health status', () => {
      expect(healthChecker.isServiceHealthy('test-service')).toBe(true);
      
      healthChecker.markServiceUnhealthy('test-service');
      expect(healthChecker.isServiceHealthy('test-service')).toBe(false);
      
      healthChecker.markServiceHealthy('test-service');
      expect(healthChecker.isServiceHealthy('test-service')).toBe(true);
    });

    test('should provide system health overview', () => {
      healthChecker.markServiceUnhealthy('service1');
      healthChecker.markServiceHealthy('service2');
      
      const health = healthChecker.getSystemHealth();
      
      expect(health.healthy).toBe(false);
      expect(health.services.service1).toBe(false);
      expect(health.services.service2).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(3, 1000); // 3 failures, 1 second recovery
    });

    test('should allow execution when circuit is closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should open circuit after failure threshold', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));
      
      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected failures
        }
      }
      
      // Circuit should now be open
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');
      
      const state = circuitBreaker.getState();
      expect(state.state).toBe('OPEN');
      expect(state.failures).toBe(3);
    });

    test('should transition to half-open after recovery time', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValue('success');
      
      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected failures
        }
      }
      
      // Wait for recovery time
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should allow one attempt in half-open state
      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBe('success');
      
      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
    }, 10000);
  });

  describe('Integration Error Scenarios', () => {
    
    test('should handle provider timeout with fallback', async () => {
      app.get('/test', asyncHandler(async (req, res, next) => {
        // Simulate provider timeout
        throw new ProviderError('Tradier API timeout - using fallback data', 'tradier', {
          timeout: 600,
          fallbackUsed: true
        });
      }));
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(200); // Provider errors return 200 with fallback
      expect(response.body.error).toBe('PROVIDER_ERROR');
      expect(response.body.details.provider).toBe('tradier');
      expect(response.body.details.fallbackUsed).toBe(true);
    });

    test('should handle system overload scenario', async () => {
      app.get('/test', (req, res, next) => {
        next(new ServiceUnavailableError('System overloaded - too many concurrent requests', {
          activeRequests: 100,
          maxConcurrent: 50
        }));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
      expect(response.body.details.activeRequests).toBe(100);
    });

    test('should handle immutability violation', async () => {
      app.get('/test', (req, res, next) => {
        next(new ImmutabilityViolationError('Attempted to modify frozen configuration', {
          object: 'GATE_THRESHOLDS',
          property: 'SPREAD_BPS'
        }));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('IMMUTABILITY_VIOLATION');
      expect(response.body.details.object).toBe('GATE_THRESHOLDS');
    });

    test('should handle validation failure with field details', async () => {
      app.post('/webhook', 
        validateRequest({
          signal: (value) => {
            if (!value || typeof value !== 'object') {
              return 'Signal object is required';
            }
            if (!value.type || !['LONG', 'SHORT'].includes(value.type)) {
              return 'Signal type must be LONG or SHORT';
            }
            return true;
          },
          aiScore: (value) => {
            if (typeof value !== 'number') {
              return 'aiScore must be a number';
            }
            if (value < 0 || value > 10.5) {
              return 'aiScore must be between 0 and 10.5';
            }
            return true;
          }
        }),
        (req, res) => res.json({ success: true })
      );
      app.use(errorHandler);

      const response = await request(app)
        .post('/webhook')
        .send({
          signal: { type: 'INVALID' },
          aiScore: 'not-a-number'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Signal type must be LONG or SHORT');
      expect(response.body.message).toContain('aiScore must be a number');
    });
  });

  describe('Error Response Format', () => {
    
    test('should include all required fields in error response', async () => {
      app.get('/test', (req, res, next) => {
        next(new ValidationError('Test validation error', { field: 'test' }));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('engineVersion');
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('details');
      
      expect(response.body.engineVersion).toBe(ENGINE_VERSION);
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('should include proper headers in error response', async () => {
      app.get('/test', (req, res, next) => {
        next(new ValidationError('Test error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-engine-version']).toBe(ENGINE_VERSION);
    });
  });
});