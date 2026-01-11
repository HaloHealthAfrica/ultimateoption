/**
 * Phase 2 Decision Engine - Middleware Module
 * 
 * Exports all middleware functionality for error handling,
 * validation, timeouts, performance monitoring, health monitoring, security, and service health monitoring.
 */

export {
  // Error classes
  Phase2Error,
  ValidationError,
  InternalError,
  ServiceUnavailableError,
  ProviderError,
  TimeoutError,
  RateLimitError,
  ImmutabilityViolationError,
  ErrorType,

  // Middleware functions
  errorHandler,
  asyncHandler,
  validateRequest,
  timeoutHandler,

  // Service monitoring
  ServiceHealthChecker,
  CircuitBreaker
} from './error-handler';

export { 
  rateLimitMiddleware, 
  strictRateLimitMiddleware, 
  burstRateLimitMiddleware,
  RateLimiter 
} from './rate-limiter';

export { requestLogger } from './request-logger';
export { performanceMiddleware, PerformanceMiddleware } from './performance-middleware';
export { HealthMiddleware } from './health-middleware';

export {
  apiKeyValidation,
  securityHeaders,
  requestSanitization,
  requestFingerprinting,
  suspiciousActivityMonitoring,
  createSecurityMiddleware,
  SuspiciousActivityDetector
} from './security-middleware';