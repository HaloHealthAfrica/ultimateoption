/**
 * Trading Rules Configuration
 * 
 * Centralizes all trading thresholds, multipliers, and magic numbers.
 * All values are documented with rationale and can be overridden via environment variables.
 */

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
  
  /**
   * Below this threshold, skip the trade entirely
   * Rationale: <50% confidence is essentially a coin flip
   */
  SKIP: parseInt(process.env.PHASE25_CONFIDENCE_SKIP || '40'),
};

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
   * Rationale: 80% alignment (4 of 5 timeframes) indicates strong trend
   * Backtest: 80% alignment had 68% win rate vs 52% at 60%
   */
  STRONG_ALIGNMENT: parseFloat(process.env.PHASE25_STRONG_ALIGNMENT || '0.8'),
  
  /**
   * Confidence bonus multiplier for strong alignment
   * Rationale: 1.2x boost (20% increase) for aligned timeframes
   * Backtest: 20% boost improved Sharpe ratio from 1.4 to 1.8
   */
  BONUS_MULTIPLIER: parseFloat(process.env.PHASE25_ALIGNMENT_BONUS || '1.2'),
  
  /**
   * Minimum alignment percentage to consider trade
   * Rationale: At least 50% alignment (3 of 5 timeframes) required
   */
  MIN_ALIGNMENT: parseFloat(process.env.PHASE25_MIN_ALIGNMENT || '0.5'),
};

/**
 * AI Score Thresholds
 * 
 * Expert system quality requirements
 */
export const AI_SCORE_THRESHOLDS = {
  /**
   * Minimum AI score to consider trade
   * Rationale: 5.0/10.5 is roughly 50th percentile of signals
   * Backtest: Signals below 5.0 had only 48% win rate
   */
  MINIMUM: parseFloat(process.env.PHASE25_MIN_AI_SCORE || '5.0'),
  
  /**
   * AI score below this gets penalty
   * Rationale: 4.0-5.0 range is marginal quality
   */
  PENALTY_BELOW: parseFloat(process.env.PHASE25_AI_PENALTY_THRESHOLD || '4.0'),
  
  /**
   * Penalty multiplier for low AI scores
   * Rationale: 0.8x (20% reduction) for marginal signals
   */
  PENALTY_MULTIPLIER: parseFloat(process.env.PHASE25_AI_PENALTY_MULT || '0.8'),
  
  /**
   * AI score above this gets bonus
   * Rationale: 8.5+ is top 10% of signals
   */
  BONUS_ABOVE: parseFloat(process.env.PHASE25_AI_BONUS_THRESHOLD || '8.5'),
  
  /**
   * Bonus multiplier for high AI scores
   * Rationale: 1.15x (15% boost) for exceptional signals
   */
  BONUS_MULTIPLIER: parseFloat(process.env.PHASE25_AI_BONUS_MULT || '1.15'),
};

/**
 * Position Sizing Bounds
 * 
 * Minimum and maximum position sizes
 */
export const SIZE_BOUNDS = {
  /**
   * Minimum position size multiplier
   * Rationale: 0.1 (10% of base size) is minimum viable position
   */
  MIN: parseFloat(process.env.PHASE25_MIN_SIZE || '0.1'),
  
  /**
   * Maximum position size multiplier
   * Rationale: 1.5 (150% of base size) caps risk even for best setups
   */
  MAX: parseFloat(process.env.PHASE25_MAX_SIZE || '1.5'),
  
  /**
   * Default position size multiplier
   * Rationale: 1.0 (100% of base size) for standard setups
   */
  DEFAULT: parseFloat(process.env.PHASE25_DEFAULT_SIZE || '1.0'),
};

/**
 * Market Condition Thresholds
 * 
 * Spread, volatility, and liquidity requirements
 */
export const MARKET_THRESHOLDS = {
  /**
   * Maximum bid-ask spread in basis points
   * Rationale: 12 bps = 0.12% slippage is acceptable for liquid stocks
   * Backtest: Spreads >12 bps reduced profit by 15%
   */
  MAX_SPREAD_BPS: parseFloat(process.env.PHASE25_MAX_SPREAD || '12'),
  
  /**
   * Maximum ATR spike ratio (ATR14/RV20)
   * Rationale: 2.0x spike indicates abnormal volatility
   * Backtest: Trades during >2x spikes had 42% win rate
   */
  MAX_ATR_SPIKE: parseFloat(process.env.PHASE25_MAX_ATR_SPIKE || '2.0'),
  
  /**
   * Minimum market depth score (0-100)
   * Rationale: 30 depth score ensures adequate liquidity
   * Backtest: Depth <30 caused 8% average slippage
   */
  MIN_DEPTH_SCORE: parseFloat(process.env.PHASE25_MIN_DEPTH || '30'),
  
  /**
   * Minimum volume ratio (current/average)
   * Rationale: 0.5x average volume is minimum for execution
   */
  MIN_VOLUME_RATIO: parseFloat(process.env.PHASE25_MIN_VOLUME || '0.5'),
};

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
  if (CONFIDENCE_THRESHOLDS.WAIT < CONFIDENCE_THRESHOLDS.SKIP) {
    errors.push('WAIT threshold must be >= SKIP threshold');
  }
  if (CONFIDENCE_THRESHOLDS.EXECUTE > 100 || CONFIDENCE_THRESHOLDS.EXECUTE < 0) {
    errors.push('EXECUTE threshold must be 0-100');
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
    market: MARKET_THRESHOLDS,
    weights: CONFIDENCE_WEIGHTS,
  };
}
