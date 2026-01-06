/**
 * Decision Engine Types
 * Types for the immutable decision engine output
 * 
 * Requirements: 2.2, 2.3
 */

import { z } from 'zod';
import { EnrichedSignal, EnrichedSignalSchema } from './signal';

// Decision outcomes
export const DecisionSchema = z.enum(['EXECUTE', 'WAIT', 'SKIP']);
export type Decision = z.infer<typeof DecisionSchema>;

// Decision breakdown - all multipliers applied
export const DecisionBreakdownSchema = z.object({
  confluence_multiplier: z.number(),
  quality_multiplier: z.number(),
  htf_alignment_multiplier: z.number(),
  rr_multiplier: z.number(),
  volume_multiplier: z.number(),
  trend_multiplier: z.number(),
  session_multiplier: z.number(),
  day_multiplier: z.number(),
  phase_confidence_boost: z.number(),
  phase_position_boost: z.number(),
  trend_alignment_boost: z.number(),
  final_multiplier: z.number(),
});
export type DecisionBreakdown = z.infer<typeof DecisionBreakdownSchema>;

// Full decision result
export const DecisionResultSchema = z.object({
  decision: DecisionSchema,
  reason: z.string(),
  breakdown: DecisionBreakdownSchema,
  engine_version: z.string(),
  confluence_score: z.number().min(0).max(100),
  recommended_contracts: z.number().int().nonnegative(),
  entry_signal: EnrichedSignalSchema.nullable(),
  stop_loss: z.number().nullable(),
  target_1: z.number().nullable(),
  target_2: z.number().nullable(),
});
export type DecisionResult = z.infer<typeof DecisionResultSchema>;

/**
 * Create an empty decision breakdown with default values
 */
export function createEmptyBreakdown(): DecisionBreakdown {
  return {
    confluence_multiplier: 1.0,
    quality_multiplier: 1.0,
    htf_alignment_multiplier: 1.0,
    rr_multiplier: 1.0,
    volume_multiplier: 1.0,
    trend_multiplier: 1.0,
    session_multiplier: 1.0,
    day_multiplier: 1.0,
    phase_confidence_boost: 0,
    phase_position_boost: 0,
    trend_alignment_boost: 0,
    final_multiplier: 1.0,
  };
}

/**
 * Create a WAIT decision result
 */
export function createWaitDecision(
  reason: string,
  engineVersion: string,
  confluenceScore: number = 0
): DecisionResult {
  return {
    decision: 'WAIT',
    reason,
    breakdown: createEmptyBreakdown(),
    engine_version: engineVersion,
    confluence_score: confluenceScore,
    recommended_contracts: 0,
    entry_signal: null,
    stop_loss: null,
    target_1: null,
    target_2: null,
  };
}

/**
 * Create a SKIP decision result
 */
export function createSkipDecision(
  reason: string,
  engineVersion: string,
  breakdown: DecisionBreakdown,
  confluenceScore: number,
  entrySignal: EnrichedSignal | null = null
): DecisionResult {
  return {
    decision: 'SKIP',
    reason,
    breakdown,
    engine_version: engineVersion,
    confluence_score: confluenceScore,
    recommended_contracts: 0,
    entry_signal: entrySignal,
    stop_loss: entrySignal?.entry.stop_loss ?? null,
    target_1: entrySignal?.entry.target_1 ?? null,
    target_2: entrySignal?.entry.target_2 ?? null,
  };
}
