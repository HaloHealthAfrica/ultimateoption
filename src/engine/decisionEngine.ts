/**
 * Decision Engine Core (IMMUTABLE)
 * Makes deterministic trading decisions based on signals and phases
 * 
 * Requirements: 2.2, 2.3, 2.4, 3.3, 3.4, 3.5, 3.13, 3.14
 */

import { EnrichedSignal, Timeframe, SignalType } from '@/types/signal';
import { 
  DecisionResult, 
  createWaitDecision,
  createSkipDecision,
} from '@/types/decision';
import { StoredSignal } from '@/webhooks/timeframeStore';
import { StoredPhase } from '@/webhooks/phaseStore';
import { TrendStore } from '@/trend/storage/trendStore';
import {
  getDominantDirection,
} from './confluence';
import {
  calculatePositionMultiplier,
  calculateRawMultiplier,
  shouldSkipPosition,
  calculateRecommendedContracts,
} from './positionSizing';
import {
  ENGINE_VERSION,
  CONFLUENCE_THRESHOLD,
  HTF_MIN_AI_SCORE,
  POSITION_MULTIPLIER_MIN,
} from './matrices';

/**
 * Check if we have valid HTF bias (4H or 1H signal with ai_score >= 6)
 */
function hasValidHTFBias(
  signals: Map<Timeframe, StoredSignal>,
  direction: SignalType
): boolean {
  // Check 4H signal
  const signal4H = signals.get('240');
  if (signal4H && 
      signal4H.signal.signal.type === direction &&
      signal4H.signal.signal.ai_score >= HTF_MIN_AI_SCORE) {
    return true;
  }
  
  // Check 1H signal
  const signal1H = signals.get('60');
  if (signal1H && 
      signal1H.signal.signal.type === direction &&
      signal1H.signal.signal.ai_score >= HTF_MIN_AI_SCORE) {
    return true;
  }
  
  return false;
}

/**
 * Select the best entry signal from active signals
 * Prefers higher timeframes and higher quality
 */
function selectEntrySignal(
  signals: Map<Timeframe, StoredSignal>,
  direction: SignalType
): EnrichedSignal | null {
  // Priority order: 4H > 1H > 30M > 15M > 5M > 3M
  const priorityOrder: Timeframe[] = ['240', '60', '30', '15', '5', '3'];
  
  for (const tf of priorityOrder) {
    const stored = signals.get(tf);
    if (stored && stored.signal.signal.type === direction) {
      return stored.signal;
    }
  }
  
  return null;
}

/**
 * Select best stop loss from aligned signals
 * Uses the tightest stop that still makes sense
 */
function selectBestStopLoss(
  signals: Map<Timeframe, StoredSignal>,
  direction: SignalType
): number | null {
  let bestStop: number | null = null;
  
  for (const stored of signals.values()) {
    if (stored.signal.signal.type === direction) {
      const stop = stored.signal.entry.stop_loss;
      if (bestStop === null) {
        bestStop = stop;
      } else if (direction === 'LONG') {
        // For LONG, prefer higher (tighter) stop
        bestStop = Math.max(bestStop, stop);
      } else {
        // For SHORT, prefer lower (tighter) stop
        bestStop = Math.min(bestStop, stop);
      }
    }
  }
  
  return bestStop;
}


/**
 * Select best targets from aligned signals
 */
function selectBestTargets(
  signals: Map<Timeframe, StoredSignal>,
  direction: SignalType
): { target_1: number | null; target_2: number | null } {
  let bestT1: number | null = null;
  let bestT2: number | null = null;
  
  for (const stored of signals.values()) {
    if (stored.signal.signal.type === direction) {
      const t1 = stored.signal.entry.target_1;
      const t2 = stored.signal.entry.target_2;
      
      if (bestT1 === null) {
        bestT1 = t1;
        bestT2 = t2;
      } else if (direction === 'LONG') {
        // For LONG, prefer higher targets
        bestT1 = Math.max(bestT1, t1);
        bestT2 = Math.max(bestT2 ?? 0, t2);
      } else {
        // For SHORT, prefer lower targets
        bestT1 = Math.min(bestT1, t1);
        bestT2 = Math.min(bestT2 ?? Infinity, t2);
      }
    }
  }
  
  return { target_1: bestT1, target_2: bestT2 };
}

/**
 * Main decision engine function
 * Makes a deterministic decision based on current signals and phases
 * 
 * @param signals - Map of active signals by timeframe
 * @param phases - Map of active phases
 * @param trendStore - Optional trend store for trend boosts
 * @returns DecisionResult with decision, breakdown, and trade parameters
 */
export function makeDecision(
  signals: Map<Timeframe, StoredSignal>,
  phases: Map<string, StoredPhase>,
  trendStore?: TrendStore
): DecisionResult {
  // Step 1: Check if we have any signals
  if (signals.size === 0) {
    return createWaitDecision(
      'No active signals',
      ENGINE_VERSION,
      0
    );
  }
  
  // Step 2: Determine dominant direction
  const { direction, score: confluenceScore } = getDominantDirection(signals);
  
  if (!direction) {
    return createWaitDecision(
      'No clear direction from signals',
      ENGINE_VERSION,
      0
    );
  }
  
  // Step 3: Check HTF bias requirement (4H or 1H with ai_score >= 6)
  if (!hasValidHTFBias(signals, direction)) {
    return createWaitDecision(
      `No valid HTF bias for ${direction} (need 4H or 1H signal with AI score >= ${HTF_MIN_AI_SCORE})`,
      ENGINE_VERSION,
      confluenceScore
    );
  }
  
  // Step 4: Check confluence threshold (minimum 60%)
  if (confluenceScore < CONFLUENCE_THRESHOLD) {
    return createWaitDecision(
      `Confluence ${confluenceScore.toFixed(1)}% below threshold ${CONFLUENCE_THRESHOLD}%`,
      ENGINE_VERSION,
      confluenceScore
    );
  }
  
  // Step 5: Select entry signal
  const entrySignal = selectEntrySignal(signals, direction);
  
  if (!entrySignal) {
    return createWaitDecision(
      'No suitable entry signal found',
      ENGINE_VERSION,
      confluenceScore
    );
  }
  
  // Step 6: Calculate position multiplier
  const breakdown = calculatePositionMultiplier(
    confluenceScore,
    entrySignal,
    signals,
    phases,
    trendStore
  );
  
  // Step 7: Check if should SKIP due to low multiplier
  if (shouldSkipPosition(breakdown)) {
    const rawMultiplier = calculateRawMultiplier(breakdown);
    return createSkipDecision(
      `Position multiplier ${rawMultiplier.toFixed(2)} below minimum ${POSITION_MULTIPLIER_MIN}`,
      ENGINE_VERSION,
      breakdown,
      confluenceScore,
      entrySignal
    );
  }
  
  // Step 8: Select best stop/targets
  const stopLoss = selectBestStopLoss(signals, direction);
  const { target_1, target_2 } = selectBestTargets(signals, direction);
  
  // Step 9: Calculate recommended contracts
  const recommendedContracts = calculateRecommendedContracts(breakdown, entrySignal);
  
  // Step 10: Return EXECUTE decision
  return {
    decision: 'EXECUTE',
    reason: `${direction} signal with ${confluenceScore.toFixed(1)}% confluence, ${breakdown.final_multiplier.toFixed(2)}x multiplier`,
    breakdown,
    engine_version: ENGINE_VERSION,
    confluence_score: confluenceScore,
    recommended_contracts: recommendedContracts,
    entry_signal: entrySignal,
    stop_loss: stopLoss,
    target_1,
    target_2,
  };
}

/**
 * Re-export ENGINE_VERSION for external use
 */
export { ENGINE_VERSION };
