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
  // Helper to ensure positive numbers with reasonable fallbacks
  const safePositive = (value: number | undefined, fallback: number): number => {
    if (typeof value === 'number' && value > 0) return value;
    return fallback;
  };

  // Get current price - use a reasonable fallback if not available
  // In production, this should come from the market context builder
  const symbol = decision.inputContext.instrument.symbol;
  const rawPrice = decision.inputContext.instrument.price;
  const currentPrice = safePositive(rawPrice, 100); // Fallback to $100 if price not available
  
  // Log warning if using fallback price
  if (!rawPrice || rawPrice <= 0) {
    console.warn(`Using fallback price for ${symbol}: instrument.price was ${rawPrice}`);
  }

  // Calculate reasonable stop/target prices based on current price
  const stopLoss = currentPrice * 0.98; // 2% stop loss
  const target1 = currentPrice * 1.02; // 2% target 1
  const target2 = currentPrice * 1.04; // 4% target 2

  // Get ATR with reasonable fallback (2% of price)
  const atr = safePositive(decision.marketSnapshot?.stats?.atr14, currentPrice * 0.02);

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
      current_price: currentPrice,
    },
    entry: {
      price: currentPrice,
      stop_loss: stopLoss,
      target_1: target1,
      target_2: target2,
      stop_reason: 'ATR_BASED',
    },
    risk: {
      amount: 0,
      rr_ratio_t1: decision.inputContext.expert?.rr1 || 2.0,
      rr_ratio_t2: decision.inputContext.expert?.rr2 || 4.0,
      stop_distance_pct: 2.0,
      recommended_shares: 0,
      recommended_contracts: 0,
      position_multiplier: decision.finalSizeMultiplier,
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
      atr: atr,
      volume_vs_avg: decision.marketSnapshot?.stats?.volumeRatio || 1,
      candle_direction: 'GREEN',
      candle_size_atr: 0,
    },
    trend: {
      ema_8: currentPrice,
      ema_21: currentPrice,
      ema_50: currentPrice,
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
