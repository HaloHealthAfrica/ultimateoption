/**
 * Confluence Calculator
 * Calculates weighted multi-timeframe confluence score
 * 
 * Requirements: 3.1, 3.2
 */

import { Timeframe, SignalType } from '@/types/signal';
import { StoredSignal } from '@/webhooks/timeframeStore';
import { CONFLUENCE_WEIGHTS } from './matrices';

/**
 * All valid timeframes in order of weight (highest to lowest)
 */
export const TIMEFRAMES_BY_WEIGHT: readonly Timeframe[] = Object.freeze([
  '240', '60', '30', '15', '5', '3'
]);

/**
 * Confluence calculation result
 */
export interface ConfluenceResult {
  score: number;
  direction: SignalType | null;
  alignedTimeframes: Timeframe[];
  misalignedTimeframes: Timeframe[];
  breakdown: Record<Timeframe, { aligned: boolean; weight: number; contribution: number }>;
}

/**
 * Calculate confluence score for a given direction
 * 
 * @param signals - Map of active signals by timeframe
 * @param direction - The direction to check alignment for ('LONG' or 'SHORT')
 * @returns Confluence score as percentage (0-100)
 */
export function calculateConfluenceForDirection(
  signals: Map<Timeframe, StoredSignal>,
  direction: SignalType
): number {
  let score = 0;
  
  for (const [tf, weight] of Object.entries(CONFLUENCE_WEIGHTS)) {
    const stored = signals.get(tf as Timeframe);
    if (stored && stored.signal.signal.type === direction) {
      score += weight;
    }
  }
  
  // Convert to percentage (weights sum to 1.0)
  return score * 100;
}

/**
 * Calculate full confluence result with breakdown
 * 
 * @param signals - Map of active signals by timeframe
 * @param direction - The direction to check alignment for
 * @returns Full confluence result with breakdown
 */
export function calculateConfluenceWithBreakdown(
  signals: Map<Timeframe, StoredSignal>,
  direction: SignalType
): ConfluenceResult {
  const alignedTimeframes: Timeframe[] = [];
  const misalignedTimeframes: Timeframe[] = [];
  const breakdown: Record<Timeframe, { aligned: boolean; weight: number; contribution: number }> = {} as Record<Timeframe, { aligned: boolean; weight: number; contribution: number }>;
  
  let totalScore = 0;
  
  for (const tf of TIMEFRAMES_BY_WEIGHT) {
    const weight = CONFLUENCE_WEIGHTS[tf];
    const stored = signals.get(tf);
    
    if (stored) {
      const aligned = stored.signal.signal.type === direction;
      const contribution = aligned ? weight * 100 : 0;
      
      breakdown[tf] = { aligned, weight, contribution };
      totalScore += contribution;
      
      if (aligned) {
        alignedTimeframes.push(tf);
      } else {
        misalignedTimeframes.push(tf);
      }
    } else {
      breakdown[tf] = { aligned: false, weight, contribution: 0 };
    }
  }
  
  return {
    score: totalScore,
    direction,
    alignedTimeframes,
    misalignedTimeframes,
    breakdown,
  };
}

/**
 * Determine the dominant direction from active signals
 * Returns the direction with higher confluence, or null if no signals
 * 
 * @param signals - Map of active signals by timeframe
 * @returns Dominant direction and its confluence score
 */
export function getDominantDirection(
  signals: Map<Timeframe, StoredSignal>
): { direction: SignalType | null; score: number } {
  if (signals.size === 0) {
    return { direction: null, score: 0 };
  }
  
  const longScore = calculateConfluenceForDirection(signals, 'LONG');
  const shortScore = calculateConfluenceForDirection(signals, 'SHORT');
  
  if (longScore > shortScore) {
    return { direction: 'LONG', score: longScore };
  } else if (shortScore > longScore) {
    return { direction: 'SHORT', score: shortScore };
  } else if (longScore > 0) {
    // Tie - prefer LONG (arbitrary but deterministic)
    return { direction: 'LONG', score: longScore };
  }
  
  return { direction: null, score: 0 };
}

/**
 * Check if a specific timeframe is aligned with the given direction
 */
export function isTimeframeAligned(
  signals: Map<Timeframe, StoredSignal>,
  timeframe: Timeframe,
  direction: SignalType
): boolean {
  const stored = signals.get(timeframe);
  return stored !== undefined && stored.signal.signal.type === direction;
}

/**
 * Get the weight contribution of a specific timeframe
 */
export function getTimeframeWeight(timeframe: Timeframe): number {
  return CONFLUENCE_WEIGHTS[timeframe] ?? 0;
}

/**
 * Calculate the maximum possible confluence score
 * (useful for understanding how close to perfect alignment)
 */
export function getMaxPossibleConfluence(): number {
  return Object.values(CONFLUENCE_WEIGHTS).reduce((sum, w) => sum + w, 0) * 100;
}
