/**
 * Metrics Engine
 * 
 * Calculates descriptive performance metrics without recommendations.
 * Provides core metrics, attribution metrics, and stability metrics.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { LedgerEntry } from '../types/ledger';
import { TradeFeatures, extractFeatures, groupByDTEBucket } from './featureExtractor';

/**
 * Minimum sample size required for valid metrics
 * Requirement 8.1
 */
export const MINIMUM_SAMPLE_SIZE = 30;

/**
 * Metrics result status
 */
export type MetricsStatus = 'VALID' | 'INSUFFICIENT_DATA';

/**
 * Core performance metrics
 * Requirement 8.2
 */
export interface Metrics {
  status: MetricsStatus;
  sample_size: number;
  required?: number;
  
  // Core metrics (Requirement 8.2)
  win_rate?: number;
  avg_win?: number;
  avg_loss?: number;
  avg_r?: number;
  expectancy?: number;
  max_drawdown?: number;
  profit_factor?: number;
  
  // Attribution metrics (Requirement 8.3)
  avg_delta_contribution?: number;
  avg_iv_contribution?: number;
  avg_theta_drag?: number;
  avg_gamma_contribution?: number;
  
  // Stability metrics (Requirement 8.4)
  r_std?: number;
  avg_hold_time_hours?: number;
  
  // Additional useful metrics
  total_trades?: number;
  total_wins?: number;
  total_losses?: number;
  total_pnl?: number;
  largest_win?: number;
  largest_loss?: number;
}

/**
 * Rolling metrics for different time windows
 */
export interface RollingMetrics {
  '30d': Metrics;
  '60d': Metrics;
  '90d': Metrics;
}

/**
 * Calculate metrics from closed trades
 * Requirement 8.1: Returns INSUFFICIENT_DATA if sample < 30
 * 
 * @param entries - Ledger entries (should be closed trades with exit data)
 * @param features - Optional feature filter
 * @returns Metrics object
 */
export function calculateMetrics(
  entries: LedgerEntry[],
  features?: Partial<TradeFeatures>
): Metrics {
  // Filter to only closed trades (EXECUTE with exit data)
  let closedTrades = entries.filter(e => 
    e.decision === 'EXECUTE' && e.exit !== undefined && e.exit !== null && e.exit.pnl_net !== undefined
  );
  
  // Apply feature filter if provided
  if (features) {
    closedTrades = closedTrades.filter(e => {
      const entryFeatures = extractFeatures(e);
      return Object.entries(features).every(([key, value]) => 
        entryFeatures[key as keyof TradeFeatures] === value
      );
    });
  }
  
  const sampleSize = closedTrades.length;
  
  // Requirement 8.1: Check minimum sample size
  if (sampleSize < MINIMUM_SAMPLE_SIZE) {
    return {
      status: 'INSUFFICIENT_DATA',
      sample_size: sampleSize,
      required: MINIMUM_SAMPLE_SIZE,
    };
  }
  
  // Calculate core metrics
  const wins = closedTrades.filter(e => e.exit!.pnl_net > 0);
  const losses = closedTrades.filter(e => e.exit!.pnl_net < 0);
  
  const winRate = wins.length / sampleSize;
  
  const avgWin = wins.length > 0
    ? wins.reduce((sum, e) => sum + e.exit!.pnl_net, 0) / wins.length
    : 0;
    
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((sum, e) => sum + e.exit!.pnl_net, 0) / losses.length)
    : 0;
  
  // Calculate R-multiples
  const rMultiples = closedTrades.map(e => {
    const riskAmount = e.execution?.risk_amount || 1;
    return e.exit!.pnl_net / riskAmount;
  });
  
  const avgR = rMultiples.reduce((sum, r) => sum + r, 0) / sampleSize;
  
  // Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
  
  // Max drawdown calculation
  const maxDrawdown = calculateMaxDrawdown(closedTrades);
  
  // Profit factor = Gross Profit / Gross Loss
  const grossProfit = wins.reduce((sum, e) => sum + e.exit!.pnl_net, 0);
  const grossLoss = Math.abs(losses.reduce((sum, e) => sum + e.exit!.pnl_net, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  
  // Attribution metrics (Requirement 8.3)
  const avgDeltaContribution = closedTrades.reduce((sum, e) => 
    sum + e.exit!.pnl_from_delta, 0) / sampleSize;
  const avgIVContribution = closedTrades.reduce((sum, e) => 
    sum + e.exit!.pnl_from_iv, 0) / sampleSize;
  const avgThetaDrag = closedTrades.reduce((sum, e) => 
    sum + e.exit!.pnl_from_theta, 0) / sampleSize;
  const avgGammaContribution = closedTrades.reduce((sum, e) => 
    sum + e.exit!.pnl_from_gamma, 0) / sampleSize;
  
  // Stability metrics (Requirement 8.4)
  const rStd = calculateStandardDeviation(rMultiples);
  const avgHoldTimeHours = closedTrades.reduce((sum, e) => 
    sum + e.exit!.hold_time_seconds, 0) / sampleSize / 3600;
  
  // Additional metrics
  const totalPnl = closedTrades.reduce((sum, e) => sum + e.exit!.pnl_net, 0);
  const largestWin = wins.length > 0 
    ? Math.max(...wins.map(e => e.exit!.pnl_net)) 
    : 0;
  const largestLoss = losses.length > 0 
    ? Math.min(...losses.map(e => e.exit!.pnl_net)) 
    : 0;
  
  return {
    status: 'VALID',
    sample_size: sampleSize,
    
    // Core metrics
    win_rate: winRate,
    avg_win: avgWin,
    avg_loss: avgLoss,
    avg_r: avgR,
    expectancy: expectancy,
    max_drawdown: maxDrawdown,
    profit_factor: profitFactor,
    
    // Attribution metrics
    avg_delta_contribution: avgDeltaContribution,
    avg_iv_contribution: avgIVContribution,
    avg_theta_drag: avgThetaDrag,
    avg_gamma_contribution: avgGammaContribution,
    
    // Stability metrics
    r_std: rStd,
    avg_hold_time_hours: avgHoldTimeHours,
    
    // Additional metrics
    total_trades: sampleSize,
    total_wins: wins.length,
    total_losses: losses.length,
    total_pnl: totalPnl,
    largest_win: largestWin,
    largest_loss: largestLoss,
  };
}

/**
 * Calculate rolling metrics for different time windows
 * 
 * @param entries - All ledger entries
 * @param features - Optional feature filter
 * @returns Rolling metrics for 30d, 60d, 90d windows
 */
export function getRollingMetrics(
  entries: LedgerEntry[],
  features?: Partial<TradeFeatures>
): RollingMetrics {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  const filter30d = entries.filter(e => 
    now - e.created_at <= 30 * msPerDay
  );
  const filter60d = entries.filter(e => 
    now - e.created_at <= 60 * msPerDay
  );
  const filter90d = entries.filter(e => 
    now - e.created_at <= 90 * msPerDay
  );
  
  return {
    '30d': calculateMetrics(filter30d, features),
    '60d': calculateMetrics(filter60d, features),
    '90d': calculateMetrics(filter90d, features),
  };
}

/**
 * Calculate metrics isolated by DTE bucket
 * Requirement 7.5: Isolate analysis by DTE bucket
 * 
 * @param entries - All ledger entries
 * @returns Map of DTE bucket to metrics
 */
export function getMetricsByDTEBucket(
  entries: LedgerEntry[]
): Map<string, Metrics> {
  const groups = groupByDTEBucket(entries);
  const result = new Map<string, Metrics>();
  
  for (const [bucket, bucketEntries] of groups) {
    result.set(bucket, calculateMetrics(bucketEntries));
  }
  
  return result;
}

/**
 * Calculate max drawdown from a series of trades
 * 
 * @param trades - Closed trades sorted by time
 * @returns Maximum drawdown value (positive number)
 */
function calculateMaxDrawdown(trades: LedgerEntry[]): number {
  if (trades.length === 0) return 0;
  
  // Sort by exit time
  const sorted = [...trades].sort((a, b) => 
    a.exit!.exit_time - b.exit!.exit_time
  );
  
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  
  for (const trade of sorted) {
    cumulative += trade.exit!.pnl_net;
    
    if (cumulative > peak) {
      peak = cumulative;
    }
    
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

/**
 * Calculate standard deviation
 * 
 * @param values - Array of numbers
 * @returns Standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate win streak statistics
 * 
 * @param trades - Closed trades sorted by time
 * @returns Win/loss streak statistics
 */
export function calculateStreakStats(trades: LedgerEntry[]): {
  currentStreak: number;
  currentStreakType: 'WIN' | 'LOSS' | 'NONE';
  maxWinStreak: number;
  maxLossStreak: number;
} {
  if (trades.length === 0) {
    return {
      currentStreak: 0,
      currentStreakType: 'NONE',
      maxWinStreak: 0,
      maxLossStreak: 0,
    };
  }
  
  // Sort by exit time
  const sorted = [...trades]
    .filter(t => t.exit)
    .sort((a, b) => a.exit!.exit_time - b.exit!.exit_time);
  
  let currentStreak = 0;
  let currentStreakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let winStreak = 0;
  let lossStreak = 0;
  
  for (const trade of sorted) {
    const isWin = trade.exit!.pnl_net > 0;
    
    if (isWin) {
      winStreak++;
      lossStreak = 0;
      if (winStreak > maxWinStreak) maxWinStreak = winStreak;
    } else {
      lossStreak++;
      winStreak = 0;
      if (lossStreak > maxLossStreak) maxLossStreak = lossStreak;
    }
  }
  
  // Determine current streak
  if (sorted.length > 0) {
    const lastTrade = sorted[sorted.length - 1];
    const lastIsWin = lastTrade.exit!.pnl_net > 0;
    currentStreakType = lastIsWin ? 'WIN' : 'LOSS';
    currentStreak = lastIsWin ? winStreak : lossStreak;
  }
  
  return {
    currentStreak,
    currentStreakType,
    maxWinStreak,
    maxLossStreak,
  };
}

/**
 * Calculate metrics for a specific feature combination
 * 
 * @param entries - All ledger entries
 * @param features - Feature filter
 * @returns Metrics for the feature combination
 */
export function getMetricsForFeatures(
  entries: LedgerEntry[],
  features: Partial<TradeFeatures>
): Metrics {
  return calculateMetrics(entries, features);
}
