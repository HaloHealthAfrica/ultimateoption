/**
 * Phase 2 Decision Engine - Request Logging Middleware
 * 
 * Comprehensive request logging with performance metrics,
 * error tracking, and security monitoring.
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../services/logger';

// Create a logger instance for request logging
const logger = new Logger();
import { PerformanceMonitor } from '../services/performance-monitor';
import { ENGINE_VERSION } from '../types';

/**
 * Request context interface
 */
interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  query: any;
  userAgent?: string;
  ip: string;
  timestamp: string;
  engineVersion: string;
}

/**
 * Response context interface
 */
interface ResponseContext extends RequestContext {
  statusCode: number;
  responseTime: number;
  contentLength?: number;
  error?: string;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mask sensitive data in request body
 */
function maskSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const masked = { ...data };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'key'];

  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = '***MASKED***';
    }
  }

  return masked;
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Add request ID to request object for downstream use
  (req as any).requestId = requestId;
  
  // Set request ID header
  res.set('X-Request-ID', requestId);
  res.set('X-Engine-Version', ENGINE_VERSION);

  const requestContext: RequestContext = {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip || 'unknown',
    timestamp: new Date().toISOString(),
    engineVersion: ENGINE_VERSION
  };

  // Log incoming request
  logger.info('Incoming request', {
    ...requestContext,
    body: req.method === 'POST' ? maskSensitiveData(req.body) : undefined,
    headers: {
      'content-type': req.get('Content-Type'),
      'content-length': req.get('Content-Length'),
      'authorization': req.get('Authorization') ? '***PRESENT***' : undefined
    }
  });

  // Capture response
  const originalSend = res.send;
  let responseBody: any;

  res.send = function(body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  // Log response when finished
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const contentLength = res.get('Content-Length');

    const responseContext: ResponseContext = {
      ...requestContext,
      statusCode: res.statusCode,
      responseTime,
      contentLength: contentLength ? parseInt(contentLength, 10) : undefined
    };

    // Determine log level based on status code
    let logLevel: 'info' | 'warn' | 'error' = 'info';
    if (res.statusCode >= 400 && res.statusCode < 500) {
      logLevel = 'warn';
      responseContext.error = 'Client error';
    } else if (res.statusCode >= 500) {
      logLevel = 'error';
      responseContext.error = 'Server error';
    }

    // Log response
    logger[logLevel]('Request completed', {
      ...responseContext,
      response: res.statusCode >= 400 ? maskSensitiveData(responseBody) : undefined
    });

    // Record performance metrics
    const performanceMonitor = new PerformanceMonitor(logger);
    if (res.statusCode < 400) {
      performanceMonitor.recordRequest(responseTime, true);
    } else {
      performanceMonitor.recordRequest(responseTime, false);
    }

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        ...responseContext,
        threshold: 1000,
        performance: 'SLOW'
      });
    }

    // Log security events
    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.warn('Security event', {
        ...responseContext,
        event: 'UNAUTHORIZED_ACCESS',
        severity: 'MEDIUM'
      });
    }

    // Log rate limiting
    if (res.statusCode === 429) {
      logger.warn('Rate limit triggered', {
        ...responseContext,
        event: 'RATE_LIMIT_EXCEEDED',
        severity: 'LOW'
      });
    }
  });

  // Log request errors
  res.on('error', (error) => {
    const responseTime = Date.now() - startTime;
    
    logger.error('Request error', {
      ...requestContext,
      error: error.message,
      stack: error.stack,
      responseTime
    });
  });

  next();
}

/**
 * Security logging middleware for sensitive endpoints
 */
export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId || generateRequestId();
  
  // Log security-relevant request details
  logger.info('Security-sensitive request', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    headers: {
      authorization: req.get('Authorization') ? 'PRESENT' : 'MISSING',
      'x-api-key': req.get('X-API-Key') ? 'PRESENT' : 'MISSING',
      'x-forwarded-for': req.get('X-Forwarded-For'),
      'x-real-ip': req.get('X-Real-IP')
    }
  });

  next();
}

/**
 * Performance logging middleware
 */
export function performanceLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  const requestId = (req as any).requestId || generateRequestId();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTimeNs = endTime - startTime;
    const responseTimeMs = Number(responseTimeNs) / 1000000;

    // Log performance metrics
    logger.info('Performance metrics', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: {
        ms: responseTimeMs,
        ns: Number(responseTimeNs)
      },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });

    // Alert on performance issues
    if (responseTimeMs > 500) {
      logger.warn('Performance alert', {
        requestId,
        responseTime: responseTimeMs,
        threshold: 500,
        severity: responseTimeMs > 1000 ? 'HIGH' : 'MEDIUM'
      });
    }
  });

  next();
}

/**
 * Audit logging middleware for compliance
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId || generateRequestId();
  
  // Log audit trail for compliance
  logger.info('Audit trail', {
    requestId,
    event: 'API_REQUEST',
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    compliance: {
      dataProcessed: req.method === 'POST',
      sensitiveEndpoint: req.path.includes('/webhooks/'),
      authenticationUsed: !!req.get('Authorization')
    }
  });

  res.on('finish', () => {
    logger.info('Audit trail completion', {
      requestId,
      event: 'API_RESPONSE',
      statusCode: res.statusCode,
      success: res.statusCode < 400,
      timestamp: new Date().toISOString()
    });
  });

  next();
}