/**
 * Confidence Weight Configuration
 * Documents rationale for each confidence adjustment in the decision engine
 */

export const CONFIDENCE_WEIGHTS = {
  // Base score calculation: AI Score * 10 (converts 0-10 scale to 0-100 scale)
  
  // Market condition adjustments
  spread: {
    penalty: -5,
    threshold: 8,  // basis points
    rationale: 
      'Wide bid-ask spreads (>8bps) indicate poor execution quality and higher slippage. ' +
      'For a typical trade, 8bps spread = $0.08 per $100 = 0.08% slippage. ' +
      'This directly reduces expected profit. ' +
      '-5 confidence points represents ~5% reduction in trade quality.',
    
    calculation: 'if (spreadBps > 8) confidence -= 5',
    
    impact: {
      low: 'Spreads 0-8bps: No penalty (good execution)',
      medium: 'Spreads 8-12bps: -5 points (acceptable but not ideal)',
      high: 'Spreads >12bps: Trade blocked by market gate (unacceptable)'
    }
  },
  
  volatility: {
    bonus: 3,
    minATR: 5,
    maxATR: 15,
    rationale:
      'Optimal volatility range (5-15 ATR) provides good risk/reward balance. ' +
      'Too low (<5): Limited profit potential, tight ranges. ' +
      'Too high (>15): Excessive risk, unpredictable moves. ' +
      'Sweet spot (5-15): Enough movement for profit, manageable risk. ' +
      '+3 points = ~3% confidence boost for optimal conditions.',
    
    calculation: 'if (atr14 >= 5 && atr14 <= 15) confidence += 3',
    
    impact: {
      low: 'ATR <5: No bonus (limited opportunity)',
      optimal: 'ATR 5-15: +3 points (ideal conditions)',
      high: 'ATR >50: Trade blocked by market gate (too risky)'
    }
  },
  
  volume: {
    bonus: 2,
    threshold: 1.2,  // ratio to average volume
    rationale:
      'High volume (>1.2x average) indicates strong market participation. ' +
      'Benefits: Better liquidity, tighter spreads, easier execution, more reliable price action. ' +
      'Institutional participation often drives high volume. ' +
      '+2 points = ~2% confidence boost for strong participation.',
    
    calculation: 'if (volumeRatio > 1.2) confidence += 2',
    
    impact: {
      low: 'Volume <0.8x: No bonus (thin market)',
      normal: 'Volume 0.8-1.2x: No bonus (average)',
      high: 'Volume >1.2x: +2 points (strong participation)'
    }
  },
  
  optionsFlow: {
    bonus: 5,
    bullishThreshold: 0.8,  // put/call ratio for long trades
    bearishThreshold: 1.2,  // put/call ratio for short trades
    rationale:
      'Favorable options flow indicates institutional positioning. ' +
      'For LONG trades: Put/Call <0.8 means more calls than puts (bullish). ' +
      'For SHORT trades: Put/Call >1.2 means more puts than calls (bearish). ' +
      'Institutions use options for hedging and positioning. ' +
      'Strong signal of market sentiment. ' +
      '+5 points = ~5% confidence boost for favorable flow.',
    
    calculation: 
      'if (direction === LONG && putCallRatio < 0.8) confidence += 5\n' +
      'if (direction === SHORT && putCallRatio > 1.2) confidence += 5',
    
    impact: {
      favorable: 'Aligned flow: +5 points (strong institutional signal)',
      neutral: 'Neutral flow (0.8-1.2): No adjustment',
      unfavorable: 'Opposing flow: No penalty (but no bonus)'
    }
  },
  
  ivPercentile: {
    bonus: 3,
    threshold: 60,
    rationale:
      'High IV percentile (>60) means options are expensive relative to history. ' +
      'Indicates market uncertainty and elevated premium. ' +
      'Good for: Premium selling strategies, volatility plays. ' +
      'Suggests: Potential for mean reversion, heightened attention. ' +
      '+3 points = ~3% confidence boost for premium strategies.',
    
    calculation: 'if (ivPercentile > 60) confidence += 3',
    
    impact: {
      low: 'IV <40: No bonus (cheap options, low uncertainty)',
      medium: 'IV 40-60: No bonus (normal range)',
      high: 'IV >60: +3 points (elevated premium, opportunity)'
    }
  }
};

/**
 * Confidence Thresholds
 * Defines action thresholds based on final confidence score
 */
export const CONFIDENCE_THRESHOLDS = {
  EXECUTE: 80,  // Execute trade if confidence >= 80%
  WAIT: 65,     // Wait for better setup if 65% <= confidence < 80%
  SKIP: 0,      // Skip trade if confidence < 65%
  
  rationale: {
    EXECUTE: 
      '80%+ confidence indicates high-quality setup with favorable conditions. ' +
      'All gates passed, strong signals, good market environment. ' +
      'Expected win rate: 60-70%, Risk/Reward: 2:1 or better.',
    
    WAIT:
      '65-79% confidence indicates decent setup but not ideal. ' +
      'All gates passed but some conditions suboptimal. ' +
      'Wait for improvement in market conditions or signal strength. ' +
      'Expected win rate: 50-60%, Risk/Reward: 1.5:1.',
    
    SKIP:
      '<65% confidence indicates poor setup or unfavorable conditions. ' +
      'May have failed gates or weak signals. ' +
      'Risk of loss too high, better opportunities will come. ' +
      'Expected win rate: <50%, Risk/Reward: <1:1.'
  }
};

/**
 * Validation Framework
 * Structure for backtesting and validating confidence weights
 */
export interface ConfidenceValidation {
  weight: number;
  threshold: number;
  rationale: string;
  backtestResults?: {
    sampleSize: number;
    winRate: number;
    avgProfit: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

/**
 * Backtest Template
 * Use this structure to validate weights with historical data
 */
export const BACKTEST_TEMPLATE = {
  spread: {
    weight: -5,
    threshold: 8,
    rationale: CONFIDENCE_WEIGHTS.spread.rationale,
    backtestResults: {
      // TODO: Add results from historical backtest
      sampleSize: 0,
      winRate: 0,
      avgProfit: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    }
  },
  
  volatility: {
    weight: 3,
    threshold: [5, 15],
    rationale: CONFIDENCE_WEIGHTS.volatility.rationale,
    backtestResults: {
      // TODO: Add results from historical backtest
      sampleSize: 0,
      winRate: 0,
      avgProfit: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    }
  },
  
  volume: {
    weight: 2,
    threshold: 1.2,
    rationale: CONFIDENCE_WEIGHTS.volume.rationale,
    backtestResults: {
      // TODO: Add results from historical backtest
      sampleSize: 0,
      winRate: 0,
      avgProfit: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    }
  },
  
  optionsFlow: {
    weight: 5,
    threshold: [0.8, 1.2],
    rationale: CONFIDENCE_WEIGHTS.optionsFlow.rationale,
    backtestResults: {
      // TODO: Add results from historical backtest
      sampleSize: 0,
      winRate: 0,
      avgProfit: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    }
  },
  
  ivPercentile: {
    weight: 3,
    threshold: 60,
    rationale: CONFIDENCE_WEIGHTS.ivPercentile.rationale,
    backtestResults: {
      // TODO: Add results from historical backtest
      sampleSize: 0,
      winRate: 0,
      avgProfit: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    }
  }
};

/**
 * Get weight for a specific adjustment
 */
export function getConfidenceWeight(adjustment: keyof typeof CONFIDENCE_WEIGHTS): number {
  const config = CONFIDENCE_WEIGHTS[adjustment];
  if ('bonus' in config) return config.bonus;
  if ('penalty' in config) return config.penalty;
  return 0;
}

/**
 * Get rationale for a specific adjustment
 */
export function getConfidenceRationale(adjustment: keyof typeof CONFIDENCE_WEIGHTS): string {
  return CONFIDENCE_WEIGHTS[adjustment].rationale;
}

/**
 * Export all weights for easy reference
 */
export const WEIGHTS_SUMMARY = {
  spread: -5,
  volatility: +3,
  volume: +2,
  optionsFlow: +5,
  ivPercentile: +3,
  
  total_possible_bonus: 13,  // 3 + 2 + 5 + 3
  total_possible_penalty: -5,
  
  notes: 'Maximum confidence boost: +13 points. Maximum penalty: -5 points.'
};
