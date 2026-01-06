/**
 * Decision Engine Matrices (IMMUTABLE)
 * All matrices are frozen in production to ensure deterministic behavior
 * 
 * Requirements: 2.1, 3.2
 */

import { Timeframe, SignalQuality, MarketSession, DayOfWeek } from '@/types/signal';

/**
 * Engine version - tracked with every decision for audit/replay
 */
export const ENGINE_VERSION = '1.0.0';

/**
 * Confluence weights by timeframe
 * Higher timeframes have more weight in confluence calculation
 * Total = 100% (0.40 + 0.25 + 0.15 + 0.10 + 0.07 + 0.03 = 1.00)
 */
export const CONFLUENCE_WEIGHTS: Readonly<Record<Timeframe, number>> = Object.freeze({
  '240': 0.40, // 4H = 40%
  '60': 0.25,  // 1H = 25%
  '30': 0.15,  // 30M = 15%
  '15': 0.10,  // 15M = 10%
  '5': 0.07,   // 5M = 7%
  '3': 0.03,   // 3M = 3%
});

/**
 * Confluence score thresholds for position multiplier
 * Higher confluence = larger position
 */
export const CONFLUENCE_MULTIPLIERS: Readonly<Record<number, number>> = Object.freeze({
  90: 2.5,  // 90%+ confluence
  80: 2.0,  // 80-89% confluence
  70: 1.5,  // 70-79% confluence
  60: 1.0,  // 60-69% confluence (minimum for EXECUTE)
  50: 0.7,  // 50-59% confluence
  0: 0.5,   // Below 50% confluence
});

/**
 * Get confluence multiplier for a given score
 */
export function getConfluenceMultiplier(score: number): number {
  if (score >= 90) return CONFLUENCE_MULTIPLIERS[90];
  if (score >= 80) return CONFLUENCE_MULTIPLIERS[80];
  if (score >= 70) return CONFLUENCE_MULTIPLIERS[70];
  if (score >= 60) return CONFLUENCE_MULTIPLIERS[60];
  if (score >= 50) return CONFLUENCE_MULTIPLIERS[50];
  return CONFLUENCE_MULTIPLIERS[0];
}

/**
 * Quality multipliers
 * Higher quality signals get larger positions
 */
export const QUALITY_MULTIPLIERS: Readonly<Record<SignalQuality, number>> = Object.freeze({
  'EXTREME': 1.3,
  'HIGH': 1.1,
  'MEDIUM': 1.0,
});


/**
 * HTF Alignment categories
 */
export type HTFAlignment = 'PERFECT' | 'GOOD' | 'WEAK' | 'COUNTER';

/**
 * HTF Alignment multipliers
 * Trading with higher timeframe bias is rewarded
 */
export const HTF_ALIGNMENT_MULTIPLIERS: Readonly<Record<HTFAlignment, number>> = Object.freeze({
  'PERFECT': 1.3,  // 4H + 1H both aligned with trade direction
  'GOOD': 1.15,    // Either 4H or 1H aligned
  'WEAK': 0.85,    // Only lower timeframes aligned
  'COUNTER': 0.5,  // Trading against HTF bias
});

/**
 * R:R ratio thresholds for multiplier
 */
export const RR_THRESHOLDS: Readonly<Array<{ min: number; multiplier: number }>> = Object.freeze([
  { min: 5.0, multiplier: 1.2 },
  { min: 4.0, multiplier: 1.15 },
  { min: 3.0, multiplier: 1.1 },
  { min: 2.0, multiplier: 1.0 },
  { min: 1.5, multiplier: 0.85 },
  { min: 0, multiplier: 0.5 },
]);

/**
 * Get R:R multiplier for a given ratio
 */
export function getRRMultiplier(rr: number): number {
  for (const threshold of RR_THRESHOLDS) {
    if (rr >= threshold.min) {
      return threshold.multiplier;
    }
  }
  return 0.5;
}

/**
 * Volume ratio thresholds
 */
export const VOLUME_THRESHOLDS: Readonly<Array<{ min: number; multiplier: number }>> = Object.freeze([
  { min: 1.5, multiplier: 1.1 },  // High volume
  { min: 0.8, multiplier: 1.0 },  // Normal volume
  { min: 0, multiplier: 0.7 },    // Low volume
]);

/**
 * Get volume multiplier for a given ratio
 */
export function getVolumeMultiplier(volumeRatio: number): number {
  for (const threshold of VOLUME_THRESHOLDS) {
    if (volumeRatio >= threshold.min) {
      return threshold.multiplier;
    }
  }
  return 0.7;
}

/**
 * Trend strength thresholds
 */
export const TREND_THRESHOLDS: Readonly<Array<{ min: number; multiplier: number }>> = Object.freeze([
  { min: 80, multiplier: 1.2 },  // Strong trend
  { min: 60, multiplier: 1.0 },  // Normal trend
  { min: 0, multiplier: 0.8 },   // Weak trend
]);

/**
 * Get trend multiplier for a given strength
 */
export function getTrendMultiplier(strength: number): number {
  for (const threshold of TREND_THRESHOLDS) {
    if (strength >= threshold.min) {
      return threshold.multiplier;
    }
  }
  return 0.8;
}

/**
 * Session multipliers
 * Certain sessions are more volatile/risky
 */
export const SESSION_MULTIPLIERS: Readonly<Record<MarketSession, number>> = Object.freeze({
  'OPEN': 0.9,        // Market open volatility
  'MIDDAY': 1.0,      // Standard
  'POWER_HOUR': 0.85, // End of day volatility
  'AFTERHOURS': 0.5,  // Low liquidity
});

/**
 * Day of week multipliers
 * Some days historically perform better
 */
export const DAY_MULTIPLIERS: Readonly<Record<DayOfWeek, number>> = Object.freeze({
  'MONDAY': 0.95,
  'TUESDAY': 1.1,     // Best day historically
  'WEDNESDAY': 1.0,
  'THURSDAY': 0.95,
  'FRIDAY': 0.85,     // Reduced due to weekend risk
});


/**
 * Position multiplier bounds
 */
export const POSITION_MULTIPLIER_MIN = 0.5;
export const POSITION_MULTIPLIER_MAX = 3.0;

/**
 * Confluence threshold for EXECUTE decision
 */
export const CONFLUENCE_THRESHOLD = 60;

/**
 * Minimum AI score for HTF signals to count as valid bias
 */
export const HTF_MIN_AI_SCORE = 6;

/**
 * Phase confidence threshold for trade_allowed
 */
export const PHASE_CONFIDENCE_THRESHOLD = 65;

/**
 * Phase boost configuration
 */
export const PHASE_BOOSTS: Readonly<{
  confidence: { threshold: number; boost: number }[];
  position: { threshold: number; boost: number }[];
}> = Object.freeze({
  confidence: [
    { threshold: 90, boost: 0.15 },
    { threshold: 80, boost: 0.10 },
    { threshold: 70, boost: 0.05 },
  ],
  position: [
    { threshold: 90, boost: 0.10 },
    { threshold: 80, boost: 0.05 },
  ],
});

/**
 * Get phase confidence boost
 */
export function getPhaseConfidenceBoost(confidenceScore: number): number {
  for (const { threshold, boost } of PHASE_BOOSTS.confidence) {
    if (confidenceScore >= threshold) {
      return boost;
    }
  }
  return 0;
}

/**
 * Get phase position boost
 */
export function getPhasePositionBoost(confidenceScore: number): number {
  for (const { threshold, boost } of PHASE_BOOSTS.position) {
    if (confidenceScore >= threshold) {
      return boost;
    }
  }
  return 0;
}

/**
 * Clamp position multiplier to valid bounds
 */
export function clampPositionMultiplier(multiplier: number): number {
  return Math.max(POSITION_MULTIPLIER_MIN, Math.min(POSITION_MULTIPLIER_MAX, multiplier));
}

/**
 * Trend alignment boost configuration
 * Requirements: 24.9, 24.10
 */
export const TREND_BOOSTS: Readonly<{
  position: { strength: string; boost: number }[];
  confidence: { htf_match: boolean; boost: number }[];
}> = Object.freeze({
  position: [
    { strength: 'STRONG', boost: 0.30 }, // +30% position boost for STRONG trend (>=75%)
  ],
  confidence: [
    { htf_match: true, boost: 0.15 }, // +15% confidence boost when HTF bias matches signal direction
  ],
});

/**
 * Get trend position boost based on alignment strength
 * Requirements: 24.9
 */
export function getTrendPositionBoost(strength: string): number {
  for (const { strength: reqStrength, boost } of TREND_BOOSTS.position) {
    if (strength === reqStrength) {
      return boost;
    }
  }
  return 0;
}

/**
 * Get trend confidence boost based on HTF bias alignment
 * Requirements: 24.10
 */
export function getTrendConfidenceBoost(htfBiasMatches: boolean): number {
  if (htfBiasMatches) {
    return TREND_BOOSTS.confidence[0].boost;
  }
  return 0;
}
