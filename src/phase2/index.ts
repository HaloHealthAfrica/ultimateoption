/**
 * Phase 2 Decision Engine - Main Entry Point
 * 
 * This is the main entry point for the deterministic decision engine.
 * It exports all public interfaces and ensures proper initialization.
 * 
 * IMMUTABLE: All configurations are frozen at startup to ensure determinism.
 */

import { initializeImmutability, ImmutabilityGuard } from './immutability';

// Initialize immutability system on module load
initializeImmutability();

// Start runtime monitoring in production
if (process.env.NODE_ENV === 'production') {
  ImmutabilityGuard.getInstance().startMonitoring(30000); // Check every 30 seconds
}

// Core Types
export * from './types';

// Configuration
export * from './config';

// Constants
export * from './constants/gates';

// Services
export * from './services/webhook-service';
export * from './services/normalizer';
export * from './services/logger';
export * from './services/performance-monitor';
export * from './services/market-context-builder';

// Providers
export * from './providers';

// Gates
export * from './gates';

// Engine
export * from './engine';

// Formatters
export * from './formatters';

// Immutability
export * from './immutability';

// Middleware
export * from './middleware';

// Server
export * from './server';

// Engine Version
export { ENGINE_VERSION } from './types';

/**
 * Phase 2 Decision Engine
 * 
 * A deterministic, immutable, and auditable trading decision engine
 * that processes TradingView webhooks and enriches them with market context.
 * 
 * Key Principles:
 * - Deterministic: Same inputs always produce identical outputs
 * - Immutable: No learning, no dynamic weight tuning, no agent debates
 * - Auditable: Every decision is fully explainable and reconstructible
 * - Fast: Sub-second decision latency with graceful degradation
 */
export const PHASE2_INFO = Object.freeze({
  name: 'Phase 2 Deterministic Decision Engine',
  version: '2.0.0',
  description: 'Deterministic Node.js Decision Engine for TradingView webhooks',
  features: [
    'Deterministic decision making',
    'Market context enrichment',
    'Fixed risk gates',
    'Comprehensive audit trails',
    'Graceful provider fallbacks',
    'Sub-second response times'
  ],
  principles: [
    'No learning capabilities',
    'No agent-based logic', 
    'No probabilistic voting',
    'No dynamic weight tuning',
    'Complete immutability',
    'Full auditability'
  ]
} as const);