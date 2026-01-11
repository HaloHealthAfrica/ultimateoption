/**
 * Phase 2 Decision Engine - Gamma Risk Gate
 * 
 * Blocks trades against gamma bias to avoid fighting market maker positioning.
 * Logic: Rejects LONG signals with NEGATIVE gamma or SHORT signals with POSITIVE gamma
 */

import { DecisionContext, GateResult } from '../types';
import { GATE_NAMES, GATE_REASONS } from '../constants/gates';
import { BaseRiskGate } from './base-gate';

/**
 * Gamma Gate - Rejects trades that oppose gamma bias
 * 
 * Requirements:
 * - WHEN signal is LONG and gammaBias is NEGATIVE, SHALL fail with reason 'GAMMA_HEADWIND'
 * - WHEN signal is SHORT and gammaBias is POSITIVE, SHALL fail with reason 'GAMMA_HEADWIND'
 * - WHEN signal direction aligns with gamma bias, SHALL pass
 * - WHEN gammaBias is NEUTRAL, SHALL pass regardless of signal direction
 * - WHEN gamma data unavailable, SHALL use fallback value of NEUTRAL
 */
export class GammaGate extends BaseRiskGate {
  readonly name = GATE_NAMES.GAMMA_GATE;
  
  evaluate(context: DecisionContext): GateResult {
    // Get gamma bias from market context, fallback to NEUTRAL if unavailable
    const gammaBias = context.market?.optionsData.gammaBias ?? 'NEUTRAL';
    const signalType = context.indicator.signalType;
    
    // Check for gamma headwind conditions
    const hasGammaHeadwind = (
      (signalType === 'LONG' && gammaBias === 'NEGATIVE') ||
      (signalType === 'SHORT' && gammaBias === 'POSITIVE')
    );
    
    const passed = !hasGammaHeadwind;
    
    return this.createResult(
      passed,
      passed ? undefined : GATE_REASONS.GAMMA_HEADWIND
    );
  }
}