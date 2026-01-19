# Enhanced Ledger Data Guide

**Purpose:** Capture comprehensive decision data for replay, backtesting, and algorithm improvement

---

## Overview

The enhanced ledger system captures additional data beyond the standard ledger entry to enable:

1. **Exact Decision Replay** - Reproduce any decision with the exact market conditions
2. **What-If Analysis** - Test how different parameters would have changed outcomes
3. **Algorithm Optimization** - Identify which rules and thresholds work best
4. **Performance Attribution** - Understand what drove each outcome
5. **Pattern Recognition** - Detect successful patterns for future use

---

## Data Captured

### 1. Raw Input Snapshot
**Purpose:** Enable exact replay of any decision

```typescript
{
  webhook_payload: {...},           // Original webhook data
  webhook_received_at: 1768852496,  // Exact timing
  webhook_source_ip: "1.2.3.4",     // Source tracking
  webhook_headers: {...},           // Request metadata
  saty_phase_regime: "PHASE_1",     // Phase context
  saty_phase_bias: "BULLISH",       // Bias context
  market_data_sources: {            // Data provenance
    options_provider: "marketdata",
    quotes_provider: "tradier",
    greeks_provider: "marketdata"
  }
}
```

**Use Cases:**
- Replay decision with exact inputs
- Debug why a decision was made
- Audit data quality issues
- Track data provider performance

---

### 2. Decision Processing Metadata
**Purpose:** Understand decision timing and intermediate calculations

```typescript
{
  timing: {
    total_processing_time: 150,      // Total ms
    webhook_to_decision: 120,        // Decision engine time
    market_data_fetch: 80,           // API call time
    gate_evaluation: 20,             // Gate processing
    confidence_calculation: 15,      // Scoring time
    ledger_write: 10                 // Database write
  },
  intermediate_scores: {
    raw_confluence_score: 65,        // Before adjustments
    quality_adjusted_score: 70,      // After quality multiplier
    phase_adjusted_score: 75,        // After phase boost
    final_confidence_score: 75       // Final score
  },
  gate_evaluation_order: ["regime", "structural", "market"],
  gate_short_circuit: true,          // Did we stop early?
  gate_short_circuit_at: "market",   // Which gate failed?
  context_completeness: {
    signal_complete: true,
    market_data_complete: false,     // Missing some data
    phase_data_complete: true,
    missing_fields: ["greeks", "order_book"]
  }
}
```

**Use Cases:**
- Optimize processing performance
- Identify slow data sources
- Debug confidence calculation
- Track data completeness over time

---

### 3. Market Snapshot for Replay
**Purpose:** Complete market state at decision time

```typescript
{
  underlying: {
    symbol: "SPY",
    price: 580.25,
    bid: 580.20,
    ask: 580.30,
    bid_size: 500,
    ask_size: 300,
    volume: 1250000,
    open_interest: 5000000
  },
  options_chain: {
    expiration_dates: ["2026-01-24", "2026-01-31"],
    strikes_near_money: [575, 577.5, 580, 582.5, 585],
    atm_iv: 0.18,
    iv_skew: 0.02,
    put_call_ratio: 0.85
  },
  greeks_snapshot: {
    delta: 0.55,
    gamma: 0.03,
    theta: -0.15,
    vega: 0.25,
    rho: 0.10
  },
  technical_snapshot: {
    rsi_5m: 62,
    rsi_15m: 58,
    rsi_1h: 55,
    rsi_4h: 52,
    macd_5m: 0.5,
    bollinger_upper: 582,
    bollinger_lower: 578,
    bollinger_width: 4
  },
  order_book: {
    bid_depth_5: 2500,
    ask_depth_5: 1800,
    spread_bps: 15,
    liquidity_score: 85
  }
}
```

**Use Cases:**
- Replay with exact market conditions
- Backtest with real market data
- Analyze market microstructure
- Study liquidity patterns

---

### 4. Alternative Outcomes
**Purpose:** What would have happened with different parameters?

```typescript
{
  threshold_sensitivity: [
    { threshold: 60, would_execute: true, confidence_delta: 15 },
    { threshold: 70, would_execute: true, confidence_delta: 5 },
    { threshold: 80, would_execute: false, confidence_delta: -5 }
  ],
  spread_sensitivity: [
    { spread_threshold_bps: 10, would_pass_market_gate: false, actual_spread_bps: 15 },
    { spread_threshold_bps: 15, would_pass_market_gate: true, actual_spread_bps: 15 },
    { spread_threshold_bps: 20, would_pass_market_gate: true, actual_spread_bps: 15 }
  ],
  sizing_alternatives: [
    { multiplier: 0.5, contracts: 1, risk_dollars: 290, reason: "Conservative" },
    { multiplier: 1.0, contracts: 3, risk_dollars: 870, reason: "Standard" },
    { multiplier: 1.5, contracts: 4, risk_dollars: 1160, reason: "Aggressive" }
  ],
  wait_scenarios: [
    { wait_minutes: 5, hypothetical_entry_price: 580.50, would_have_been_better: false },
    { wait_minutes: 15, hypothetical_entry_price: 579.80, would_have_been_better: true }
  ]
}
```

**Use Cases:**
- Optimize confidence thresholds
- Tune spread tolerance
- Calibrate position sizing
- Test timing strategies

---

### 5. Performance Attribution
**Purpose:** Understand what drove the outcome (updated after exit)

```typescript
{
  decision_quality: {
    was_correct: true,                    // Did we make the right call?
    confidence_accuracy: 0.85,            // How well did confidence predict outcome?
    timing_quality: 0.90,                 // Entry timing vs optimal
    sizing_quality: 0.80                  // Position size vs optimal
  },
  gate_performance: {
    regime_gate_value: 50,                // $ value added by this gate
    structural_gate_value: 100,           // $ value added
    market_gate_value: -25,               // $ value lost (false negative)
    total_gate_value: 125                 // Total value added
  },
  factor_attribution: {
    signal_quality_contribution: 60,      // % of P&L from signal quality
    market_timing_contribution: 25,       // % from timing
    position_sizing_contribution: 10,     // % from sizing
    execution_quality_contribution: 5,    // % from execution
    luck_factor: 0                        // Unexplained variance
  }
}
```

**Use Cases:**
- Measure gate effectiveness
- Identify which factors drive success
- Optimize decision rules
- Calculate ROI of each component

---

### 6. Learning Signals
**Purpose:** Data for algorithm improvement

```typescript
{
  pattern_matches: [
    { pattern_name: "HTF_ALIGNMENT", confidence: 0.8, historical_win_rate: 0.65 },
    { pattern_name: "EXTREME_QUALITY_SIGNAL", confidence: 0.9, historical_win_rate: 0.72 }
  ],
  anomalies: [
    { field: "rsi", expected_value: 50, actual_value: 75, z_score: 1.67 }
  ],
  similar_trades: [
    { ledger_id: "abc-123", similarity_score: 0.92, outcome: "WIN", pnl: 250 },
    { ledger_id: "def-456", similarity_score: 0.88, outcome: "WIN", pnl: 180 }
  ],
  regime_classification: {
    primary_regime: "NORMAL",
    regime_confidence: 0.7,
    regime_stability: 0.8,
    regime_duration_minutes: 120
  }
}
```

**Use Cases:**
- Pattern recognition
- Anomaly detection
- Similar trade analysis
- Regime classification

---

## Usage Examples

### Example 1: Replay a Decision

```typescript
// Get original decision
const entry = await ledger.get(ledgerId);
const enhanced = entry.enhanced_data;

// Replay with exact inputs
const replayResult = await decisionEngine.replay({
  rawInput: enhanced.raw_input,
  marketSnapshot: enhanced.market_snapshot_replay,
  overrides: {} // Use original parameters
});

console.log('Original:', entry.decision);
console.log('Replayed:', replayResult.decision);
console.log('Match:', entry.decision === replayResult.decision);
```

### Example 2: What-If Analysis

```typescript
// What if we had used a lower confidence threshold?
const whatIf = await decisionEngine.replay({
  rawInput: enhanced.raw_input,
  marketSnapshot: enhanced.market_snapshot_replay,
  overrides: {
    confidence_threshold: 65 // Instead of 75
  }
});

console.log('Would have executed:', whatIf.decision === 'EXECUTE');
console.log('Confidence delta:', whatIf.confidence - entry.confluence_score);
```

### Example 3: Optimize Thresholds

```typescript
// Test multiple thresholds
const thresholds = [60, 65, 70, 75, 80, 85, 90];
const results = await Promise.all(
  thresholds.map(threshold => 
    decisionEngine.replay({
      rawInput: enhanced.raw_input,
      marketSnapshot: enhanced.market_snapshot_replay,
      overrides: { confidence_threshold: threshold }
    })
  )
);

// Find optimal threshold
const optimal = results.reduce((best, result, i) => {
  if (result.expectedValue > best.expectedValue) {
    return { threshold: thresholds[i], ...result };
  }
  return best;
}, { threshold: 0, expectedValue: -Infinity });

console.log('Optimal threshold:', optimal.threshold);
```

### Example 4: Performance Attribution

```typescript
// After trade exits, analyze what drove the outcome
const attribution = await performanceAnalyzer.analyze(entry);

console.log('Decision Quality:', attribution.decision_quality);
console.log('Gate Performance:', attribution.gate_performance);
console.log('Factor Attribution:', attribution.factor_attribution);

// Update ledger with attribution
await ledger.updateEnhancedData(entry.id, {
  ...entry.enhanced_data,
  performance_attribution: attribution
});
```

### Example 5: Pattern Analysis

```typescript
// Find similar successful trades
const similar = await ledger.query({
  filters: {
    decision: 'EXECUTE',
    from_date: Date.now() - 30 * 24 * 60 * 60 * 1000 // Last 30 days
  }
});

const patterns = similar
  .filter(e => e.exit?.pnl_net > 0) // Winners only
  .flatMap(e => e.enhanced_data?.learning_signals?.pattern_matches || [])
  .reduce((acc, pattern) => {
    acc[pattern.pattern_name] = (acc[pattern.pattern_name] || 0) + 1;
    return acc;
  }, {});

console.log('Winning patterns:', patterns);
```

---

## Database Schema

### Enhanced Data Column

```sql
-- Add to ledger_entries table
ALTER TABLE ledger_entries ADD COLUMN enhanced_data JSONB;

-- Index for queries
CREATE INDEX idx_ledger_enhanced_data_gin 
ON ledger_entries USING GIN (enhanced_data);

-- Index for replayable entries
CREATE INDEX idx_ledger_replayable 
ON ledger_entries ((enhanced_data->'replay_metadata'->>'is_replayable'))
WHERE enhanced_data IS NOT NULL;
```

### Query Examples

```sql
-- Find all replayable decisions
SELECT id, created_at, decision, confluence_score
FROM ledger_entries
WHERE enhanced_data->'replay_metadata'->>'is_replayable' = 'true';

-- Find decisions with specific patterns
SELECT id, created_at, decision
FROM ledger_entries
WHERE enhanced_data->'learning_signals'->'pattern_matches' @> 
  '[{"pattern_name": "HTF_ALIGNMENT"}]'::jsonb;

-- Find decisions with slow processing
SELECT id, created_at, 
  (enhanced_data->'processing_metadata'->'timing'->>'total_processing_time')::int as processing_time
FROM ledger_entries
WHERE (enhanced_data->'processing_metadata'->'timing'->>'total_processing_time')::int > 200
ORDER BY processing_time DESC;

-- Find decisions with missing data
SELECT id, created_at,
  enhanced_data->'replay_metadata'->'missing_data_for_replay' as missing_data
FROM ledger_entries
WHERE jsonb_array_length(enhanced_data->'replay_metadata'->'missing_data_for_replay') > 0;
```

---

## Integration

### 1. Enable Enhanced Capture

```typescript
// In decision-orchestrator.service.ts
import { EnhancedLedgerCaptureService } from './enhanced-ledger-capture.service';

const enhancedCapture = new EnhancedLedgerCaptureService();

// Capture enhanced data
const enhancedData = enhancedCapture.captureEnhancedData(
  decision,
  webhookPayload,
  webhookMetadata,
  timing,
  intermediateScores,
  contextCompleteness
);

// Add to ledger entry
const ledgerEntry = {
  ...standardLedgerEntry,
  enhanced_data: enhancedData
};
```

### 2. Run Migration

```bash
# Add enhanced_data column
psql $DATABASE_URL -f migrations/add-enhanced-data-column.sql
```

### 3. Query Enhanced Data

```typescript
// Get entry with enhanced data
const entry = await ledger.get(ledgerId);
const enhanced = entry.enhanced_data;

// Access specific data
console.log('Processing time:', enhanced.processing_metadata.timing.total_processing_time);
console.log('Is replayable:', enhanced.replay_metadata.is_replayable);
console.log('Patterns:', enhanced.learning_signals.pattern_matches);
```

---

## Benefits

### For Algorithm Development
- **A/B Testing:** Test rule changes on historical data
- **Optimization:** Find optimal thresholds and parameters
- **Validation:** Verify improvements with replay
- **Debugging:** Understand why decisions were made

### For Performance Analysis
- **Attribution:** Know what drives success
- **Gate Effectiveness:** Measure value of each gate
- **Pattern Recognition:** Identify winning setups
- **Risk Management:** Analyze sizing and timing

### For Operations
- **Audit Trail:** Complete decision history
- **Data Quality:** Track completeness and sources
- **Performance:** Monitor processing times
- **Debugging:** Reproduce any decision exactly

---

## Next Steps

1. **Run Migration:** Add `enhanced_data` column
2. **Enable Capture:** Integrate `EnhancedLedgerCaptureService`
3. **Deploy:** Push changes to production
4. **Analyze:** Start querying enhanced data
5. **Optimize:** Use insights to improve algorithm

---

## Summary

The enhanced ledger system captures comprehensive decision data that enables:
- ✅ Exact decision replay
- ✅ What-if analysis
- ✅ Algorithm optimization
- ✅ Performance attribution
- ✅ Pattern recognition

This data is the foundation for continuous algorithm improvement and provides complete transparency into every decision made by the system.
