/**
 * Safety Monitor
 * 
 * Monitors trading activity for safety violations and generates alerts.
 * Does NOT take automatic actions - only generates alerts for human review.
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 */

import { LedgerEntry, VolatilityRegime, TrendRegime } from '../types/ledger';

/**
 * Metrics interface for learning instability check
 * Defined locally to avoid importing from learning module (isolation requirement)
 */
export interface Metrics {
  status: 'VALID' | 'INSUFFICIENT_DATA';
  sample_size: number;
  win_rate?: number;
  expectancy?: number;
  avg_r?: number;
  profit_factor?: number;
  max_drawdown?: number;
  avg_win?: number;
  avg_loss?: number;
  r_std?: number;
  required?: number;
}

/**
 * Detect regime mismatch between current and historical performance
 * Inlined from learning module to maintain isolation (Requirement 2.6)
 * 
 * @param entries - All ledger entries
 * @param currentRegime - Current market regime
 * @returns Mismatch percentage (0-100)
 */
function detectRegimeMismatch(
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

/**
 * Alert severity levels
 */
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/**
 * Alert types
 * Requirement 16.1
 */
export type AlertType = 
  | 'OVERTRADING'
  | 'DRAWDOWN_SPIKE'
  | 'REGIME_MISMATCH'
  | 'LEARNING_INSTABILITY'
  | 'CONSECUTIVE_LOSSES'
  | 'POSITION_SIZE_ANOMALY';

/**
 * Safety alert
 * Requirement 16.1
 */
export interface SafetyAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
  acknowledged: boolean;
}

/**
 * Safety thresholds configuration
 * Requirement 16.2, 16.3, 16.4
 */
export interface SafetyThresholds {
  maxTradesPerDay: number;        // Default: 20
  maxDrawdownSpike: number;       // Default: $5000
  maxRegimeMismatch: number;      // Default: 50%
  maxConsecutiveLosses: number;   // Default: 5
  positionSizeStdMultiple: number; // Default: 2.0
}

/**
 * Default safety thresholds
 */
export const DEFAULT_THRESHOLDS: Readonly<SafetyThresholds> = Object.freeze({
  maxTradesPerDay: 20,
  maxDrawdownSpike: 5000,
  maxRegimeMismatch: 50,
  maxConsecutiveLosses: 5,
  positionSizeStdMultiple: 2.0,
});

/**
 * Safety monitor state
 */
export interface SafetyState {
  alerts: SafetyAlert[];
  lastCheck: number;
  tradesLast24h: number;
  currentDrawdown: number;
  consecutiveLosses: number;
  regimeMismatchPercent: number;
}

/**
 * Generate a unique alert ID
 */
function generateAlertId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Check for overtrading (>20 trades in 24 hours)
 * Requirement 16.2
 * 
 * @param entries - Ledger entries
 * @param threshold - Max trades per day
 * @returns Alert if threshold exceeded, null otherwise
 */
export function checkOvertrading(
  entries: LedgerEntry[],
  threshold: number = DEFAULT_THRESHOLDS.maxTradesPerDay
): SafetyAlert | null {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  const tradesLast24h = entries.filter(e => 
    e.decision === 'EXECUTE' && 
    now - e.created_at <= msPerDay
  ).length;
  
  if (tradesLast24h > threshold) {
    return {
      id: generateAlertId(),
      type: 'OVERTRADING',
      severity: tradesLast24h > threshold * 1.5 ? 'CRITICAL' : 'WARNING',
      message: `Overtrading detected: ${tradesLast24h} trades in last 24 hours (threshold: ${threshold})`,
      details: {
        tradesLast24h,
        threshold,
        excessTrades: tradesLast24h - threshold,
      },
      timestamp: now,
      acknowledged: false,
    };
  }
  
  return null;
}


/**
 * Check for drawdown spike (>$5000 in recent period)
 * Requirement 16.3
 * 
 * @param entries - Ledger entries
 * @param threshold - Max drawdown spike
 * @returns Alert if threshold exceeded, null otherwise
 */
export function checkDrawdownSpike(
  entries: LedgerEntry[],
  threshold: number = DEFAULT_THRESHOLDS.maxDrawdownSpike
): SafetyAlert | null {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  // Get closed trades from last 7 days
  const recentTrades = entries.filter(e => 
    e.decision === 'EXECUTE' && 
    e.exit && 
    now - e.created_at <= 7 * msPerDay
  ).sort((a, b) => a.exit!.exit_time - b.exit!.exit_time);
  
  if (recentTrades.length === 0) return null;
  
  // Calculate max drawdown in recent period
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  
  for (const trade of recentTrades) {
    cumulative += trade.exit!.pnl_net;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  if (maxDrawdown > threshold) {
    return {
      id: generateAlertId(),
      type: 'DRAWDOWN_SPIKE',
      severity: maxDrawdown > threshold * 1.5 ? 'CRITICAL' : 'WARNING',
      message: `Drawdown spike detected: $${maxDrawdown.toFixed(2)} (threshold: $${threshold})`,
      details: {
        maxDrawdown,
        threshold,
        periodDays: 7,
        tradesInPeriod: recentTrades.length,
      },
      timestamp: now,
      acknowledged: false,
    };
  }
  
  return null;
}

/**
 * Check for regime mismatch (>50% trades in different regime)
 * Requirement 16.4
 * 
 * @param entries - Ledger entries
 * @param currentRegime - Current market regime
 * @param threshold - Max mismatch percentage
 * @returns Alert if threshold exceeded, null otherwise
 */
export function checkRegimeMismatch(
  entries: LedgerEntry[],
  currentRegime: { volatility: VolatilityRegime; trend: TrendRegime },
  threshold: number = DEFAULT_THRESHOLDS.maxRegimeMismatch
): SafetyAlert | null {
  const mismatchPercent = detectRegimeMismatch(entries, currentRegime);
  
  if (mismatchPercent > threshold) {
    return {
      id: generateAlertId(),
      type: 'REGIME_MISMATCH',
      severity: mismatchPercent > threshold * 1.3 ? 'CRITICAL' : 'WARNING',
      message: `Regime mismatch detected: ${mismatchPercent}% of recent trades in different regime (threshold: ${threshold}%)`,
      details: {
        mismatchPercent,
        threshold,
        currentRegime,
      },
      timestamp: Date.now(),
      acknowledged: false,
    };
  }
  
  return null;
}

/**
 * Check for consecutive losses
 * 
 * @param entries - Ledger entries
 * @param threshold - Max consecutive losses
 * @returns Alert if threshold exceeded, null otherwise
 */
export function checkConsecutiveLosses(
  entries: LedgerEntry[],
  threshold: number = DEFAULT_THRESHOLDS.maxConsecutiveLosses
): SafetyAlert | null {
  // Get closed trades sorted by exit time
  const closedTrades = entries
    .filter(e => e.decision === 'EXECUTE' && e.exit)
    .sort((a, b) => a.exit!.exit_time - b.exit!.exit_time);
  
  if (closedTrades.length === 0) return null;
  
  // Count consecutive losses from most recent
  let consecutiveLosses = 0;
  for (let i = closedTrades.length - 1; i >= 0; i--) {
    if (closedTrades[i].exit!.pnl_net < 0) {
      consecutiveLosses++;
    } else {
      break;
    }
  }
  
  if (consecutiveLosses >= threshold) {
    return {
      id: generateAlertId(),
      type: 'CONSECUTIVE_LOSSES',
      severity: consecutiveLosses >= threshold * 1.5 ? 'CRITICAL' : 'WARNING',
      message: `${consecutiveLosses} consecutive losses detected (threshold: ${threshold})`,
      details: {
        consecutiveLosses,
        threshold,
        totalLoss: closedTrades
          .slice(-consecutiveLosses)
          .reduce((sum, t) => sum + t.exit!.pnl_net, 0),
      },
      timestamp: Date.now(),
      acknowledged: false,
    };
  }
  
  return null;
}

/**
 * Check for position size anomalies
 * 
 * @param entries - Ledger entries
 * @param stdMultiple - Standard deviation multiple for anomaly detection
 * @returns Alert if anomaly detected, null otherwise
 */
export function checkPositionSizeAnomaly(
  entries: LedgerEntry[],
  stdMultiple: number = DEFAULT_THRESHOLDS.positionSizeStdMultiple
): SafetyAlert | null {
  // Get executed trades with position sizes
  const executedTrades = entries.filter(e => 
    e.decision === 'EXECUTE' && e.execution
  );
  
  if (executedTrades.length < 10) return null; // Need enough data
  
  // Calculate mean and std of position sizes
  const sizes = executedTrades.map(e => e.execution!.filled_contracts);
  const mean = sizes.reduce((sum, s) => sum + s, 0) / sizes.length;
  const variance = sizes.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sizes.length;
  const std = Math.sqrt(variance);
  
  // Check most recent trade
  const mostRecent = executedTrades[executedTrades.length - 1];
  const recentSize = mostRecent.execution!.filled_contracts;
  const zScore = std > 0 ? (recentSize - mean) / std : 0;
  
  if (Math.abs(zScore) > stdMultiple) {
    return {
      id: generateAlertId(),
      type: 'POSITION_SIZE_ANOMALY',
      severity: Math.abs(zScore) > stdMultiple * 1.5 ? 'CRITICAL' : 'WARNING',
      message: `Position size anomaly: ${recentSize} contracts (${zScore > 0 ? '+' : ''}${zScore.toFixed(1)} std from mean)`,
      details: {
        recentSize,
        mean: Math.round(mean * 100) / 100,
        std: Math.round(std * 100) / 100,
        zScore: Math.round(zScore * 100) / 100,
        threshold: stdMultiple,
      },
      timestamp: Date.now(),
      acknowledged: false,
    };
  }
  
  return null;
}

/**
 * Check for learning instability (metrics changing rapidly)
 * Requirement 16.5
 * 
 * @param currentMetrics - Current period metrics
 * @param previousMetrics - Previous period metrics
 * @returns Alert if instability detected, null otherwise
 */
export function checkLearningInstability(
  currentMetrics: Metrics,
  previousMetrics: Metrics
): SafetyAlert | null {
  if (currentMetrics.status !== 'VALID' || previousMetrics.status !== 'VALID') {
    return null;
  }
  
  // Check for significant changes in key metrics
  const winRateChange = Math.abs(currentMetrics.win_rate! - previousMetrics.win_rate!);
  const expectancyChange = previousMetrics.expectancy! !== 0
    ? Math.abs(currentMetrics.expectancy! - previousMetrics.expectancy!) / Math.abs(previousMetrics.expectancy!)
    : 0;
  
  const isUnstable = winRateChange > 0.15 || expectancyChange > 0.30;
  
  if (isUnstable) {
    return {
      id: generateAlertId(),
      type: 'LEARNING_INSTABILITY',
      severity: 'WARNING',
      message: 'Learning metrics showing instability - significant changes detected',
      details: {
        winRateChange: Math.round(winRateChange * 100),
        expectancyChange: Math.round(expectancyChange * 100),
        currentWinRate: currentMetrics.win_rate,
        previousWinRate: previousMetrics.win_rate,
        currentExpectancy: currentMetrics.expectancy,
        previousExpectancy: previousMetrics.expectancy,
      },
      timestamp: Date.now(),
      acknowledged: false,
    };
  }
  
  return null;
}

/**
 * Run all safety checks and return alerts
 * Requirement 16.1
 * 
 * @param entries - Ledger entries
 * @param currentRegime - Current market regime
 * @param thresholds - Safety thresholds (optional)
 * @returns Array of safety alerts
 */
export function runSafetyChecks(
  entries: LedgerEntry[],
  currentRegime: { volatility: VolatilityRegime; trend: TrendRegime },
  thresholds: SafetyThresholds = DEFAULT_THRESHOLDS
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  
  // Check overtrading
  const overtradingAlert = checkOvertrading(entries, thresholds.maxTradesPerDay);
  if (overtradingAlert) alerts.push(overtradingAlert);
  
  // Check drawdown spike
  const drawdownAlert = checkDrawdownSpike(entries, thresholds.maxDrawdownSpike);
  if (drawdownAlert) alerts.push(drawdownAlert);
  
  // Check regime mismatch
  const regimeAlert = checkRegimeMismatch(entries, currentRegime, thresholds.maxRegimeMismatch);
  if (regimeAlert) alerts.push(regimeAlert);
  
  // Check consecutive losses
  const lossesAlert = checkConsecutiveLosses(entries, thresholds.maxConsecutiveLosses);
  if (lossesAlert) alerts.push(lossesAlert);
  
  // Check position size anomaly
  const sizeAlert = checkPositionSizeAnomaly(entries, thresholds.positionSizeStdMultiple);
  if (sizeAlert) alerts.push(sizeAlert);
  
  return alerts;
}

/**
 * Get safety state summary
 * 
 * @param entries - Ledger entries
 * @param currentRegime - Current market regime
 * @returns Safety state summary
 */
export function getSafetyState(
  entries: LedgerEntry[],
  currentRegime: { volatility: VolatilityRegime; trend: TrendRegime }
): SafetyState {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  // Count trades in last 24h
  const tradesLast24h = entries.filter(e => 
    e.decision === 'EXECUTE' && 
    now - e.created_at <= msPerDay
  ).length;
  
  // Calculate current drawdown
  const recentTrades = entries
    .filter(e => e.decision === 'EXECUTE' && e.exit)
    .sort((a, b) => a.exit!.exit_time - b.exit!.exit_time);
  
  let peak = 0;
  let currentDrawdown = 0;
  let cumulative = 0;
  
  for (const trade of recentTrades) {
    cumulative += trade.exit!.pnl_net;
    if (cumulative > peak) peak = cumulative;
  }
  currentDrawdown = peak - cumulative;
  
  // Count consecutive losses
  let consecutiveLosses = 0;
  for (let i = recentTrades.length - 1; i >= 0; i--) {
    if (recentTrades[i].exit!.pnl_net < 0) {
      consecutiveLosses++;
    } else {
      break;
    }
  }
  
  // Get regime mismatch
  const regimeMismatchPercent = detectRegimeMismatch(entries, currentRegime);
  
  // Run all checks
  const alerts = runSafetyChecks(entries, currentRegime);
  
  return {
    alerts,
    lastCheck: now,
    tradesLast24h,
    currentDrawdown,
    consecutiveLosses,
    regimeMismatchPercent,
  };
}
