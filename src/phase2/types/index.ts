/**
 * Phase 2 Decision Engine - Core Type Definitions
 * 
 * This file contains all TypeScript interfaces for the deterministic decision engine.
 * All types are immutable and designed for complete auditability.
 */

// Engine Version - IMMUTABLE
export const ENGINE_VERSION = '2.0.0' as const;

// Decision Types
export type Decision = 'APPROVE' | 'REJECT';
export type SignalType = 'LONG' | 'SHORT';
export type MarketSession = 'OPEN' | 'MIDDAY' | 'POWER_HOUR' | 'AFTERHOURS';
export type GammaBias = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
export type TradeVelocity = 'SLOW' | 'NORMAL' | 'FAST';
export type DataSource = 'API' | 'FALLBACK';

// Input Types from TradingView
export interface TradingViewSignal {
  signal: {
    type: SignalType;
    aiScore: number;
    timestamp: number;
    symbol: string;
  };
  satyPhase?: {
    phase: number;
    confidence: number;
  };
  marketSession: MarketSession;
}

export interface SatyPhaseWebhook {
  phase: number;
  confidence: number;
  symbol: string;
  timestamp: number;
}

// Canonical Decision Context
export interface DecisionContext {
  indicator: {
    signalType: SignalType;
    aiScore: number;
    satyPhase: number;
    marketSession: MarketSession;
    symbol: string;
    timestamp: number;
  };
  
  market?: MarketContext;
}

// Market Context from External Providers
export interface MarketContext {
  optionsData: {
    putCallRatio: number;
    ivPercentile: number;
    gammaBias: GammaBias;
    dataSource: DataSource;
  };
  
  marketStats: {
    atr14: number;
    rv20: number;
    trendSlope: number;
    dataSource: DataSource;
  };
  
  liquidityData: {
    spreadBps: number;
    depthScore: number;
    tradeVelocity: TradeVelocity;
    dataSource: DataSource;
  };
}

// Risk Gate Results
export interface GateResult {
  gate: string;
  passed: boolean;
  reason?: string;
  value?: number;
  threshold?: number;
}

// Audit Trail
export interface AuditTrail {
  timestamp: string;
  symbol: string;
  session: string;
  context_snapshot: DecisionContext;
  gate_results: GateResult[];
  gate_results_object?: Record<string, GateResult>; // Object format for backward compatibility
  processing_time_ms: number;
}

// Decision Output
export interface DecisionOutput {
  decision: Decision;
  direction: SignalType; // Always present
  symbol: string; // Add symbol field
  confidence: number; // Always present (0 for REJECT)
  engine_version: string;
  timestamp: string; // Add timestamp field
  gates: {
    passed: string[];
    failed: string[];
  };
  reasons?: string[];
  audit: AuditTrail;
}

// Provider Response Types
export interface TradierOptionsData {
  putCallRatio: number;
  ivPercentile: number;
  gammaBias: GammaBias;
}

export interface TwelveDataStats {
  atr: {
    value: number;
    period: 14;
  };
  realizedVolatility: {
    value: number;
    period: 20;
  };
  trendSlope: number;
}

export interface AlpacaLiquidityData {
  spread: {
    bps: number;
  };
  depth: {
    score: number;
  };
  velocity: TradeVelocity;
}

// Provider Result Wrapper
export interface ProviderResult<T> {
  data: T;
  source: DataSource;
  error?: string;
}

// Configuration Types
export interface Config {
  tradier: {
    apiKey: string;
    baseUrl: string;
  };
  twelveData: {
    apiKey: string;
    baseUrl: string;
  };
  alpaca: {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
  };
  server: {
    port: number;
    webhookSecret?: string;
  };
}

// Performance Metrics
export interface PerformanceMetrics {
  requestCount: number;
  averageLatency: number;
  p95Latency: number;
  errorRate: number;
  providerFailureRates: {
    tradier: number;
    twelveData: number;
    alpaca: number;
  };
}

// Health Check Response
export interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  version: string;
  providers: {
    tradier: 'healthy' | 'unhealthy';
    twelveData: 'healthy' | 'unhealthy';
    alpaca: 'healthy' | 'unhealthy';
  };
}