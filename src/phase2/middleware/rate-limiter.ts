/**
 * Phase 2 Decision Engine - Rate Limiting Middleware
 * 
 * Implements rate limiting to protect against abuse and ensure
 * system stability under high load conditions.
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from './error-handler';
import { RATE_LIMITS } from '../constants/gates';
import { Logger } from '../services/logger';

// Create a logger instance for rate limiting
const logger = new Logger();

/**
 * Rate limit store interface
 */
interface RateLimitStore {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttlMs: number): Promise<void>;
  increment(key: string, ttlMs: number): Promise<number>;
}

/**
 * In-memory rate limit store
 */
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; expiry: number }>();

  async get(key: string): Promise<number | null> {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.count;
  }

  async set(key: string, value: number, ttlMs: number): Promise<void> {
    this.store.set(key, {
      count: value,
      expiry: Date.now() + ttlMs
    });
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const current = await this.get(key);
    const newCount = (current || 0) + 1;
    await this.set(key, newCount, ttlMs);
    return newCount;
  }
}

/**
 * Rate limiter configuration
 */
interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  store?: RateLimitStore;
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private store: RateLimitStore;
  private config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      keyGenerator: (req) => req.ip || 'unknown',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      store: new MemoryRateLimitStore(),
      ...config
    };
    this.store = this.config.store;
  }

  /**
   * Create middleware function
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.config.keyGenerator(req);
        const current = await this.store.increment(key, this.config.windowMs);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, this.config.maxRequests - current).toString(),
          'X-RateLimit-Reset': new Date(Date.now() + this.config.windowMs).toISOString()
        });

        if (current > this.config.maxRequests) {
          // Log rate limit violation
          logger.warn('Rate limit exceeded', {
            key,
            current,
            limit: this.config.maxRequests,
            method: req.method,
            path: req.path,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          });

          throw new RateLimitError(
            `Rate limit exceeded. Maximum ${this.config.maxRequests} requests per ${this.config.windowMs / 1000} seconds.`,
            Math.ceil(this.config.windowMs / 1000),
            {
              limit: this.config.maxRequests,
              current,
              windowMs: this.config.windowMs,
              key
            }
          );
        }

        next();
      } catch (_error) {
        next(_error);
      }
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    await this.store.set(key, 0, this.config.windowMs);
  }

  /**
   * Get current count for a key
   */
  async getCount(key: string): Promise<number> {
    return (await this.store.get(key)) || 0;
  }
}

/**
 * Default rate limiter middleware
 */
export const rateLimitMiddleware = new RateLimiter({
  windowMs: RATE_LIMITS.WINDOW_MS,
  maxRequests: RATE_LIMITS.MAX_REQUESTS,
  keyGenerator: (req) => {
    // Use IP address as default, but allow override with API key
    const apiKey = req.headers['x-api-key'] as string;
    return apiKey ? `api:${apiKey}` : `ip:${req.ip}`;
  }
}).middleware();

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimitMiddleware = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  keyGenerator: (req) => `strict:${req.ip}`
}).middleware();

/**
 * Burst rate limiter for high-frequency endpoints
 */
export const burstRateLimitMiddleware = new RateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: 5, // 5 requests per second
  keyGenerator: (req) => `burst:${req.ip}`
}).middleware();