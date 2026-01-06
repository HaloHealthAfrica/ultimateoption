/**
 * Learning Advisor
 * 
 * Generates parameter adjustment suggestions based on historical performance.
 * COMPLETELY ISOLATED from execution - suggestions are output only.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { LedgerEntry } from '../types/ledger';
import { 
  calculateMetrics, 
  Metrics, 
  MINIMUM_SAMPLE_SIZE 
} from './metricsEngine';
import { 
  TradeFeatures, 
  extractFeatures, 
  TradeType,
  DTEBucket,
  AIScoreBucket,
} from './featureExtractor';

/**
 * Suggestion status
 * Requirement 10.6
 */
export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Parameter types that can be adjusted
 */
export type ParameterType = 
  | 'CONFLUENCE_THRESHOLD'
  | 'QUALITY_MULTIPLIER'
  | 'HTF_MULTIPLIER'
  | 'RR_MULTIPLIER'
  | 'VOLUME_MULTIPLIER'
  | 'SESSION_MULTIPLIER'
  | 'DAY_MULTIPLIER';

/**
 * Evidence supporting a suggestion
 * Requirement 10.5
 */
export interface SuggestionEvidence {
  sampleSize: number;
  winRate: number;
  expectancy: number;
  avgR: number;
  profitFactor: number;
  featureKey: string;
  comparisonMetrics?: Metrics;
}

/**
 * Learning suggestion
 * Requirement 10.4, 10.5, 10.6
 */
export interface LearningSuggestion {
  id: string;
  createdAt: number;
  status: SuggestionStatus;
  
  // What to change
  parameterType: ParameterType;
  featureContext: Partial<TradeFeatures>;
  
  // Change details
  currentValue: number;
  suggestedValue: number;
  changePercent: number;
  
  // Evidence
  evidence: SuggestionEvidence;
  rationale: string;
}

/**
 * Suggestion bounds
 * Requirement 10.2, 10.3
 */
export const SUGGESTION_BOUNDS = Object.freeze({
  MAX_CHANGE_PERCENT: 15,  // +/- 15% max change
  MIN_CHANGE_PERCENT: 5,   // Skip changes < 5%
});

/**
 * Generate a unique suggestion ID
 */
function generateSuggestionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


/**
 * Check if sample size is sufficient for suggestions
 * Requirement 10.1
 * 
 * @param entries - Ledger entries for the feature combination
 * @returns True if sample size >= 30
 */
export function hasSufficientSample(entries: LedgerEntry[]): boolean {
  const closedTrades = entries.filter(e => 
    e.decision === 'EXECUTE' && e.exit !== undefined
  );
  return closedTrades.length >= MINIMUM_SAMPLE_SIZE;
}

/**
 * Clamp change to bounds
 * Requirement 10.2
 * 
 * @param changePercent - Raw change percentage
 * @returns Clamped change percentage
 */
export function clampChange(changePercent: number): number {
  const maxChange = SUGGESTION_BOUNDS.MAX_CHANGE_PERCENT;
  return Math.max(-maxChange, Math.min(maxChange, changePercent));
}

/**
 * Check if change is significant enough
 * Requirement 10.3
 * 
 * @param changePercent - Change percentage
 * @returns True if change >= 5%
 */
export function isSignificantChange(changePercent: number): boolean {
  return Math.abs(changePercent) >= SUGGESTION_BOUNDS.MIN_CHANGE_PERCENT;
}

/**
 * Calculate suggested multiplier adjustment based on performance
 * 
 * @param metrics - Performance metrics for the feature combination
 * @param baselineMetrics - Overall baseline metrics
 * @param currentValue - Current multiplier value
 * @returns Suggested value and change percent
 */
function calculateAdjustment(
  metrics: Metrics,
  baselineMetrics: Metrics,
  currentValue: number
): { suggestedValue: number; changePercent: number } | null {
  if (metrics.status !== 'VALID' || baselineMetrics.status !== 'VALID') {
    return null;
  }
  
  // Compare win rate and expectancy to baseline
  const winRateDiff = metrics.win_rate! - baselineMetrics.win_rate!;
  const expectancyRatio = baselineMetrics.expectancy! !== 0
    ? metrics.expectancy! / baselineMetrics.expectancy!
    : 1;
  
  // Calculate raw adjustment based on performance difference
  // Better performance = increase multiplier, worse = decrease
  let rawChangePercent = 0;
  
  if (winRateDiff > 0.05 && expectancyRatio > 1.1) {
    // Significantly better - suggest increase
    rawChangePercent = Math.min(winRateDiff * 100, expectancyRatio * 10 - 10);
  } else if (winRateDiff < -0.05 && expectancyRatio < 0.9) {
    // Significantly worse - suggest decrease
    rawChangePercent = Math.max(winRateDiff * 100, (expectancyRatio - 1) * 10);
  } else {
    // Not significant enough
    return null;
  }
  
  // Clamp to bounds
  const clampedChange = clampChange(rawChangePercent);
  
  // Check if significant
  if (!isSignificantChange(clampedChange)) {
    return null;
  }
  
  const suggestedValue = currentValue * (1 + clampedChange / 100);
  
  return {
    suggestedValue: Math.round(suggestedValue * 100) / 100,
    changePercent: Math.round(clampedChange * 10) / 10,
  };
}

/**
 * Generate suggestions for quality multipliers
 * 
 * @param entries - All ledger entries
 * @param baselineMetrics - Overall baseline metrics
 * @param currentMultipliers - Current quality multipliers
 * @returns Array of suggestions
 */
export function generateQualityMultiplierSuggestions(
  entries: LedgerEntry[],
  baselineMetrics: Metrics,
  currentMultipliers: Record<string, number>
): LearningSuggestion[] {
  const suggestions: LearningSuggestion[] = [];
  const qualities = ['EXTREME', 'HIGH', 'MEDIUM'];
  
  for (const quality of qualities) {
    const filtered = entries.filter(e => {
      const features = extractFeatures(e);
      return features.ai_score_bucket === quality;
    });
    
    if (!hasSufficientSample(filtered)) continue;
    
    const metrics = calculateMetrics(filtered);
    const currentValue = currentMultipliers[quality] || 1.0;
    
    const adjustment = calculateAdjustment(metrics, baselineMetrics, currentValue);
    if (!adjustment) continue;
    
    suggestions.push({
      id: generateSuggestionId(),
      createdAt: Date.now(),
      status: 'PENDING',
      parameterType: 'QUALITY_MULTIPLIER',
      featureContext: { ai_score_bucket: quality as AIScoreBucket },
      currentValue,
      suggestedValue: adjustment.suggestedValue,
      changePercent: adjustment.changePercent,
      evidence: {
        sampleSize: metrics.sample_size,
        winRate: metrics.win_rate!,
        expectancy: metrics.expectancy!,
        avgR: metrics.avg_r!,
        profitFactor: metrics.profit_factor!,
        featureKey: `quality:${quality}`,
        comparisonMetrics: baselineMetrics,
      },
      rationale: generateRationale('QUALITY_MULTIPLIER', quality, metrics, baselineMetrics),
    });
  }
  
  return suggestions;
}

/**
 * Generate suggestions for DTE-specific adjustments
 * 
 * @param entries - All ledger entries
 * @param baselineMetrics - Overall baseline metrics
 * @param currentMultipliers - Current DTE multipliers
 * @returns Array of suggestions
 */
export function generateDTESuggestions(
  entries: LedgerEntry[],
  baselineMetrics: Metrics,
  currentMultipliers: Record<string, number>
): LearningSuggestion[] {
  const suggestions: LearningSuggestion[] = [];
  const dteBuckets: DTEBucket[] = ['0DTE', 'WEEKLY', 'MONTHLY', 'LEAP'];
  
  for (const dte of dteBuckets) {
    const filtered = entries.filter(e => {
      const features = extractFeatures(e);
      return features.dte_bucket === dte;
    });
    
    if (!hasSufficientSample(filtered)) continue;
    
    const metrics = calculateMetrics(filtered);
    const currentValue = currentMultipliers[dte] || 1.0;
    
    const adjustment = calculateAdjustment(metrics, baselineMetrics, currentValue);
    if (!adjustment) continue;
    
    suggestions.push({
      id: generateSuggestionId(),
      createdAt: Date.now(),
      status: 'PENDING',
      parameterType: 'RR_MULTIPLIER', // DTE affects R:R expectations
      featureContext: { dte_bucket: dte },
      currentValue,
      suggestedValue: adjustment.suggestedValue,
      changePercent: adjustment.changePercent,
      evidence: {
        sampleSize: metrics.sample_size,
        winRate: metrics.win_rate!,
        expectancy: metrics.expectancy!,
        avgR: metrics.avg_r!,
        profitFactor: metrics.profit_factor!,
        featureKey: `dte:${dte}`,
        comparisonMetrics: baselineMetrics,
      },
      rationale: generateRationale('RR_MULTIPLIER', dte, metrics, baselineMetrics),
    });
  }
  
  return suggestions;
}

/**
 * Generate suggestions for trade type adjustments
 * 
 * @param entries - All ledger entries
 * @param baselineMetrics - Overall baseline metrics
 * @param currentMultipliers - Current trade type multipliers
 * @returns Array of suggestions
 */
export function generateTradeTypeSuggestions(
  entries: LedgerEntry[],
  baselineMetrics: Metrics,
  currentMultipliers: Record<string, number>
): LearningSuggestion[] {
  const suggestions: LearningSuggestion[] = [];
  const tradeTypes: TradeType[] = ['SCALP', 'DAY', 'SWING', 'LEAP'];
  
  for (const tradeType of tradeTypes) {
    const filtered = entries.filter(e => {
      const features = extractFeatures(e);
      return features.trade_type === tradeType;
    });
    
    if (!hasSufficientSample(filtered)) continue;
    
    const metrics = calculateMetrics(filtered);
    const currentValue = currentMultipliers[tradeType] || 1.0;
    
    const adjustment = calculateAdjustment(metrics, baselineMetrics, currentValue);
    if (!adjustment) continue;
    
    suggestions.push({
      id: generateSuggestionId(),
      createdAt: Date.now(),
      status: 'PENDING',
      parameterType: 'SESSION_MULTIPLIER', // Trade type affects session expectations
      featureContext: { trade_type: tradeType },
      currentValue,
      suggestedValue: adjustment.suggestedValue,
      changePercent: adjustment.changePercent,
      evidence: {
        sampleSize: metrics.sample_size,
        winRate: metrics.win_rate!,
        expectancy: metrics.expectancy!,
        avgR: metrics.avg_r!,
        profitFactor: metrics.profit_factor!,
        featureKey: `trade_type:${tradeType}`,
        comparisonMetrics: baselineMetrics,
      },
      rationale: generateRationale('SESSION_MULTIPLIER', tradeType, metrics, baselineMetrics),
    });
  }
  
  return suggestions;
}

/**
 * Generate human-readable rationale for a suggestion
 */
function generateRationale(
  parameterType: ParameterType,
  context: string,
  metrics: Metrics,
  baseline: Metrics
): string {
  const winRateDiff = ((metrics.win_rate! - baseline.win_rate!) * 100).toFixed(1);
  const expectancyDiff = baseline.expectancy! !== 0
    ? (((metrics.expectancy! / baseline.expectancy!) - 1) * 100).toFixed(1)
    : 'N/A';
  
  const direction = metrics.expectancy! > baseline.expectancy! ? 'outperforming' : 'underperforming';
  
  return `${context} trades are ${direction} baseline. ` +
    `Win rate: ${(metrics.win_rate! * 100).toFixed(1)}% (${winRateDiff}% vs baseline). ` +
    `Expectancy: ${expectancyDiff}% vs baseline. ` +
    `Sample: ${metrics.sample_size} trades.`;
}

/**
 * Generate all suggestions based on historical performance
 * Requirement 10.1, 10.4
 * 
 * @param entries - All ledger entries
 * @param currentParameters - Current parameter values
 * @returns Array of suggestions with PENDING status
 */
export function generateAllSuggestions(
  entries: LedgerEntry[],
  currentParameters: {
    qualityMultipliers: Record<string, number>;
    dteMultipliers: Record<string, number>;
    tradeTypeMultipliers: Record<string, number>;
  }
): LearningSuggestion[] {
  // Calculate baseline metrics
  const baselineMetrics = calculateMetrics(entries);
  
  if (baselineMetrics.status !== 'VALID') {
    return []; // Not enough data for any suggestions
  }
  
  const suggestions: LearningSuggestion[] = [];
  
  // Generate quality multiplier suggestions
  suggestions.push(...generateQualityMultiplierSuggestions(
    entries,
    baselineMetrics,
    currentParameters.qualityMultipliers
  ));
  
  // Generate DTE suggestions
  suggestions.push(...generateDTESuggestions(
    entries,
    baselineMetrics,
    currentParameters.dteMultipliers
  ));
  
  // Generate trade type suggestions
  suggestions.push(...generateTradeTypeSuggestions(
    entries,
    baselineMetrics,
    currentParameters.tradeTypeMultipliers
  ));
  
  return suggestions;
}

/**
 * Filter suggestions by status
 * 
 * @param suggestions - All suggestions
 * @param status - Status to filter by
 * @returns Filtered suggestions
 */
export function filterSuggestionsByStatus(
  suggestions: LearningSuggestion[],
  status: SuggestionStatus
): LearningSuggestion[] {
  return suggestions.filter(s => s.status === status);
}

/**
 * Update suggestion status
 * 
 * @param suggestion - Suggestion to update
 * @param status - New status
 * @returns Updated suggestion
 */
export function updateSuggestionStatus(
  suggestion: LearningSuggestion,
  status: SuggestionStatus
): LearningSuggestion {
  return {
    ...suggestion,
    status,
  };
}
