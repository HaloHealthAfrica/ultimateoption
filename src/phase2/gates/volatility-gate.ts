/**
 * Phase 2 Decision Engine - Volatility Risk Gate
 * 
 * Blocks trades during volatility spikes to avoid unstable market conditions.
 * Threshold: ATR14/RV20 ratio must not exceed 2.0
 */

import { GateResult, DecisionContext } from '../types';
import { GATE_NAMES, GATE_THRESHOLDS, GATE_REASONS } from '../constants/gates';
import { BaseRiskGate } from './base-gate';

/**
 * Volatility Gate - Rejects trades during volatility spikes
 * 
 * Requirements:
 * - WHEN ATR14/RV20 ratio > 2.0, SHALL fail with reason 'VOLATILITY_SPIKE'
 * - WHEN ATR14/RV20 ratio <= 2.0, SHALL pass
 * - WHEN RV20 is zero, SHALL use ratio of 1.0 (no spike)
 * - WHEN volatility data unavailable, SHALL use fallback values
 */
export class VolatilityGate extends BaseRiskGate {
  readonly name = GATE_NAMES.VOLATILITY_GATE;
  
  evaluate(context: DecisionContext): GateResult {
    // Get volatility data from market context, fallback to 0 if unavailable
    let atr14 = context.market?.marketStats.atr14 ?? 0;
    let rv20 = context.market?.marketStats.rv20 ?? 0;
    
    // Handle NaN and invalid values
    if (!Number.isFinite(atr14)) atr14 = 0;
    if (!Number.isFinite(rv20)) rv20 = 0;
    
    // Calculate spike ratio with zero-division protection
    // If RV20 is zero or invalid, assume no spike (ratio = 1.0)
    const spikeRatio = rv20 > 0 ? atr14 / rv20 : 1.0;
    
    // Apply threshold check
    const passed = spikeRatio <= GATE_THRESHOLDS.VOLATILITY_SPIKE;
    
    return this.createResult(
      passed,
      passed ? undefined : GATE_REASONS.VOLATILITY_SPIKE,
      spikeRatio,
      GATE_THRESHOLDS.VOLATILITY_SPIKE
    );
  }
}