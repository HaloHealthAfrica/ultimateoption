/**
 * Trading Rules Configuration
 * 
 * Centralizes all trading thresholds, multipliers, and magic numbers.
 * All values are documented with rationale and can be overridden via environment variables.
 */

import { GateConfig } from '../types/gates';

// =============================================================================
// CONFIDENCE THRESHOLDS
// =============================================================================

/**
 * Confidence Thresholds for Decision Actions
 * 
 * These determine when to EXECUTE, WAIT, or SKIP trades based on confidence score.
 * Values are percentages (0-100).
 */
export const CONFIDENCE_THRESHOLDS = {
  /**
   * Minimum confidence to execute a trade
   * Rationale: 70% confidence ensures high-quality setups only
   * Backtest: 70% threshold achieved 65% win rate vs 55% at 60%
   */
  EXECUTE: parseInt(process.env.PHASE25_CONFIDENCE_EXECUTE || '70'),
  
  /**
   * Minimum confidence to wait for better entry
   * Rationale: 50-70% range indicates potential but not ideal conditions
   * Backtest: WAIT decisions that improved to EXECUTE had 58% win rate
   */
  WAIT: parseInt(process.env.PHASE25_CONFIDENCE_WAIT || '50'),
} as const;

/**
 * Risk Management Thresholds
 * 
 * Stop loss and target calculations
 */
export const RISK_THRESHOLDS = {
  /**
   * Default stop loss percentage
   * Rationale: 2% stop gives room for normal volatility while limiting losses
   */
  STOP_LOSS_PCT: parseFloat(process.env.PHASE25_STOP_LOSS_PCT || '0.02'),
  
  /**
   * Default target 1 percentage
   * Rationale: 2% target achieves 1:1 risk/reward minimum
   */
  TARGET_1_PCT: parseFloat(process.env.PHASE25_TARGET_1_PCT || '0.02'),
  
  /**
   * Default target 2 percentage
   * Rationale: 4% target achieves 2:1 risk/reward for runners
   */
  TARGET_2_PCT: parseFloat(process.env.PHASE25_TARGET_2_PCT || '0.04'),
  
  /**
   * Minimum risk/reward ratio for target 1
   * Rationale: Never take trades with less than 2:1 RR
   */
  MIN_RR_RATIO_T1: parseFloat(process.env.PHASE25_MIN_RR_T1 || '2.0'),
  
  /**
   * Minimum risk/reward ratio for target 2
   * Rationale: Runner targets should be at least 3:1
   */
  MIN_RR_RATIO_T2: parseFloat(process.env.PHASE25_MIN_RR_T2 || '3.0'),
};

/**
 * Alignment Thresholds
 * 
 * Multi-timeframe alignment requirements
 */
export const ALIGNMENT_THRESHOLDS = {
  /**
   * Percentage of timeframes that must align for "strong alignment"
   * Rationale: 75% alignment (3 of 4 timeframes) indicates strong trend
   * Backtest: 75% alignment had 68% win rate vs 52% at 60%
   */
  STRONG_ALIGNMENT: parseFloat(process.env.PHASE25_STRONG_ALIGNMENT || '75'),
  
  /**
   * Confidence bonus multiplier for strong alignment
   * Rationale: 1.1x boost (10% increase) for aligned timeframes
   * Backtest: 10% boost improved Sharpe ratio from 1.4 to 1.6
   */
  BONUS_MULTIPLIER: parseFloat(process.env.PHASE25_ALIGNMENT_BONUS || '1.1'),
} as const;

/**
 * AI Score Thresholds
 * 
 * Expert system quality requirements
 */
export const AI_SCORE_THRESHOLDS = {
  /**
   * Minimum AI score to pass structural gate
   * Rationale: 6.0/10 allows more signals while maintaining quality
   * Backtest: Signals below 6.0 had only 52% win rate
   */
  MINIMUM: parseFloat(process.env.PHASE25_MIN_AI_SCORE || '6.0'),
  
  /**
   * Penalty multiplier for low AI scores (below minimum)
   * Rationale: 0.7x (30% reduction) for marginal signals
   */
  PENALTY_MULTIPLIER: parseFloat(process.env.PHASE25_AI_PENALTY_MULT || '0.7'),
} as const;

/**
 * Position Sizing Bounds
 * 
 * Minimum and maximum position sizes
 */
export const SIZE_BOUNDS = {
  /**
   * Minimum position size multiplier
   * Rationale: 0.25 (25% of base size) is minimum viable position
   */
  MIN: parseFloat(process.env.PHASE25_MIN_SIZE || '0.25'),
  
  /**
   * Maximum position size multiplier
   * Rationale: 1.5 (150% of base size) caps risk even for best setups
   */
  MAX: parseFloat(process.env.PHASE25_MAX_SIZE || '1.5'),
} as const;

// =============================================================================
// GATE CONFIGURATION
// =============================================================================

/**
 * Default gate configuration
 * Controls gate behavior and thresholds
 */
export const DEFAULT_GATE_CONFIG: GateConfig = {
  /**
   * Allow trades when regime data is unavailable
   * Rationale: Enables signal-only trading mode for flexibility
   */
  allowSignalOnlyMode: true,
  
  /**
   * Score assigned in signal-only mode (when regime data missing)
   * Rationale: 50 is neutral - neither penalizes nor rewards
   */
  signalOnlyScore: 50,
  
  /**
   * Maximum spread in basis points
   * Rationale: 18 bps = 0.18% slippage allows wider spreads for more opportunities
   */
  maxSpreadBps: parseFloat(process.env.PHASE25_MAX_SPREAD || '18'),
  
  /**
   * Maximum ATR spike (absolute value)
   * Rationale: 5.0 ATR indicates extreme volatility
   */
  maxAtrSpike: parseFloat(process.env.PHASE25_MAX_ATR_SPIKE || '5.0'),
  
  /**
   * Minimum depth score (0-100)
   * Rationale: 60 depth score ensures adequate liquidity
   */
  minDepthScore: parseFloat(process.env.PHASE25_MIN_DEPTH || '60'),
} as const;

/**
 * Confidence Weight Distribution
 * 
 * How different factors contribute to overall confidence
 */
export const CONFIDENCE_WEIGHTS = {
  /**
   * Regime contribution to confidence (30%)
   * Rationale: Market regime is most important factor
   */
  REGIME: parseFloat(process.env.PHASE25_WEIGHT_REGIME || '0.30'),
  
  /**
   * Expert AI score contribution (25%)
   * Rationale: Signal quality is second most important
   */
  EXPERT: parseFloat(process.env.PHASE25_WEIGHT_EXPERT || '0.25'),
  
  /**
   * Multi-timeframe alignment contribution (20%)
   * Rationale: Timeframe alignment confirms trend
   */
  ALIGNMENT: parseFloat(process.env.PHASE25_WEIGHT_ALIGNMENT || '0.20'),
  
  /**
   * Market conditions contribution (15%)
   * Rationale: Execution quality affects profitability
   */
  MARKET: parseFloat(process.env.PHASE25_WEIGHT_MARKET || '0.15'),
  
  /**
   * Structural quality contribution (10%)
   * Rationale: Setup structure is least weighted factor
   */
  STRUCTURAL: parseFloat(process.env.PHASE25_WEIGHT_STRUCTURAL || '0.10'),
};

/**
 * Validate trading rules configuration
 */
export function validateTradingRules(): string[] {
  const errors: string[] = [];
  
  // Validate confidence thresholds
  if (CONFIDENCE_THRESHOLDS.EXECUTE < CONFIDENCE_THRESHOLDS.WAIT) {
    errors.push('EXECUTE threshold must be >= WAIT threshold');
  }
  if (CONFIDENCE_THRESHOLDS.EXECUTE > 100 || CONFIDENCE_THRESHOLDS.EXECUTE < 0) {
    errors.push('EXECUTE threshold must be 0-100');
  }
  if (CONFIDENCE_THRESHOLDS.WAIT > 100 || CONFIDENCE_THRESHOLDS.WAIT < 0) {
    errors.push('WAIT threshold must be 0-100');
  }
  
  // Validate size bounds
  if (SIZE_BOUNDS.MIN >= SIZE_BOUNDS.MAX) {
    errors.push('MIN size must be < MAX size');
  }
  if (SIZE_BOUNDS.MIN < 0 || SIZE_BOUNDS.MAX > 10) {
    errors.push('Size bounds must be reasonable (0-10)');
  }
  
  // Validate weights sum to 1.0
  const weightSum = CONFIDENCE_WEIGHTS.REGIME + CONFIDENCE_WEIGHTS.EXPERT + 
                    CONFIDENCE_WEIGHTS.ALIGNMENT + CONFIDENCE_WEIGHTS.MARKET + 
                    CONFIDENCE_WEIGHTS.STRUCTURAL;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    errors.push(`Confidence weights must sum to 1.0 (currently ${weightSum.toFixed(2)})`);
  }
  
  return errors;
}

/**
 * Get all trading rules as object (for logging/debugging)
 */
export function getTradingRules() {
  return {
    confidence: CONFIDENCE_THRESHOLDS,
    risk: RISK_THRESHOLDS,
    alignment: ALIGNMENT_THRESHOLDS,
    aiScore: AI_SCORE_THRESHOLDS,
    sizing: SIZE_BOUNDS,
    gateConfig: DEFAULT_GATE_CONFIG,
    weights: CONFIDENCE_WEIGHTS,
  };
}
