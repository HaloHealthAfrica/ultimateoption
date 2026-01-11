/**
 * Phase 2 Decision Engine - Phase Confidence Gate
 * 
 * Blocks trades with low phase confidence to ensure high-conviction setups.
 * Threshold: Absolute satyPhase value must be >= 65
 */

import { DecisionContext, GateResult } from '../types';
import { GATE_NAMES, GATE_THRESHOLDS, GATE_REASONS } from '../constants/gates';
import { BaseRiskGate } from './base-gate';

/**
 * Phase Gate - Rejects trades with insufficient phase confidence
 * 
 * Requirements:
 * - WHEN absolute satyPhase value < 65, SHALL fail with reason 'PHASE_CONFIDENCE_LOW'
 * - WHEN absolute satyPhase value >= 65, SHALL pass
 * - WHEN satyPhase is missing, SHALL use default value of 0
 * - WHEN phase confidence is exactly 65, SHALL pass (boundary condition)
 */
export class PhaseGate extends BaseRiskGate {
  readonly name = GATE_NAMES.PHASE_GATE;
  
  evaluate(context: DecisionContext): GateResult {
    // Get satyPhase from context, default to 0 if unavailable
    const satyPhase = context.indicator.satyPhase ?? 0;
    
    // Calculate absolute phase confidence
    const phaseConfidence = Math.abs(satyPhase);
    
    // Apply threshold check
    const passed = phaseConfidence >= GATE_THRESHOLDS.PHASE_CONFIDENCE;
    
    return this.createResult(
      passed,
      passed ? undefined : GATE_REASONS.PHASE_CONFIDENCE_LOW,
      phaseConfidence,
      GATE_THRESHOLDS.PHASE_CONFIDENCE
    );
  }
}