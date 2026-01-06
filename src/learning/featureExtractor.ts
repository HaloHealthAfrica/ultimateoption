/**
 * Feature Extractor
 * 
 * Normalizes trade data into discrete buckets for pattern analysis.
 * All features are bucketed - no raw floats or prices.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { LedgerEntry } from '../types/ledger';
import { EnrichedSignal } from '../types/signal';

/**
 * Trade type classification based on timeframe
 * Requirement 7.1: SCALP (<=5M), DAY (<=60M), SWING (<=240M), LEAP (>240M)
 */
export type TradeType = 'SCALP' | 'DAY' | 'SWING' | 'LEAP';

/**
 * DTE bucket classification
 * Requirement 7.2: 0DTE, WEEKLY (1-7), MONTHLY (8-45), LEAP (>45)
 */
export type DTEBucket = '0DTE' | 'WEEKLY' | 'MONTHLY' | 'LEAP';

/**
 * AI score bucket classification
 * Requirement 7.3: EXTREME_PLUS (>=9), EXTREME (>=8), HIGH (>=7), MEDIUM (>=6), LOW (<6)
 */
export type AIScoreBucket = 'EXTREME_PLUS' | 'EXTREME' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * IV rank bucket classification
 */
export type IVRankBucket = 'VERY_LOW' | 'LOW' | 'NORMAL' | 'HIGH' | 'VERY_HIGH';

/**
 * Trend strength bucket classification
 */
export type TrendStrengthBucket = 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';

/**
 * Volume bucket classification
 */
export type VolumeBucket = 'LOW' | 'NORMAL' | 'HIGH' | 'VERY_HIGH';

/**
 * Complete trade features - all bucketed, no raw values
 * Requirement 7.4: No raw floats or prices
 */
export interface TradeFeatures {
  trade_type: TradeType;
  dte_bucket: DTEBucket;
  signal_quality: 'EXTREME' | 'HIGH' | 'MEDIUM';
  ai_score_bucket: AIScoreBucket;
  iv_rank_bucket: IVRankBucket;
  trend_strength_bucket: TrendStrengthBucket;
  volume_bucket: VolumeBucket;
  volatility_regime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
  trend_regime: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
  market_session: 'OPEN' | 'MIDDAY' | 'POWER_HOUR' | 'AFTERHOURS';
  day_of_week: string;
  direction: 'LONG' | 'SHORT';
  htf_alignment: 'ALIGNED' | 'PARTIAL' | 'COUNTER';
}

/**
 * Classify trade type based on timeframe
 * Requirement 7.1
 * 
 * @param timeframe - Timeframe string (e.g., '3', '5', '15', '30', '60', '240')
 * @returns TradeType classification
 */
export function classifyTradeType(timeframe: string): TradeType {
  const normalized = timeframe.toUpperCase();
  
  // Handle string timeframes like '1H', '4H', '1D' first
  if (normalized === '1H' || normalized === '60M') return 'DAY';
  if (normalized === '4H' || normalized === '240M') return 'SWING';
  if (normalized === '1D' || normalized === 'D') return 'LEAP';
  
  // Try to parse as number
  const tf = parseInt(timeframe, 10);
  
  if (isNaN(tf)) {
    return 'DAY'; // Default fallback for unknown formats
  }
  
  if (tf <= 5) return 'SCALP';
  if (tf <= 60) return 'DAY';
  if (tf <= 240) return 'SWING';
  return 'LEAP';
}

/**
 * Bucket DTE value
 * Requirement 7.2
 * 
 * @param dte - Days to expiration
 * @returns DTEBucket classification
 */
export function bucketDTE(dte: number): DTEBucket {
  if (dte === 0) return '0DTE';
  if (dte >= 1 && dte <= 7) return 'WEEKLY';
  if (dte >= 8 && dte <= 45) return 'MONTHLY';
  return 'LEAP';
}

/**
 * Bucket AI score
 * Requirement 7.3
 * 
 * @param aiScore - AI score (0-10.5)
 * @returns AIScoreBucket classification
 */
export function bucketAIScore(aiScore: number): AIScoreBucket {
  if (aiScore >= 9) return 'EXTREME_PLUS';
  if (aiScore >= 8) return 'EXTREME';
  if (aiScore >= 7) return 'HIGH';
  if (aiScore >= 6) return 'MEDIUM';
  return 'LOW';
}

/**
 * Bucket IV rank
 * 
 * @param ivRank - IV rank (0-100)
 * @returns IVRankBucket classification
 */
export function bucketIVRank(ivRank: number): IVRankBucket {
  if (ivRank < 20) return 'VERY_LOW';
  if (ivRank < 40) return 'LOW';
  if (ivRank < 60) return 'NORMAL';
  if (ivRank < 80) return 'HIGH';
  return 'VERY_HIGH';
}

/**
 * Bucket trend strength
 * 
 * @param strength - Trend strength (0-100)
 * @returns TrendStrengthBucket classification
 */
export function bucketTrendStrength(strength: number): TrendStrengthBucket {
  if (strength < 40) return 'WEAK';
  if (strength < 60) return 'MODERATE';
  if (strength < 80) return 'STRONG';
  return 'VERY_STRONG';
}

/**
 * Bucket volume ratio
 * 
 * @param volumeRatio - Volume vs average ratio
 * @returns VolumeBucket classification
 */
export function bucketVolume(volumeRatio: number): VolumeBucket {
  if (volumeRatio < 0.7) return 'LOW';
  if (volumeRatio < 1.3) return 'NORMAL';
  if (volumeRatio < 2.0) return 'HIGH';
  return 'VERY_HIGH';
}

/**
 * Determine HTF alignment
 * 
 * @param signal - Enriched signal
 * @returns HTF alignment classification
 */
export function classifyHTFAlignment(signal: EnrichedSignal): 'ALIGNED' | 'PARTIAL' | 'COUNTER' {
  const direction = signal.signal.type;
  const htf4h = signal.mtf_context['4h_bias'];
  const htf1h = signal.mtf_context['1h_bias'];
  
  const is4hAligned = htf4h === direction;
  const is1hAligned = htf1h === direction;
  
  if (is4hAligned && is1hAligned) return 'ALIGNED';
  if (is4hAligned || is1hAligned) return 'PARTIAL';
  return 'COUNTER';
}

/**
 * Extract all features from a ledger entry
 * Requirement 7.4: All features bucketed, no raw values
 * 
 * @param entry - Ledger entry
 * @returns Complete trade features
 */
export function extractFeatures(entry: LedgerEntry): TradeFeatures {
  const signal = entry.signal;
  
  return {
    trade_type: classifyTradeType(signal.signal.timeframe),
    dte_bucket: entry.execution ? bucketDTE(entry.execution.dte) : 'WEEKLY',
    signal_quality: signal.signal.quality,
    ai_score_bucket: bucketAIScore(signal.signal.ai_score),
    iv_rank_bucket: bucketIVRank(entry.regime.iv_rank),
    trend_strength_bucket: bucketTrendStrength(signal.trend.strength),
    volume_bucket: bucketVolume(signal.market_context.volume_vs_avg),
    volatility_regime: entry.regime.volatility,
    trend_regime: entry.regime.trend,
    market_session: signal.time_context.market_session,
    day_of_week: signal.time_context.day_of_week,
    direction: signal.signal.type,
    htf_alignment: classifyHTFAlignment(signal),
  };
}

/**
 * Extract features from a signal (without execution data)
 * 
 * @param signal - Enriched signal
 * @param ivRank - Current IV rank
 * @param volatilityRegime - Current volatility regime
 * @param trendRegime - Current trend regime
 * @returns Partial trade features
 */
export function extractSignalFeatures(
  signal: EnrichedSignal,
  ivRank: number = 50,
  volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME' = 'NORMAL',
  trendRegime: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR' = 'NEUTRAL'
): Omit<TradeFeatures, 'dte_bucket'> & { dte_bucket?: DTEBucket } {
  return {
    trade_type: classifyTradeType(signal.signal.timeframe),
    signal_quality: signal.signal.quality,
    ai_score_bucket: bucketAIScore(signal.signal.ai_score),
    iv_rank_bucket: bucketIVRank(ivRank),
    trend_strength_bucket: bucketTrendStrength(signal.trend.strength),
    volume_bucket: bucketVolume(signal.market_context.volume_vs_avg),
    volatility_regime: volatilityRegime,
    trend_regime: trendRegime,
    market_session: signal.time_context.market_session,
    day_of_week: signal.time_context.day_of_week,
    direction: signal.signal.type,
    htf_alignment: classifyHTFAlignment(signal),
  };
}

/**
 * Create a feature key for grouping/lookup
 * Requirement 7.5: Isolate analysis by DTE bucket
 * 
 * @param features - Trade features
 * @returns String key for grouping
 */
export function createFeatureKey(features: TradeFeatures): string {
  return [
    features.trade_type,
    features.dte_bucket,
    features.signal_quality,
    features.ai_score_bucket,
    features.volatility_regime,
  ].join(':');
}

/**
 * Create a DTE-isolated feature key
 * Requirement 7.5: Isolate analysis by DTE bucket
 * 
 * @param features - Trade features
 * @returns String key isolated by DTE bucket
 */
export function createDTEIsolatedKey(features: TradeFeatures): string {
  return `${features.dte_bucket}:${features.trade_type}:${features.signal_quality}`;
}

/**
 * Group entries by feature key
 * 
 * @param entries - Ledger entries
 * @param keyFn - Function to create grouping key
 * @returns Map of feature key to entries
 */
export function groupByFeatures(
  entries: LedgerEntry[],
  keyFn: (features: TradeFeatures) => string = createFeatureKey
): Map<string, LedgerEntry[]> {
  const groups = new Map<string, LedgerEntry[]>();
  
  for (const entry of entries) {
    const features = extractFeatures(entry);
    const key = keyFn(features);
    
    const existing = groups.get(key) || [];
    existing.push(entry);
    groups.set(key, existing);
  }
  
  return groups;
}

/**
 * Group entries by DTE bucket (isolated analysis)
 * Requirement 7.5
 * 
 * @param entries - Ledger entries
 * @returns Map of DTE bucket to entries
 */
export function groupByDTEBucket(entries: LedgerEntry[]): Map<DTEBucket, LedgerEntry[]> {
  const groups = new Map<DTEBucket, LedgerEntry[]>();
  
  // Initialize all buckets
  const buckets: DTEBucket[] = ['0DTE', 'WEEKLY', 'MONTHLY', 'LEAP'];
  for (const bucket of buckets) {
    groups.set(bucket, []);
  }
  
  for (const entry of entries) {
    if (entry.execution) {
      const bucket = bucketDTE(entry.execution.dte);
      groups.get(bucket)!.push(entry);
    }
  }
  
  return groups;
}

/**
 * Group entries by trade type
 * 
 * @param entries - Ledger entries
 * @returns Map of trade type to entries
 */
export function groupByTradeType(entries: LedgerEntry[]): Map<TradeType, LedgerEntry[]> {
  const groups = new Map<TradeType, LedgerEntry[]>();
  
  // Initialize all types
  const types: TradeType[] = ['SCALP', 'DAY', 'SWING', 'LEAP'];
  for (const type of types) {
    groups.set(type, []);
  }
  
  for (const entry of entries) {
    const type = classifyTradeType(entry.signal.signal.timeframe);
    groups.get(type)!.push(entry);
  }
  
  return groups;
}
