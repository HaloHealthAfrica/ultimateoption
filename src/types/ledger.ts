/**
 * Ledger Types
 * Types for the append-only audit ledger
 * 
 * Requirements: 4.2
 */

import { z } from 'zod';
import { EnrichedSignalSchema } from './signal';
import { SatyPhaseWebhookSchema } from './saty';
import { DecisionSchema, DecisionBreakdownSchema } from './decision';
import { ExecutionSchema } from './options';

// Exit reasons
export const ExitReasonSchema = z.enum([
  'TARGET_1',
  'TARGET_2',
  'STOP_LOSS',
  'THETA_DECAY',
  'MANUAL',
]);
export type ExitReason = z.infer<typeof ExitReasonSchema>;

// Volatility regime
export const VolatilityRegimeSchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'EXTREME']);
export type VolatilityRegime = z.infer<typeof VolatilityRegimeSchema>;

// Trend regime
export const TrendRegimeSchema = z.enum([
  'STRONG_BULL',
  'BULL',
  'NEUTRAL',
  'BEAR',
  'STRONG_BEAR',
]);
export type TrendRegime = z.infer<typeof TrendRegimeSchema>;

// Liquidity regime
export const LiquidityRegimeSchema = z.enum(['HIGH', 'NORMAL', 'LOW']);
export type LiquidityRegime = z.infer<typeof LiquidityRegimeSchema>;

// Phase context (optional phases at decision time)
export const PhaseContextSchema = z.object({
  regime_phase: SatyPhaseWebhookSchema.optional(),
  bias_phase: SatyPhaseWebhookSchema.optional(),
});
export type PhaseContext = z.infer<typeof PhaseContextSchema>;

// Exit data (updated when trade closes)
export const ExitDataSchema = z.object({
  exit_time: z.number(),
  exit_price: z.number().positive(),
  exit_iv: z.number().positive(),
  exit_delta: z.number().min(-1).max(1),
  underlying_at_exit: z.number().positive(),
  pnl_gross: z.number(),
  pnl_net: z.number(),
  hold_time_seconds: z.number().int().nonnegative(),
  exit_reason: ExitReasonSchema,
  // P&L Attribution
  pnl_from_delta: z.number(),
  pnl_from_iv: z.number(),
  pnl_from_theta: z.number(),
  pnl_from_gamma: z.number(),
  // Costs
  total_commission: z.number().nonnegative(),
  total_spread_cost: z.number().nonnegative(),
  total_slippage: z.number().nonnegative(),
});
export type ExitData = z.infer<typeof ExitDataSchema>;


// Market regime snapshot
export const RegimeSnapshotSchema = z.object({
  volatility: VolatilityRegimeSchema,
  trend: TrendRegimeSchema,
  liquidity: LiquidityRegimeSchema,
  iv_rank: z.number().min(0).max(100),
});
export type RegimeSnapshot = z.infer<typeof RegimeSnapshotSchema>;

// Hypothetical tracking (for skipped trades)
export const HypotheticalSchema = z.object({
  would_have_executed: z.boolean(),
  would_have_hit_target_1: z.boolean(),
  would_have_hit_target_2: z.boolean(),
  would_have_hit_stop: z.boolean(),
  hypothetical_pnl: z.number(),
});
export type Hypothetical = z.infer<typeof HypotheticalSchema>;

// Full ledger entry
export const LedgerEntrySchema = z.object({
  // Identity
  id: z.string().uuid(),
  created_at: z.number(),
  engine_version: z.string(),
  
  // Signal snapshot (frozen at decision time)
  signal: EnrichedSignalSchema,
  
  // Phase context (if present)
  phase_context: PhaseContextSchema.optional(),
  
  // Decision
  decision: DecisionSchema,
  decision_reason: z.string(),
  decision_breakdown: DecisionBreakdownSchema,
  confluence_score: z.number().min(0).max(100),
  
  // Execution data (if executed)
  execution: ExecutionSchema.optional(),
  
  // Exit data (updated when closed)
  exit: ExitDataSchema.optional(),
  
  // Market regime snapshot
  regime: RegimeSnapshotSchema,
  
  // Hypothetical tracking (for skipped trades)
  hypothetical: HypotheticalSchema.optional(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

// Ledger entry without ID (for creation)
export const LedgerEntryCreateSchema = LedgerEntrySchema.omit({ id: true });
export type LedgerEntryCreate = z.infer<typeof LedgerEntryCreateSchema>;

// Query filters for ledger
export const LedgerQueryFiltersSchema = z.object({
  timeframe: z.string().optional(),
  quality: z.string().optional(),
  decision: DecisionSchema.optional(),
  engine_version: z.string().optional(),
  dte_bucket: z.string().optional(),
  trade_type: z.string().optional(),
  regime_volatility: VolatilityRegimeSchema.optional(),
  from_date: z.number().optional(),
  to_date: z.number().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});
export type LedgerQueryFilters = z.infer<typeof LedgerQueryFiltersSchema>;
