/**
 * Phase 2 Decision Engine - Spread Risk Gate
 * 
 * Blocks trades with wide spreads to avoid poor execution quality.
 * Threshold: 12 basis points maximum
 */

import { GateResult, DecisionContext } from '../types';
import { GATE_NAMES, GATE_THRESHOLDS, GATE_REASONS } from '../constants/gates';
import { BaseRiskGate } from './base-gate';

/**
 * Spread Gate - Rejects trades with spreads wider than 12 bps
 * 
 * Requirements:
 * - WHEN spreadBps > 12, SHALL fail with reason 'SPREAD_TOO_WIDE'
 * - WHEN spreadBps <= 12, SHALL pass
 * - WHEN spread data unavailable, SHALL use fallback value of 999 bps
 */
export class SpreadGate extends BaseRiskGate {
  readonly name = GATE_NAMES.SPREAD_GATE;
  
  evaluate(context: DecisionContext): GateResult {
    // Get spread from market context
    const spreadBps = context.market?.liquidityData.spreadBps;
    
    // CONSERVATIVE: Fail gate if spread data is unavailable
    // This prevents trading when we cannot assess execution quality
    if (spreadBps === undefined || !Number.isFinite(spreadBps) || spreadBps < 0) {
      return this.createResult(
        false,
        'Spread data unavailable - cannot assess execution quality',
        undefined,
        GATE_THRESHOLDS.SPREAD_BPS
      );
    }
    
    // Apply threshold check
    const passed = spreadBps <= GATE_THRESHOLDS.SPREAD_BPS;
    
    return this.createResult(
      passed,
      passed ? undefined : GATE_REASONS.SPREAD_TOO_WIDE,
      spreadBps,
      GATE_THRESHOLDS.SPREAD_BPS
    );
  }
}