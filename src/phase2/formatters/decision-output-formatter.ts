/**
 * Phase 2 Decision Engine - Decision Output Formatter
 * 
 * Formats decision engine outputs into structured, consistent format
 * for consumption by external systems.
 */

import { DecisionOutput, DecisionContext, GateResult, AuditTrail, Decision, ENGINE_VERSION } from '../types';

/**
 * Decision Output Formatter - Ensures consistent output structure
 * 
 * Requirements:
 * - 10.1: Output decision as 'APPROVE' or 'REJECT'
 * - 10.2: Include direction and confidence for APPROVE decisions
 * - 10.3: Include reasons array for REJECT decisions
 * - 10.4: Include complete audit trail
 * - 10.5: List all passed and failed gate names
 */
export class DecisionOutputFormatter {
  
  /**
   * Format a complete decision output
   * 
   * @param decision - The decision (APPROVE/REJECT)
   * @param context - The decision context
   * @param gateResults - Results from all gate evaluations
   * @param confidence - Calculated confidence (for APPROVE only)
   * @param processingTimeMs - Processing time in milliseconds
   * @returns Formatted DecisionOutput
   */
  formatDecision(
    decision: Decision,
    context: DecisionContext,
    gateResults: GateResult[],
    confidence?: number,
    processingTimeMs?: number
  ): DecisionOutput {
    
    // Separate passed and failed gates
    const passed: string[] = [];
    const failed: string[] = [];
    
    gateResults.forEach(result => {
      if (result.passed) {
        passed.push(result.gate);
      } else {
        failed.push(result.gate);
      }
    });

    // Generate reasons for REJECT decisions
    const reasons = decision === 'REJECT'
      ? gateResults
          .filter(r => !r.passed)
          .map(r => r.reason!)
          .filter(reason => reason !== undefined)
      : undefined;

    // Create audit trail
    const audit: AuditTrail = {
      timestamp: new Date().toISOString(),
      symbol: context.indicator.symbol,
      session: context.indicator.marketSession,
      context_snapshot: this.createContextSnapshot(context),
      gate_results: gateResults,
      processing_time_ms: processingTimeMs ?? 0
    };

    // Build the complete decision output
    const output: DecisionOutput = {
      decision,
      direction: decision === 'APPROVE' ? context.indicator.signalType : undefined, // Only include for APPROVE
      symbol: context.indicator.symbol, // Always include symbol
      confidence: decision === 'APPROVE' ? (confidence ?? 0) : undefined, // Only include for APPROVE
      timestamp: new Date().toISOString(), // Add timestamp
      engine_version: ENGINE_VERSION,
      gates: {
        passed,
        failed
      },
      reasons,
      audit
    };

    return output;
  }

  /**
   * Format an APPROVE decision with all required fields
   */
  formatApproveDecision(
    context: DecisionContext,
    gateResults: GateResult[],
    confidence: number,
    processingTimeMs?: number
  ): DecisionOutput {
    return this.formatDecision('APPROVE', context, gateResults, confidence, processingTimeMs);
  }

  /**
   * Format a REJECT decision with reasons
   */
  formatRejectDecision(
    context: DecisionContext,
    gateResults: GateResult[],
    processingTimeMs?: number
  ): DecisionOutput {
    return this.formatDecision('REJECT', context, gateResults, undefined, processingTimeMs);
  }

  /**
   * Validate that a DecisionOutput has all required fields
   * 
   * @param output - The decision output to validate
   * @returns true if valid, throws error if invalid
   */
  validateDecisionOutput(output: DecisionOutput): boolean {
    // Required fields for all decisions
    if (!output.decision || !['APPROVE', 'REJECT'].includes(output.decision)) {
      throw new Error('Invalid decision: must be APPROVE or REJECT');
    }

    if (!output.engine_version || typeof output.engine_version !== 'string') {
      throw new Error('Invalid engine_version: must be a non-empty string');
    }

    if (!output.gates || !Array.isArray(output.gates.passed) || !Array.isArray(output.gates.failed)) {
      throw new Error('Invalid gates: must have passed and failed arrays');
    }

    if (!output.audit) {
      throw new Error('Invalid audit: audit trail is required');
    }

    // Validate audit trail structure
    this.validateAuditTrail(output.audit);

    // APPROVE-specific validation
    if (output.decision === 'APPROVE') {
      if (!output.direction || !['LONG', 'SHORT'].includes(output.direction)) {
        throw new Error('APPROVE decisions must include valid direction (LONG/SHORT)');
      }

      if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 10) {
        throw new Error('APPROVE decisions must include confidence between 0 and 10');
      }

      if (output.reasons !== undefined) {
        throw new Error('APPROVE decisions should not include reasons');
      }
    }

    // REJECT-specific validation
    if (output.decision === 'REJECT') {
      if (output.direction !== undefined) {
        throw new Error('REJECT decisions should not include direction');
      }

      if (output.confidence !== undefined) {
        throw new Error('REJECT decisions should not include confidence');
      }

      if (!output.reasons || !Array.isArray(output.reasons) || output.reasons.length === 0) {
        throw new Error('REJECT decisions must include non-empty reasons array');
      }
    }

    return true;
  }

  /**
   * Validate audit trail structure
   */
  private validateAuditTrail(audit: AuditTrail): void {
    if (!audit.timestamp || !audit.timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)) {
      throw new Error('Invalid audit timestamp: must be ISO string');
    }

    if (!audit.symbol || typeof audit.symbol !== 'string') {
      throw new Error('Invalid audit symbol: must be non-empty string');
    }

    if (!audit.session || typeof audit.session !== 'string') {
      throw new Error('Invalid audit session: must be non-empty string');
    }

    if (!audit.context_snapshot) {
      throw new Error('Invalid audit context_snapshot: required');
    }

    if (!Array.isArray(audit.gate_results)) {
      throw new Error('Invalid audit gate_results: must be array');
    }

    if (typeof audit.processing_time_ms !== 'number' || audit.processing_time_ms < 0) {
      throw new Error('Invalid audit processing_time_ms: must be non-negative number');
    }
  }

  /**
   * Create a deep snapshot of the decision context for audit trail
   */
  private createContextSnapshot(context: DecisionContext): DecisionContext {
    return JSON.parse(JSON.stringify(context));
  }

  /**
   * Get formatter metadata
   */
  getFormatterInfo() {
    return {
      name: 'DecisionOutputFormatter',
      version: ENGINE_VERSION,
      supported_decisions: ['APPROVE', 'REJECT'],
      validation_enabled: true
    };
  }
}