/**
 * Ledger Adapter for Phase 2.5
 * 
 * Converts Phase 2.5 decision packets to ledger entry format
 */

import { DecisionPacket } from '../types';
import { LedgerEntryCreate } from '@/types/ledger';
import { EnrichedSignal } from '@/types/signal';

/**
 * Convert Phase 2.5 decision to ledger entry
 */
export function convertDecisionToLedgerEntry(decision: DecisionPacket): LedgerEntryCreate {
  // Build enriched signal from input context
  const signal: EnrichedSignal = {
    signal: {
      type: decision.inputContext.expert?.direction || 'LONG',
      timeframe: '15', // Default, should come from context
      quality: decision.inputContext.expert?.quality || 'MEDIUM',
      ai_score: decision.inputContext.expert?.aiScore || 0,
      timestamp: decision.timestamp,
      bar_time: new Date(decision.timestamp).toISOString(),
    },
    instrument: {
      exchange: decision.inputContext.instrument.exchange || 'NASDAQ',
      ticker: decision.inputContext.instrument.symbol,
      current_price: decision.inputContext.instrument.price || 0,
    },
    entry: {
      price: decision.inputContext.instrument.price || 0,
      stop_loss: 0, // Would come from risk calculation
      target_1: 0,
      target_2: 0,
      stop_reason: 'N/A',
    },
    risk: {
      amount: 0,
      rr_ratio_t1: decision.inputContext.expert?.rr1 || 0,
      rr_ratio_t2: decision.inputContext.expert?.rr2 || 0,
      stop_distance_pct: 0,
      recommended_shares: 0,
      recommended_contracts: 0,
      position_multiplier: decision.finalSizeMultiplier,
      account_risk_pct: 0,
      max_loss_dollars: 0,
    },
    market_context: {
      vwap: 0,
      pmh: 0,
      pml: 0,
      day_open: 0,
      day_change_pct: 0,
      price_vs_vwap_pct: 0,
      distance_to_pmh_pct: 0,
      distance_to_pml_pct: 0,
      atr: decision.marketSnapshot?.stats?.atr14 || 0,
      volume_vs_avg: decision.marketSnapshot?.stats?.volumeRatio || 1,
      candle_direction: 'GREEN',
      candle_size_atr: 0,
    },
    trend: {
      ema_8: 0,
      ema_21: 0,
      ema_50: 0,
      alignment: 'NEUTRAL',
      strength: 50,
      rsi: decision.marketSnapshot?.stats?.rsi || 50,
      macd_signal: 'BULLISH',
    },
    mtf_context: {
      '4h_bias': 'LONG',
      '4h_rsi': 50,
      '1h_bias': 'LONG',
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
      market_session: 'OPEN',
      day_of_week: 'MONDAY',
    },
  };

  // Map decision action to ledger decision type
  const ledgerDecision = decision.action === 'EXECUTE' ? 'EXECUTE' :
                        decision.action === 'WAIT' ? 'WAIT' : 'SKIP';

  // Build decision breakdown
  const decisionBreakdown = {
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

  // Build regime snapshot
  const regime = {
    volatility: decision.inputContext.regime?.volatility || 'NORMAL',
    trend: 'NEUTRAL' as const, // Would come from trend data
    liquidity: 'NORMAL' as const, // Would come from market data
    iv_rank: decision.marketSnapshot?.options?.ivPercentile || 50,
  };

  const entry: LedgerEntryCreate = {
    created_at: decision.timestamp,
    engine_version: decision.engineVersion,
    signal,
    decision: ledgerDecision,
    decision_reason: decision.reasons.join('; ') || `${decision.action} decision`,
    decision_breakdown: decisionBreakdown,
    confluence_score: decision.confidenceScore,
    regime,
  };

  return entry;
}
