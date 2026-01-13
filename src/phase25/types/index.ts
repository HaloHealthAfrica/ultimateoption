/**
 * Phase 2.5 Decision Engine - Type Exports
 * 
 * This file exports all types, interfaces, and constants used throughout
 * the Phase 2.5 Decision Engine system.
 */

// Core types and interfaces
export * from './core';
export * from './interfaces';
export * from './webhooks';
export * from './constants';

// Re-export commonly used types for convenience
export type {
  DecisionContext,
  MarketContext,
  DecisionPacket,
  TradeDirection,
  EngineAction,
  WebhookSource,
  GateResult
} from './core';

export type {
  IDecisionEngine,
  IWebhookService,
  INormalizer,
  IMarketContextBuilder,
  IContextStore,
  IRiskGates,
  IAuditLogger,
  IErrorHandler,
  IDecisionOrchestrator
} from './interfaces';

export {
  ENGINE_VERSION,
  PHASE_RULES,
  VOLATILITY_CAP,
  CONFIDENCE_GATE,
  GATE_THRESHOLDS,
  SIZE_BOUNDS,
  CONFLUENCE_WEIGHTS,
  getConfluenceMultiplier,
  getRRMultiplier,
  clamp
} from './constants';