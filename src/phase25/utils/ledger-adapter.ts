/**
 * Ledger Adapter for Phase 2.5
 * 
 * Converts Phase 2.5 decision packets to ledger entry format.
 * 
 * REFACTORED:
 * - Extracted utility functions for clarity
 * - Removed hardcoded values (timeframe, day_of_week, market_session)
 * - Uses LEDGER_DEFAULTS from constants
 * - Builder functions for complex objects
 */

import { DecisionPacket } from '../types';
import { LedgerEntryCreate } from '@/types/ledger';
import { EnrichedSignal } from '@/types/signal';
import type { Execution } from '@/types/options';
import { RISK_THRESHOLDS } from '../config/trading-rules.config';
import { LEDGER_DEFAULTS } from '../config/constants';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Ensure positive numbers with reasonable fallbacks
 */
function safePositive(value: number | undefined, fallback: number): number {
  if (typeof value === 'number' && value > 0) return value;
  return fallback;
}

/**
 * Get day of week from timestamp (trading days only)
 */
function getDayOfWeek(timestamp: number): 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' {
  const days: ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY')[] = 
    ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  const dayIndex = new Date(timestamp).getDay(); // 0 = Sunday, 6 = Saturday
  
  // Map Sunday (0) and Saturday (6) to Monday (default for weekends)
  if (dayIndex === 0 || dayIndex === 6) return 'MONDAY';
  
  // Map 1-5 to Monday-Friday
  return days[dayIndex - 1];
}

/**
 * Map alignment bias to trade direction
 */
function mapBiasToDirection(bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | undefined): 'LONG' | 'SHORT' {
  if (bias === 'BULLISH') return 'LONG';
  if (bias === 'BEARISH') return 'SHORT';
  return 'LONG'; // Default to LONG for NEUTRAL or undefined
}

/**
 * Determine market session from timestamp (Eastern Time)
 */
function getMarketSession(timestamp: number): 'OPEN' | 'MIDDAY' | 'POWER_HOUR' | 'AFTERHOURS' {
  const date = new Date(timestamp);
  const hour = date.getUTCHours() - 5; // Convert to EST (simplified)
  const minute = date.getUTCMinutes();
  const day = date.getUTCDay();
  
  // Weekend or outside trading hours
  if (day === 0 || day === 6 || hour < 4 || hour >= 20) {
    return 'AFTERHOURS';
  }
  
  // Premarket (4:00 AM - 9:30 AM)
  if (hour < 9 || (hour === 9 && minute < 30)) {
    return 'AFTERHOURS'; // Map premarket to afterhours
  }
  
  // Market open (9:30 AM - 12:00 PM)
  if (hour < 12) {
    return 'OPEN';
  }
  
  // Midday (12:00 PM - 3:00 PM)
  if (hour < 15) {
    return 'MIDDAY';
  }
  
  // Power hour (3:00 PM - 4:00 PM)
  if (hour < 16) {
    return 'POWER_HOUR';
  }
  
  // After hours (4:00 PM - 8:00 PM)
  return 'AFTERHOURS';
}

// =============================================================================
// BUILDER FUNCTIONS
// =============================================================================

/**
 * Build enriched signal from decision packet
 */
function buildEnrichedSignal(
  decision: DecisionPacket,
  currentPrice: number,
  atr: number,
  recommendedContracts: number
): EnrichedSignal {
  const { inputContext, marketSnapshot, timestamp, finalSizeMultiplier } = decision;
  
  // Calculate stop/target prices
  const stopLoss = currentPrice * (1 - RISK_THRESHOLDS.STOP_LOSS_PCT);
  const target1 = currentPrice * (1 + RISK_THRESHOLDS.TARGET_1_PCT);
  const target2 = currentPrice * (1 + RISK_THRESHOLDS.TARGET_2_PCT);
  
  return {
    signal: {
      type: inputContext.expert?.direction || 'LONG',
      timeframe: LEDGER_DEFAULTS.timeframe, // Use default - timeframe not in DecisionContext
      quality: inputContext.expert?.quality || 'MEDIUM',
      ai_score: inputContext.expert?.aiScore || 0,
      timestamp,
      bar_time: new Date(timestamp).toISOString(),
    },
    instrument: {
      exchange: inputContext.instrument.exchange || LEDGER_DEFAULTS.exchange,
      ticker: inputContext.instrument.symbol,
      current_price: currentPrice,
    },
    entry: {
      price: currentPrice,
      stop_loss: stopLoss,
      target_1: target1,
      target_2: target2,
      stop_reason: LEDGER_DEFAULTS.stopReason,
    },
    risk: {
      amount: 0,
      rr_ratio_t1: inputContext.expert?.rr1 || RISK_THRESHOLDS.MIN_RR_RATIO_T1,
      rr_ratio_t2: inputContext.expert?.rr2 || RISK_THRESHOLDS.MIN_RR_RATIO_T2,
      stop_distance_pct: RISK_THRESHOLDS.STOP_LOSS_PCT * 100,
      recommended_shares: 0,
      recommended_contracts: recommendedContracts,
      position_multiplier: finalSizeMultiplier,
      account_risk_pct: 0,
      max_loss_dollars: 0,
    },
    market_context: {
      vwap: currentPrice,
      pmh: currentPrice * 1.01,
      pml: currentPrice * 0.99,
      day_open: currentPrice,
      day_change_pct: 0,
      price_vs_vwap_pct: 0,
      distance_to_pmh_pct: 1,
      distance_to_pml_pct: 1,
      atr,
      volume_vs_avg: marketSnapshot?.stats?.volumeRatio || 1,
      candle_direction: 'GREEN',
      candle_size_atr: 0,
    },
    trend: {
      ema_8: currentPrice,
      ema_21: currentPrice,
      ema_50: currentPrice,
      alignment: 'NEUTRAL',
      strength: 50,
      rsi: marketSnapshot?.stats?.rsi || 50,
      macd_signal: 'BULLISH',
    },
    mtf_context: {
      '4h_bias': mapBiasToDirection(inputContext.alignment?.tfStates?.['4h']),
      '4h_rsi': 50, // RSI not available in alignment data
      '1h_bias': mapBiasToDirection(inputContext.alignment?.tfStates?.['1h']),
    },
    score_breakdown: {
      strat: 0,
      trend: 0,
      gamma: 0,
      vwap: 0,
      mtf: 0,
      golf: 0,
    },
    components: [],
    time_context: {
      market_session: getMarketSession(timestamp),
      day_of_week: getDayOfWeek(timestamp),
    },
  };
}

/**
 * Build decision breakdown from decision packet
 */
function buildDecisionBreakdown(decision: DecisionPacket) {
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
    final_multiplier: decision.finalSizeMultiplier,
  };
}

/**
 * Build regime snapshot from decision packet
 */
function buildRegimeSnapshot(decision: DecisionPacket) {
  return {
    volatility: decision.inputContext.regime?.volatility || 'NORMAL',
    trend: 'NEUTRAL' as const,
    liquidity: 'NORMAL' as const,
    iv_rank: decision.marketSnapshot?.options?.ivPercentile || 50,
  };
}

// =============================================================================
// MAIN CONVERSION FUNCTION
// =============================================================================

/**
 * Convert Phase 2.5 decision to ledger entry
 */
export function convertDecisionToLedgerEntry(decision: DecisionPacket): LedgerEntryCreate {
  const symbol = decision.inputContext.instrument.symbol;
  const rawPrice = decision.inputContext.instrument.price;
  const currentPrice = safePositive(rawPrice, 100);
  
  // Log warning if using fallback price
  if (!rawPrice || rawPrice <= 0) {
    console.warn(`Using fallback price for ${symbol}: instrument.price was ${rawPrice}`);
  }
  
  // Get ATR with reasonable fallback (2% of price)
  const atr = safePositive(decision.marketSnapshot?.stats?.atr14, currentPrice * 0.02);
  
  // Build components
  const signal = buildEnrichedSignal(decision, currentPrice, atr, 0);
  const decisionBreakdown = buildDecisionBreakdown(decision);
  const regime = buildRegimeSnapshot(decision);
  
  // Map decision action to ledger decision type
  const ledgerDecision = decision.action === 'EXECUTE' ? 'EXECUTE' :
                        decision.action === 'WAIT' ? 'WAIT' : 'SKIP';
  
  const entry: LedgerEntryCreate = {
    created_at: decision.timestamp,
    engine_version: decision.engineVersion,
    signal,
    decision: ledgerDecision,
    decision_reason: decision.reasons.join('; ') || `${decision.action} decision`,
    decision_breakdown: decisionBreakdown,
    confluence_score: decision.confidenceScore,
    regime,
    gate_results: decision.gateResults,
  };
  
  return entry;
}

export function buildEnrichedSignalFromDecision(
  decision: DecisionPacket,
  recommendedContracts: number
): EnrichedSignal {
  const symbol = decision.inputContext.instrument.symbol;
  const rawPrice = decision.inputContext.instrument.price;
  const currentPrice = safePositive(rawPrice, 100);

  if (!rawPrice || rawPrice <= 0) {
    console.warn(`Using fallback price for ${symbol}: instrument.price was ${rawPrice}`);
  }

  const atr = safePositive(decision.marketSnapshot?.stats?.atr14, currentPrice * 0.02);
  return buildEnrichedSignal(decision, currentPrice, atr, recommendedContracts);
}

export function convertDecisionToLedgerEntryWithExecution(
  decision: DecisionPacket,
  execution: Execution | undefined,
  recommendedContracts: number
): LedgerEntryCreate {
  const entry = convertDecisionToLedgerEntry(decision);
  if (execution) {
    entry.execution = execution;
  }
  if (recommendedContracts > 0) {
    entry.signal.risk.recommended_contracts = recommendedContracts;
  }
  return entry;
}
