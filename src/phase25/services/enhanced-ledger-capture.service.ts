/**
 * Enhanced Ledger Capture Service
 * 
 * Captures additional decision data for replay and algorithm improvement
 */

import { DecisionPacket } from '../types';
import type { 
  RawInputSnapshot, 
  DecisionProcessingMetadata,
  MarketSnapshotForReplay,
  AlternativeOutcomes,
  LearningSignals,
  EnhancedLedgerData 
} from '@/types/ledger-enhanced';

export class EnhancedLedgerCaptureService {
  /**
   * Capture raw input snapshot
   */
  captureRawInput(
    webhookPayload: Record<string, any>,
    webhookMetadata: {
      receivedAt: number;
      sourceIp?: string;
      headers?: Record<string, string>;
    },
    decision: DecisionPacket
  ): RawInputSnapshot {
    return {
      webhook_payload: webhookPayload,
      webhook_received_at: webhookMetadata.receivedAt,
      webhook_source_ip: webhookMetadata.sourceIp,
      webhook_headers: webhookMetadata.headers,
      saty_phase_regime: decision.inputContext.phase?.regime?.phase,
      saty_phase_bias: decision.inputContext.phase?.bias?.phase,
      market_data_sources: {
        options_provider: decision.marketSnapshot?.provider as any,
        quotes_provider: decision.marketSnapshot?.provider as any,
        greeks_provider: decision.marketSnapshot?.provider as any,
      },
    };
  }

  /**
   * Capture decision processing metadata
   */
  captureProcessingMetadata(
    decision: DecisionPacket,
    timing: {
      totalProcessingTime: number;
      webhookToDecision: number;
      marketDataFetch: number;
      gateEvaluation: number;
      confidenceCalculation: number;
      ledgerWrite: number;
    },
    intermediateScores: {
      rawConfluenceScore: number;
      qualityAdjustedScore: number;
      phaseAdjustedScore: number;
      finalConfidenceScore: number;
    },
    contextCompleteness: {
      signalComplete: boolean;
      marketDataComplete: boolean;
      phaseDataComplete: boolean;
      missingFields: string[];
    }
  ): DecisionProcessingMetadata {
    const gateOrder = ['regime', 'structural', 'market'];
    const failedGate = Object.entries(decision.gateResults || {})
      .find(([_, result]) => !result.passed)?.[0];

    return {
      timing: {
        total_processing_time: timing.totalProcessingTime,
        webhook_to_decision: timing.webhookToDecision,
        market_data_fetch: timing.marketDataFetch,
        gate_evaluation: timing.gateEvaluation,
        confidence_calculation: timing.confidenceCalculation,
        ledger_write: timing.ledgerWrite,
      },
      intermediate_scores: {
        raw_confluence_score: intermediateScores.rawConfluenceScore,
        quality_adjusted_score: intermediateScores.qualityAdjustedScore,
        phase_adjusted_score: intermediateScores.phaseAdjustedScore,
        final_confidence_score: intermediateScores.finalConfidenceScore,
      },
      gate_evaluation_order: gateOrder,
      gate_short_circuit: !!failedGate,
      gate_short_circuit_at: failedGate,
      context_completeness: {
        signal_complete: contextCompleteness.signalComplete,
        market_data_complete: contextCompleteness.marketDataComplete,
        phase_data_complete: contextCompleteness.phaseDataComplete,
        missing_fields: contextCompleteness.missingFields,
      },
    };
  }

  /**
   * Capture market snapshot for replay
   */
  captureMarketSnapshot(decision: DecisionPacket): MarketSnapshotForReplay {
    const { marketSnapshot, inputContext } = decision;
    const symbol = inputContext.instrument.symbol;
    const price = inputContext.instrument.price;

    return {
      underlying: {
        symbol,
        price,
        bid: marketSnapshot?.quotes?.bid,
        ask: marketSnapshot?.quotes?.ask,
        bid_size: marketSnapshot?.quotes?.bidSize,
        ask_size: marketSnapshot?.quotes?.askSize,
        volume: marketSnapshot?.stats?.volume,
        open_interest: marketSnapshot?.options?.openInterest,
      },
      options_chain: marketSnapshot?.options ? {
        expiration_dates: marketSnapshot.options.expirations || [],
        strikes_near_money: marketSnapshot.options.strikes || [],
        atm_iv: marketSnapshot.options.atmIv,
        iv_skew: marketSnapshot.options.ivSkew,
        put_call_ratio: marketSnapshot.options.putCallRatio,
      } : undefined,
      greeks_snapshot: marketSnapshot?.options?.greeks ? {
        delta: marketSnapshot.options.greeks.delta,
        gamma: marketSnapshot.options.greeks.gamma,
        theta: marketSnapshot.options.greeks.theta,
        vega: marketSnapshot.options.greeks.vega,
        rho: marketSnapshot.options.greeks.rho,
      } : undefined,
      technical_snapshot: {
        rsi_5m: marketSnapshot?.stats?.rsi,
        rsi_15m: undefined, // Would need to fetch from market data
        rsi_1h: undefined,
        rsi_4h: undefined,
        macd_5m: undefined,
        macd_15m: undefined,
        bollinger_upper: undefined,
        bollinger_lower: undefined,
        bollinger_width: undefined,
      },
      order_book: marketSnapshot?.liquidity ? {
        bid_depth_5: marketSnapshot.liquidity.bidDepth,
        ask_depth_5: marketSnapshot.liquidity.askDepth,
        spread_bps: marketSnapshot.liquidity.spreadBps,
        liquidity_score: marketSnapshot.liquidity.score,
      } : undefined,
    };
  }

  /**
   * Calculate alternative outcomes
   */
  calculateAlternativeOutcomes(
    decision: DecisionPacket,
    config: {
      confidenceThresholds: number[];
      spreadThresholds: number[];
      sizeMultipliers: number[];
    }
  ): AlternativeOutcomes {
    const actualSpread = decision.marketSnapshot?.liquidity?.spreadBps || 0;
    const actualConfidence = decision.confidenceScore;

    return {
      threshold_sensitivity: config.confidenceThresholds.map(threshold => ({
        threshold,
        would_execute: actualConfidence >= threshold,
        confidence_delta: actualConfidence - threshold,
      })),
      spread_sensitivity: config.spreadThresholds.map(threshold => ({
        spread_threshold_bps: threshold,
        would_pass_market_gate: actualSpread <= threshold,
        actual_spread_bps: actualSpread,
      })),
      sizing_alternatives: config.sizeMultipliers.map(multiplier => ({
        multiplier,
        contracts: Math.floor(decision.recommendedContracts * multiplier),
        risk_dollars: decision.inputContext.instrument.price * 100 * Math.floor(decision.recommendedContracts * multiplier),
        reason: multiplier > 1 ? 'Aggressive sizing' : multiplier < 1 ? 'Conservative sizing' : 'Standard sizing',
      })),
      wait_scenarios: [
        { wait_minutes: 5, hypothetical_entry_price: undefined, hypothetical_confidence: undefined, would_have_been_better: undefined },
        { wait_minutes: 15, hypothetical_entry_price: undefined, hypothetical_confidence: undefined, would_have_been_better: undefined },
        { wait_minutes: 30, hypothetical_entry_price: undefined, hypothetical_confidence: undefined, would_have_been_better: undefined },
      ],
    };
  }

  /**
   * Generate learning signals
   */
  generateLearningSignals(decision: DecisionPacket): LearningSignals {
    const patterns: Array<{ pattern_name: string; confidence: number; historical_win_rate?: number }> = [];

    // Detect common patterns
    if (decision.inputContext.alignment?.isAligned) {
      patterns.push({
        pattern_name: 'HTF_ALIGNMENT',
        confidence: 0.8,
        historical_win_rate: undefined, // Would need historical data
      });
    }

    if (decision.inputContext.expert?.quality === 'EXTREME') {
      patterns.push({
        pattern_name: 'EXTREME_QUALITY_SIGNAL',
        confidence: 0.9,
        historical_win_rate: undefined,
      });
    }

    // Detect anomalies
    const anomalies: Array<{ field: string; expected_value: number; actual_value: number; z_score: number }> = [];
    
    const rsi = decision.marketSnapshot?.stats?.rsi;
    if (rsi !== undefined) {
      if (rsi < 30 || rsi > 70) {
        anomalies.push({
          field: 'rsi',
          expected_value: 50,
          actual_value: rsi,
          z_score: Math.abs(rsi - 50) / 15, // Simplified z-score
        });
      }
    }

    return {
      pattern_matches: patterns,
      anomalies,
      similar_trades: undefined, // Would need to query historical ledger
      regime_classification: {
        primary_regime: decision.inputContext.regime?.volatility || 'NORMAL',
        regime_confidence: 0.7,
        regime_stability: 0.8,
        regime_duration_minutes: undefined,
      },
    };
  }

  /**
   * Capture complete enhanced ledger data
   */
  captureEnhancedData(
    decision: DecisionPacket,
    webhookPayload: Record<string, any>,
    webhookMetadata: {
      receivedAt: number;
      sourceIp?: string;
      headers?: Record<string, string>;
    },
    timing: {
      totalProcessingTime: number;
      webhookToDecision: number;
      marketDataFetch: number;
      gateEvaluation: number;
      confidenceCalculation: number;
      ledgerWrite: number;
    },
    intermediateScores: {
      rawConfluenceScore: number;
      qualityAdjustedScore: number;
      phaseAdjustedScore: number;
      finalConfidenceScore: number;
    },
    contextCompleteness: {
      signalComplete: boolean;
      marketDataComplete: boolean;
      phaseDataComplete: boolean;
      missingFields: string[];
    }
  ): EnhancedLedgerData {
    const rawInput = this.captureRawInput(webhookPayload, webhookMetadata, decision);
    const processingMetadata = this.captureProcessingMetadata(
      decision,
      timing,
      intermediateScores,
      contextCompleteness
    );
    const marketSnapshot = this.captureMarketSnapshot(decision);
    const alternativeOutcomes = this.calculateAlternativeOutcomes(decision, {
      confidenceThresholds: [60, 65, 70, 75, 80, 85, 90],
      spreadThresholds: [10, 12, 15, 20, 25],
      sizeMultipliers: [0.5, 0.75, 1.0, 1.25, 1.5],
    });
    const learningSignals = this.generateLearningSignals(decision);

    const missingDataForReplay: string[] = [];
    if (!marketSnapshot.options_chain) missingDataForReplay.push('options_chain');
    if (!marketSnapshot.greeks_snapshot) missingDataForReplay.push('greeks');
    if (!marketSnapshot.order_book) missingDataForReplay.push('order_book');

    return {
      raw_input: rawInput,
      processing_metadata: processingMetadata,
      market_snapshot_replay: marketSnapshot,
      alternative_outcomes: alternativeOutcomes,
      performance_attribution: undefined, // Updated after exit
      learning_signals: learningSignals,
      replay_metadata: {
        is_replayable: missingDataForReplay.length === 0,
        replay_confidence: 1.0 - (missingDataForReplay.length * 0.2),
        missing_data_for_replay: missingDataForReplay,
      },
    };
  }
}
