/**
 * Phase 2.5 Decision Engine - Main Entry Point
 * 
 * This file serves as the main entry point for the Phase 2.5 Decision Engine.
 * It exports the core components and provides a clean API for integration.
 */

// Export all types and interfaces
export * from './types';

// Export configuration
export { DEFAULT_ENGINE_CONFIG, getEngineConfig, validateEngineConfig } from './config/engine.config';

// Export testing utilities (for development and testing)
export * from './testing/setup';

// Version information
export const PHASE25_VERSION = "2.5.0";
export const PHASE25_BUILD_DATE = new Date().toISOString();

/**
 * Phase 2.5 Decision Engine metadata
 */
export const PHASE25_INFO = {
  version: PHASE25_VERSION,
  buildDate: PHASE25_BUILD_DATE,
  description: "Deterministic Decision Engine with Market Context",
  features: [
    "Deterministic decision-making with frozen rules",
    "Real-time market context from multiple data providers",
    "Comprehensive audit trails for compliance",
    "Property-based testing for correctness validation",
    "Sub-second latency for production trading",
    "Graceful degradation when market feeds fail"
  ]
} as const;