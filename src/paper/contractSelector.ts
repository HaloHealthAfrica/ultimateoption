/**
 * Option Contract Selector
 * Selects appropriate option contracts based on signal direction and timeframe
 * 
 * Requirements: 5.1, 5.2
 */

import { EnrichedSignal } from '@/types/signal';
import { DecisionResult } from '@/types/decision';
import { OptionContract, OptionType, getDteBucket } from '@/types/options';

/**
 * DTE selection rules by timeframe
 * - Scalp (3M, 5M): 0DTE
 * - Day (15M, 30M, 60M): Weekly (next Friday)
 * - Swing (240M): Monthly (30-45 DTE)
 */
const DTE_BY_TIMEFRAME: Readonly<Record<number, () => number>> = Object.freeze({
  3: () => 0,   // 0DTE for scalps
  5: () => 0,   // 0DTE for scalps
  15: () => getNextFridayDTE(), // Weekly
  30: () => getNextFridayDTE(), // Weekly
  60: () => getNextFridayDTE(), // Weekly
  240: () => getMonthlyDTE(),   // Monthly (30-45 DTE)
});

/**
 * Calculate days until next Friday
 */
export function getNextFridayDTE(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
  
  // If today is Friday and before market close, return 0
  if (dayOfWeek === 5) {
    return 0;
  }
  
  // Calculate days until Friday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  return daysUntilFriday === 0 ? 7 : daysUntilFriday;
}

/**
 * Calculate monthly DTE (30-45 days out)
 * Uses deterministic calculation based on current date
 */
export function getMonthlyDTE(): number {
  const now = new Date();
  const dayOfMonth = now.getDate();
  
  // Base of 30 days, add 0-15 based on day of month for variety
  const offset = Math.floor((dayOfMonth % 16));
  return 30 + offset;
}

/**
 * Select option type based on signal direction
 * LONG signal → CALL option
 * SHORT signal → PUT option
 * 
 * @param direction - Signal direction (LONG or SHORT)
 * @returns Option type (CALL or PUT)
 */
export function selectOptionType(direction: 'LONG' | 'SHORT'): OptionType {
  return direction === 'LONG' ? 'CALL' : 'PUT';
}

/**
 * Select DTE based on signal timeframe
 * 
 * @param timeframeValue - Timeframe in minutes (3, 5, 15, 30, 60, 240)
 * @returns Days to expiration
 */
export function selectDTE(timeframeValue: number): number {
  const dteSelector = DTE_BY_TIMEFRAME[timeframeValue];
  if (dteSelector) {
    return dteSelector();
  }
  
  // Default fallback based on timeframe size
  if (timeframeValue <= 5) return 0;
  if (timeframeValue <= 60) return getNextFridayDTE();
  return getMonthlyDTE();
}

/**
 * Calculate strike price based on underlying price and option type
 * Uses ATM (at-the-money) strikes rounded to nearest standard increment
 * 
 * @param underlyingPrice - Current price of underlying
 * @param _optionType - CALL or PUT (reserved for future OTM/ITM selection)
 * @returns Strike price rounded to standard increment
 */
export function selectStrike(underlyingPrice: number, _optionType: OptionType): number {
  // Determine strike increment based on price level
  let increment: number;
  if (underlyingPrice < 50) {
    increment = 0.5;
  } else if (underlyingPrice < 200) {
    increment = 1;
  } else if (underlyingPrice < 500) {
    increment = 5;
  } else {
    increment = 10;
  }
  
  // Round to nearest increment (ATM)
  return Math.round(underlyingPrice / increment) * increment;
}

/**
 * Calculate expiry date string from DTE
 * 
 * @param dte - Days to expiration
 * @returns Expiry date in YYYY-MM-DD format
 */
export function calculateExpiryDate(dte: number): string {
  const now = new Date();
  const expiry = new Date(now.getTime() + dte * 24 * 60 * 60 * 1000);
  return expiry.toISOString().split('T')[0];
}

/**
 * Select complete option contract based on signal and decision
 * 
 * @param signal - The enriched signal
 * @param _decision - The decision result (reserved for future position sizing)
 * @returns Complete option contract specification
 */
export function selectContract(
  signal: EnrichedSignal,
  _decision: DecisionResult
): OptionContract {
  const direction = signal.signal.type;
  const timeframeValue = parseInt(signal.signal.timeframe, 10);
  const underlyingPrice = signal.entry.price;
  
  const optionType = selectOptionType(direction);
  const dte = selectDTE(timeframeValue);
  const strike = selectStrike(underlyingPrice, optionType);
  const expiry = calculateExpiryDate(dte);
  
  return {
    type: optionType,
    strike,
    expiry,
    dte,
  };
}

/**
 * Get DTE bucket for a contract
 * Re-exported for convenience
 */
export { getDteBucket };
