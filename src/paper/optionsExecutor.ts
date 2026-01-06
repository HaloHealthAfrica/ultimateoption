/**
 * Paper Options Executor
 * Orchestrates contract selection, Greeks calculation, and fill simulation
 * 
 * Requirements: 5.1-5.11
 */

import { EnrichedSignal } from '@/types/signal';
import { DecisionResult } from '@/types/decision';
import { Execution, OptionContract, Greeks } from '@/types/options';
import { selectContract } from './contractSelector';
import { calculateGreeks } from './greeksCalculator';
import { simulateFill } from './fillSimulator';

/**
 * Execute a paper trade based on signal and decision
 * Combines contract selection, Greeks calculation, and fill simulation
 * 
 * @param signal - The enriched signal triggering the trade
 * @param decision - The decision result with recommended contracts
 * @returns Complete execution record
 */
export function executePaperTrade(
  signal: EnrichedSignal,
  decision: DecisionResult
): Execution {
  // 1. Select option contract
  const contract = selectContract(signal, decision);
  
  // 2. Get underlying price and IV rank from signal
  const underlyingPrice = signal.entry.price;
  // IV rank not in signal, use a default moderate value
  const ivRank = 0.5;
  
  // 3. Calculate Greeks
  const greeks = calculateGreeks(contract, underlyingPrice, ivRank);
  
  // 4. Simulate fill
  const fill = simulateFill(
    contract,
    decision.recommended_contracts,
    underlyingPrice,
    greeks
  );
  
  // 5. Calculate risk amount (max loss = entry price * contracts * 100)
  const riskAmount = fill.price * fill.filled_contracts * 100;
  
  // 6. Build execution record
  return {
    option_type: contract.type,
    strike: contract.strike,
    expiry: contract.expiry,
    dte: contract.dte,
    contracts: decision.recommended_contracts,
    entry_price: fill.price,
    entry_iv: greeks.iv,
    entry_delta: greeks.delta,
    entry_theta: greeks.theta,
    entry_gamma: greeks.gamma,
    entry_vega: greeks.vega,
    spread_cost: fill.spread_cost,
    slippage: fill.slippage,
    fill_quality: fill.fill_quality,
    filled_contracts: fill.filled_contracts,
    commission: fill.commission,
    underlying_at_entry: underlyingPrice,
    risk_amount: parseFloat(riskAmount.toFixed(2)),
  };
}

/**
 * Validate that a decision can be executed
 * 
 * @param decision - The decision result
 * @returns True if decision is EXECUTE with valid parameters
 */
export function canExecute(decision: DecisionResult): boolean {
  return (
    decision.decision === 'EXECUTE' &&
    decision.recommended_contracts > 0 &&
    decision.entry_signal !== null
  );
}

/**
 * Get contract details for a signal without executing
 * Useful for preview/display purposes
 * 
 * @param signal - The enriched signal
 * @param decision - The decision result
 * @returns Contract and Greeks preview
 */
export function previewExecution(
  signal: EnrichedSignal,
  decision: DecisionResult
): { contract: OptionContract; greeks: Greeks } {
  const contract = selectContract(signal, decision);
  const underlyingPrice = signal.entry.price;
  // IV rank not in signal, use a default moderate value
  const ivRank = 0.5;
  const greeks = calculateGreeks(contract, underlyingPrice, ivRank);
  
  return { contract, greeks };
}

// Re-export components for convenience
export { selectContract } from './contractSelector';
export { calculateGreeks } from './greeksCalculator';
export { simulateFill, simulateExitFill } from './fillSimulator';
