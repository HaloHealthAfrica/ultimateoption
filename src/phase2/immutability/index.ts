/**
 * Phase 2 Decision Engine - Immutability Module
 * 
 * Exports all immutability enforcement functionality.
 */

export {
  GATE_REGISTRY,
  CONFIDENCE_MATRIX,
  FALLBACK_MATRIX,
  PERFORMANCE_CONSTRAINTS,
  initializeImmutability,
  validateImmutability,
  getImmutableConfig,
  getImmutabilityStatus
} from './immutable-config';

export { ImmutabilityGuard } from './immutability-guard';