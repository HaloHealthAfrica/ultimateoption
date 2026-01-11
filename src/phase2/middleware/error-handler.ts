/**
 * Phase 2 Decision Engine - Error Handling Middleware
 * 
 * Comprehensive error handling for all HTTP endpoints with proper
 * status codes, detailed logging, and graceful degradation.
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../services/logger';

// Create a logger instance for error handling
const logger = new Logger();
import { HTTP_STATUS } from '../constants/gates';
import { ENGINE_VERSION } from '../types';

/**
 * Error types for classification
 */
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  IMMUTABILITY_VIOLATION = 'IMMUTABILITY_VIOLATION'
}

/**
 * Custom error class with additional context
 */
export class Phase2Error extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly context?: any;
  public readonly timestamp: string;

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number,
    context?: any
  ) {
    super(message);
    this.name = 'Phase2Error';
    this.type = type;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Validation error for HTTP 400 responses
 */
export class ValidationError extends Phase2Error {
  constructor(message: string, context?: any) {
    super(ErrorType.VALIDATION_ERROR, message, HTTP_STATUS.BAD_REQUEST, context);
  }
}

/**
 * Internal error for HTTP 500 responses
 */
export class InternalError extends Phase2Error {
  constructor(message: string, context?: any) {
    super(ErrorType.INTERNAL_ERROR, message, HTTP_STATUS.INTERNAL_SERVER_ERROR, context);
  }
}

/**
 * Service unavailable error for HTTP 503 responses
 */
export class ServiceUnavailableError extends Phase2Error {
  constructor(message: string, context?: any) {
    super(ErrorType.SERVICE_UNAVAILABLE, message, HTTP_STATUS.SERVICE_UNAVAILABLE, context);
  }
}

/**
 * Provider error for external API failures
 */
export class ProviderError extends Phase2Error {
  constructor(message: string, provider: string, context?: any) {
    super(
      ErrorType.PROVIDER_ERROR,
      message,
      HTTP_STATUS.OK, // Return 200 with fallback data
      { provider, ...context }
    );
  }
}

/**
 * Timeout error for request timeouts
 */
export class TimeoutError extends Phase2Error {
  constructor(message: string, timeoutMs: number, context?: any) {
    super(
      ErrorType.TIMEOUT_ERROR,
      message,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { timeoutMs, ...context }
    );
  }
}

/**
 * Rate limit error for HTTP 429 responses
 */
export class RateLimitError extends Phase2Error {
  constructor(message: string, retryAfter: number, context?: any) {
    super(
      ErrorType.RATE_LIMIT_ERROR,
      message,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      { retryAfter, ...context }
    );
  }
}

/**
 * Immutability violation error
 */
export class ImmutabilityViolationError extends Phase2Error {
  constructor(message: string, context?: any) {
    super(
      ErrorType.IMMUTABILITY_VIOLATION,
      message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      context
    );
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  type: string;
  message: string;
  timestamp: string;
  engineVersion: string;
  requestId?: string;
  details?: any;
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  error: Phase2Error,
  requestId?: string
): ErrorResponse {
  return {
    error: error.type,
    type: error.type,
    message: error.message,
    timestamp: error.timestamp,
    engineVersion: ENGINE_VERSION,
    requestId,
    details: error.context
  };
}

/**
 * Log error with appropriate level and context
 */
function logError(error: Phase2Error, req: Request): void {
  const logContext = {
    type: error.type,
    message: error.message,
    statusCode: error.statusCode,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: error.timestamp,
    context: error.context
  };

  switch (error.type) {
    case ErrorType.VALIDATION_ERROR:
      logger.warn('Validation error', logContext);
      break;
    case ErrorType.PROVIDER_ERROR:
      logger.warn('Provider error - using fallback', logContext);
      break;
    case ErrorType.TIMEOUT_ERROR:
      logger.error('Request timeout', logContext);
      break;
    case ErrorType.RATE_LIMIT_ERROR:
      logger.warn('Rate limit exceeded', logContext);
      break;
    case ErrorType.IMMUTABILITY_VIOLATION:
      logger.error('CRITICAL: Immutability violation detected', logContext);
      break;
    case ErrorType.SERVICE_UNAVAILABLE:
      logger.error('Service unavailable', logContext);
      break;
    default:
      logger.error('Internal error', logContext);
  }
}

/**
 * Main error handling middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let phase2Error: Phase2Error;

  // Convert generic errors to Phase2Error
  if (error instanceof Phase2Error) {
    phase2Error = error;
  } else if (error.name === 'ValidationError' || error.message.includes('validation')) {
    phase2Error = new ValidationError(error.message, { originalError: error.name });
  } else if (error.message.includes('timeout')) {
    phase2Error = new TimeoutError(error.message, 600, { originalError: error.name });
  } else if (error.message.includes('rate limit') || error.message.includes('too many')) {
    phase2Error = new RateLimitError(error.message, 60, { originalError: error.name });
  } else if (error.message.includes('immutability') || error.message.includes('frozen')) {
    phase2Error = new ImmutabilityViolationError(error.message, { originalError: error.name });
  } else {
    // Generic internal error
    phase2Error = new InternalError(
      'An internal error occurred. Please try again later.',
      { originalError: error.message, stack: error.stack }
    );
  }

  // Log the error
  logError(phase2Error, req);

  // Create response
  const errorResponse = createErrorResponse(phase2Error, requestId);

  // Set appropriate headers
  res.set('X-Request-ID', requestId);
  res.set('X-Engine-Version', ENGINE_VERSION);

  // Handle rate limiting
  if (phase2Error.type === ErrorType.RATE_LIMIT_ERROR) {
    res.set('Retry-After', phase2Error.context?.retryAfter?.toString() || '60');
  }

  // Send error response
  res.status(phase2Error.statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation middleware for request validation
 */
export function validateRequest(
  validationRules: Record<string, (value: any) => boolean | string>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const body = req.body;

    for (const [field, validator] of Object.entries(validationRules)) {
      const value = body[field];
      const result = validator(value);
      
      if (result !== true) {
        errors.push(typeof result === 'string' ? result : `Invalid ${field}`);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        `Validation failed: ${errors.join(', ')}`,
        { fields: errors, body }
      );
    }

    next();
  };
}

/**
 * Timeout middleware for request timeouts
 */
export function timeoutHandler(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    let timeoutTriggered = false;
    
    const timeout = setTimeout(() => {
      if (!res.headersSent && !timeoutTriggered) {
        timeoutTriggered = true;
        const error = new TimeoutError(
          `Request timeout after ${timeoutMs}ms`,
          timeoutMs,
          { method: req.method, path: req.path }
        );
        next(error);
      }
    }, timeoutMs);

    // Clear timeout when response finishes
    const cleanup = () => {
      clearTimeout(timeout);
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    next();
  };
}

/**
 * Service health checker
 */
export class ServiceHealthChecker {
  private static instance: ServiceHealthChecker;
  private healthStatus: Map<string, boolean> = new Map();
  private lastCheck: Map<string, number> = new Map();

  static getInstance(): ServiceHealthChecker {
    if (!ServiceHealthChecker.instance) {
      ServiceHealthChecker.instance = new ServiceHealthChecker();
    }
    return ServiceHealthChecker.instance;
  }

  /**
   * Check if service is healthy
   */
  isServiceHealthy(serviceName: string): boolean {
    return this.healthStatus.get(serviceName) ?? true;
  }

  /**
   * Mark service as unhealthy
   */
  markServiceUnhealthy(serviceName: string): void {
    this.healthStatus.set(serviceName, false);
    this.lastCheck.set(serviceName, Date.now());
    
    // Use conditional logging to avoid dependency issues in tests
    if (typeof logger !== 'undefined' && logger.warn) {
      logger.warn(`Service marked as unhealthy: ${serviceName}`, {
        service: serviceName,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Mark service as healthy
   */
  markServiceHealthy(serviceName: string): void {
    const wasUnhealthy = this.healthStatus.get(serviceName) === false;
    this.healthStatus.set(serviceName, true);
    this.lastCheck.set(serviceName, Date.now());
    
    if (wasUnhealthy && typeof logger !== 'undefined' && logger.info) {
      logger.info(`Service recovered: ${serviceName}`, {
        service: serviceName,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): { healthy: boolean; services: Record<string, boolean> } {
    const services: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [service, healthy] of this.healthStatus.entries()) {
      services[service] = healthy;
      if (!healthy) {
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, services };
  }
}

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeMs: number = 60000
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError(
          'Circuit breaker is OPEN - service temporarily unavailable',
          { state: this.state, failures: this.failures }
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): { state: string; failures: number; lastFailure: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailureTime
    };
  }
}