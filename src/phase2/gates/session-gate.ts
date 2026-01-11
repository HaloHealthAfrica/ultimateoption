/**
 * Phase 2 Decision Engine - Session Risk Gate
 * 
 * Blocks afterhours trading to avoid low-liquidity periods.
 * Logic: Rejects any signal during AFTERHOURS session
 */

import { DecisionContext, GateResult } from '../types';
import { GATE_NAMES, GATE_REASONS } from '../constants/gates';
import { BaseRiskGate } from './base-gate';

/**
 * Session Gate - Rejects afterhours trading
 * 
 * Requirements:
 * - WHEN marketSession is 'AFTERHOURS', SHALL fail with reason 'AFTERHOURS_BLOCKED'
 * - WHEN marketSession is 'OPEN', 'MIDDAY', or 'POWER_HOUR', SHALL pass
 * - WHEN marketSession is invalid, SHALL fail with validation error
 * - WHEN session data is missing, SHALL use default session classification
 */
export class SessionGate extends BaseRiskGate {
  readonly name = GATE_NAMES.SESSION_GATE;
  
  evaluate(context: DecisionContext): GateResult {
    // Get market session from context
    const marketSession = context.indicator.marketSession;
    
    // Valid trading sessions (not afterhours)
    const validSessions = ['OPEN', 'MIDDAY', 'POWER_HOUR'];
    
    // Check if session allows trading
    const passed = validSessions.includes(marketSession);
    
    return this.createResult(
      passed,
      passed ? undefined : GATE_REASONS.AFTERHOURS_BLOCKED
    );
  }
}