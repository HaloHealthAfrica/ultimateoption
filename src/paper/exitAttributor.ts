/**
 * Exit Attributor
 * Calculates P&L attribution when positions are closed
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { z } from 'zod';
import { Greeks, COMMISSION_PER_CONTRACT } from '../types/options';

// Exit reasons
export const ExitReasonSchema = z.enum([
  'TARGET_1',
  'TARGET_2',
  'STOP_LOSS',
  'THETA_DECAY',
  'MANUAL'
]);
export type ExitReason = z.infer<typeof ExitReasonSchema>;

// P&L Attribution breakdown
export const PnlAttributionSchema = z.object({
  delta_contribution: z.number(),
  iv_contribution: z.number(),
  theta_contribution: z.number(),
  gamma_contribution: z.number(),
});
export type PnlAttribution = z.infer<typeof PnlAttributionSchema>;

// Exit data for a closed position
export const ExitDataSchema = z.object({
  exit_time: z.string(),
  exit_price: z.number().positive(),
  exit_reason: ExitReasonSchema,
  pnl_gross: z.number(),
  pnl_net: z.number(),
  total_costs: z.number().nonnegative(),
  commission_cost: z.number().nonnegative(),
  spread_cost: z.number().nonnegative(),
  slippage_cost: z.number().nonnegative(),
  r_multiple: z.number(),
  hold_time_minutes: z.number().nonnegative(),
  attribution: PnlAttributionSchema,
});
export type ExitData = z.infer<typeof ExitDataSchema>;

// Entry data needed for attribution
export interface EntryData {
  entry_price: number;
  entry_time: string;
  contracts: number;
  filled_contracts: number;
  spread_cost: number;
  slippage: number;
  risk_amount: number;
  underlying_at_entry: number;
  entry_greeks: Greeks;
}

// Exit context for attribution calculation
export interface ExitContext {
  exit_price: number;
  exit_time: string;
  exit_reason: ExitReason;
  underlying_at_exit: number;
  exit_iv: number;
  exit_greeks: Greeks;
}

/**
 * Calculate P&L attribution for a closed position
 * Requirement 6.1: Calculate gross and net P&L
 * Requirement 6.2: Attribute P&L to delta, IV, theta, gamma
 * Requirement 6.3: Calculate total costs
 * Requirement 6.4: Calculate R-multiple
 * Requirement 6.5: Record exit reason
 */
export function calculateExitAttribution(
  entry: EntryData,
  exit: ExitContext
): ExitData {
  const contracts = entry.filled_contracts;
  const contractMultiplier = 100; // Standard options contract multiplier
  
  // Calculate gross P&L (price difference × contracts × multiplier)
  const priceDiff = exit.exit_price - entry.entry_price;
  const pnl_gross = priceDiff * contracts * contractMultiplier;
  
  // Calculate costs
  // Commission: entry + exit = 2 × contracts × $0.65
  const commission_cost = contracts * 2 * COMMISSION_PER_CONTRACT;
  
  // Spread cost at entry (already paid)
  const spread_cost = entry.spread_cost * contracts * contractMultiplier;
  
  // Slippage cost at entry (already paid)
  const slippage_cost = entry.slippage * contracts * contractMultiplier;
  
  // Total costs
  const total_costs = commission_cost + spread_cost + slippage_cost;
  
  // Net P&L
  const pnl_net = pnl_gross - total_costs;
  
  // Calculate R-multiple (Requirement 6.4)
  const r_multiple = entry.risk_amount > 0 ? pnl_net / entry.risk_amount : 0;
  
  // Calculate hold time in minutes
  const entryTime = new Date(entry.entry_time).getTime();
  const exitTime = new Date(exit.exit_time).getTime();
  const hold_time_minutes = Math.max(0, Math.floor((exitTime - entryTime) / (1000 * 60)));
  
  // Calculate P&L attribution (Requirement 6.2)
  const attribution = calculateAttribution(entry, exit, pnl_gross);
  
  return {
    exit_time: exit.exit_time,
    exit_price: exit.exit_price,
    exit_reason: exit.exit_reason,
    pnl_gross,
    pnl_net,
    total_costs,
    commission_cost,
    spread_cost,
    slippage_cost,
    r_multiple,
    hold_time_minutes,
    attribution,
  };
}

/**
 * Calculate P&L attribution to Greeks
 * Uses first-order approximations for each Greek's contribution
 * When raw calculations don't match gross P&L, we normalize proportionally
 * 
 * Note: This is an approximation. In reality, options P&L is driven by
 * complex interactions between Greeks. When Greeks are near-zero or
 * the model doesn't explain the P&L well, we attribute to delta (price movement)
 * as the primary driver.
 */
function calculateAttribution(
  entry: EntryData,
  exit: ExitContext,
  pnl_gross: number
): PnlAttribution {
  const contracts = entry.filled_contracts;
  const contractMultiplier = 100;
  
  // Underlying price change
  const underlyingChange = exit.underlying_at_exit - entry.underlying_at_entry;
  
  // IV change (in decimal form)
  const ivChange = exit.exit_iv - entry.entry_greeks.iv;
  
  // Delta contribution: delta × underlying change × contracts × multiplier
  const avgDelta = (entry.entry_greeks.delta + exit.exit_greeks.delta) / 2;
  const delta_raw = avgDelta * underlyingChange * contracts * contractMultiplier;
  
  // Gamma contribution: 0.5 × gamma × (underlying change)² × contracts × multiplier
  const avgGamma = (entry.entry_greeks.gamma + exit.exit_greeks.gamma) / 2;
  const gamma_raw = 0.5 * avgGamma * Math.pow(underlyingChange, 2) * contracts * contractMultiplier;
  
  // Vega contribution: vega × IV change × contracts × multiplier × 100 (per 1% IV)
  const avgVega = (entry.entry_greeks.vega + exit.exit_greeks.vega) / 2;
  const iv_raw = avgVega * ivChange * 100 * contracts * contractMultiplier;
  
  // Theta contribution: theta × days held × contracts × multiplier
  const daysHeld = (new Date(exit.exit_time).getTime() - new Date(entry.entry_time).getTime()) / (1000 * 60 * 60 * 24);
  const avgTheta = (entry.entry_greeks.theta + exit.exit_greeks.theta) / 2;
  const theta_raw = avgTheta * daysHeld * contracts * contractMultiplier;
  
  // Ensure all values are finite
  const safeValue = (v: number) => Number.isFinite(v) ? v : 0;
  const delta_safe = safeValue(delta_raw);
  const gamma_safe = safeValue(gamma_raw);
  const iv_safe = safeValue(iv_raw);
  const theta_safe = safeValue(theta_raw);
  
  const rawSum = delta_safe + gamma_safe + iv_safe + theta_safe;
  const absRawSum = Math.abs(delta_safe) + Math.abs(gamma_safe) + Math.abs(iv_safe) + Math.abs(theta_safe);
  const absPnl = Math.abs(pnl_gross);
  
  // If P&L is near zero, return zero attributions
  if (absPnl < 0.01) {
    return {
      delta_contribution: 0,
      gamma_contribution: 0,
      iv_contribution: 0,
      theta_contribution: 0,
    };
  }
  
  // If raw contributions are negligible compared to P&L, attribute all to delta
  // This handles cases where Greeks are near-zero but price moved significantly
  if (absRawSum < 0.01) {
    return {
      delta_contribution: pnl_gross,
      gamma_contribution: 0,
      iv_contribution: 0,
      theta_contribution: 0,
    };
  }
  
  // Calculate how well the raw sum explains the P&L
  const explanationRatio = Math.abs(rawSum) / absPnl;
  
  // If raw sum explains P&L reasonably well (within 10x), scale proportionally
  if (explanationRatio > 0.1 && explanationRatio < 10) {
    const scale = pnl_gross / rawSum;
    if (Number.isFinite(scale)) {
      return {
        delta_contribution: delta_safe * scale,
        gamma_contribution: gamma_safe * scale,
        iv_contribution: iv_safe * scale,
        theta_contribution: theta_safe * scale,
      };
    }
  }
  
  // Otherwise, distribute P&L proportionally to absolute contributions
  // This ensures attributions always sum to gross P&L
  const delta_pct = Math.abs(delta_safe) / absRawSum;
  const gamma_pct = Math.abs(gamma_safe) / absRawSum;
  const iv_pct = Math.abs(iv_safe) / absRawSum;
  const theta_pct = Math.abs(theta_safe) / absRawSum;
  
  // For proportional distribution, we need to ensure the sum equals pnl_gross
  // We'll distribute based on absolute percentages and adjust signs
  // to make the sum work out correctly
  
  // Simple approach: distribute proportionally, all with same sign as P&L
  return {
    delta_contribution: delta_pct * pnl_gross,
    gamma_contribution: gamma_pct * pnl_gross,
    iv_contribution: iv_pct * pnl_gross,
    theta_contribution: theta_pct * pnl_gross,
  };
}

/**
 * Determine exit reason based on price action
 */
export function determineExitReason(
  exitPrice: number,
  entryPrice: number,
  stopLoss: number,
  target1: number,
  target2: number,
  isLong: boolean,
  thetaDecayThreshold: number = 0.5 // 50% of premium lost to theta
): ExitReason {
  if (isLong) {
    // For CALL options (long underlying)
    if (exitPrice >= target2) return 'TARGET_2';
    if (exitPrice >= target1) return 'TARGET_1';
    if (exitPrice <= stopLoss) return 'STOP_LOSS';
  } else {
    // For PUT options (short underlying)
    if (exitPrice <= target2) return 'TARGET_2';
    if (exitPrice <= target1) return 'TARGET_1';
    if (exitPrice >= stopLoss) return 'STOP_LOSS';
  }
  
  // Check for theta decay exit
  const priceLoss = entryPrice - exitPrice;
  if (priceLoss > 0 && priceLoss / entryPrice >= thetaDecayThreshold) {
    return 'THETA_DECAY';
  }
  
  return 'MANUAL';
}
