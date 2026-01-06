/**
 * Signal Validity Calculator
 * Calculates how long a signal remains valid based on timeframe, quality, and session
 * 
 * Formula: validity = base_tf × role_mult × quality_mult × session_mult
 * Bounds: [base_tf, 720 minutes]
 * 
 * Requirements: 1.6, 1.8, 1.9, 1.10, 1.11
 */

import { EnrichedSignal, Timeframe, SignalQuality, MarketSession } from '@/types/signal';

/**
 * Timeframe role multipliers
 * Higher timeframes (4H, 1H) have longer validity as they represent stronger signals
 */
export const TIMEFRAME_ROLE_MULTIPLIERS: Readonly<Record<Timeframe, number>> = Object.freeze({
  '240': 2.0,  // 4H - regime level, longest validity
  '60': 1.5,   // 1H - bias level
  '30': 1.0,   // 30M - setup level
  '15': 1.0,   // 15M - setup level
  '5': 1.0,    // 5M - entry level
  '3': 1.0,    // 3M - scalp level
});

/**
 * Quality multipliers
 * Higher quality signals stay valid longer
 */
export const QUALITY_MULTIPLIERS: Readonly<Record<SignalQuality, number>> = Object.freeze({
  'EXTREME': 1.5,  // Highest quality, longest validity
  'HIGH': 1.0,     // Standard validity
  'MEDIUM': 0.75,  // Reduced validity
});

/**
 * Session multipliers
 * Signals during volatile sessions expire faster
 */
export const SESSION_MULTIPLIERS: Readonly<Record<MarketSession, number>> = Object.freeze({
  'OPEN': 0.8,        // Market open is volatile, signals expire faster
  'MIDDAY': 1.0,      // Standard validity
  'POWER_HOUR': 0.7,  // Power hour is volatile
  'AFTERHOURS': 0.5,  // After hours has low liquidity, signals less reliable
});

/**
 * Maximum validity in minutes (12 hours)
 */
export const MAX_VALIDITY_MINUTES = 720;

/**
 * Calculate signal validity period in milliseconds
 * 
 * @param signal - The EnrichedSignal to calculate validity for
 * @returns Validity period in milliseconds
 */
export function calculateSignalValidity(signal: EnrichedSignal): number {
  const validityMinutes = calculateSignalValidityMinutes(signal);
  return validityMinutes * 60 * 1000; // Convert to milliseconds
}

/**
 * Calculate signal validity period in minutes
 * 
 * @param signal - The EnrichedSignal to calculate validity for
 * @returns Validity period in minutes
 */
export function calculateSignalValidityMinutes(signal: EnrichedSignal): number {
  const timeframe = signal.signal.timeframe;
  const quality = signal.signal.quality;
  const session = signal.time_context.market_session;
  
  // Base validity = timeframe duration in minutes
  const baseTf = parseInt(timeframe, 10);
  
  // Apply multipliers
  const roleMultiplier = TIMEFRAME_ROLE_MULTIPLIERS[timeframe];
  const qualityMultiplier = QUALITY_MULTIPLIERS[quality];
  const sessionMultiplier = SESSION_MULTIPLIERS[session];
  
  // Calculate raw validity
  let validityMinutes = baseTf * roleMultiplier * qualityMultiplier * sessionMultiplier;
  
  // Enforce bounds: [base_tf, 720 minutes]
  validityMinutes = Math.max(validityMinutes, baseTf);
  validityMinutes = Math.min(validityMinutes, MAX_VALIDITY_MINUTES);
  
  return validityMinutes;
}

/**
 * Calculate expiry timestamp for a signal
 * 
 * @param signal - The EnrichedSignal
 * @param receivedAt - Timestamp when signal was received (defaults to now)
 * @returns Expiry timestamp in milliseconds
 */
export function calculateExpiryTime(signal: EnrichedSignal, receivedAt: number = Date.now()): number {
  const validityMs = calculateSignalValidity(signal);
  return receivedAt + validityMs;
}

/**
 * Check if a signal has expired
 * 
 * @param expiresAt - Expiry timestamp in milliseconds
 * @param now - Current timestamp (defaults to Date.now())
 * @returns true if signal has expired
 */
export function isSignalExpired(expiresAt: number, now: number = Date.now()): boolean {
  return now >= expiresAt;
}

/**
 * Get remaining validity time in milliseconds
 * 
 * @param expiresAt - Expiry timestamp in milliseconds
 * @param now - Current timestamp (defaults to Date.now())
 * @returns Remaining time in milliseconds (0 if expired)
 */
export function getRemainingValidity(expiresAt: number, now: number = Date.now()): number {
  return Math.max(0, expiresAt - now);
}

/**
 * Breakdown of validity calculation for debugging/display
 */
export interface ValidityBreakdown {
  base_tf_minutes: number;
  role_multiplier: number;
  quality_multiplier: number;
  session_multiplier: number;
  raw_validity_minutes: number;
  final_validity_minutes: number;
  clamped: boolean;
  clamp_reason?: 'min' | 'max';
}

/**
 * Alias for calculateSignalValidity for backward compatibility
 */
export const calculateValidity = calculateSignalValidity;

/**
 * Get detailed breakdown of validity calculation
 * 
 * @param signal - The EnrichedSignal
 * @returns Breakdown of all factors in the calculation
 */
export function getValidityBreakdown(signal: EnrichedSignal): ValidityBreakdown {
  const timeframe = signal.signal.timeframe;
  const quality = signal.signal.quality;
  const session = signal.time_context.market_session;
  
  const baseTf = parseInt(timeframe, 10);
  const roleMultiplier = TIMEFRAME_ROLE_MULTIPLIERS[timeframe];
  const qualityMultiplier = QUALITY_MULTIPLIERS[quality];
  const sessionMultiplier = SESSION_MULTIPLIERS[session];
  
  const rawValidity = baseTf * roleMultiplier * qualityMultiplier * sessionMultiplier;
  
  let finalValidity = rawValidity;
  let clamped = false;
  let clampReason: 'min' | 'max' | undefined;
  
  if (rawValidity < baseTf) {
    finalValidity = baseTf;
    clamped = true;
    clampReason = 'min';
  } else if (rawValidity > MAX_VALIDITY_MINUTES) {
    finalValidity = MAX_VALIDITY_MINUTES;
    clamped = true;
    clampReason = 'max';
  }
  
  return {
    base_tf_minutes: baseTf,
    role_multiplier: roleMultiplier,
    quality_multiplier: qualityMultiplier,
    session_multiplier: sessionMultiplier,
    raw_validity_minutes: rawValidity,
    final_validity_minutes: finalValidity,
    clamped,
    clamp_reason: clampReason,
  };
}
