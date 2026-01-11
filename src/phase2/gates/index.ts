/**
 * Phase 2 Decision Engine - Risk Gates Implementation
 * 
 * This module implements all risk gates that evaluate trading signals.
 * All gates are deterministic and use frozen thresholds from constants.
 */

export { SpreadGate } from './spread-gate';
export { VolatilityGate } from './volatility-gate';
export { GammaGate } from './gamma-gate';
export { PhaseGate } from './phase-gate';
export { SessionGate } from './session-gate';

// Re-export gate interface for convenience
export type { RiskGate } from './base-gate';