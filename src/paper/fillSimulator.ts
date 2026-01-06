/**
 * Fill Simulator
 * Simulates realistic option fills with spreads, slippage, and partial fills
 * 
 * Requirements: 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 5.10
 */

import { OptionContract, Fill, FillQuality, getDteBucket, SPREAD_PERCENTAGES, COMMISSION_PER_CONTRACT } from '@/types/options';
import { Greeks } from '@/types/options';

/**
 * Slippage range [min, max] as percentage
 */
const SLIPPAGE_RANGE: readonly [number, number] = [0.005, 0.02] as const; // 0.5% - 2%

/**
 * Threshold for partial fills
 */
const PARTIAL_FILL_THRESHOLD = 50;

/**
 * Partial fill percentage (approximately 85%)
 */
const PARTIAL_FILL_PERCENTAGE = 0.85;

/**
 * Calculate theoretical option price using simplified model
 * In production, this would come from market data
 * 
 * @param contract - Option contract
 * @param underlyingPrice - Current underlying price
 * @param greeks - Calculated Greeks
 * @returns Theoretical mid price
 */
export function calculateTheoreticalPrice(
  contract: OptionContract,
  underlyingPrice: number,
  greeks: Greeks
): number {
  // Simplified intrinsic + time value model
  let intrinsic: number;
  if (contract.type === 'CALL') {
    intrinsic = Math.max(0, underlyingPrice - contract.strike);
  } else {
    intrinsic = Math.max(0, contract.strike - underlyingPrice);
  }
  
  // Time value based on vega and IV
  const timeValue = greeks.vega * greeks.iv * 100;
  
  // Minimum price floor
  const minPrice = 0.01;
  
  return Math.max(minPrice, intrinsic + timeValue);
}

/**
 * Calculate bid/ask spread based on DTE
 * 
 * @param theoreticalPrice - Mid price
 * @param dte - Days to expiration
 * @returns Object with bid and ask prices
 */
export function calculateBidAsk(
  theoreticalPrice: number,
  dte: number
): { bid: number; ask: number; spreadPercent: number } {
  const dteBucket = getDteBucket(dte);
  const [minSpread, maxSpread] = SPREAD_PERCENTAGES[dteBucket];
  
  // Use midpoint of spread range for determinism
  const spreadPercent = (minSpread + maxSpread) / 2;
  const halfSpread = theoreticalPrice * spreadPercent / 2;
  
  return {
    bid: Math.max(0.01, theoreticalPrice - halfSpread),
    ask: theoreticalPrice + halfSpread,
    spreadPercent,
  };
}

/**
 * Calculate slippage for an order
 * Larger orders have more slippage
 * 
 * @param contracts - Number of contracts
 * @param basePrice - Base price before slippage
 * @returns Slippage amount
 */
export function calculateSlippage(
  contracts: number,
  basePrice: number
): number {
  const [minSlip, maxSlip] = SLIPPAGE_RANGE;
  
  // Scale slippage with order size
  // 1 contract = min slippage, 100+ contracts = max slippage
  const sizeMultiplier = Math.min(1, contracts / 100);
  const slippagePercent = minSlip + (maxSlip - minSlip) * sizeMultiplier;
  
  return basePrice * slippagePercent;
}

/**
 * Determine if order will be partially filled
 * Orders over 50 contracts may be partially filled
 * 
 * @param contracts - Requested number of contracts
 * @returns Object with fill quality and filled contracts
 */
export function determineFillQuality(
  contracts: number
): { fillQuality: FillQuality; filledContracts: number } {
  if (contracts <= PARTIAL_FILL_THRESHOLD) {
    return {
      fillQuality: 'FULL',
      filledContracts: contracts,
    };
  }
  
  // Partial fill for large orders (approximately 85%)
  const filledContracts = Math.round(contracts * PARTIAL_FILL_PERCENTAGE);
  
  return {
    fillQuality: 'PARTIAL',
    filledContracts: Math.max(1, filledContracts),
  };
}

/**
 * Calculate commission for an order
 * 
 * @param contracts - Number of contracts filled
 * @returns Total commission
 */
export function calculateCommission(contracts: number): number {
  return contracts * COMMISSION_PER_CONTRACT;
}

/**
 * Simulate a complete fill for an option order
 * Uses conservative pricing (buy at ask + slippage)
 * 
 * @param contract - Option contract
 * @param contracts - Number of contracts requested
 * @param underlyingPrice - Current underlying price
 * @param greeks - Calculated Greeks
 * @returns Complete fill simulation result
 */
export function simulateFill(
  contract: OptionContract,
  contracts: number,
  underlyingPrice: number,
  greeks: Greeks
): Fill {
  // Calculate theoretical price
  const theoreticalPrice = calculateTheoreticalPrice(contract, underlyingPrice, greeks);
  
  // Calculate bid/ask spread
  const { ask, spreadPercent } = calculateBidAsk(theoreticalPrice, contract.dte);
  
  // Calculate slippage (added to ask for buys)
  const slippage = calculateSlippage(contracts, ask);
  
  // Final fill price (conservative: ask + slippage)
  const fillPrice = ask + slippage;
  
  // Determine fill quality
  const { fillQuality, filledContracts } = determineFillQuality(contracts);
  
  // Calculate costs
  const spreadCost = theoreticalPrice * spreadPercent * filledContracts * 100; // Per contract = 100 shares
  const commission = calculateCommission(filledContracts);
  
  return {
    price: parseFloat(fillPrice.toFixed(2)),
    contracts,
    filled_contracts: filledContracts,
    spread_cost: parseFloat(spreadCost.toFixed(2)),
    slippage: parseFloat((slippage * filledContracts * 100).toFixed(2)),
    fill_quality: fillQuality,
    commission: parseFloat(commission.toFixed(2)),
  };
}

/**
 * Simulate exit fill (selling position)
 * Uses conservative pricing (sell at bid - slippage)
 * 
 * @param contract - Option contract
 * @param contracts - Number of contracts to sell
 * @param underlyingPrice - Current underlying price
 * @param greeks - Current Greeks
 * @returns Exit fill price
 */
export function simulateExitFill(
  contract: OptionContract,
  contracts: number,
  underlyingPrice: number,
  greeks: Greeks
): { exitPrice: number; slippage: number; commission: number } {
  const theoreticalPrice = calculateTheoreticalPrice(contract, underlyingPrice, greeks);
  const { bid } = calculateBidAsk(theoreticalPrice, contract.dte);
  const slippage = calculateSlippage(contracts, bid);
  
  // Conservative exit: bid - slippage
  const exitPrice = Math.max(0.01, bid - slippage);
  const commission = calculateCommission(contracts);
  
  return {
    exitPrice: parseFloat(exitPrice.toFixed(2)),
    slippage: parseFloat((slippage * contracts * 100).toFixed(2)),
    commission: parseFloat(commission.toFixed(2)),
  };
}
