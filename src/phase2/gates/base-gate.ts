/**
 * Phase 2 Decision Engine - Base Risk Gate Interface
 * 
 * Defines the common interface that all risk gates must implement.
 * All gates are deterministic and stateless.
 */

import { DecisionContext, GateResult } from '../types';

/**
 * Base interface for all risk gates
 */
export interface RiskGate {
  readonly name: string;
  evaluate(context: DecisionContext): GateResult;
}

/**
 * Abstract base class for risk gates with common functionality
 */
export abstract class BaseRiskGate implements RiskGate {
  abstract readonly name: string;
  
  abstract evaluate(context: DecisionContext): GateResult;
  
  /**
   * Helper method to create a gate result
   */
  protected createResult(
    passed: boolean,
    reason?: string,
    value?: number,
    threshold?: number
  ): GateResult {
    return {
      gate: this.name,
      passed,
      reason: passed ? undefined : reason,
      value,
      threshold
    };
  }
}