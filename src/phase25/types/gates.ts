/**
 * Gate-related type definitions for Phase 2.5
 * 
 * Provides strong typing for gate results and configuration.
 */

/**
 * Result from evaluating a single gate
 */
export interface GateResult {
  /** Whether the gate passed */
  passed: boolean;
  /** Human-readable reason for pass/fail */
  reason: string;
  /** Numeric score (0-100) indicating gate quality */
  score: number;
  /** Optional additional details for debugging */
  details?: Record<string, unknown>;
}

/**
 * Collection of all gate results for a decision
 */
export interface GateResults {
  regime: GateResult;
  structural: GateResult;
  market: GateResult;
}

/**
 * Configuration for gate behavior
 */
export interface GateConfig {
  /** Whether to allow trades when regime data is unavailable */
  allowSignalOnlyMode: boolean;
  /** Score to assign in signal-only mode */
  signalOnlyScore: number;
  /** Maximum allowed spread in basis points */
  maxSpreadBps: number;
  /** Maximum ATR spike threshold */
  maxAtrSpike: number;
  /** Minimum market depth score */
  minDepthScore: number;
}
