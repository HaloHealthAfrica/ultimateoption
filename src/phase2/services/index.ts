/**
 * Phase 2 Decision Engine - Services Module
 * 
 * Exports all service functionality including logging, performance monitoring,
 * health monitoring, webhook handling, and data normalization.
 */

export { Logger } from './logger';
export { PerformanceMonitor } from './performance-monitor';
export { PerformanceTracker } from './performance-tracker';
export { HealthService } from './health-service';
export { WebhookService } from './webhook-service';
export { Normalizer } from './normalizer';
export { MarketContextBuilder } from './market-context-builder';

// Export service interfaces
export type {
  DecisionLogEvent,
  ProviderFailureEvent,
  PerformanceWarningEvent,
  RequestEvent
} from './logger';

export type {
  ThroughputMetrics,
  DetailedPerformanceMetrics
} from './performance-tracker';

export type {
  ProviderHealth,
  SystemHealth
} from './health-service';