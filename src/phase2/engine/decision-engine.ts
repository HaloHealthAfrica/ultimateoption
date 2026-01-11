/**
 * Phase 2 Decision Engine - Core Decision Engine
 * 
 * Deterministic decision engine that evaluates all risk gates and produces
 * auditable APPROVE/REJECT decisions with complete audit trails.
 */

import { DecisionContext, DecisionOutput, Decision, GateResult, AuditTrail, ENGINE_VERSION } from '../types';
import { GATE_THRESHOLDS, CONFIDENCE_BOOSTS } from '../constants/gates';
import { 
  SpreadGate, 
  VolatilityGate, 
  GammaGate, 
  PhaseGate, 
  SessionGate,
  RiskGate 
} from '../gates';

/**
 * Core Decision Engine - Deterministic risk evaluation
 * 
 * Requirements:
 * - 4.1: Identical inputs produce identical outputs (deterministic)
 * - 4.2: Evaluate ALL defined risk gates
 * - 4.3: REJECT if any gate fails
 * - 4.4: APPROVE if all gates pass
 * - 4.5: Stamp decisions with engine version
 */
export class DecisionEngine {
  private readonly gates: RiskGate[];
  private readonly version = ENGINE_VERSION;

  constructor() {
    // Initialize all risk gates in deterministic order
    this.gates = [
      new SpreadGate(),
      new VolatilityGate(),
      new GammaGate(),
      new PhaseGate(),
      new SessionGate()
    ];

    // Freeze the gates array to ensure immutability
    Object.freeze(this.gates);
  }

  /**
   * Make a deterministic trading decision
   * 
   * @param context - Complete decision context with market data
   * @returns DecisionOutput with decision, confidence, and audit trail
   */
  makeDecision(context: DecisionContext): DecisionOutput {
    const startTime = performance.now();
    
    // Evaluate all gates sequentially for deterministic results
    const gateResults: GateResult[] = [];
    const passed: string[] = [];
    const failed: string[] = [];

    for (const gate of this.gates) {
      const result = gate.evaluate(context);
      gateResults.push(result);

      if (result.passed) {
        passed.push(result.gate);
      } else {
        failed.push(result.gate);
      }
    }

    // Decision logic: ALL gates must pass for APPROVE
    const decision: Decision = failed.length === 0 ? 'APPROVE' : 'REJECT';

    // Calculate confidence for approved trades only
    const confidence = decision === 'APPROVE' 
      ? this.calculateConfidence(context)
      : undefined;

    // Generate reasons for rejected trades
    const reasons = decision === 'REJECT'
      ? gateResults
          .filter(r => !r.passed)
          .map(r => r.reason!)
          .filter(reason => reason !== undefined)
      : undefined;

    const processingTime = performance.now() - startTime;

    // Build complete audit trail with both gate result formats
    const gateResultsObject = this.createGateResultsObject(gateResults);
    const audit: AuditTrail = {
      timestamp: new Date().toISOString(),
      symbol: context.indicator.symbol,
      session: context.indicator.marketSession,
      context_snapshot: this.createContextSnapshot(context),
      gate_results: gateResults, // Array format
      gate_results_object: gateResultsObject, // Object format for tests
      processing_time_ms: Math.max(0.01, Math.round(processingTime * 100) / 100) // Ensure minimum 0.01ms
    };

    return {
      decision,
      direction: context.indicator.signalType, // Always include direction
      symbol: context.indicator.symbol, // Add symbol field
      confidence: decision === 'APPROVE' ? (confidence ?? 0) : 0, // Always include confidence, 0 for REJECT
      engine_version: this.version,
      timestamp: new Date().toISOString(), // Add timestamp field
      gates: {
        passed,
        failed
      },
      reasons,
      audit
    };
  }

  /**
   * Create gate results object format for backward compatibility
   */
  private createGateResultsObject(gateResults: GateResult[]): Record<string, GateResult> {
    const gateResultsObject: Record<string, GateResult> = {};
    
    for (const result of gateResults) {
      gateResultsObject[result.gate] = result;
    }
    
    return gateResultsObject;
  }

  /**
   * Calculate confidence score for approved trades
   * 
   * Requirements:
   * - 13.1: Base confidence on aiScore
   * - 13.2: Add 0.5 boost for |satyPhase| >= 80
   * - 13.3: Add 0.3 boost for spreadBps <= 5
   * - 13.4: Cap at 10.0 maximum
   * - 13.5: Ensure non-negative result
   */
  private calculateConfidence(context: DecisionContext): number {
    // Start with aiScore as base confidence
    let confidence = context.indicator.aiScore;

    // Apply satyPhase boost for strong phase alignment
    const absolutePhase = Math.abs(context.indicator.satyPhase);
    if (absolutePhase >= GATE_THRESHOLDS.SATY_PHASE_BOOST_THRESHOLD) {
      confidence += CONFIDENCE_BOOSTS.SATY_PHASE_BOOST;
    }

    // Apply spread boost for tight spreads
    const spreadBps = context.market?.liquidityData.spreadBps ?? 999;
    if (spreadBps <= GATE_THRESHOLDS.SPREAD_BOOST_THRESHOLD) {
      confidence += CONFIDENCE_BOOSTS.SPREAD_BOOST;
    }

    // Ensure bounds: non-negative and capped at maximum
    confidence = Math.max(0, confidence);
    confidence = Math.min(GATE_THRESHOLDS.MAX_CONFIDENCE, confidence);

    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Create a deep snapshot of the decision context for audit trail
   * This ensures the audit trail captures the exact state at decision time
   */
  private createContextSnapshot(context: DecisionContext): DecisionContext {
    return JSON.parse(JSON.stringify(context));
  }

  /**
   * Get engine metadata for health checks and diagnostics
   */
  getEngineInfo() {
    return {
      version: this.version,
      gates: this.gates.map(gate => gate.name),
      deterministic: true,
      learning_enabled: false
    };
  }
}