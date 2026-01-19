/**
 * Core types for Phase 2.5 Decision Engine
 * 
 * These types define the canonical data structures used throughout
 * the deterministic decision-making system.
 */

// ============================================================================
// FUNDAMENTAL TYPES
// ============================================================================

export type TradeDirection = "LONG" | "SHORT";
export type EngineAction = "EXECUTE" | "WAIT" | "SKIP";
export type WebhookSource = 
  | "SATY_PHASE" 
  | "MTF_DOTS" 
  | "ULTIMATE_OPTIONS" 
  | "STRAT_EXEC"
  | "TRADINGVIEW_SIGNAL";

// ============================================================================
// DECISION CONTEXT - CANONICAL INPUT FORMAT
// ============================================================================

export interface DecisionContext {
  meta: {
    engineVersion: string;
    receivedAt: number;
    completeness: number; // 0-1 based on available sources
  };
  
  instrument: {
    symbol: string;
    exchange: string;
    price: number;
  };
  
  // From SATY Phase webhook
  regime: {
    phase: 1 | 2 | 3 | 4;
    phaseName: "ACCUMULATION" | "MARKUP" | "DISTRIBUTION" | "MARKDOWN";
    volatility: "LOW" | "NORMAL" | "HIGH";
    confidence: number; // 0-100
    bias: "LONG" | "SHORT" | "NEUTRAL";
  };
  
  // From MTF Dots webhook  
  alignment: {
    tfStates: Record<string, "BULLISH" | "BEARISH" | "NEUTRAL">;
    bullishPct: number; // 0-100
    bearishPct: number; // 0-100
  };
  
  // From Ultimate Options webhook
  expert: {
    direction: TradeDirection;
    aiScore: number; // 0-10.5
    quality: "EXTREME" | "HIGH" | "MEDIUM";
    components: string[];
    rr1: number;
    rr2: number;
  };
  
  // From STRAT webhook
  structure: {
    validSetup: boolean;
    liquidityOk: boolean;
    executionQuality: "A" | "B" | "C";
  };
}

// ============================================================================
// MARKET CONTEXT - REAL-TIME MARKET INTELLIGENCE
// ============================================================================

export interface MarketContext {
  // From Tradier API
  options?: {
    putCallRatio: number;
    ivPercentile: number; // 0-100
    gammaBias: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
    optionVolume: number;
    maxPain: number;
  };
  
  // From TwelveData API
  stats?: {
    atr14: number;
    rv20: number; // Realized volatility 20-day
    trendSlope: number; // -1 to 1
    rsi: number;
    volume: number;
    volumeRatio: number; // vs 20-day average
  };
  
  // From Alpaca API
  liquidity?: {
    spreadBps: number;
    depthScore: number; // 0-100
    tradeVelocity: "SLOW" | "NORMAL" | "FAST";
    bidSize: number;
    askSize: number;
  };
  
  // Metadata
  fetchTime: number;
  completeness: number; // 0-1 based on successful API calls
  errors: string[]; // Failed API calls
}

// ============================================================================
// DECISION OUTPUT - CANONICAL OUTPUT FORMAT
// ============================================================================

export interface DecisionPacket {
  action: EngineAction;
  direction?: TradeDirection;
  finalSizeMultiplier: number;
  confidenceScore: number;
  reasons: string[];
  engineVersion: string;
  
  // Detailed breakdown for audit
  gateResults: {
    regime: GateResult;
    structural: GateResult;
    market: GateResult;
  };
  
  // Input snapshots for reproducibility
  inputContext: DecisionContext;
  marketSnapshot: MarketContext;
  timestamp: number;
}

export interface GateResult {
  passed: boolean;
  reason?: string;
  score?: number;
}

// ============================================================================
// WEBHOOK PROCESSING TYPES
// ============================================================================

export interface NormalizedPayload {
  source: WebhookSource;
  partial: Partial<DecisionContext>;
  timestamp: number;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  processingTime: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface EngineConfig {
  version: string;
  
  // Gate thresholds
  gates: {
    maxSpreadBps: number;
    maxAtrSpike: number;
    minDepthScore: number;
    minConfidence: number;
    restrictedSessions: string[];
  };
  
  // Phase rules
  phases: Record<number, {
    allowed: TradeDirection[];
    sizeCap: number;
  }>;
  
  // Multipliers
  volatilityCaps: Record<string, number>;
  qualityBoosts: Record<string, number>;
  sizeBounds: {
    min: number;
    max: number;
  };
  
  // Confidence and scoring thresholds
  confidenceThresholds: {
    execute: number;
    wait: number;
    skip: number;
  };
  
  aiScoreThresholds: {
    minimum: number;
    penaltyBelow: number;
  };
  
  alignmentThresholds: {
    strongAlignment: number;
    bonusMultiplier: number;
  };
  
  // Context rules
  contextRules: {
    maxAge: number;
    requiredSources: WebhookSource[];
    optionalSources: WebhookSource[];
  };
  
  // API configuration
  feeds: {
    tradier: FeedConfig;
    twelveData: FeedConfig;
    alpaca: FeedConfig;
  };
  
  // Timeouts
  timeouts: {
    webhookProcessing: number;
    marketContext: number;
    decisionEngine: number;
  };
}

export interface FeedConfig {
  enabled: boolean;
  timeout: number;
  retries: number;
  apiKey?: string;
  baseUrl: string;
  fallbackValues: unknown;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export enum WebhookErrorType {
  INVALID_JSON = "INVALID_JSON",
  SCHEMA_VALIDATION = "SCHEMA_VALIDATION", 
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  UNKNOWN_SOURCE = "UNKNOWN_SOURCE",
  PROCESSING_TIMEOUT = "PROCESSING_TIMEOUT"
}

export interface WebhookError {
  type: WebhookErrorType;
  message: string;
  details?: unknown;
  timestamp: number;
}

export enum FeedErrorType {
  TIMEOUT = "TIMEOUT",
  API_ERROR = "API_ERROR", 
  RATE_LIMITED = "RATE_LIMITED",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  NETWORK_ERROR = "NETWORK_ERROR"
}

export interface FeedError {
  provider: "tradier" | "twelvedata" | "alpaca" | "marketdata";
  type: FeedErrorType;
  message: string;
  timestamp: number;
  retryable: boolean;
}

export enum EngineErrorType {
  INCOMPLETE_CONTEXT = "INCOMPLETE_CONTEXT",
  INVALID_INPUT = "INVALID_INPUT",
  CALCULATION_ERROR = "CALCULATION_ERROR",
  RULE_VIOLATION = "RULE_VIOLATION"
}

export interface EngineError extends Error {
  type: EngineErrorType;
  context?: DecisionContext;
  marketContext?: MarketContext;
  timestamp: number;
}