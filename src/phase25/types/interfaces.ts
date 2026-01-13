/**
 * Interface definitions for Phase 2.5 Decision Engine components
 * 
 * These interfaces define the contracts for all major system components
 * ensuring proper separation of concerns and testability.
 */

import { 
  DecisionContext, 
  MarketContext, 
  DecisionPacket, 
  NormalizedPayload,
  WebhookResponse,
  ValidationResult,
  WebhookSource,
  GateResult,
  EngineConfig
} from './core';

import { AnyWebhook } from './webhooks';

// ============================================================================
// WEBHOOK SERVICE INTERFACES
// ============================================================================

export interface IWebhookService {
  // Main webhook endpoints
  handleSignalWebhook(payload: any): Promise<WebhookResponse>;
  handleSatyPhaseWebhook(payload: any): Promise<WebhookResponse>;
  
  // Authentication and validation
  validateSignature(payload: string, signature: string): boolean;
  validateSchema(payload: any, source: WebhookSource): ValidationResult;
}

export interface AuthConfig {
  hmacSecret?: string;
  bearerToken?: string;
  requireAuth: boolean;
}

// ============================================================================
// NORMALIZER INTERFACES
// ============================================================================

export interface INormalizer {
  detectSource(payload: any): WebhookSource;
  normalize(payload: any, source: WebhookSource): NormalizedPayload;
}

export interface ISatyMapper {
  mapToRegime(payload: any): DecisionContext['regime'];
}

export interface IMtfMapper {
  mapToAlignment(payload: any): DecisionContext['alignment'];
}

export interface IOptionsMapper {
  mapToExpert(payload: any): DecisionContext['expert'];
}

export interface IStratMapper {
  mapToStructure(payload: any): DecisionContext['structure'];
}

// ============================================================================
// MARKET CONTEXT INTERFACES
// ============================================================================

export interface IMarketContextBuilder {
  buildContext(symbol: string): Promise<MarketContext>;
  
  // Individual feed methods
  getTradierOptions(symbol: string): Promise<MarketContext['options']>;
  getTwelveDataStats(symbol: string): Promise<MarketContext['stats']>;
  getAlpacaLiquidity(symbol: string): Promise<MarketContext['liquidity']>;
}

// ============================================================================
// CONTEXT STORE INTERFACES
// ============================================================================

export interface IContextStore {
  update(partial: Partial<DecisionContext>, source: WebhookSource): void;
  build(): DecisionContext | null;
  isComplete(): boolean;
  getLastUpdate(source: WebhookSource): number | null;
  clear(): void;
}

export interface StoredContext {
  regime?: DecisionContext['regime'];
  alignment?: DecisionContext['alignment'];
  expert?: DecisionContext['expert'];
  structure?: DecisionContext['structure'];
  instrument?: DecisionContext['instrument'];
  lastUpdated: Record<WebhookSource, number>;
}

export interface CompletenessRules {
  requiredSources: WebhookSource[];
  optionalSources: WebhookSource[];
  maxAge: number; // milliseconds before context expires
}

// ============================================================================
// DECISION ENGINE INTERFACES
// ============================================================================

export interface IDecisionEngine {
  makeDecision(context: DecisionContext, marketContext: MarketContext): DecisionPacket;
  
  // Internal pipeline methods (for testing)
  runRegimeGate(context: DecisionContext): GateResult;
  runStructuralGate(context: DecisionContext): GateResult;
  runMarketGates(marketContext: MarketContext): GateResult;
  calculateConfidence(context: DecisionContext, marketContext: MarketContext): number;
  calculateSizing(context: DecisionContext, confidence: number): number;
}

// ============================================================================
// RISK GATES INTERFACES
// ============================================================================

export interface IRiskGates {
  runAllGates(context: DecisionContext, marketContext: MarketContext): GateResult[];
  
  // Individual gate methods
  checkSpreadGate(marketContext: MarketContext): GateResult;
  checkVolatilityGate(marketContext: MarketContext): GateResult;
  checkGammaGate(context: DecisionContext, marketContext: MarketContext): GateResult;
  checkSessionGate(context: DecisionContext): GateResult;
  checkLiquidityGate(marketContext: MarketContext): GateResult;
}

export interface GateDefinition {
  name: string;
  threshold: number;
  operator: ">" | "<" | "==" | "!=" | ">=" | "<=";
  rejectReason: string;
}

// ============================================================================
// AUDIT LOGGER INTERFACES
// ============================================================================

export interface IAuditLogger {
  logDecision(packet: DecisionPacket): Promise<void>;
  logWebhookReceived(source: WebhookSource, payload: any): Promise<void>;
  logMarketContext(context: MarketContext): Promise<void>;
  logError(error: Error, context?: any): Promise<void>;
  
  // Query methods for analysis
  getDecisionHistory(filters: AuditFilters): Promise<AuditEntry[]>;
  getPerformanceMetrics(timeRange: TimeRange): Promise<PerformanceMetrics>;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  engineVersion: string;
  
  // Decision data
  decision: DecisionPacket;
  processingTime: number;
  
  // Context snapshots
  inputSources: Record<WebhookSource, any>;
  marketContext: MarketContext;
  
  // Outcome tracking (updated later)
  outcome?: {
    executed: boolean;
    pnl?: number;
    exitReason?: string;
    holdTime?: number;
  };
}

export interface AuditFilters {
  startTime?: number;
  endTime?: number;
  action?: string;
  symbol?: string;
  engineVersion?: string;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface PerformanceMetrics {
  totalDecisions: number;
  executeRate: number;
  avgProcessingTime: number;
  gateRejectReasons: Record<string, number>;
  avgConfidenceScore: number;
}

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

export interface IConfigManager {
  loadConfig(): EngineConfig;
  validateConfig(config: EngineConfig): ValidationResult;
  getEngineVersion(): string;
  getConfigHash(): string;
  freezeConfig(): void;
}

// ============================================================================
// ERROR HANDLING INTERFACES
// ============================================================================

export interface IErrorHandler {
  handleMarketFeedDegradation(symbol: string, feedErrors: any[]): Promise<{
    context: MarketContext;
    degradationStatus: any;
  }>;
  applyConservativeBias(decision: DecisionPacket, degradationStatus: any): DecisionPacket;
  createErrorResponse(error: Error): any;
  handleWebhookError(error: Error, payload: any, retryCount?: number): Promise<any>;
  handleDecisionEngineError(error: Error, context?: DecisionContext, marketContext?: MarketContext): Promise<any>;
  getSystemHealthStatus(): any;
  recordFeedFailure(provider: string): void;
  resetFailureCounts(): void;
}

// ============================================================================
// DECISION ORCHESTRATOR INTERFACES
// ============================================================================

export interface IDecisionOrchestrator {
  processWebhook(payload: any): Promise<{
    success: boolean;
    decision?: DecisionPacket;
    message: string;
    processingTime: number;
  }>;
  
  processDecisionOnly(
    decisionContext: DecisionContext,
    marketContext?: MarketContext
  ): Promise<DecisionPacket>;
  
  getContextStatus(): {
    isComplete: boolean;
    completeness: number;
    requiredSources: { source: WebhookSource; available: boolean; age?: number }[];
    optionalSources: { source: WebhookSource; available: boolean; age?: number }[];
  };
  
  clearContext(): void;
  updateContext(partial: Partial<DecisionContext>, source: WebhookSource): void;
  isReady(): boolean;
  
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      orchestrator: boolean;
      contextStore: boolean;
      marketFeeds: boolean;
      decisionEngine: boolean;
      configuration: boolean;
    };
    timestamp: number;
  }>;
  
  setDecisionOnlyMode(enabled: boolean): void;
  getConfiguration(): EngineConfig;
  
  // Metrics methods
  getMetricsReport(): {
    decisions: any;
    performance: any;
    system: any;
    timestamp: number;
  };
  
  getSystemHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number;
    issues: string[];
    details: {
      orchestrator: boolean;
      contextStore: boolean;
      marketFeeds: boolean;
      decisionEngine: boolean;
      configuration: boolean;
    };
    metrics: {
      decisions: any;
      performance: any;
      system: any;
    };
    timestamp: number;
  }>;
}

// ============================================================================
// HEALTH CHECK INTERFACES
// ============================================================================

export interface IHealthCheck {
  getStatus(): HealthStatus;
  checkDependencies(): Promise<DependencyStatus[]>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  configHash: string;
  uptime: number;
  timestamp: number;
}

export interface DependencyStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
}