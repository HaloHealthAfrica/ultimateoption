/**
 * Webhook-specific types for Phase 2.5 Decision Engine
 * 
 * These types define the expected schemas for incoming webhooks
 * from various sources (TradingView, SATY, MTF, etc.)
 */

// ============================================================================
// SATY PHASE WEBHOOK SCHEMA
// ============================================================================

export interface SatyPhaseWebhook {
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

// ============================================================================
// MTF DOTS WEBHOOK SCHEMA
// ============================================================================

export interface TimeframeData {
  direction: 'bullish' | 'bearish' | 'neutral';
  open: number;
  close: number;
}

export interface MtfDotsWebhook {
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

// ============================================================================
// ULTIMATE OPTIONS WEBHOOK SCHEMA
// ============================================================================

export interface UltimateOptionsWebhook {
  signal: {
    type: 'LONG' | 'SHORT';
    ai_score: number; // 0-10.5
    quality: 'EXTREME' | 'HIGH' | 'MEDIUM';
  };
  
  instrument: {
    ticker: string;
    exchange: string;
    current_price: number;
  };
  
  components: string[];
  
  risk: {
    rr_ratio_t1: number;
    rr_ratio_t2: number;
  };
}

// ============================================================================
// STRAT EXECUTION WEBHOOK SCHEMA
// ============================================================================

export interface StratExecutionWebhook {
  setup_valid: boolean;
  liquidity_ok: boolean;
  quality: 'A' | 'B' | 'C';
  symbol: string;
  exchange: string;
  price: number;
}

// ============================================================================
// TRADINGVIEW SIGNAL WEBHOOK SCHEMA (LEGACY SUPPORT)
// ============================================================================

export interface TradingViewSignalWebhook {
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

// ============================================================================
// WEBHOOK PAYLOAD WRAPPER
// ============================================================================

export interface WebhookPayload {
  text: string; // Stringified JSON
}

// ============================================================================
// WEBHOOK UNION TYPES
// ============================================================================

export type AnyWebhook = 
  | SatyPhaseWebhook
  | MtfDotsWebhook
  | UltimateOptionsWebhook
  | StratExecutionWebhook
  | TradingViewSignalWebhook;