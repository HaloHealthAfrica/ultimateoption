/**
 * Phase 2 Decision Engine - Security Middleware
 * 
 * Additional security features including API key validation,
 * request sanitization, and security headers.
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError, InternalError } from './error-handler';
import { Logger } from '../services/logger';
import { ENGINE_VERSION } from '../types';

// Logger will be created when needed to avoid initialization issues
let logger: Logger | null = null;

function getLogger(): Logger {
  if (!logger) {
    logger = new Logger();
  }
  return logger;
}

/**
 * API Key validation configuration
 */
interface ApiKeyConfig {
  requiredForPaths?: string[];
  validKeys?: Set<string>;
  headerName?: string;
  allowBypass?: boolean;
}

/**
 * Security headers configuration
 */
interface SecurityHeadersConfig {
  enableCSP?: boolean;
  enableHSTS?: boolean;
  enableXFrameOptions?: boolean;
  enableXContentTypeOptions?: boolean;
  customHeaders?: Record<string, string>;
}

/**
 * Request sanitization configuration
 */
interface SanitizationConfig {
  maxBodySize?: number;
  maxHeaderSize?: number;
  allowedContentTypes?: string[];
  sanitizeHeaders?: boolean;
}

/**
 * API Key validation middleware
 */
export function apiKeyValidation(config: ApiKeyConfig = {}) {
  const {
    requiredForPaths = ['/api/webhooks'],
    validKeys = new Set(process.env.VALID_API_KEYS?.split(',') || []),
    headerName = 'x-api-key',
    allowBypass = process.env.NODE_ENV === 'development'
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if API key is required for this path
      const requiresApiKey = requiredForPaths.some(path => req.path.startsWith(path));
      
      if (!requiresApiKey) {
        return next();
      }

      const apiKey = req.headers[headerName] as string;

      // Allow bypass in development
      if (allowBypass && !apiKey) {
        getLogger().warn('API key bypass in development mode', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        return next();
      }

      // Validate API key presence
      if (!apiKey) {
        throw new ValidationError('Missing API key', {
          header: headerName,
          path: req.path
        });
      }

      // Validate API key format (basic checks)
      if (typeof apiKey !== 'string' || apiKey.length < 10) {
        throw new ValidationError('Invalid API key format', {
          header: headerName,
          keyLength: apiKey?.length || 0
        });
      }

      // Check for header injection attempts
      if (apiKey.includes('\r') || apiKey.includes('\n')) {
        getLogger().warn('Header injection attempt detected', {
          apiKey: apiKey.substring(0, 10) + '...',
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        throw new ValidationError('Invalid API key format', {
          reason: 'Header injection detected'
        });
      }

      // Validate against known keys (if configured)
      if (validKeys.size > 0 && !validKeys.has(apiKey)) {
        getLogger().warn('Invalid API key used', {
          apiKey: apiKey.substring(0, 10) + '...',
          ip: req.ip,
          path: req.path,
          userAgent: req.get('User-Agent')
        });
        throw new ValidationError('Invalid API key', {
          header: headerName
        });
      }

      // Add API key info to request for rate limiting
      (req as any).apiKeyInfo = {
        key: apiKey.substring(0, 10) + '...',
        valid: true
      };

      next();
    } catch (_error) {
      next(_error);
    }
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(config: SecurityHeadersConfig = {}) {
  const {
    enableCSP = true,
    enableHSTS = true,
    enableXFrameOptions = true,
    enableXContentTypeOptions = true,
    customHeaders = {}
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Content Security Policy
      if (enableCSP) {
        res.set('Content-Security-Policy', 
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
        );
      }

      // HTTP Strict Transport Security
      if (enableHSTS) {
        res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }

      // X-Frame-Options
      if (enableXFrameOptions) {
        res.set('X-Frame-Options', 'DENY');
      }

      // X-Content-Type-Options
      if (enableXContentTypeOptions) {
        res.set('X-Content-Type-Options', 'nosniff');
      }

      // Additional security headers
      res.set({
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'X-Engine-Version': ENGINE_VERSION,
        'X-Powered-By': 'Phase2-Decision-Engine'
      });

      // Custom headers
      for (const [header, value] of Object.entries(customHeaders)) {
        res.set(header, value);
      }

      next();
    } catch (_error) {
      next(_error);
    }
  };
}

/**
 * Request sanitization middleware
 */
export function requestSanitization(config: SanitizationConfig = {}) {
  const {
    maxBodySize = 1024 * 1024, // 1MB
    maxHeaderSize = 8192, // 8KB
    allowedContentTypes = ['application/json', 'application/x-www-form-urlencoded'],
    sanitizeHeaders = true
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check content type
      const contentType = req.get('Content-Type');
      if (contentType && !allowedContentTypes.some(type => contentType.includes(type))) {
        throw new ValidationError(`Unsupported content type: ${contentType}`, {
          contentType,
          allowed: allowedContentTypes
        });
      }

      // Check content length
      const contentLength = parseInt(req.get('Content-Length') || '0');
      if (contentLength > maxBodySize) {
        throw new ValidationError(`Request body too large: ${contentLength} bytes`, {
          size: contentLength,
          maxSize: maxBodySize
        });
      }

      // Sanitize headers if enabled
      if (sanitizeHeaders) {
        const suspiciousHeaders = [];
        
        for (const [header, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') {
            // Check for header injection
            if (value.includes('\r') || value.includes('\n')) {
              suspiciousHeaders.push(header);
            }
            
            // Check header size
            if (value.length > maxHeaderSize) {
              suspiciousHeaders.push(header);
            }
          }
        }

        if (suspiciousHeaders.length > 0) {
          getLogger().warn('Suspicious headers detected', {
            headers: suspiciousHeaders,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          throw new ValidationError('Invalid request headers', {
            suspiciousHeaders
          });
        }
      }

      // Add sanitization info to request
      (req as any).sanitized = true;

      next();
    } catch (_error) {
      next(_error);
    }
  };
}

/**
 * Request fingerprinting for security monitoring
 */
export function requestFingerprinting() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Create request fingerprint
      const fingerprint = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        acceptLanguage: req.get('Accept-Language'),
        acceptEncoding: req.get('Accept-Encoding'),
        method: req.method,
        path: req.path,
        timestamp: Date.now()
      };

      // Add fingerprint to request
      (req as any).fingerprint = fingerprint;

      // Log security-relevant requests
      if (req.path.includes('/api/')) {
        getLogger().info('API request fingerprint', {
          fingerprint,
          hasApiKey: !!req.headers['x-api-key'],
          contentType: req.get('Content-Type')
        });
      }

      next();
    } catch (_error) {
      next(_error);
    }
  };
}

/**
 * Suspicious activity detection
 */
export class SuspiciousActivityDetector {
  private static instance: SuspiciousActivityDetector;
  private suspiciousIPs: Map<string, { count: number; lastSeen: number }> = new Map();
  private readonly threshold = 10; // Suspicious requests per minute
  private readonly windowMs = 60000; // 1 minute

  static getInstance(): SuspiciousActivityDetector {
    if (!SuspiciousActivityDetector.instance) {
      SuspiciousActivityDetector.instance = new SuspiciousActivityDetector();
    }
    return SuspiciousActivityDetector.instance;
  }

  /**
   * Check if IP is suspicious
   */
  isSuspicious(ip: string): boolean {
    const entry = this.suspiciousIPs.get(ip);
    if (!entry) return false;

    // Clean up old entries
    if (Date.now() - entry.lastSeen > this.windowMs) {
      this.suspiciousIPs.delete(ip);
      return false;
    }

    return entry.count >= this.threshold;
  }

  /**
   * Record suspicious activity
   */
  recordActivity(ip: string, reason: string): void {
    const now = Date.now();
    const entry = this.suspiciousIPs.get(ip) || { count: 0, lastSeen: now };

    // Reset count if window expired
    if (now - entry.lastSeen > this.windowMs) {
      entry.count = 0;
    }

    entry.count++;
    entry.lastSeen = now;
    this.suspiciousIPs.set(ip, entry);

    getLogger().warn('Suspicious activity recorded', {
      ip,
      reason,
      count: entry.count,
      threshold: this.threshold
    });
  }

  /**
   * Get suspicious activity report
   */
  getReport(): { ip: string; count: number; lastSeen: number }[] {
    const now = Date.now();
    const report = [];

    for (const [ip, entry] of this.suspiciousIPs.entries()) {
      if (now - entry.lastSeen <= this.windowMs) {
        report.push({ ip, count: entry.count, lastSeen: entry.lastSeen });
      }
    }

    return report.sort((a, b) => b.count - a.count);
  }
}

/**
 * Suspicious activity monitoring middleware
 */
export function suspiciousActivityMonitoring() {
  const detector = SuspiciousActivityDetector.getInstance();

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = req.ip || 'unknown';

      // Check if IP is already flagged as suspicious
      if (detector.isSuspicious(ip)) {
        getLogger().warn('Request from suspicious IP blocked', {
          ip,
          path: req.path,
          userAgent: req.get('User-Agent')
        });
        throw new ValidationError('Request blocked due to suspicious activity', {
          ip,
          reason: 'Suspicious IP'
        });
      }

      // Monitor for suspicious patterns
      const userAgent = req.get('User-Agent') || '';
      const path = req.path;

      // Check for bot-like user agents
      if (userAgent.toLowerCase().includes('bot') || 
          userAgent.toLowerCase().includes('crawler') ||
          userAgent.toLowerCase().includes('spider')) {
        detector.recordActivity(ip, 'Bot user agent');
      }

      // Check for rapid requests (handled by rate limiter, but we can detect patterns)
      if (path.includes('/api/') && !req.headers['x-api-key']) {
        detector.recordActivity(ip, 'API access without key');
      }

      // Add monitoring info to request
      (req as any).monitoringInfo = {
        suspicious: false,
        checked: true
      };

      next();
    } catch (_error) {
      next(_error);
    }
  };
}

/**
 * Combined security middleware factory
 */
export function createSecurityMiddleware(options: {
  apiKey?: ApiKeyConfig;
  headers?: SecurityHeadersConfig;
  sanitization?: SanitizationConfig;
  enableFingerprinting?: boolean;
  enableSuspiciousActivityMonitoring?: boolean;
} = {}) {
  const middlewares = [];

  // Security headers (always first)
  middlewares.push(securityHeaders(options.headers));

  // Request fingerprinting
  if (options.enableFingerprinting !== false) {
    middlewares.push(requestFingerprinting());
  }

  // Suspicious activity monitoring
  if (options.enableSuspiciousActivityMonitoring !== false) {
    middlewares.push(suspiciousActivityMonitoring());
  }

  // Request sanitization
  middlewares.push(requestSanitization(options.sanitization));

  // API key validation
  if (options.apiKey) {
    middlewares.push(apiKeyValidation(options.apiKey));
  }

  return middlewares;
}