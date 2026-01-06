/**
 * Position Sizing Calculator
 * Calculates position multiplier based on multiple factors
 * 
 * Requirements: 3.6-3.25
 */

import { EnrichedSignal, Timeframe } from '@/types/signal';
import { DecisionBreakdown } from '@/types/decision';
import { StoredSignal } from '@/webhooks/timeframeStore';
import { StoredPhase } from '@/webhooks/phaseStore';
import { TrendStore } from '@/trend/storage/trendStore';
import {
  getConfluenceMultiplier,
  QUALITY_MULTIPLIERS,
  HTF_ALIGNMENT_MULTIPLIERS,
  HTFAlignment,
  getRRMultiplier,
  getVolumeMultiplier,
  getTrendMultiplier,
  SESSION_MULTIPLIERS,
  DAY_MULTIPLIERS,
  getTrendPositionBoost,
  getTrendConfidenceBoost,
  clampPositionMultiplier,
  POSITION_MULTIPLIER_MIN,
  HTF_MIN_AI_SCORE,
} from './matrices';

/**
 * Determine HTF alignment category
 * 
 * @param signal - The entry signal
 * @param signals - All active signals
 * @param phases - Active phases
 * @returns HTF alignment category
 */
export function determineHTFAlignment(
  signal: EnrichedSignal,
  signals: Map<Timeframe, StoredSignal>,
  phases: Map<string, StoredPhase>
): HTFAlignment {
  const direction = signal.signal.type;
  
  // Check 4H signal alignment
  const signal4H = signals.get('240');
  const has4HAligned = signal4H && 
    signal4H.signal.signal.type === direction &&
    signal4H.signal.signal.ai_score >= HTF_MIN_AI_SCORE;
  
  // Check 1H signal alignment
  const signal1H = signals.get('60');
  const has1HAligned = signal1H && 
    signal1H.signal.signal.type === direction &&
    signal1H.signal.signal.ai_score >= HTF_MIN_AI_SCORE;
  
  // Check MTF context from signal itself
  const mtfBias4H = signal.mtf_context['4h_bias'];
  const mtfBias1H = signal.mtf_context['1h_bias'];
  const expectedBias = direction; // LONG signal expects LONG bias
  
  const mtf4HAligned = mtfBias4H === expectedBias;
  const mtf1HAligned = mtfBias1H === expectedBias;
  
  // Check phase alignment
  let phaseAligned = false;
  for (const stored of phases.values()) {
    const phase = stored.phase;
    if (phase.timeframe.tf_role === 'REGIME' || phase.timeframe.tf_role === 'BIAS') {
      const phaseDirection = phase.event.directional_implication;
      if (
        (direction === 'LONG' && phaseDirection === 'UPSIDE_POTENTIAL') ||
        (direction === 'SHORT' && phaseDirection === 'DOWNSIDE_POTENTIAL')
      ) {
        phaseAligned = true;
        break;
      }
    }
  }
  
  // Determine alignment category
  // PERFECT: Both 4H and 1H aligned (via signals, MTF context, or phases)
  const perfect4H = has4HAligned || mtf4HAligned || phaseAligned;
  const perfect1H = has1HAligned || mtf1HAligned;
  
  if (perfect4H && perfect1H) {
    return 'PERFECT';
  }
  
  // GOOD: Either 4H or 1H aligned
  if (perfect4H || perfect1H) {
    return 'GOOD';
  }
  
  // Check for counter-trend (trading against HTF bias)
  const counter4H = mtfBias4H !== expectedBias;
  const counter1H = mtfBias1H !== expectedBias;
  
  if (counter4H && counter1H) {
    return 'COUNTER';
  }
  
  // WEAK: Only lower timeframes aligned
  return 'WEAK';
}


/**
 * Get phase and trend boosts from active phases and trends
 * Requirements: 18.9, 18.10, 24.9, 24.10
 */
export function getPhaseAndTrendBoosts(
  signal: EnrichedSignal,
  phases: Map<string, StoredPhase>,
  trendStore?: TrendStore
): { confidence_boost: number; position_boost: number; trend_alignment_boost: number } {
  let maxConfidenceBoost = 0;
  let maxPositionBoost = 0;
  let trendAlignmentBoost = 0;
  
  const direction = signal.signal.type;
  
  // Phase boosts
  for (const stored of phases.values()) {
    const phase = stored.phase;
    
    // Only consider phases that align with trade direction
    const phaseDirection = phase.event.directional_implication;
    const aligned = 
      (direction === 'LONG' && phaseDirection === 'UPSIDE_POTENTIAL') ||
      (direction === 'SHORT' && phaseDirection === 'DOWNSIDE_POTENTIAL');
    
    if (!aligned) continue;
    
    // Only consider phases that allow trading
    if (!phase.execution_guidance.trade_allowed) continue;
    
    const confidenceScore = phase.confidence.confidence_score;
    const htfAlignment = phase.confidence.htf_alignment;
    
    // Phase confidence boost: +20% when htf_alignment is true (Requirement 18.9)
    if (htfAlignment) {
      maxConfidenceBoost = Math.max(maxConfidenceBoost, 0.20);
    }
    
    // Phase position boost: +10% when confidence >= 70 and htf_alignment is true (Requirement 18.10)
    if (confidenceScore >= 70 && htfAlignment) {
      maxPositionBoost = Math.max(maxPositionBoost, 0.10);
    }
  }
  
  // Trend boosts
  if (trendStore) {
    const ticker = signal.instrument.ticker;
    const alignment = trendStore.getAlignment(ticker);
    
    if (alignment) {
      // Trend position boost: +30% when strength is STRONG (>=75%) (Requirement 24.9)
      const trendPositionBoost = getTrendPositionBoost(alignment.strength);
      trendAlignmentBoost += trendPositionBoost;
      
      // Trend confidence boost: +15% when HTF bias matches signal direction (Requirement 24.10)
      const signalDirection = direction.toLowerCase() as 'long' | 'short';
      const htfBiasMatches = 
        (signalDirection === 'long' && alignment.htf_bias === 'bullish') ||
        (signalDirection === 'short' && alignment.htf_bias === 'bearish');
      
      if (htfBiasMatches) {
        const trendConfidenceBoost = getTrendConfidenceBoost(true);
        trendAlignmentBoost += trendConfidenceBoost;
      }
    }
  }
  
  return {
    confidence_boost: maxConfidenceBoost,
    position_boost: maxPositionBoost,
    trend_alignment_boost: trendAlignmentBoost,
  };
}

/**
 * Calculate full position multiplier with breakdown
 * 
 * @param confluenceScore - Calculated confluence score (0-100)
 * @param signal - The entry signal
 * @param signals - All active signals
 * @param phases - Active phases
 * @param trendStore - Optional trend store for trend boosts
 * @returns Decision breakdown with all multipliers
 */
export function calculatePositionMultiplier(
  confluenceScore: number,
  signal: EnrichedSignal,
  signals: Map<Timeframe, StoredSignal>,
  phases: Map<string, StoredPhase>,
  trendStore?: TrendStore
): DecisionBreakdown {
  // 1. Confluence multiplier (PRIMARY)
  const confluenceMultiplier = getConfluenceMultiplier(confluenceScore);
  
  // 2. Quality multiplier
  const qualityMultiplier = QUALITY_MULTIPLIERS[signal.signal.quality];
  
  // 3. HTF Alignment multiplier (CRITICAL)
  const htfAlignment = determineHTFAlignment(signal, signals, phases);
  const htfAlignmentMultiplier = HTF_ALIGNMENT_MULTIPLIERS[htfAlignment];
  
  // 4. R:R multiplier
  const rrMultiplier = getRRMultiplier(signal.risk.rr_ratio_t1);
  
  // 5. Volume multiplier
  const volumeMultiplier = getVolumeMultiplier(signal.market_context.volume_vs_avg);
  
  // 6. Trend multiplier
  const trendMultiplier = getTrendMultiplier(signal.trend.strength);
  
  // 7. Session multiplier
  const sessionMultiplier = SESSION_MULTIPLIERS[signal.time_context.market_session];
  
  // 8. Day multiplier
  const dayMultiplier = DAY_MULTIPLIERS[signal.time_context.day_of_week];
  
  // 9. Phase and trend boosts
  const boosts = getPhaseAndTrendBoosts(signal, phases, trendStore);
  
  // Calculate raw multiplier (all factors stack)
  let rawMultiplier = 1.0;
  rawMultiplier *= confluenceMultiplier;
  rawMultiplier *= qualityMultiplier;
  rawMultiplier *= htfAlignmentMultiplier;
  rawMultiplier *= rrMultiplier;
  rawMultiplier *= volumeMultiplier;
  rawMultiplier *= trendMultiplier;
  rawMultiplier *= sessionMultiplier;
  rawMultiplier *= dayMultiplier;
  
  // Apply phase boosts (additive)
  rawMultiplier *= (1 + boosts.confidence_boost);
  rawMultiplier *= (1 + boosts.position_boost);
  
  // Apply trend alignment boost (additive)
  rawMultiplier *= (1 + boosts.trend_alignment_boost);
  
  // Clamp to bounds
  const finalMultiplier = clampPositionMultiplier(rawMultiplier);
  
  return {
    confluence_multiplier: confluenceMultiplier,
    quality_multiplier: qualityMultiplier,
    htf_alignment_multiplier: htfAlignmentMultiplier,
    rr_multiplier: rrMultiplier,
    volume_multiplier: volumeMultiplier,
    trend_multiplier: trendMultiplier,
    session_multiplier: sessionMultiplier,
    day_multiplier: dayMultiplier,
    phase_confidence_boost: boosts.confidence_boost,
    phase_position_boost: boosts.position_boost,
    trend_alignment_boost: boosts.trend_alignment_boost,
    final_multiplier: finalMultiplier,
  };
}

/**
 * Calculate raw multiplier before clamping (for SKIP detection)
 */
export function calculateRawMultiplier(breakdown: DecisionBreakdown): number {
  let raw = 1.0;
  raw *= breakdown.confluence_multiplier;
  raw *= breakdown.quality_multiplier;
  raw *= breakdown.htf_alignment_multiplier;
  raw *= breakdown.rr_multiplier;
  raw *= breakdown.volume_multiplier;
  raw *= breakdown.trend_multiplier;
  raw *= breakdown.session_multiplier;
  raw *= breakdown.day_multiplier;
  raw *= (1 + breakdown.phase_confidence_boost);
  raw *= (1 + breakdown.phase_position_boost);
  raw *= (1 + breakdown.trend_alignment_boost);
  return raw;
}

/**
 * Check if position should be skipped due to low multiplier
 */
export function shouldSkipPosition(breakdown: DecisionBreakdown): boolean {
  const raw = calculateRawMultiplier(breakdown);
  return raw < POSITION_MULTIPLIER_MIN;
}

/**
 * Calculate recommended contracts based on multiplier and signal
 */
export function calculateRecommendedContracts(
  breakdown: DecisionBreakdown,
  signal: EnrichedSignal
): number {
  const baseContracts = signal.risk.recommended_contracts;
  const adjusted = Math.round(baseContracts * breakdown.final_multiplier);
  return Math.max(1, adjusted); // Minimum 1 contract
}
