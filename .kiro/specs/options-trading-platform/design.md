# Design Document: Options Trading Platform

## Overview

This document describes the technical design for a production-grade, paper-trading options platform built with Next.js 14 (App Router) and TypeScript. The system processes enriched multi-timeframe webhooks from TradingView and makes deterministic paper trading decisions using rule-based logic with options-specific awareness (Greeks, IV, theta decay).

## Implementation Status

### ✅ COMPLETED (v2.0)
- **Dashboard Rebuild**: Complete dashboard with error boundaries, all tabs working (overview, trades, learning, webhooks)
- **Webhook Security**: Comprehensive authentication system supporting HMAC-SHA256, Bearer tokens, and query parameters
- **Webhook Endpoints**: All 3 webhook endpoints (signals, saty-phase, trend) with full authentication
- **Error Handling**: Robust error boundaries and API error handling throughout dashboard
- **Documentation**: Complete webhook security setup guide and JSON format documentation

### 🚧 IN PROGRESS
- **Database Integration**: Webhook receipts table exists, ledger implementation pending
- **Decision Engine**: Core logic designed, implementation in progress
- **Paper Executor**: Options-specific execution simulation pending

### 📋 PENDING
- **Learning Engine**: Advisory system for strategy optimization
- **Metrics Engine**: Performance analytics and attribution
- **Full Testing Suite**: Property-based tests and integration tests

The platform follows a strict separation of concerns:
- **Execution Path**: Immutable, deterministic, frozen in production
- **Learning Path**: Isolated, advisory-only, human-gated
- **Audit Path**: Append-only ledger with full replay capability

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEBHOOK INGESTION LAYER                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ Signal Receiver │    │ Phase Receiver  │    │ Schema Validator│         │
│  │ /api/webhooks/  │    │ /api/webhooks/  │    │                 │         │
│  │ signals         │    │ saty-phase      │    │                 │         │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────┘         │
│           │                      │                                          │
│           ▼                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │              TIMEFRAME STORE (In-Memory + Redis)            │           │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │           │
│  │  │ 3M  │ │ 5M  │ │ 15M │ │ 30M │ │ 1H  │ │ 4H  │           │           │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘           │           │
│  └─────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DECISION ENGINE (IMMUTABLE/FROZEN)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ Confluence      │    │ Position Sizing │    │ Decision        │         │
│  │ Calculator      │───▶│ Calculator      │───▶│ Output          │         │
│  │ (Weighted MTF)  │    │ (Multi-Factor)  │    │ EXECUTE|WAIT|   │         │
│  └─────────────────┘    └─────────────────┘    │ SKIP            │         │
│                                                 └─────────────────┘         │
│  Object.freeze() on all matrices in production                              │
│  ENGINE_VERSION tracked with every decision                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│   PAPER EXECUTOR     │ │   EVENT BUS      │ │   LEDGER (Append)    │
│   (Options-Specific) │ │   (Pub/Sub)      │ │   (PostgreSQL +      │
│   - Greeks Calc      │ │   - SIGNAL_RECV  │ │    TimescaleDB)      │
│   - Spread Sim       │ │   - DECISION_MADE│ │   - Immutable        │
│   - Slippage Model   │ │   - TRADE_EXEC   │ │   - Partitioned      │
│   - Commission       │ │   - TRADE_CLOSED │ │   - Indexed          │
└──────────────────────┘ └────────┬─────────┘ └──────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   LEARNING ENGINE (ISOLATED) │  │   METRICS ENGINE             │
│   - Subscribe only           │  │   - Descriptive only         │
│   - Advisory suggestions     │  │   - No recommendations       │
│   - Human approval required  │  │   - Rolling windows          │
│   - Cannot import execution  │  │   - Attribution metrics      │
└──────────────────────────────┘  └──────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                    READ-ONLY API LAYER                            │
│   GET /api/decisions    GET /api/ledger    GET /api/metrics      │
│   GET /api/learning/suggestions                                   │
│   NO WRITE ENDPOINTS                                              │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (READ-ONLY)                          │
│   - Signal Monitor        - Confluence View                       │
│   - Decision Breakdown    - Paper Trades                          │
│   - Learning Insights     - Safety Alerts                         │
└──────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Webhook Receiver Component

Handles incoming webhooks from TradingView for both enriched signals and SATY phase events.

```typescript
// Types
interface WebhookPayload {
  text: string; // Stringified JSON
}

interface EnrichedSignal {
  signal: {
    type: 'LONG' | 'SHORT';
    timeframe: '3' | '5' | '15' | '30' | '60' | '240';
    quality: 'EXTREME' | 'HIGH' | 'MEDIUM';
    ai_score: number; // 0-10.5
    timestamp: number;
    bar_time: string;
  };
  instrument: {
    exchange: string;
    ticker: string;
    current_price: number;
  };
  entry: {
    price: number;
    stop_loss: number;
    target_1: number;
    target_2: number;
    stop_reason: string;
  };
  risk: {
    amount: number;
    rr_ratio_t1: number;
    rr_ratio_t2: number;
    stop_distance_pct: number;
    recommended_shares: number;
    recommended_contracts: number;
    position_multiplier: number;
    account_risk_pct: number;
    max_loss_dollars: number;
  };
  market_context: {
    vwap: number;
    pmh: number;
    pml: number;
    day_open: number;
    day_change_pct: number;
    price_vs_vwap_pct: number;
    distance_to_pmh_pct: number;
    distance_to_pml_pct: number;
    atr: number;
    volume_vs_avg: number;
    candle_direction: 'GREEN' | 'RED';
    candle_size_atr: number;
  };
  trend: {
    ema_8: number;
    ema_21: number;
    ema_50: number;
    alignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; // 0-100
    rsi: number;
    macd_signal: 'BULLISH' | 'BEARISH';
  };
  mtf_context: {
    '4h_bias': 'LONG' | 'SHORT';
    '4h_rsi': number;
    '1h_bias': 'LONG' | 'SHORT';
  };
  score_breakdown: {
    strat: number;
    trend: number;
    gamma: number;
    vwap: number;
    mtf: number;
    golf: number;
  };
  components: string[];
  time_context: {
    market_session: 'OPEN' | 'MIDDAY' | 'POWER_HOUR' | 'AFTERHOURS';
    day_of_week: string;
  };
}

interface SatyPhaseWebhook {
  meta: {
    engine: 'SATY_PO';
    engine_version: string;
    event_id: string;
    event_type: 'REGIME_PHASE_EXIT' | 'REGIME_PHASE_ENTRY' | 'REGIME_REVERSAL';
    generated_at: string;
  };
  instrument: {
    symbol: string;
    exchange: string;
    asset_class: string;
    session: string;
  };
  timeframe: {
    chart_tf: string;
    event_tf: string;
    tf_role: 'REGIME' | 'BIAS' | 'SETUP_FORMATION' | 'STRUCTURAL';
    bar_close_time: string;
  };
  event: {
    name: 'EXIT_ACCUMULATION' | 'ENTER_ACCUMULATION' | 'EXIT_DISTRIBUTION' | 
          'ENTER_DISTRIBUTION' | 'ZERO_CROSS_UP' | 'ZERO_CROSS_DOWN';
    description: string;
    directional_implication: 'UPSIDE_POTENTIAL' | 'DOWNSIDE_POTENTIAL' | 'NEUTRAL';
    event_priority: number;
  };
  oscillator_state: {
    value: number;
    previous_value: number;
    zone_from: string;
    zone_to: string;
    distance_from_zero: number;
    distance_from_extreme: number;
    velocity: 'INCREASING' | 'DECREASING';
  };
  regime_context: {
    local_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    htf_bias: {
      tf: string;
      bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      osc_value: number;
    };
    macro_bias: {
      tf: string;
      bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    };
  };
  confidence: {
    raw_strength: number;
    htf_alignment: boolean;
    confidence_score: number; // 0-100
    confidence_tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  };
  execution_guidance: {
    trade_allowed: boolean;
    allowed_directions: ('LONG' | 'SHORT')[];
    recommended_execution_tf: string[];
    requires_confirmation: string[];
  };
  risk_hints: {
    avoid_if: string[];
    time_decay_minutes: number;
    cooldown_tf: string;
  };
}

// Webhook Receiver Interface
interface IWebhookReceiver {
  receiveSignal(payload: WebhookPayload): Promise<SignalResult>;
  receivePhase(payload: WebhookPayload): Promise<PhaseResult>;
}
```

### 2. SATY Phase Store Component

Manages SATY Phase Oscillator events with automatic expiry and regime context aggregation.

```typescript
interface SatyPhaseWebhook {
  meta: {
    engine: 'SATY_PO';
    engine_version: string;
    event_id: string;
    event_type: 'REGIME_PHASE_EXIT' | 'REGIME_PHASE_ENTRY' | 'REGIME_REVERSAL';
    generated_at: string;
  };
  instrument: {
    symbol: string;
    exchange: string;
    asset_class: string;
    session: string;
  };
  timeframe: {
    chart_tf: string;
    event_tf: string;
    tf_role: string;
    bar_close_time: string;
  };
  event: {
    name: string;
    description: string;
    directional_implication: 'UPSIDE_POTENTIAL' | 'DOWNSIDE_POTENTIAL' | 'NEUTRAL';
    event_priority: number;
  };
  oscillator_state: {
    value: number;
    previous_value: number;
    zone_from: string;
    zone_to: string;
    distance_from_zero: number;
    distance_from_extreme: number;
    velocity: 'INCREASING' | 'DECREASING' | 'FLAT';
  };
  regime_context: {
    local_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    htf_bias: {
      tf: string;
      bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      osc_value: number;
    };
    macro_bias: {
      tf: string;
      bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    };
  };
  market_structure: {
    mean_reversion_phase: string;
    trend_phase: string;
    is_counter_trend: boolean;
    compression_state: string;
  };
  confidence: {
    raw_strength: number;
    htf_alignment: boolean;
    confidence_score: number;
    confidence_tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  };
  execution_guidance: {
    trade_allowed: boolean;
    allowed_directions: ('LONG' | 'SHORT')[];
    recommended_execution_tf: string[];
    requires_confirmation: string[];
  };
  risk_hints: {
    avoid_if: string[];
    time_decay_minutes: number;
    cooldown_tf: string;
  };
  audit: {
    source: string;
    alert_frequency: string;
    deduplication_key: string;
  };
}

interface StoredPhase {
  phase: SatyPhaseWebhook;
  received_at: number;
  expires_at: number;
  is_active: boolean;
}

interface RegimeContext {
  setup_phase: SatyPhaseWebhook | null;      // 15M
  bias_phase: SatyPhaseWebhook | null;       // 1H
  regime_phase: SatyPhaseWebhook | null;     // 4H
  structural_phase: SatyPhaseWebhook | null; // 1D
  is_aligned: boolean;
}

interface IPhaseStore {
  updatePhase(phase: SatyPhaseWebhook): void;
  getPhase(symbol: string, timeframe: string): SatyPhaseWebhook | null;
  getRegimeContext(symbol: string): RegimeContext;
  getActiveCount(): number;
  getLastPhaseTime(): number | null;
  clear(): void;
  destroy(): void;
}
```

### 3. Trend Store Component

Manages multi-timeframe trend alignment data with 8-timeframe confluence calculation.

```typescript
interface TimeframeData {
  direction: 'bullish' | 'bearish' | 'neutral';
  open: number;
  close: number;
}

interface TrendWebhook {
  ticker: string;
  exchange: string;
  timestamp: string;
  price: number;
  timeframes: {
    tf3min: TimeframeData;
    tf5min: TimeframeData;
    tf15min: TimeframeData;
    tf30min: TimeframeData;
    tf60min: TimeframeData;
    tf240min: TimeframeData;
    tf1week: TimeframeData;
    tf1month: TimeframeData;
  };
}

interface TrendAlignment {
  bullish_count: number;      // How many TFs are bullish
  bearish_count: number;      // How many TFs are bearish
  neutral_count: number;      // How many TFs are neutral
  alignment_score: number;    // 0-100 (% of TFs aligned with dominant)
  dominant_trend: 'bullish' | 'bearish' | 'neutral';
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CHOPPY';
  htf_bias: 'bullish' | 'bearish' | 'neutral';  // 4H trend
  ltf_bias: 'bullish' | 'bearish' | 'neutral';  // 3M/5M average
}

interface StoredTrend {
  trend: TrendWebhook;
  received_at: number;
  expires_at: number;
}

interface ITrendStore {
  updateTrend(trend: TrendWebhook): void;
  getTrend(ticker: string): TrendWebhook | null;
  getAlignment(ticker: string): TrendAlignment;
  getActiveTickerCount(): number;
  getLastUpdateTime(): number | null;
  clear(): void;
  destroy(): void;
}
```

### 4. Timeframe Store Component

Manages active signals and phases with automatic expiry based on validity calculations.

```typescript
interface StoredSignal {
  signal: EnrichedSignal;
  received_at: number;
  expires_at: number;
  validity_minutes: number;
}

interface StoredPhase {
  phase: SatyPhaseWebhook;
  received_at: number;
  expires_at: number;
  decay_minutes: number;
}

interface ValidityConfig {
  timeframeRoleMultipliers: Record<string, number>;
  qualityMultipliers: Record<string, number>;
  sessionMultipliers: Record<string, number>;
  minValidityMinutes: (tf: number) => number;
  maxValidityMinutes: number;
}

interface ITimeframeStore {
  storeSignal(signal: EnrichedSignal): StoredSignal;
  storePhase(phase: SatyPhaseWebhook): StoredPhase;
  getActiveSignals(): Map<string, StoredSignal>;
  getActivePhases(): Map<string, StoredPhase>;
  cleanupExpired(): void;
  getSignalByTimeframe(tf: string): StoredSignal | null;
  getPhaseByTimeframe(tf: string): StoredPhase | null;
}
```

### 3. Decision Engine Component (IMMUTABLE)

The core deterministic decision-making component. Frozen in production.

```typescript
const ENGINE_VERSION = '1.0.0';

type Decision = 'EXECUTE' | 'WAIT' | 'SKIP';

interface DecisionBreakdown {
  confluence_multiplier: number;
  quality_multiplier: number;
  htf_alignment_multiplier: number;
  rr_multiplier: number;
  volume_multiplier: number;
  trend_multiplier: number;
  session_multiplier: number;
  day_multiplier: number;
  phase_confidence_boost: number;
  phase_position_boost: number;
  final_multiplier: number;
}

interface DecisionResult {
  decision: Decision;
  reason: string;
  breakdown: DecisionBreakdown;
  engine_version: string;
  confluence_score: number;
  recommended_contracts: number;
  entry_signal: EnrichedSignal | null;
  stop_loss: number | null;
  target_1: number | null;
  target_2: number | null;
}

// Confluence weights (FROZEN)
const CONFLUENCE_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  '240': 0.40, // 4H = 40%
  '60': 0.25,  // 1H = 25%
  '30': 0.15,  // 30M = 15%
  '15': 0.10,  // 15M = 10%
  '5': 0.07,   // 5M = 7%
  '3': 0.03,   // 3M = 3%
});

// Position multiplier matrices (FROZEN)
const CONFLUENCE_MULTIPLIERS: Readonly<Record<number, number>> = Object.freeze({
  90: 2.5,
  80: 2.0,
  70: 1.5,
  60: 1.0,
  50: 0.7,
});

const QUALITY_MULTIPLIERS: Readonly<Record<string, number>> = Object.freeze({
  'EXTREME': 1.3,
  'HIGH': 1.1,
  'MEDIUM': 1.0,
});

const HTF_ALIGNMENT_MULTIPLIERS: Readonly<Record<string, number>> = Object.freeze({
  'PERFECT': 1.3,  // 4H + 1H aligned
  'GOOD': 1.15,    // Either 4H or 1H aligned
  'WEAK': 0.85,    // Only 1H, not 4H
  'COUNTER': 0.5,  // Against HTF bias
});

interface IDecisionEngine {
  makeDecision(
    signals: Map<string, StoredSignal>,
    phases: Map<string, StoredPhase>
  ): DecisionResult;
  
  calculateConfluence(
    signals: Map<string, StoredSignal>,
    direction: 'LONG' | 'SHORT'
  ): number;
  
  calculatePositionMultiplier(
    confluenceScore: number,
    entrySignal: EnrichedSignal,
    phases: Map<string, StoredPhase>
  ): DecisionBreakdown;
}
```


### 4. Paper Executor Component

Simulates realistic options execution with Greeks, spreads, and slippage.

```typescript
interface OptionContract {
  type: 'CALL' | 'PUT';
  strike: number;
  expiry: string; // YYYY-MM-DD
  dte: number;
}

interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

interface Fill {
  price: number;
  contracts: number;
  filled_contracts: number;
  spread_cost: number;
  slippage: number;
  fill_quality: 'FULL' | 'PARTIAL';
  commission: number;
}

interface Execution {
  option_type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;
  dte: number;
  contracts: number;
  entry_price: number;
  entry_iv: number;
  entry_delta: number;
  entry_theta: number;
  entry_gamma: number;
  entry_vega: number;
  spread_cost: number;
  slippage: number;
  fill_quality: 'FULL' | 'PARTIAL';
  filled_contracts: number;
  commission: number;
  underlying_at_entry: number;
  risk_amount: number;
}

// DTE selection based on timeframe
const DTE_RULES: Readonly<Record<string, () => number>> = Object.freeze({
  '3': () => 0,   // 0DTE for scalps
  '5': () => 0,   // 0DTE for scalps
  '15': () => getNextFridayDTE(), // Weekly
  '30': () => getNextFridayDTE(), // Weekly
  '60': () => getNextFridayDTE(), // Weekly
  '240': () => 30 + Math.floor(getDeterministicOffset() * 15), // Monthly
});

// Spread percentages by DTE
const SPREAD_PERCENTAGES: Readonly<Record<string, [number, number]>> = Object.freeze({
  '0DTE': [0.03, 0.05],    // 3-5%
  'WEEKLY': [0.02, 0.03],  // 2-3%
  'MONTHLY': [0.01, 0.02], // 1-2%
  'LEAP': [0.005, 0.01],   // 0.5-1%
});

interface IPaperExecutor {
  selectContract(signal: EnrichedSignal, decision: DecisionResult): OptionContract;
  simulateFill(contract: OptionContract, contracts: number): Fill;
  calculateGreeks(contract: OptionContract, underlyingPrice: number): Greeks;
  execute(signal: EnrichedSignal, decision: DecisionResult): Execution;
}
```

### 5. Ledger Component

Append-only immutable audit trail using PostgreSQL with TimescaleDB.

```typescript
interface LedgerEntry {
  // Identity
  id: string; // UUID
  created_at: number; // Unix timestamp
  engine_version: string;
  
  // Signal snapshot (frozen at decision time)
  signal: EnrichedSignal;
  
  // Phase context (if present)
  phase_context?: {
    regime_phase?: SatyPhaseWebhook;
    bias_phase?: SatyPhaseWebhook;
  };
  
  // Decision
  decision: 'EXECUTE' | 'WAIT' | 'SKIP';
  decision_reason: string;
  decision_breakdown: DecisionBreakdown;
  confluence_score: number;
  
  // Execution data (if executed)
  execution?: Execution;
  
  // Exit data (updated when closed)
  exit?: {
    exit_time: number;
    exit_price: number;
    exit_iv: number;
    exit_delta: number;
    underlying_at_exit: number;
    pnl_gross: number;
    pnl_net: number;
    hold_time_seconds: number;
    exit_reason: 'TARGET_1' | 'TARGET_2' | 'STOP_LOSS' | 'THETA_DECAY' | 'MANUAL';
    
    // P&L Attribution
    pnl_from_delta: number;
    pnl_from_iv: number;
    pnl_from_theta: number;
    pnl_from_gamma: number;
    
    // Costs
    total_commission: number;
    total_spread_cost: number;
    total_slippage: number;
  };
  
  // Market regime snapshot
  regime: {
    volatility: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
    trend: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
    liquidity: 'HIGH' | 'NORMAL' | 'LOW';
    iv_rank: number;
  };
  
  // Hypothetical tracking (for skipped trades)
  hypothetical?: {
    would_have_executed: boolean;
    would_have_hit_target_1: boolean;
    would_have_hit_target_2: boolean;
    would_have_hit_stop: boolean;
    hypothetical_pnl: number;
  };
}

interface ILedger {
  append(entry: Omit<LedgerEntry, 'id'>): Promise<LedgerEntry>;
  updateExit(id: string, exit: LedgerEntry['exit']): Promise<void>;
  updateHypothetical(id: string, hypothetical: LedgerEntry['hypothetical']): Promise<void>;
  get(id: string): Promise<LedgerEntry | null>;
  query(filters: LedgerQueryFilters): Promise<LedgerEntry[]>;
}

// Database schema (PostgreSQL + TimescaleDB)
/*
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engine_version VARCHAR(20) NOT NULL,
  signal JSONB NOT NULL,
  phase_context JSONB,
  decision VARCHAR(10) NOT NULL,
  decision_reason TEXT NOT NULL,
  decision_breakdown JSONB NOT NULL,
  confluence_score DECIMAL(5,2) NOT NULL,
  execution JSONB,
  exit JSONB,
  regime JSONB NOT NULL,
  hypothetical JSONB
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('ledger_entries', 'created_at', chunk_time_interval => INTERVAL '1 month');

-- Indexes
CREATE INDEX idx_ledger_decision ON ledger_entries (decision);
CREATE INDEX idx_ledger_option_type ON ledger_entries ((execution->>'option_type'));
CREATE INDEX idx_ledger_dte ON ledger_entries ((execution->>'dte'));
CREATE INDEX idx_ledger_timeframe ON ledger_entries ((signal->'signal'->>'timeframe'));
*/
```

### 6. Exit Attributor Component

Calculates P&L attribution to Greeks components.

```typescript
interface Attribution {
  pnl_gross: number;
  pnl_net: number;
  pnl_from_delta: number;
  pnl_from_iv: number;
  pnl_from_theta: number;
  pnl_from_gamma: number;
  commissions: number;
  spread_cost: number;
  slippage_cost: number;
  realized_r: number;
  win: boolean;
  hold_time_seconds: number;
}

interface IExitAttributor {
  attributePnL(entry: Execution, exit: ExitData): Attribution;
  calculateDeltaContribution(entry: Execution, exit: ExitData): number;
  calculateIVContribution(entry: Execution, exit: ExitData): number;
  calculateThetaContribution(entry: Execution, exit: ExitData): number;
  calculateGammaContribution(entry: Execution, exit: ExitData): number;
}
```

### 7. Event Bus Component

Decouples execution from learning with publish/subscribe pattern.

```typescript
type SystemEvent =
  | { type: 'SIGNAL_RECEIVED'; payload: EnrichedSignal }
  | { type: 'PHASE_RECEIVED'; payload: SatyPhaseWebhook }
  | { type: 'DECISION_MADE'; payload: DecisionResult }
  | { type: 'TRADE_EXECUTED'; payload: Execution }
  | { type: 'TRADE_SKIPPED'; payload: { reason: string; signal: EnrichedSignal } }
  | { type: 'TRADE_CLOSED'; payload: LedgerEntry }
  | { type: 'LEARNING_COMPLETED'; payload: LearningSuggestion[] };

interface IEventBus {
  publish(event: SystemEvent): void;
  subscribe(eventType: string, listener: (event: SystemEvent) => void): void;
  unsubscribe(eventType: string, listener: (event: SystemEvent) => void): void;
}

// CRITICAL: Execution can ONLY publish, Learning can ONLY subscribe
```

### 8. Learning Advisor Component (ISOLATED)

Generates advisory suggestions requiring human approval. Cannot import from execution modules.

```typescript
interface LearningSuggestion {
  id: string;
  scope: TradeFeatures;
  current_multiplier: number;
  suggested_multiplier: number;
  delta: number;
  confidence: number;
  evidence: {
    sample_size: number;
    win_rate: number;
    expectancy: number;
    avg_r: number;
    max_drawdown: number;
  };
  reasoning: string;
  created_at: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface TradeFeatures {
  trade_type: 'SCALP' | 'DAY' | 'SWING' | 'LEAP';
  dte_bucket: '0DTE' | 'WEEKLY' | 'MONTHLY' | 'LEAP';
  signal_quality: 'EXTREME' | 'HIGH' | 'MEDIUM';
  ai_score_bucket: 'EXTREME_PLUS' | 'EXTREME' | 'HIGH' | 'MEDIUM' | 'LOW';
  volatility_regime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
  trend_regime: string;
  market_session: string;
  day_of_week: string;
}

interface ILearningAdvisor {
  generateSuggestions(entries: LedgerEntry[]): LearningSuggestion[];
  // MUST NOT: execute changes, modify Decision_Engine, relax risk limits
}
```

### 9. Metrics Engine Component

Calculates descriptive performance metrics without recommendations.

```typescript
interface Metrics {
  status: 'VALID' | 'INSUFFICIENT_DATA';
  sample_size: number;
  required?: number;
  
  // Core metrics
  win_rate?: number;
  avg_win?: number;
  avg_loss?: number;
  avg_r?: number;
  expectancy?: number;
  max_drawdown?: number;
  profit_factor?: number;
  
  // Stability
  r_std?: number;
  avg_hold_time_hours?: number;
  
  // Attribution
  avg_delta_contribution?: number;
  avg_iv_contribution?: number;
  avg_theta_drag?: number;
}

interface RollingMetrics {
  '30d': Metrics;
  '60d': Metrics;
  '90d': Metrics;
}

interface IMetricsEngine {
  calculate(entries: LedgerEntry[], features?: TradeFeatures): Metrics;
  getRollingMetrics(entries: LedgerEntry[], features?: TradeFeatures): RollingMetrics;
  // MUST NOT: provide recommendations or tuning suggestions
}
```


## Data Models

### EnrichedSignal Schema

The canonical schema for incoming TradingView signals. This is the single source of truth.

```typescript
// See full interface in Components section
// Key validation rules:
// - signal.type: Must be 'LONG' or 'SHORT'
// - signal.timeframe: Must be '3', '5', '15', '30', '60', or '240'
// - signal.quality: Must be 'EXTREME', 'HIGH', or 'MEDIUM'
// - signal.ai_score: Must be 0-10.5
// - All numeric fields must be valid numbers
// - All required fields must be present
```

### SatyPhaseWebhook Schema

The canonical schema for SATY Phase Oscillator events.

```typescript
// See full interface in Components section
// Key validation rules:
// - meta.engine: Must be 'SATY_PO'
// - event.name: Must be valid phase event
// - confidence.confidence_score: Must be 0-100
// - execution_guidance.trade_allowed: Boolean
```

### TrendWebhook Schema

The canonical schema for multi-timeframe trend alignment data.

```typescript
interface TrendWebhook {
  ticker: string;
  exchange: string;
  timestamp: string;
  price: number;
  timeframes: {
    tf3min: TimeframeData;
    tf5min: TimeframeData;
    tf15min: TimeframeData;
    tf30min: TimeframeData;
    tf60min: TimeframeData;
    tf240min: TimeframeData;
    tf1week: TimeframeData;
    tf1month: TimeframeData;
  };
}

interface TimeframeData {
  direction: 'bullish' | 'bearish' | 'neutral';
  open: number;
  close: number;
}

// Key validation rules:
// - ticker: Must be valid symbol string
// - timeframes: All 8 timeframes must be present
// - direction: Must be 'bullish', 'bearish', or 'neutral'
// - price, open, close: Must be valid positive numbers
```

### Trend Alignment Calculation

```typescript
function calculateTrendAlignment(trend: TrendWebhook): TrendAlignment {
  const tfs = trend.timeframes;
  
  // Count directions
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  
  Object.values(tfs).forEach(tf => {
    if (tf.direction === 'bullish') bullish++;
    else if (tf.direction === 'bearish') bearish++;
    else neutral++;
  });
  
  // Determine dominant trend
  let dominant: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let alignment_score = 0;
  
  if (bullish > bearish && bullish > neutral) {
    dominant = 'bullish';
    alignment_score = (bullish / 8) * 100;
  } else if (bearish > bullish && bearish > neutral) {
    dominant = 'bearish';
    alignment_score = (bearish / 8) * 100;
  } else {
    dominant = 'neutral';
    alignment_score = (neutral / 8) * 100;
  }
  
  // Determine strength
  let strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CHOPPY';
  if (alignment_score >= 75) strength = 'STRONG';      // 6+ aligned
  else if (alignment_score >= 62.5) strength = 'MODERATE';  // 5 aligned
  else if (alignment_score >= 50) strength = 'WEAK';        // 4 aligned
  else strength = 'CHOPPY';  // Less than 4 aligned
  
  // Get HTF bias (4H)
  const htf_bias = tfs.tf240min.direction;
  
  // Get LTF bias (average of 3M and 5M)
  const ltf_directions = [tfs.tf3min.direction, tfs.tf5min.direction];
  const ltf_bullish = ltf_directions.filter(d => d === 'bullish').length;
  const ltf_bearish = ltf_directions.filter(d => d === 'bearish').length;
  const ltf_bias = ltf_bullish > ltf_bearish ? 'bullish' :
                   ltf_bearish > ltf_bullish ? 'bearish' : 'neutral';
  
  return {
    bullish_count: bullish,
    bearish_count: bearish,
    neutral_count: neutral,
    alignment_score,
    dominant_trend: dominant,
    strength,
    htf_bias,
    ltf_bias
  };
}
```

### Phase Decay Time Calculation

```typescript
function calculatePhaseDecayTime(phase: SatyPhaseWebhook): number {
  const timeframe = phase.timeframe.event_tf;
  const decayMinutes = getPhaseDecayMinutes(timeframe);
  return phase.risk_hints.time_decay_minutes || decayMinutes;
}

function getPhaseDecayMinutes(timeframe: string): number {
  const decayMap: Record<string, number> = {
    '15m': 45,    // 45 minutes
    '30m': 90,    // 90 minutes  
    '1h': 180,    // 3 hours
    '4h': 720,    // 12 hours
    '1D': 1440,   // 24 hours
  };
  
  return decayMap[timeframe] || 60; // Default 1 hour
}
```

### Enhanced Decision Engine with Phase and Trend Integration

```typescript
function getPhaseBoosts(
  signal: EnrichedSignal, 
  phases: Map<string, StoredPhase>,
  trends: Map<string, StoredTrend>
): { confidence_boost: number; position_boost: number } {
  let confidence_boost = 0;
  let position_boost = 0;
  
  // Phase boosts
  const regimePhase = getPhaseByTimeframe(phases, '4h');
  const biasPhase = getPhaseByTimeframe(phases, '1h');
  
  if (regimePhase?.phase.confidence.htf_alignment) {
    confidence_boost += 0.20; // +20% confidence boost
    
    if (regimePhase.phase.confidence.confidence_score >= 70) {
      position_boost += 0.10; // +10% position boost
    }
  }
  
  // Trend boosts
  const ticker = signal.instrument.ticker;
  const trendData = trends.get(ticker);
  
  if (trendData) {
    const alignment = calculateTrendAlignment(trendData.trend);
    
    // Strong trend alignment boost
    if (alignment.strength === 'STRONG') {
      position_boost += 0.30; // +30% position boost
    }
    
    // HTF trend alignment boost
    if (alignment.htf_bias === signal.signal.type.toLowerCase()) {
      confidence_boost += 0.15; // +15% confidence boost
    }
  }
  
  return { confidence_boost, position_boost };
}
```

### Signal Validity Calculation

```typescript
function calculateSignalValidity(signal: EnrichedSignal): number {
  const tf = parseInt(signal.signal.timeframe);
  let validityMinutes = tf; // Base = timeframe duration
  
  // Timeframe role multiplier
  const roleMultipliers: Record<string, number> = {
    '240': 2.0, '60': 1.5, '30': 1.0, '15': 1.0, '5': 1.0, '3': 1.0
  };
  validityMinutes *= roleMultipliers[signal.signal.timeframe] || 1.0;
  
  // Quality multiplier
  const qualityMultipliers: Record<string, number> = {
    'EXTREME': 1.5, 'HIGH': 1.0, 'MEDIUM': 0.75
  };
  validityMinutes *= qualityMultipliers[signal.signal.quality];
  
  // Session multiplier
  const sessionMultipliers: Record<string, number> = {
    'OPEN': 0.8, 'MIDDAY': 1.0, 'POWER_HOUR': 0.7, 'AFTERHOURS': 0.5
  };
  validityMinutes *= sessionMultipliers[signal.time_context.market_session];
  
  // Enforce bounds
  validityMinutes = Math.max(validityMinutes, tf); // Min = base TF
  validityMinutes = Math.min(validityMinutes, 720); // Max = 12 hours
  
  return validityMinutes * 60 * 1000; // Return milliseconds
}
```

### Position Multiplier Calculation

```typescript
function calculatePositionMultiplier(
  confluenceScore: number,
  signal: EnrichedSignal,
  phases: Map<string, StoredPhase>
): DecisionBreakdown {
  let multiplier = 1.0;
  
  // 1. Confluence (PRIMARY)
  const confluenceMult = getConfluenceMultiplier(confluenceScore);
  multiplier *= confluenceMult;
  
  // 2. Quality
  const qualityMult = QUALITY_MULTIPLIERS[signal.signal.quality];
  multiplier *= qualityMult;
  
  // 3. HTF Alignment (CRITICAL)
  const htfMult = getHTFAlignmentMultiplier(signal, phases);
  multiplier *= htfMult;
  
  // 4. R:R Ratio
  const rrMult = getRRMultiplier(signal.risk.rr_ratio_t1);
  multiplier *= rrMult;
  
  // 5. Volume
  const volumeMult = getVolumeMultiplier(signal.market_context.volume_vs_avg);
  multiplier *= volumeMult;
  
  // 6. Trend Strength
  const trendMult = getTrendMultiplier(signal.trend.strength);
  multiplier *= trendMult;
  
  // 7. Session
  const sessionMult = SESSION_MULTIPLIERS[signal.time_context.market_session];
  multiplier *= sessionMult;
  
  // 8. Day of Week
  const dayMult = DAY_MULTIPLIERS[signal.time_context.day_of_week];
  multiplier *= dayMult;
  
  // 9. Phase boosts
  const phaseBoosts = getPhaseBoosts(signal, phases);
  multiplier *= (1 + phaseBoosts.confidence_boost);
  multiplier *= (1 + phaseBoosts.position_boost);
  
  // 10. Safety caps
  multiplier = Math.max(0.5, Math.min(3.0, multiplier));
  
  return {
    confluence_multiplier: confluenceMult,
    quality_multiplier: qualityMult,
    htf_alignment_multiplier: htfMult,
    rr_multiplier: rrMult,
    volume_multiplier: volumeMult,
    trend_multiplier: trendMult,
    session_multiplier: sessionMult,
    day_multiplier: dayMult,
    phase_confidence_boost: phaseBoosts.confidence_boost,
    phase_position_boost: phaseBoosts.position_boost,
    final_multiplier: multiplier,
  };
}

function getConfluenceMultiplier(score: number): number {
  if (score >= 90) return 2.5;
  if (score >= 80) return 2.0;
  if (score >= 70) return 1.5;
  if (score >= 60) return 1.0;
  if (score >= 50) return 0.7;
  return 0.5;
}

function getRRMultiplier(rr: number): number {
  if (rr >= 5.0) return 1.2;
  if (rr >= 4.0) return 1.15;
  if (rr >= 3.0) return 1.1;
  if (rr >= 2.0) return 1.0;
  if (rr >= 1.5) return 0.85;
  return 0.5;
}

function getVolumeMultiplier(volumeRatio: number): number {
  if (volumeRatio >= 1.5) return 1.1;
  if (volumeRatio >= 0.8) return 1.0;
  return 0.7;
}

function getTrendMultiplier(strength: number): number {
  if (strength >= 80) return 1.2;
  if (strength >= 60) return 1.0;
  return 0.8;
}

const SESSION_MULTIPLIERS: Record<string, number> = {
  'OPEN': 0.9,
  'MIDDAY': 1.0,
  'POWER_HOUR': 0.85,
  'AFTERHOURS': 0.5,
};

const DAY_MULTIPLIERS: Record<string, number> = {
  'MONDAY': 0.95,
  'TUESDAY': 1.1,
  'WEDNESDAY': 1.0,
  'THURSDAY': 0.95,
  'FRIDAY': 0.85,
};
```

### Greeks Calculation (Black-Scholes Approximation)

```typescript
function calculateGreeks(
  contract: OptionContract,
  underlyingPrice: number,
  riskFreeRate: number = 0.05
): Greeks {
  const S = underlyingPrice;
  const K = contract.strike;
  const T = contract.dte / 365;
  const r = riskFreeRate;
  const sigma = estimateIV(contract); // Implied volatility
  
  // Prevent division by zero for 0DTE
  const sqrtT = Math.max(Math.sqrt(T), 0.001);
  
  // Calculate d1, d2
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  
  // Delta
  const delta = contract.type === 'CALL'
    ? normalCDF(d1)
    : normalCDF(d1) - 1;
  
  // Gamma
  const gamma = normalPDF(d1) / (S * sigma * sqrtT);
  
  // Theta (per day)
  const theta = contract.type === 'CALL'
    ? -(S * normalPDF(d1) * sigma) / (2 * sqrtT) / 365
    : (-(S * normalPDF(d1) * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  
  // Vega (per 1% IV change)
  const vega = S * normalPDF(d1) * sqrtT / 100;
  
  return {
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(6)),
    theta: parseFloat(theta.toFixed(4)),
    vega: parseFloat(vega.toFixed(4)),
    iv: sigma,
  };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Schema Validation Correctness
*For any* webhook payload, the Webhook_Receiver SHALL correctly accept valid EnrichedSignal payloads and reject invalid payloads with descriptive errors.
**Validates: Requirements 1.1, 1.4**

### Property 2: Signal Validity Calculation
*For any* valid EnrichedSignal, the calculated validity period SHALL equal: base_timeframe × role_multiplier × quality_multiplier × session_multiplier, clamped between base_timeframe and 720 minutes.
**Validates: Requirements 1.6, 1.8, 1.9, 1.10, 1.11**

### Property 3: Signal Expiry Enforcement
*For any* stored signal, after its validity period has elapsed, the signal SHALL NOT be present in active storage.
**Validates: Requirements 1.2, 1.3**

### Property 4: Signal Conflict Resolution
*For any* two signals arriving for the same timeframe, the Timeframe_Store SHALL retain the signal with higher quality, or the existing signal if qualities are equal.
**Validates: Requirements 1.12**

### Property 5: Decision Engine Determinism
*For any* identical set of inputs (signals and phases), the Decision_Engine SHALL produce identical outputs (decision, breakdown, recommended_contracts).
**Validates: Requirements 2.5, 15.3**

### Property 6: Decision Output Validity
*For any* valid input to the Decision_Engine, the output decision SHALL be exactly one of: EXECUTE, WAIT, or SKIP.
**Validates: Requirements 2.2**

### Property 7: Decision Breakdown Completeness
*For any* decision made by the Decision_Engine, the breakdown SHALL contain all required multiplier fields (confluence, quality, htf_alignment, rr, volume, trend, session, day, phase boosts, final).
**Validates: Requirements 2.3**

### Property 8: Confluence Score Calculation
*For any* set of active signals, the confluence score SHALL equal the sum of (weight × 1) for aligned signals, where weights are: 4H=40%, 1H=25%, 30M=15%, 15M=10%, 5M=7%, 3M=3%.
**Validates: Requirements 3.1, 3.2**

### Property 9: Confluence Threshold Enforcement
*For any* input where confluence score is below 60%, the Decision_Engine SHALL output WAIT.
**Validates: Requirements 3.3**

### Property 10: HTF Bias Requirement
*For any* input without a 4H or 1H signal with ai_score >= 6, the Decision_Engine SHALL output WAIT.
**Validates: Requirements 3.4**

### Property 11: Position Multiplier Bounds
*For any* calculated position multiplier, the final value SHALL be clamped between 0.5 and 3.0.
**Validates: Requirements 3.24**

### Property 12: Skip on Low Multiplier
*For any* input where the calculated multiplier (before capping) falls below 0.5, the Decision_Engine SHALL output SKIP.
**Validates: Requirements 3.25**

### Property 13: Confluence Multiplier Mapping
*For any* confluence score, the correct multiplier SHALL be applied: 90%+=2.5x, 80%+=2.0x, 70%+=1.5x, 60%+=1.0x, 50%+=0.7x.
**Validates: Requirements 3.6, 3.7, 3.8, 3.9, 3.10**

### Property 14: Quality Multiplier Mapping
*For any* signal quality, the correct multiplier SHALL be applied: EXTREME=1.3x, HIGH=1.1x, MEDIUM=1.0x.
**Validates: Requirements 3.11, 3.12**

### Property 15: HTF Alignment Multiplier Mapping
*For any* HTF alignment state, the correct multiplier SHALL be applied: PERFECT=1.3x, GOOD=1.15x, WEAK=0.85x, COUNTER=0.5x.
**Validates: Requirements 3.15, 3.16, 3.17, 3.18**

### Property 16: R:R Multiplier Mapping
*For any* R:R ratio, the correct multiplier SHALL be applied: >=5.0=1.2x, >=4.0=1.15x, >=3.0=1.1x, >=2.0=1.0x, >=1.5=0.85x, <1.5=0.5x.
**Validates: Requirements 3.19**

### Property 17: Ledger Append-Only Invariant
*For any* ledger operation, delete and overwrite operations SHALL fail, and only append operations SHALL succeed.
**Validates: Requirements 4.1**

### Property 18: Ledger Entry Completeness
*For any* decision recorded in the ledger, the entry SHALL contain all required fields: id, created_at, engine_version, signal snapshot, decision, decision_breakdown, regime.
**Validates: Requirements 4.2**

### Property 19: Option Type Selection
*For any* signal direction, the Paper_Executor SHALL select: LONG → CALL, SHORT → PUT.
**Validates: Requirements 5.1**

### Property 20: DTE Selection by Timeframe
*For any* signal timeframe, the Paper_Executor SHALL select DTE: <=5M → 0DTE, <=60M → weekly, <=240M → monthly, >240M → LEAPS.
**Validates: Requirements 5.2**

### Property 21: Conservative Fill Pricing
*For any* simulated fill, entry_price SHALL be >= theoretical_ask and exit_price SHALL be <= theoretical_bid.
**Validates: Requirements 5.3**

### Property 22: Partial Fill Simulation
*For any* order exceeding 50 contracts, filled_contracts SHALL be approximately 85% of requested contracts.
**Validates: Requirements 5.6**

### Property 23: Greeks Mathematical Validity
*For any* option contract, calculated Greeks SHALL satisfy: -1 <= delta <= 1, gamma >= 0, theta <= 0 (for long options), vega >= 0.
**Validates: Requirements 5.7**

### Property 24: P&L Attribution Sum
*For any* closed trade, pnl_from_delta + pnl_from_iv + pnl_from_theta + pnl_from_gamma SHALL approximately equal pnl_gross (within rounding tolerance).
**Validates: Requirements 6.1, 6.2**

### Property 25: R-Multiple Calculation
*For any* closed trade, realized_r SHALL equal pnl_net / risk_amount.
**Validates: Requirements 6.4**

### Property 26: Trade Type Classification
*For any* timeframe, trade_type SHALL be: <=5M → SCALP, <=60M → DAY, <=240M → SWING, >240M → LEAP.
**Validates: Requirements 7.1**

### Property 27: DTE Bucketing
*For any* DTE value, bucket SHALL be: 0 → 0DTE, 1-7 → WEEKLY, 8-45 → MONTHLY, >45 → LEAP.
**Validates: Requirements 7.2**

### Property 28: AI Score Bucketing
*For any* AI score, bucket SHALL be: >=9 → EXTREME_PLUS, >=8 → EXTREME, >=7 → HIGH, >=6 → MEDIUM, <6 → LOW.
**Validates: Requirements 7.3**

### Property 29: Metrics Minimum Sample Size
*For any* input with fewer than 30 trades, Metrics_Engine SHALL return status INSUFFICIENT_DATA.
**Validates: Requirements 8.1**

### Property 30: Learning Suggestion Sample Size
*For any* input with fewer than 30 trades, Learning_Advisor SHALL generate zero suggestions.
**Validates: Requirements 10.1**

### Property 31: Learning Suggestion Bounds
*For any* learning suggestion, the delta SHALL be within [-0.15, 0.15] of current_multiplier AND |delta| >= 0.05.
**Validates: Requirements 10.2, 10.3**

### Property 32: Phase Confidence Threshold
*For any* phase with confidence_score < 65, the Decision_Engine SHALL set trade_allowed to false.
**Validates: Requirements 18.5**

### Property 33: Test Generator Determinism
*For any* identical input parameters, the Signal_Generator and Phase_Generator SHALL produce identical output.
**Validates: Requirements 19.5, 21.5**

### Property 34: Trend Alignment Score Calculation
*For any* TrendWebhook with 8 timeframes, the alignment_score SHALL equal (count_of_dominant_direction / 8) × 100.
**Validates: Requirements 24.4**

### Property 35: Trend Strength Classification
*For any* alignment_score, strength SHALL be: >=75% → STRONG, >=62.5% → MODERATE, >=50% → WEAK, <50% → CHOPPY.
**Validates: Requirements 24.5**

### Property 36: Phase Store TTL Enforcement
*For any* stored phase, after its time_decay_minutes have elapsed, the phase SHALL NOT be present in active storage.
**Validates: Requirements 18.7, 25.1**

### Property 37: Regime Context Alignment
*For any* symbol with 2+ active phases sharing the same local_bias, getRegimeContext SHALL return is_aligned = true.
**Validates: Requirements 25.2**

### Property 38: Trend Position Boost Application
*For any* trend alignment >= 75% (STRONG), the Decision_Engine SHALL apply +30% position boost.
**Validates: Requirements 24.9**

### Property 39: Phase Confidence Boost Application
*For any* phase with htf_alignment = true, the Decision_Engine SHALL apply +20% confidence boost.
**Validates: Requirements 18.9**

## Error Handling

### Webhook Errors

| Error Type | HTTP Status | Response | Action |
|------------|-------------|----------|--------|
| Invalid JSON | 400 | `{ error: "Invalid JSON payload" }` | Log and reject |
| Schema validation failed | 400 | `{ error: "Schema validation failed", details: [...] }` | Log and reject |
| Missing required field | 400 | `{ error: "Missing required field: {field}" }` | Log and reject |
| Invalid timeframe | 400 | `{ error: "Invalid timeframe: {value}" }` | Log and reject |
| Server error | 500 | `{ error: "Internal server error" }` | Log, alert, reject |

### Decision Engine Errors

| Error Type | Handling | Fallback |
|------------|----------|----------|
| No active signals | Return WAIT | Log state |
| Calculation overflow | Cap at bounds | Log warning |
| Missing phase data | Proceed without phase boost | Log info |
| Engine frozen violation | Throw error | Block operation |

### Ledger Errors

| Error Type | Handling | Recovery |
|------------|----------|----------|
| Database connection failed | Retry with backoff | Queue writes |
| Write failed | Retry 3 times | Alert operator |
| Duplicate ID | Generate new UUID | Retry |
| Constraint violation | Reject operation | Log error |

### Paper Executor Errors

| Error Type | Handling | Fallback |
|------------|----------|----------|
| Greeks calculation failed | Use default values | Log warning |
| Invalid contract params | Reject execution | Return error |
| Price calculation failed | Use conservative estimate | Log warning |

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

- Schema validation with valid/invalid payloads
- Validity calculation edge cases (min/max bounds)
- Confluence calculation with various signal combinations
- Position multiplier calculation at boundary values
- Greeks calculation against known values
- Ledger CRUD operations
- Feature extraction bucketing

### Property-Based Tests

Property-based tests verify universal properties across many generated inputs. Use `fast-check` library for TypeScript.

Configuration:
- Minimum 100 iterations per property test
- Tag format: `Feature: options-trading-platform, Property {N}: {description}`

Key property tests:
1. Decision engine determinism (same inputs → same outputs)
2. Validity calculation formula correctness
3. Multiplier bounds enforcement
4. Ledger append-only invariant
5. Greeks mathematical validity
6. P&L attribution sum correctness

### Integration Tests

- End-to-end webhook processing flow
- Signal → Decision → Execution → Ledger flow
- Multi-timeframe confluence scenarios
- Phase integration with signal processing

### Scenario Tests

Pre-built scenarios from testing interface:
- Perfect Alignment (should EXECUTE)
- Counter-Trend (should SKIP)
- Low Volume (should SKIP)
- Phase Confirmation (should EXECUTE with boost)
- Signal Expiry (verify timeout)
- Complete Trade Flow (full sequence)
