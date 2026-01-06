/**
 * Safety Module
 * 
 * Exports safety monitoring functionality.
 * Generates alerts only - no automatic actions.
 */

export type {
  AlertSeverity,
  AlertType,
  SafetyAlert,
  SafetyThresholds,
  SafetyState,
  Metrics,
} from './safetyMonitor';

export {
  // Constants
  DEFAULT_THRESHOLDS,
  
  // Functions
  checkOvertrading,
  checkDrawdownSpike,
  checkRegimeMismatch,
  checkConsecutiveLosses,
  checkPositionSizeAnomaly,
  checkLearningInstability,
  runSafetyChecks,
  getSafetyState,
} from './safetyMonitor';
