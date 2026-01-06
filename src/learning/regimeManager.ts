/**
 * Regime Manager
 * 
 * Calculates rolling metrics across different time windows and detects
 * performance degradation patterns. Provides confidence scores for
 * regime stability.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { LedgerEntry, VolatilityRegime, TrendRegime } from '../types/ledger';
import { 
  calculateMetrics, 
  Metrics, 
  MINIMUM_SAMPLE_SIZE,
  getRollingMetrics,
  RollingMetrics 
} from './metricsEngine';
import { TradeFeatures } from './featureExtractor';

/**
 * Regime performance status
 */
export type RegimeStatus = 
  | 'STABLE'
  | 'DEGRADING'
  | 'RECOVERING'
  | 'INSUFFICIENT_DATA';

/**
 * Performance degradation indicators
 * Requirement 9.2
 */
export interface DegradationIndicators {
  winRateDeclining: boolean;
  expectancyDeclining: boolean;
  drawdownIncreasing: boolean;
  rStdIncreasing: boolean;
}

/**
 * Regime analysis result
 * Requirement 9.1, 9.3
 */
export interface RegimeAnalysis {
  status: RegimeStatus;
  confidence: number; // 0-100
  rollingMetrics: RollingMetrics;
  degradation: DegradationIndicators;
  recommendations: string[];
}

/**
 * Regime-specific performance
 * Requirement 9.4
 */
export interface RegimePerformance {
  volatility: Map<VolatilityRegime, Metrics>;
  trend: Map<TrendRegime, Metrics>;
}

/**
 * Thresholds for degradation detection
 */
const DEGRADATION_THRESHOLDS = Object.freeze({
  WIN_RATE_DROP: 0.10,      // 10% drop from 90d to 30d
  EXPECTANCY_DROP: 0.20,    // 20% drop
  DRAWDOWN_INCREASE: 0.50,  // 50% increase
  R_STD_INCREASE: 0.30,     // 30% increase in volatility
});

/**
 * Confidence score weights
 */
const CONFIDENCE_WEIGHTS = Object.freeze({
  SAMPLE_SIZE: 0.30,
  CONSISTENCY: 0.25,
  STABILITY: 0.25,
  RECENCY: 0.20,
});

/**
 * Analyze regime performance and detect degradation
 * Requirement 9.1, 9.2, 9.3
 * 
 * @param entries - All ledger entries
 * @param features - Optional feature filter
 * @returns Regime analysis with status, confidence, and recommendations
 */
export function analyzeRegime(
  entries: LedgerEntry[],
  features?: Partial<TradeFeatures>
): RegimeAnalysis {
  const rolling = getRollingMetrics(entries, features);
  
  // Check if we have sufficient data
  if (rolling['90d'].status === 'INSUFFICIENT_DATA') {
    return {
      status: 'INSUFFICIENT_DATA',
      confidence: 0,
      rollingMetrics: rolling,
      degradation: {
        winRateDeclining: false,
        expectancyDeclining: false,
        drawdownIncreasing: false,
        rStdIncreasing: false,
      },
      recommendations: ['Collect more trade data (minimum 30 trades in 90 days)'],
    };
  }
  
  // Detect degradation patterns
  const degradation = detectDegradation(rolling);
  
  // Calculate confidence score
  const confidence = calculateConfidence(rolling, entries);
  
  // Determine status
  const status = determineStatus(degradation, rolling);
  
  // Generate recommendations
  const recommendations = generateRecommendations(degradation, rolling, status);
  
  return {
    status,
    confidence,
    rollingMetrics: rolling,
    degradation,
    recommendations,
  };
}


/**
 * Detect performance degradation by comparing rolling windows
 * Requirement 9.2
 * 
 * @param rolling - Rolling metrics for 30d, 60d, 90d
 * @returns Degradation indicators
 */
function detectDegradation(rolling: RollingMetrics): DegradationIndicators {
  const m30 = rolling['30d'];
  const m90 = rolling['90d'];
  
  // Can't detect degradation without valid metrics
  if (m30.status !== 'VALID' || m90.status !== 'VALID') {
    return {
      winRateDeclining: false,
      expectancyDeclining: false,
      drawdownIncreasing: false,
      rStdIncreasing: false,
    };
  }
  
  // Win rate declining
  const winRateDrop = (m90.win_rate! - m30.win_rate!) / m90.win_rate!;
  const winRateDeclining = winRateDrop > DEGRADATION_THRESHOLDS.WIN_RATE_DROP;
  
  // Expectancy declining
  const expectancyDrop = m90.expectancy! !== 0
    ? (m90.expectancy! - m30.expectancy!) / Math.abs(m90.expectancy!)
    : m30.expectancy! < 0;
  const expectancyDeclining = typeof expectancyDrop === 'boolean' 
    ? expectancyDrop 
    : expectancyDrop > DEGRADATION_THRESHOLDS.EXPECTANCY_DROP;
  
  // Drawdown increasing
  const drawdownIncrease = m90.max_drawdown! !== 0
    ? (m30.max_drawdown! - m90.max_drawdown!) / m90.max_drawdown!
    : m30.max_drawdown! > 0;
  const drawdownIncreasing = typeof drawdownIncrease === 'boolean'
    ? drawdownIncrease
    : drawdownIncrease > DEGRADATION_THRESHOLDS.DRAWDOWN_INCREASE;
  
  // R standard deviation increasing (more volatile returns)
  const rStdIncrease = m90.r_std! !== 0
    ? (m30.r_std! - m90.r_std!) / m90.r_std!
    : m30.r_std! > 0;
  const rStdIncreasing = typeof rStdIncrease === 'boolean'
    ? rStdIncrease
    : rStdIncrease > DEGRADATION_THRESHOLDS.R_STD_INCREASE;
  
  return {
    winRateDeclining,
    expectancyDeclining,
    drawdownIncreasing,
    rStdIncreasing,
  };
}

/**
 * Calculate confidence score based on data quality and consistency
 * Requirement 9.3
 * 
 * @param rolling - Rolling metrics
 * @param entries - All entries for sample size calculation
 * @returns Confidence score 0-100
 */
function calculateConfidence(
  rolling: RollingMetrics,
  entries: LedgerEntry[]
): number {
  const m30 = rolling['30d'];
  const m90 = rolling['90d'];
  
  // Sample size score (more data = higher confidence)
  const sampleScore = Math.min(100, (m90.sample_size / (MINIMUM_SAMPLE_SIZE * 3)) * 100);
  
  // Consistency score (similar metrics across windows = higher confidence)
  let consistencyScore = 100;
  if (m30.status === 'VALID' && m90.status === 'VALID') {
    const winRateDiff = Math.abs(m30.win_rate! - m90.win_rate!);
    const expectancyDiff = m90.expectancy! !== 0
      ? Math.abs(m30.expectancy! - m90.expectancy!) / Math.abs(m90.expectancy!)
      : 0;
    consistencyScore = Math.max(0, 100 - (winRateDiff * 200) - (expectancyDiff * 100));
  }
  
  // Stability score (low R std = higher confidence)
  let stabilityScore = 100;
  if (m90.status === 'VALID' && m90.r_std !== undefined) {
    // R std of 0.5 or less is considered stable
    stabilityScore = Math.max(0, 100 - (m90.r_std * 100));
  }
  
  // Recency score (more recent trades = higher confidence)
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const recentTrades = entries.filter(e => 
    e.decision === 'EXECUTE' && 
    e.exit && 
    now - e.created_at <= 7 * msPerDay
  ).length;
  const recencyScore = Math.min(100, (recentTrades / 5) * 100);
  
  // Weighted average
  const confidence = 
    sampleScore * CONFIDENCE_WEIGHTS.SAMPLE_SIZE +
    consistencyScore * CONFIDENCE_WEIGHTS.CONSISTENCY +
    stabilityScore * CONFIDENCE_WEIGHTS.STABILITY +
    recencyScore * CONFIDENCE_WEIGHTS.RECENCY;
  
  return Math.round(Math.max(0, Math.min(100, confidence)));
}

/**
 * Determine regime status based on degradation indicators
 * 
 * @param degradation - Degradation indicators
 * @param rolling - Rolling metrics
 * @returns Regime status
 */
function determineStatus(
  degradation: DegradationIndicators,
  rolling: RollingMetrics
): RegimeStatus {
  const degradationCount = Object.values(degradation).filter(Boolean).length;
  
  // Check for recovery (30d better than 60d, 60d worse than 90d)
  const m30 = rolling['30d'];
  const m60 = rolling['60d'];
  const m90 = rolling['90d'];
  
  if (m30.status === 'VALID' && m60.status === 'VALID' && m90.status === 'VALID') {
    const recovering = 
      m30.win_rate! > m60.win_rate! && 
      m60.win_rate! < m90.win_rate!;
    
    if (recovering && degradationCount <= 1) {
      return 'RECOVERING';
    }
  }
  
  if (degradationCount >= 2) {
    return 'DEGRADING';
  }
  
  return 'STABLE';
}

/**
 * Generate recommendations based on analysis
 * Requirement 9.5
 * 
 * @param degradation - Degradation indicators
 * @param rolling - Rolling metrics
 * @param status - Current regime status
 * @returns Array of recommendation strings
 */
function generateRecommendations(
  degradation: DegradationIndicators,
  rolling: RollingMetrics,
  status: RegimeStatus
): string[] {
  const recommendations: string[] = [];
  
  if (status === 'DEGRADING') {
    recommendations.push('Consider reducing position sizes until performance stabilizes');
  }
  
  if (degradation.winRateDeclining) {
    recommendations.push('Win rate declining - review entry criteria and signal quality filters');
  }
  
  if (degradation.expectancyDeclining) {
    recommendations.push('Expectancy declining - review risk/reward ratios and exit timing');
  }
  
  if (degradation.drawdownIncreasing) {
    recommendations.push('Drawdown increasing - consider tighter stop losses or smaller positions');
  }
  
  if (degradation.rStdIncreasing) {
    recommendations.push('Return volatility increasing - review position sizing consistency');
  }
  
  if (status === 'RECOVERING') {
    recommendations.push('Performance recovering - maintain current approach');
  }
  
  if (status === 'STABLE' && recommendations.length === 0) {
    recommendations.push('Performance stable - continue current strategy');
  }
  
  return recommendations;
}

/**
 * Get performance metrics by volatility regime
 * Requirement 9.4
 * 
 * @param entries - All ledger entries
 * @returns Map of volatility regime to metrics
 */
export function getPerformanceByVolatilityRegime(
  entries: LedgerEntry[]
): Map<VolatilityRegime, Metrics> {
  const regimes: VolatilityRegime[] = ['LOW', 'NORMAL', 'HIGH', 'EXTREME'];
  const result = new Map<VolatilityRegime, Metrics>();
  
  for (const regime of regimes) {
    const filtered = entries.filter(e => e.regime.volatility === regime);
    result.set(regime, calculateMetrics(filtered));
  }
  
  return result;
}

/**
 * Get performance metrics by trend regime
 * Requirement 9.4
 * 
 * @param entries - All ledger entries
 * @returns Map of trend regime to metrics
 */
export function getPerformanceByTrendRegime(
  entries: LedgerEntry[]
): Map<TrendRegime, Metrics> {
  const regimes: TrendRegime[] = ['STRONG_BULL', 'BULL', 'NEUTRAL', 'BEAR', 'STRONG_BEAR'];
  const result = new Map<TrendRegime, Metrics>();
  
  for (const regime of regimes) {
    const filtered = entries.filter(e => e.regime.trend === regime);
    result.set(regime, calculateMetrics(filtered));
  }
  
  return result;
}

/**
 * Get full regime performance breakdown
 * Requirement 9.4
 * 
 * @param entries - All ledger entries
 * @returns Regime performance by volatility and trend
 */
export function getRegimePerformance(entries: LedgerEntry[]): RegimePerformance {
  return {
    volatility: getPerformanceByVolatilityRegime(entries),
    trend: getPerformanceByTrendRegime(entries),
  };
}

/**
 * Detect regime mismatch between current and historical performance
 * Requirement 9.5
 * 
 * @param entries - All ledger entries
 * @param currentRegime - Current market regime
 * @returns Mismatch percentage (0-100)
 */
export function detectRegimeMismatch(
  entries: LedgerEntry[],
  currentRegime: { volatility: VolatilityRegime; trend: TrendRegime }
): number {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  // Get recent trades (last 30 days)
  const recentTrades = entries.filter(e => 
    e.decision === 'EXECUTE' && 
    now - e.created_at <= 30 * msPerDay
  );
  
  if (recentTrades.length === 0) return 0;
  
  // Count trades in different regime
  const mismatchedTrades = recentTrades.filter(e => 
    e.regime.volatility !== currentRegime.volatility ||
    e.regime.trend !== currentRegime.trend
  );
  
  return Math.round((mismatchedTrades.length / recentTrades.length) * 100);
}
