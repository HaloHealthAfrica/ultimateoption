/**
 * Options Types
 * Types for options contracts, Greeks, and execution
 * 
 * Requirements: 5.7
 */

import { z } from 'zod';

// Option type
export const OptionTypeSchema = z.enum(['CALL', 'PUT']);
export type OptionType = z.infer<typeof OptionTypeSchema>;

// Fill quality
export const FillQualitySchema = z.enum(['FULL', 'PARTIAL']);
export type FillQuality = z.infer<typeof FillQualitySchema>;

// Option contract
export const OptionContractSchema = z.object({
  type: OptionTypeSchema,
  strike: z.number().positive(),
  expiry: z.string(), // YYYY-MM-DD format
  dte: z.number().int().nonnegative(),
});
export type OptionContract = z.infer<typeof OptionContractSchema>;

// Greeks
export const GreeksSchema = z.object({
  delta: z.number().min(-1).max(1),
  gamma: z.number().nonnegative(),
  theta: z.number(), // Usually negative for long options
  vega: z.number().nonnegative(),
  iv: z.number().positive(), // Implied volatility
});
export type Greeks = z.infer<typeof GreeksSchema>;

// Fill simulation result
export const FillSchema = z.object({
  price: z.number().positive(),
  contracts: z.number().int().positive(),
  filled_contracts: z.number().int().positive(),
  spread_cost: z.number().nonnegative(),
  slippage: z.number().nonnegative(),
  fill_quality: FillQualitySchema,
  commission: z.number().nonnegative(),
});
export type Fill = z.infer<typeof FillSchema>;

// Full execution record
export const ExecutionSchema = z.object({
  option_type: OptionTypeSchema,
  strike: z.number().positive(),
  expiry: z.string(),
  dte: z.number().int().nonnegative(),
  contracts: z.number().int().positive(),
  entry_price: z.number().positive(),
  entry_iv: z.number().positive(),
  entry_delta: z.number().min(-1).max(1),
  entry_theta: z.number(),
  entry_gamma: z.number().nonnegative(),
  entry_vega: z.number().nonnegative(),
  spread_cost: z.number().nonnegative(),
  slippage: z.number().nonnegative(),
  fill_quality: FillQualitySchema,
  filled_contracts: z.number().int().positive(),
  commission: z.number().nonnegative(),
  underlying_at_entry: z.number().positive(),
  risk_amount: z.number().positive(),
});
export type Execution = z.infer<typeof ExecutionSchema>;

// DTE bucket for categorization
export const DteBucketSchema = z.enum(['0DTE', 'WEEKLY', 'MONTHLY', 'LEAP']);
export type DteBucket = z.infer<typeof DteBucketSchema>;

/**
 * Get DTE bucket from DTE value
 */
export function getDteBucket(dte: number): DteBucket {
  if (dte === 0) return '0DTE';
  if (dte <= 7) return 'WEEKLY';
  if (dte <= 45) return 'MONTHLY';
  return 'LEAP';
}

/**
 * Commission per contract (industry standard)
 */
export const COMMISSION_PER_CONTRACT = 0.65;

/**
 * Spread percentages by DTE bucket [min, max]
 */
export const SPREAD_PERCENTAGES: Readonly<Record<DteBucket, readonly [number, number]>> = Object.freeze({
  '0DTE': [0.03, 0.05] as const,    // 3-5%
  'WEEKLY': [0.02, 0.03] as const,  // 2-3%
  'MONTHLY': [0.01, 0.02] as const, // 1-2%
  'LEAP': [0.005, 0.01] as const,   // 0.5-1%
});
