/**
 * Greeks Calculator
 * Implements Black-Scholes approximation for options Greeks
 * 
 * Requirements: 5.7
 */

import { OptionContract, Greeks, DteBucket, getDteBucket } from '@/types/options';

/**
 * Standard normal cumulative distribution function (CDF)
 * Uses Abramowitz and Stegun approximation
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  
  return 0.5 * (1.0 + sign * y);
}

/**
 * Standard normal probability density function (PDF)
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Base IV estimates by DTE bucket
 * These are conservative estimates for SPY-like instruments
 */
const BASE_IV_BY_DTE: Readonly<Record<DteBucket, number>> = Object.freeze({
  '0DTE': 0.25,    // Higher IV for 0DTE
  'WEEKLY': 0.20,  // Standard weekly IV
  'MONTHLY': 0.18, // Lower IV for monthly
  'LEAP': 0.15,    // Lowest IV for LEAPS
});

/**
 * Estimate implied volatility based on contract characteristics
 * In production, this would come from market data
 * 
 * @param contract - Option contract
 * @param ivRank - IV rank from market context (0-100)
 * @returns Estimated implied volatility (decimal)
 */
export function estimateIV(contract: OptionContract, ivRank: number = 50): number {
  const dteBucket = getDteBucket(contract.dte);
  const baseIV = BASE_IV_BY_DTE[dteBucket];
  
  // Adjust IV based on IV rank (0-100)
  // IV rank of 50 = base IV, 100 = 1.5x base, 0 = 0.5x base
  const ivMultiplier = 0.5 + (ivRank / 100);
  
  return baseIV * ivMultiplier;
}

/**
 * Calculate d1 and d2 for Black-Scholes formula
 */
function calculateD1D2(
  S: number,  // Underlying price
  K: number,  // Strike price
  T: number,  // Time to expiry (years)
  r: number,  // Risk-free rate
  sigma: number // Volatility
): { d1: number; d2: number } {
  // Prevent division by zero for 0DTE
  const sqrtT = Math.max(Math.sqrt(T), 0.001);
  
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  
  return { d1, d2 };
}

/**
 * Calculate option Greeks using Black-Scholes model
 * 
 * @param contract - Option contract specification
 * @param underlyingPrice - Current price of underlying
 * @param ivRank - IV rank from market context (0-100), default 50
 * @param riskFreeRate - Risk-free interest rate, default 5%
 * @returns Greeks object with delta, gamma, theta, vega, iv
 */
export function calculateGreeks(
  contract: OptionContract,
  underlyingPrice: number,
  ivRank: number = 50,
  riskFreeRate: number = 0.05
): Greeks {
  const S = underlyingPrice;
  const K = contract.strike;
  const T = Math.max(contract.dte / 365, 0.001); // Time in years, min 0.001
  const r = riskFreeRate;
  const sigma = estimateIV(contract, ivRank);
  
  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma);
  const sqrtT = Math.sqrt(T);
  
  // Delta
  let delta: number;
  if (contract.type === 'CALL') {
    delta = normalCDF(d1);
  } else {
    delta = normalCDF(d1) - 1;
  }
  
  // Gamma (same for calls and puts)
  const gamma = normalPDF(d1) / (S * sigma * sqrtT);
  
  // Theta (per day, negative for long options)
  let theta: number;
  const thetaBase = -(S * normalPDF(d1) * sigma) / (2 * sqrtT);
  if (contract.type === 'CALL') {
    theta = (thetaBase - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365;
  } else {
    theta = (thetaBase + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  }
  
  // Vega (per 1% IV change)
  const vega = S * normalPDF(d1) * sqrtT / 100;
  
  return {
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(Math.max(0, gamma).toFixed(6)),
    theta: parseFloat(theta.toFixed(4)),
    vega: parseFloat(Math.max(0, vega).toFixed(4)),
    iv: parseFloat(sigma.toFixed(4)),
  };
}
