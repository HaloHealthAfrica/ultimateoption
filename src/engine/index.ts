/**
 * Engine Module Exports
 * Central export point for all decision engine components
 */

// Matrices and constants
export {
  ENGINE_VERSION,
  CONFLUENCE_WEIGHTS,
  CONFLUENCE_MULTIPLIERS,
  QUALITY_MULTIPLIERS,
  HTF_ALIGNMENT_MULTIPLIERS,
  RR_THRESHOLDS,
  VOLUME_THRESHOLDS,
  TREND_THRESHOLDS,
  SESSION_MULTIPLIERS,
  DAY_MULTIPLIERS,
  POSITION_MULTIPLIER_MIN,
  POSITION_MULTIPLIER_MAX,
  CONFLUENCE_THRESHOLD,
  HTF_MIN_AI_SCORE,
  PHASE_CONFIDENCE_THRESHOLD,
  PHASE_BOOSTS,
  getConfluenceMultiplier,
  getRRMultiplier,
  getVolumeMultiplier,
  getTrendMultiplier,
  getPhaseConfidenceBoost,
  getPhasePositionBoost,
  clampPositionMultiplier,
} from './matrices';
export type { HTFAlignment } from './matrices';

// Confluence calculator
export {
  calculateConfluenceForDirection,
  getDominantDirection,
} from './confluence';

// Position sizing
export {
  determineHTFAlignment,
  getPhaseAndTrendBoosts,
  calculatePositionMultiplier,
  calculateRawMultiplier,
  shouldSkipPosition,
  calculateRecommendedContracts,
} from './positionSizing';

// Decision engine core
export { makeDecision } from './decisionEngine';
