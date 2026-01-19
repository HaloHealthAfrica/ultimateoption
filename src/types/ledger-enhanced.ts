/**
 * Enhanced Ledger Types for Replay and Algorithm Improvement
 * 
 * Additional data structures to support:
 * - Decision replay with exact market conditions
 * - Algorithm backtesting and optimization
 * - Performance attribution analysis
 * - A/B testing of rule changes
 */

import { z } from 'zod';

/**
 * Raw Input Snapshot
 * Captures the exact input data that triggered the decision
 */
export const RawInputSnapshotSchema = z.object({
  // Original webhook payload (for exact replay)
  webhook_payload: z.record(z.any()),
  
  // Webhook metadata
  webhook_received_at: z.number(),
  webhook_source_ip: z.string().optional(),
  webhook_headers: z.record(z.string()).optional(),
  
  // Phase context at decision time
  saty_phase_regime: z.string().optional(),
  saty_phase_bias: z.string().optional(),
  
  // Market data sources used
  market_data_sources: z.object({
    options_provider: z.enum(['tradier', 'twelvedata', 'marketdata', 'alpaca']).optional(),
    quotes_provider: z.enum(['tradier', 'twelvedata', 'marketdata', 'alpaca']).optional(),
    greeks_provider: z.enum(['tradier', 'twelvedata', 'marketdata', 'alpaca']).optional(),
  }),
});
export type RawInputSnapshot = z.infer<typeof RawInputSnapshotSchema>;

/**
 * Decision Processing Metadata
 * Captures timing and intermediate calculations
 */
export const DecisionProcessingMetadataSchema = z.object({
  // Timing breakdown (milliseconds)
  timing: z.object({
    total_processing_time: z.number(),
    webhook_to_decision: z.number(),
    market_data_fetch: z.number(),
    gate_evaluation: z.number(),
    confidence_calculation: z.number(),
    ledger_write: z.number(),
  }),
  
  // Intermediate calculations
  intermediate_scores: z.object({
    raw_confluence_score: z.number(),
    quality_adjusted_score: z.number(),
    phase_adjusted_score: z.number(),
    final_confidence_score: z.number(),
  }),
  
  // Gate evaluation details
  gate_evaluation_order: z.array(z.string()),
  gate_short_circuit: z.boolean(),
  gate_short_circuit_at: z.string().optional(),
  
  // Context completeness
  context_completeness: z.object({
    signal_complete: z.boolean(),
    market_data_complete: z.boolean(),
    phase_data_complete: z.boolean(),
    missing_fields: z.array(z.string()),
  }),
});
export type DecisionProcessingMetadata = z.infer<typeof DecisionProcessingMetadataSchema>;

/**
 * Market Snapshot for Replay
 * Complete market state at decision time
 */
export const MarketSnapshotForReplaySchema = z.object({
  // Underlying data
  underlying: z.object({
    symbol: z.string(),
    price: z.number(),
    bid: z.number().optional(),
    ask: z.number().optional(),
    bid_size: z.number().optional(),
    ask_size: z.number().optional(),
    volume: z.number().optional(),
    open_interest: z.number().optional(),
  }),
  
  // Options chain snapshot (if available)
  options_chain: z.object({
    expiration_dates: z.array(z.string()),
    strikes_near_money: z.array(z.number()),
    atm_iv: z.number().optional(),
    iv_skew: z.number().optional(),
    put_call_ratio: z.number().optional(),
  }).optional(),
  
  // Greeks at decision time
  greeks_snapshot: z.object({
    delta: z.number().optional(),
    gamma: z.number().optional(),
    theta: z.number().optional(),
    vega: z.number().optional(),
    rho: z.number().optional(),
  }).optional(),
  
  // Technical indicators
  technical_snapshot: z.object({
    rsi_5m: z.number().optional(),
    rsi_15m: z.number().optional(),
    rsi_1h: z.number().optional(),
    rsi_4h: z.number().optional(),
    macd_5m: z.number().optional(),
    macd_15m: z.number().optional(),
    bollinger_upper: z.number().optional(),
    bollinger_lower: z.number().optional(),
    bollinger_width: z.number().optional(),
  }).optional(),
  
  // Order book depth (if available)
  order_book: z.object({
    bid_depth_5: z.number().optional(),
    ask_depth_5: z.number().optional(),
    spread_bps: z.number().optional(),
    liquidity_score: z.number().optional(),
  }).optional(),
});
export type MarketSnapshotForReplay = z.infer<typeof MarketSnapshotForReplaySchema>;

/**
 * Alternative Outcomes
 * What would have happened with different parameters
 */
export const AlternativeOutcomesSchema = z.object({
  // Different confidence thresholds
  threshold_sensitivity: z.array(z.object({
    threshold: z.number(),
    would_execute: z.boolean(),
    confidence_delta: z.number(),
  })),
  
  // Different spread thresholds
  spread_sensitivity: z.array(z.object({
    spread_threshold_bps: z.number(),
    would_pass_market_gate: z.boolean(),
    actual_spread_bps: z.number(),
  })),
  
  // Different position sizing
  sizing_alternatives: z.array(z.object({
    multiplier: z.number(),
    contracts: z.number(),
    risk_dollars: z.number(),
    reason: z.string(),
  })),
  
  // If we had waited
  wait_scenarios: z.array(z.object({
    wait_minutes: z.number(),
    hypothetical_entry_price: z.number().optional(),
    hypothetical_confidence: z.number().optional(),
    would_have_been_better: z.boolean().optional(),
  })).optional(),
});
export type AlternativeOutcomes = z.infer<typeof AlternativeOutcomesSchema>;

/**
 * Performance Attribution
 * Detailed breakdown of what drove the outcome
 */
export const PerformanceAttributionSchema = z.object({
  // Decision quality metrics
  decision_quality: z.object({
    was_correct: z.boolean().optional(), // Only known after exit
    confidence_accuracy: z.number().optional(), // How well confidence predicted outcome
    timing_quality: z.number().optional(), // Entry timing vs optimal
    sizing_quality: z.number().optional(), // Position size vs optimal
  }),
  
  // Gate performance
  gate_performance: z.object({
    regime_gate_value: z.number(), // How much value did this gate add
    structural_gate_value: z.number(),
    market_gate_value: z.number(),
    total_gate_value: z.number(),
  }).optional(),
  
  // Factor attribution (for executed trades)
  factor_attribution: z.object({
    signal_quality_contribution: z.number().optional(),
    market_timing_contribution: z.number().optional(),
    position_sizing_contribution: z.number().optional(),
    execution_quality_contribution: z.number().optional(),
    luck_factor: z.number().optional(), // Unexplained variance
  }).optional(),
});
export type PerformanceAttribution = z.infer<typeof PerformanceAttributionSchema>;

/**
 * Learning Signals
 * Data points for algorithm improvement
 */
export const LearningSignalsSchema = z.object({
  // Pattern recognition
  pattern_matches: z.array(z.object({
    pattern_name: z.string(),
    confidence: z.number(),
    historical_win_rate: z.number().optional(),
  })),
  
  // Anomaly detection
  anomalies: z.array(z.object({
    field: z.string(),
    expected_value: z.number(),
    actual_value: z.number(),
    z_score: z.number(),
  })),
  
  // Similar historical trades
  similar_trades: z.array(z.object({
    ledger_id: z.string(),
    similarity_score: z.number(),
    outcome: z.string(),
    pnl: z.number().optional(),
  })).optional(),
  
  // Regime classification
  regime_classification: z.object({
    primary_regime: z.string(),
    regime_confidence: z.number(),
    regime_stability: z.number(), // How stable is this regime
    regime_duration_minutes: z.number().optional(),
  }).optional(),
});
export type LearningSignals = z.infer<typeof LearningSignalsSchema>;

/**
 * Enhanced Ledger Entry
 * Extends base ledger entry with replay and learning data
 */
export const EnhancedLedgerDataSchema = z.object({
  // Raw input for exact replay
  raw_input: RawInputSnapshotSchema,
  
  // Processing metadata
  processing_metadata: DecisionProcessingMetadataSchema,
  
  // Complete market snapshot
  market_snapshot_replay: MarketSnapshotForReplaySchema,
  
  // Alternative outcomes
  alternative_outcomes: AlternativeOutcomesSchema,
  
  // Performance attribution (updated after exit)
  performance_attribution: PerformanceAttributionSchema.optional(),
  
  // Learning signals
  learning_signals: LearningSignalsSchema.optional(),
  
  // Replay metadata
  replay_metadata: z.object({
    is_replayable: z.boolean(),
    replay_confidence: z.number(), // How confident are we in replay accuracy
    missing_data_for_replay: z.array(z.string()),
  }),
});
export type EnhancedLedgerData = z.infer<typeof EnhancedLedgerDataSchema>;

/**
 * Replay Request
 * Request to replay a decision with different parameters
 */
export const ReplayRequestSchema = z.object({
  ledger_id: z.string().uuid(),
  
  // Override parameters
  overrides: z.object({
    confidence_threshold: z.number().optional(),
    spread_threshold_bps: z.number().optional(),
    position_multiplier: z.number().optional(),
    enable_gates: z.array(z.string()).optional(),
    disable_gates: z.array(z.string()).optional(),
  }).optional(),
  
  // Replay mode
  mode: z.enum(['exact', 'what_if', 'optimize']),
  
  // Optimization target (for optimize mode)
  optimization_target: z.enum(['max_pnl', 'max_sharpe', 'max_win_rate', 'min_drawdown']).optional(),
});
export type ReplayRequest = z.infer<typeof ReplayRequestSchema>;

/**
 * Replay Result
 * Result of replaying a decision
 */
export const ReplayResultSchema = z.object({
  original_decision: z.string(),
  replayed_decision: z.string(),
  
  // Differences
  differences: z.object({
    decision_changed: z.boolean(),
    confidence_delta: z.number(),
    sizing_delta: z.number(),
    gate_results_changed: z.array(z.string()),
  }),
  
  // Outcome comparison (if original was executed)
  outcome_comparison: z.object({
    original_pnl: z.number().optional(),
    replayed_pnl: z.number().optional(),
    improvement: z.number().optional(),
  }).optional(),
  
  // Insights
  insights: z.array(z.string()),
});
export type ReplayResult = z.infer<typeof ReplayResultSchema>;
