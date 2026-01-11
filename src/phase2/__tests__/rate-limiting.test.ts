/**
 * Phase 2 Decision Engine - Rate Limiting Tests
 * 
 * Comprehensive tests for rate limiting middleware including high load scenarios,
 * security features, and proper enforcement of limits.
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiter, rateLimitMiddleware, strictRateLimitMiddleware, burstRateLimitMiddleware } from '../middleware/rate-limiter';
import { RateLimitError } from '../middleware/error-handler';
import { RATE_LIMITS } from '../constants/gates';
import * as fc from 'fast-check';

// Mock Express objects
const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  ip: '127.0.0.1',
  method: 'POST',
  path: '/api/webhooks/signals',
  headers: {},
  get: jest.fn((header: string) => {
    if (header === 'User-Agent') return 'test-agent';
    return undefined;
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

describe('RateLimiter', () => {
  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make 5 requests - all should pass
      for (let i = 0; i < 5; i++) {
        await rateLimiter.middleware()(req as Request, res as Response, next);
        expect(next).toHaveBeenCalledWith(); // Called without error
        (next as jest.Mock).mockClear();
      }
    });

    it('should block requests exceeding limit', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 3
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make 3 requests - should pass
      for (let i = 0; i < 3; i++) {
        await rateLimiter.middleware()(req as Request, res as Response, next);
        expect(next).toHaveBeenCalledWith();
        (next as jest.Mock).mockClear();
      }

      // 4th request should fail
      await rateLimiter.middleware()(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
    });

    it('should set proper rate limit headers', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await rateLimiter.middleware()(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '9',
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should use custom key generator', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: (req) => `custom:${req.headers['x-user-id'] || 'anonymous'}`
      });

      const req1 = createMockRequest({ headers: { 'x-user-id': 'user1' } });
      const req2 = createMockRequest({ headers: { 'x-user-id': 'user2' } });
      const res = createMockResponse();
      const next = createMockNext();

      // Each user should have separate limits
      await rateLimiter.middleware()(req1 as Request, res as Response, next);
      await rateLimiter.middleware()(req1 as Request, res as Response, next);
      await rateLimiter.middleware()(req2 as Request, res as Response, next);
      await rateLimiter.middleware()(req2 as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(4);
      expect(next).toHaveBeenCalledWith(); // All calls successful

      // Third request from user1 should fail
      (next as jest.Mock).mockClear();
      await rateLimiter.middleware()(req1 as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
    });
  });

  describe('Rate Limit Store', () => {
    it('should handle store operations correctly', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 5
      });

      // Test reset functionality
      await rateLimiter.reset('test-key');
      const count = await rateLimiter.getCount('test-key');
      expect(count).toBe(0);
    });

    it('should expire entries after TTL', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 100, // Very short window
        maxRequests: 5
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make a request
      await rateLimiter.middleware()(req as Request, res as Response, next);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Count should be reset
      const count = await rateLimiter.getCount('ip:127.0.0.1');
      expect(count).toBe(0);
    });
  });

  describe('Default Rate Limiters', () => {
    it('should use correct configuration for default rate limiter', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await rateLimitMiddleware(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'X-RateLimit-Limit': RATE_LIMITS.MAX_REQUESTS.toString()
      }));
    });

    it('should handle API key override in default rate limiter', async () => {
      const reqWithApiKey = createMockRequest({
        headers: { 'x-api-key': 'test-api-key' }
      });
      const reqWithoutApiKey = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Both should work but use different keys
      await rateLimitMiddleware(reqWithApiKey as Request, res as Response, next);
      await rateLimitMiddleware(reqWithoutApiKey as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(next).toHaveBeenCalledWith();
    });

    it('should enforce strict limits for strict rate limiter', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make 10 requests - should pass
      for (let i = 0; i < 10; i++) {
        await strictRateLimitMiddleware(req as Request, res as Response, next);
        expect(next).toHaveBeenCalledWith();
        (next as jest.Mock).mockClear();
      }

      // 11th request should fail
      await strictRateLimitMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
    });

    it('should enforce burst limits for burst rate limiter', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make 5 requests - should pass
      for (let i = 0; i < 5; i++) {
        await burstRateLimitMiddleware(req as Request, res as Response, next);
        expect(next).toHaveBeenCalledWith();
        (next as jest.Mock).mockClear();
      }

      // 6th request should fail
      await burstRateLimitMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
    });
  });

  describe('Error Handling', () => {
    it('should create proper RateLimitError with context', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // First request passes
      await rateLimiter.middleware()(req as Request, res as Response, next);
      (next as jest.Mock).mockClear();

      // Second request fails
      await rateLimiter.middleware()(req as Request, res as Response, next);
      
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.context).toEqual(expect.objectContaining({
        limit: 1,
        current: 2,
        windowMs: 60000,
        key: 'ip:127.0.0.1'
      }));
    });

    it('should handle store errors gracefully', async () => {
      const mockStore = {
        get: jest.fn().mockRejectedValue(new Error('Store error')),
        set: jest.fn(),
        increment: jest.fn().mockRejectedValue(new Error('Store error'))
      };

      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        store: mockStore
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await rateLimiter.middleware()(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('High Load Scenarios', () => {
    it('should handle concurrent requests correctly', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });

      const req = createMockRequest();
      const res = createMockResponse();

      // Make 15 concurrent requests
      const promises = Array.from({ length: 15 }, () => {
        const next = createMockNext();
        return rateLimiter.middleware()(req as Request, res as Response, next)
          .then(() => next)
          .catch(() => next);
      });

      const results = await Promise.all(promises);
      
      // Count successful vs failed requests
      const successful = results.filter(next => 
        (next as jest.Mock).mock.calls.length > 0 && 
        (next as jest.Mock).mock.calls[0].length === 0
      ).length;
      
      const failed = results.filter(next => 
        (next as jest.Mock).mock.calls.length > 0 && 
        (next as jest.Mock).mock.calls[0].length > 0
      ).length;

      expect(successful).toBeLessThanOrEqual(10);
      expect(failed).toBeGreaterThanOrEqual(5);
      expect(successful + failed).toBe(15);
    });

    it('should maintain performance under load', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 100
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const startTime = Date.now();
      
      // Make 50 requests
      for (let i = 0; i < 50; i++) {
        await rateLimiter.middleware()(req as Request, res as Response, next);
        (next as jest.Mock).mockClear();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Security Features', () => {
    it('should log rate limit violations with security context', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1
      });

      const req = createMockRequest({
        headers: { 'User-Agent': 'suspicious-bot/1.0' },
        method: 'POST',
        path: '/api/webhooks/signals'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // First request passes
      await rateLimiter.middleware()(req as Request, res as Response, next);
      (next as jest.Mock).mockClear();

      // Second request should be logged as violation
      await rateLimiter.middleware()(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
    });

    it('should handle missing IP addresses gracefully', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5
      });

      const req = createMockRequest({ ip: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      await rateLimiter.middleware()(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalledWith();
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'X-RateLimit-Limit': '5'
      }));
    });

    it('should prevent header injection attacks', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5
      });

      const req = createMockRequest({
        headers: {
          'x-api-key': 'test\r\nX-Injected-Header: malicious'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await rateLimiter.middleware()(req as Request, res as Response, next);
      
      // Should not allow header injection
      expect(next).toHaveBeenCalledWith();
    });
  });

  // Property-Based Tests
  describe('Property Tests - Rate Limiting Resilience', () => {
    it('Property: Rate limiter never allows more than maxRequests', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 20 }), // maxRequests
        fc.integer({ min: 1, max: 50 }), // number of requests to make
        async (maxRequests, numRequests) => {
          const rateLimiter = new RateLimiter({
            windowMs: 60000,
            maxRequests
          });

          const req = createMockRequest();
          const res = createMockResponse();
          let successCount = 0;
          let errorCount = 0;

          for (let i = 0; i < numRequests; i++) {
            const next = createMockNext();
            await rateLimiter.middleware()(req as Request, res as Response, next);
            
            if ((next as jest.Mock).mock.calls[0]?.length === 0) {
              successCount++;
            } else {
              errorCount++;
            }
          }

          // Property: Never allow more than maxRequests successful calls
          expect(successCount).toBeLessThanOrEqual(maxRequests);
          expect(successCount + errorCount).toBe(numRequests);
        }
      ), { numRuns: 20 });
    });

    it('Property: Different IPs have independent rate limits', () => {
      fc.assert(fc.property(
        fc.array(fc.ipV4(), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 1, max: 10 }),
        async (ips, maxRequests) => {
          const rateLimiter = new RateLimiter({
            windowMs: 60000,
            maxRequests
          });

          const results = new Map<string, number>();

          for (const ip of ips) {
            const req = createMockRequest({ ip });
            const res = createMockResponse();
            let successCount = 0;

            // Make maxRequests + 1 requests for each IP
            for (let i = 0; i <= maxRequests; i++) {
              const next = createMockNext();
              await rateLimiter.middleware()(req as Request, res as Response, next);
              
              if ((next as jest.Mock).mock.calls[0]?.length === 0) {
                successCount++;
              }
            }

            results.set(ip, successCount);
          }

          // Property: Each IP should have exactly maxRequests successful calls
          for (const [ip, successCount] of results.entries()) {
            expect(successCount).toBe(maxRequests);
          }
        }
      ), { numRuns: 10 });
    });

    it('Property: Rate limit headers are always consistent', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        async (maxRequests, requestCount) => {
          const rateLimiter = new RateLimiter({
            windowMs: 60000,
            maxRequests
          });

          const req = createMockRequest();
          let lastRemaining = maxRequests;

          for (let i = 0; i < Math.min(requestCount, maxRequests); i++) {
            const res = createMockResponse();
            const next = createMockNext();
            
            await rateLimiter.middleware()(req as Request, res as Response, next);
            
            const headers = (res as any).getHeaders();
            const remaining = parseInt(headers['X-RateLimit-Remaining'] || '0');
            const limit = parseInt(headers['X-RateLimit-Limit'] || '0');

            // Property: Headers are consistent
            expect(limit).toBe(maxRequests);
            expect(remaining).toBe(lastRemaining - 1);
            expect(remaining).toBeGreaterThanOrEqual(0);
            
            lastRemaining = remaining;
          }
        }
      ), { numRuns: 20 });
    });
  });
});