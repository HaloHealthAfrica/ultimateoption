/**
 * Phase 2 Decision Engine - Security Middleware Tests
 * 
 * Comprehensive tests for security middleware including API key validation,
 * request sanitization, and suspicious activity detection.
 */

import { Request, Response, NextFunction } from 'express';
import {
  apiKeyValidation,
  securityHeaders,
  requestSanitization,
  requestFingerprinting,
  suspiciousActivityMonitoring,
  createSecurityMiddleware,
  SuspiciousActivityDetector
} from '../middleware/security-middleware';
import { ValidationError } from '../middleware/error-handler';
import * as fc from 'fast-check';

// Mock Express objects
const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  ip: '127.0.0.1',
  method: 'POST',
  path: '/api/webhooks/signals',
  headers: {},
  get: jest.fn((header: string) => {
    const headers: Record<string, string> = {
      'User-Agent': 'test-agent/1.0',
      'Content-Type': 'application/json',
      'Content-Length': '100',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      ...overrides.headers
    };
    return headers[header];
  }),
  ...overrides
});

const createMockResponse = (): Partial<Response> => {
  const headers: Record<string, string> = {};
  return {
    set: jest.fn((headerObj: Record<string, string> | string, value?: string) => {
      if (typeof headerObj === 'string' && value) {
        headers[headerObj] = value;
      } else if (typeof headerObj === 'object') {
        Object.assign(headers, headerObj);
      }
    }),
    getHeaders: () => headers
  };
};

const createMockNext = (): NextFunction => jest.fn();

describe('Security Middleware', () => {
  describe('API Key Validation', () => {
    beforeEach(() => {
      process.env.VALID_API_KEYS = 'test-key-1,test-key-2,valid-api-key-123';
    });

    afterEach(() => {
      delete process.env.VALID_API_KEYS;
      delete process.env.NODE_ENV;
    });

    it('should allow requests to non-protected paths without API key', async () => {
      const middleware = apiKeyValidation({
        requiredForPaths: ['/api/webhooks']
      });

      const req = createMockRequest({ path: '/health' });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should require API key for protected paths', async () => {
      const middleware = apiKeyValidation({
        requiredForPaths: ['/api/webhooks'],
        validKeys: new Set(['valid-key'])
      });

      const req = createMockRequest({
        path: '/api/webhooks/signals',
        headers: {}
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Missing API key');
    });

    it('should validate API key format', async () => {
      const middleware = apiKeyValidation({
        requiredForPaths: ['/api/webhooks']
      });

      const req = createMockRequest({
        path: '/api/webhooks/signals',
        headers: { 'x-api-key': 'short' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Invalid API key format');
    });

    it('should detect header injection attempts', async () => {
      const middleware = apiKeyValidation({
        requiredForPaths: ['/api/webhooks']
      });

      const req = createMockRequest({
        path: '/api/webhooks/signals',
        headers: { 'x-api-key': 'valid-key-123\r\nX-Injected: malicious' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Invalid API key format');
    });

    it('should validate against known API keys', async () => {
      const middleware = apiKeyValidation({
        requiredForPaths: ['/api/webhooks'],
        validKeys: new Set(['valid-key-123'])
      });

      const req = createMockRequest({
        path: '/api/webhooks/signals',
        headers: { 'x-api-key': 'invalid-key-456' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Invalid API key');
    });

    it('should allow valid API keys', async () => {
      const middleware = apiKeyValidation({
        requiredForPaths: ['/api/webhooks'],
        validKeys: new Set(['valid-key-123'])
      });

      const req = createMockRequest({
        path: '/api/webhooks/signals',
        headers: { 'x-api-key': 'valid-key-123' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as any).apiKeyInfo).toEqual({
        key: 'valid-key-...',
        valid: true
      });
    });

    it('should allow bypass in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      const middleware = apiKeyValidation({
        requiredForPaths: ['/api/webhooks'],
        allowBypass: true
      });

      const req = createMockRequest({
        path: '/api/webhooks/signals',
        headers: {}
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Security Headers', () => {
    it('should set default security headers', async () => {
      const middleware = securityHeaders();

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(res.set).toHaveBeenCalledWith('Strict-Transport-Security', expect.any(String));
      expect(res.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(next).toHaveBeenCalledWith();
    });

    it('should allow custom headers', async () => {
      const middleware = securityHeaders({
        customHeaders: {
          'X-Custom-Header': 'custom-value'
        }
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith('X-Custom-Header', 'custom-value');
      expect(next).toHaveBeenCalledWith();
    });

    it('should allow disabling specific headers', async () => {
      const middleware = securityHeaders({
        enableCSP: false,
        enableHSTS: false
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(res.set).not.toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(res.set).not.toHaveBeenCalledWith('Strict-Transport-Security', expect.any(String));
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Request Sanitization', () => {
    it('should allow valid content types', async () => {
      const middleware = requestSanitization({
        allowedContentTypes: ['application/json']
      });

      const req = createMockRequest({
        headers: { 'Content-Type': 'application/json' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as any).sanitized).toBe(true);
    });

    it('should reject invalid content types', async () => {
      const middleware = requestSanitization({
        allowedContentTypes: ['application/json']
      });

      const req = createMockRequest({
        headers: { 'Content-Type': 'text/html' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Unsupported content type');
    });

    it('should enforce body size limits', async () => {
      const middleware = requestSanitization({
        maxBodySize: 1000
      });

      const req = createMockRequest({
        headers: { 'Content-Length': '2000' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Request body too large');
    });

    it('should detect header injection', async () => {
      const middleware = requestSanitization({
        sanitizeHeaders: true
      });

      const req = createMockRequest({
        headers: { 'X-Custom-Header': 'value\r\nX-Injected: malicious' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Invalid request headers');
    });

    it('should enforce header size limits', async () => {
      const middleware = requestSanitization({
        maxHeaderSize: 100,
        sanitizeHeaders: true
      });

      const req = createMockRequest({
        headers: { 'X-Large-Header': 'x'.repeat(200) }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Invalid request headers');
    });
  });

  describe('Request Fingerprinting', () => {
    it('should create request fingerprint', async () => {
      const middleware = requestFingerprinting();

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as any).fingerprint).toEqual(expect.objectContaining({
        ip: '127.0.0.1',
        userAgent: 'test-agent/1.0',
        method: 'POST',
        path: '/api/webhooks/signals',
        timestamp: expect.any(Number)
      }));
    });

    it('should handle missing headers gracefully', async () => {
      const middleware = requestFingerprinting();

      const req = createMockRequest({
        get: jest.fn(() => undefined)
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as any).fingerprint).toBeDefined();
    });
  });

  describe('Suspicious Activity Detection', () => {
    let detector: SuspiciousActivityDetector;

    beforeEach(() => {
      detector = SuspiciousActivityDetector.getInstance();
      // Clear any existing data
      (detector as any).suspiciousIPs.clear();
    });

    it('should detect and block suspicious IPs', async () => {
      const middleware = suspiciousActivityMonitoring();

      // Record suspicious activity
      for (let i = 0; i < 15; i++) {
        detector.recordActivity('192.168.1.100', 'Test activity');
      }

      const req = createMockRequest({ ip: '192.168.1.100' });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('suspicious activity');
    });

    it('should detect bot user agents', async () => {
      const middleware = suspiciousActivityMonitoring();

      const req = createMockRequest({
        get: jest.fn((header) => {
          if (header === 'User-Agent') return 'GoogleBot/2.1';
          return undefined;
        })
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      // Should record the activity but not block immediately
    });

    it('should detect API access without key', async () => {
      const middleware = suspiciousActivityMonitoring();

      const req = createMockRequest({
        path: '/api/webhooks/signals',
        headers: {} // No API key
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      // Should record the activity
    });

    it('should generate activity report', () => {
      detector.recordActivity('192.168.1.1', 'Test 1');
      detector.recordActivity('192.168.1.2', 'Test 2');
      detector.recordActivity('192.168.1.1', 'Test 1 again');

      const report = detector.getReport();

      expect(report).toHaveLength(2);
      expect(report[0].ip).toBe('192.168.1.1');
      expect(report[0].count).toBe(2);
      expect(report[1].ip).toBe('192.168.1.2');
      expect(report[1].count).toBe(1);
    });
  });

  describe('Combined Security Middleware', () => {
    it('should create middleware stack with all features', () => {
      const middlewares = createSecurityMiddleware({
        apiKey: {
          requiredForPaths: ['/api/webhooks'],
          validKeys: new Set(['test-key'])
        },
        headers: {
          enableCSP: true,
          customHeaders: { 'X-Custom': 'value' }
        },
        sanitization: {
          maxBodySize: 1024,
          allowedContentTypes: ['application/json']
        },
        enableFingerprinting: true,
        enableSuspiciousActivityMonitoring: true
      });

      expect(middlewares).toHaveLength(5); // headers, fingerprinting, monitoring, sanitization, apiKey
      expect(typeof middlewares[0]).toBe('function');
    });

    it('should create minimal middleware stack', () => {
      const middlewares = createSecurityMiddleware({
        enableFingerprinting: false,
        enableSuspiciousActivityMonitoring: false
      });

      expect(middlewares).toHaveLength(2); // headers, sanitization
    });
  });

  // Property-Based Tests
  describe('Property Tests - Security Resilience', () => {
    it('Property: API key validation never allows invalid formats', () => {
      fc.assert(fc.property(
        fc.string().filter(s => s.length < 10 || s.includes('\r') || s.includes('\n')),
        (invalidKey) => {
          const middleware = apiKeyValidation({
            requiredForPaths: ['/api/webhooks']
          });

          const req = createMockRequest({
            path: '/api/webhooks/signals',
            headers: { 'x-api-key': invalidKey }
          });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          // Property: Invalid keys always result in errors
          expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
        }
      ), { numRuns: 50 });
    });

    it('Property: Content type validation is consistent', () => {
      fc.assert(fc.property(
        fc.string(),
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
        (contentType, allowedTypes) => {
          const middleware = requestSanitization({
            allowedContentTypes: allowedTypes
          });

          const req = createMockRequest({
            headers: { 'Content-Type': contentType }
          });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          const isAllowed = allowedTypes.some(type => contentType.includes(type));
          
          if (isAllowed) {
            expect(next).toHaveBeenCalledWith();
          } else {
            expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
          }
        }
      ), { numRuns: 30 });
    });

    it('Property: Header injection is always detected', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('\r\n', '\n', '\r'),
        fc.string({ minLength: 1, maxLength: 20 }),
        (prefix, injection, suffix) => {
          const maliciousValue = prefix + injection + suffix;
          
          const middleware = requestSanitization({
            sanitizeHeaders: true
          });

          const req = createMockRequest({
            headers: { 'X-Test-Header': maliciousValue }
          });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          // Property: Header injection always results in error
          expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
        }
      ), { numRuns: 30 });
    });

    it('Property: Body size limits are enforced consistently', () => {
      fc.assert(fc.property(
        fc.integer({ min: 100, max: 10000 }),
        fc.integer({ min: 1, max: 20000 }),
        (maxSize, actualSize) => {
          const middleware = requestSanitization({
            maxBodySize: maxSize
          });

          const req = createMockRequest({
            headers: { 'Content-Length': actualSize.toString() }
          });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          if (actualSize <= maxSize) {
            expect(next).toHaveBeenCalledWith();
          } else {
            expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
          }
        }
      ), { numRuns: 50 });
    });

    it('Property: Suspicious activity threshold is consistent', () => {
      fc.assert(fc.property(
        fc.ipV4(),
        fc.integer({ min: 1, max: 20 }),
        (ip, activityCount) => {
          const detector = SuspiciousActivityDetector.getInstance();
          (detector as any).suspiciousIPs.clear(); // Clear for test

          // Record activities
          for (let i = 0; i < activityCount; i++) {
            detector.recordActivity(ip, 'Test activity');
          }

          const isSuspicious = detector.isSuspicious(ip);
          
          // Property: Suspicious status is consistent with threshold (10)
          if (activityCount >= 10) {
            expect(isSuspicious).toBe(true);
          } else {
            expect(isSuspicious).toBe(false);
          }
        }
      ), { numRuns: 30 });
    });
  });
});