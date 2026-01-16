/**
 * Decision Orchestrator Service for Phase 2.5
 * 
 * Main orchestration layer that wires together all components into a complete
 * decision flow. Handles webhook processing, context building, decision making,
 * and conditional forwarding to paper execution.
 */

import { IDecisionOrchestrator, MarketContext,
  DecisionPacket,
  WebhookSource,
  DecisionContext } from '../types';
import { SourceRouterService } from './source-router.service';
import { NormalizerService } from './normalizer.service';
import { ContextStoreService } from './context-store.service';
import { MarketContextBuilder } from './market-context.service';
import { DecisionEngineService } from './decision-engine.service';
import { ErrorHandlerService } from './error-handler.service';
import { ConfigManagerService } from './config-manager.service';
import { MetricsService } from './metrics.service';

export class DecisionOrchestratorService implements IDecisionOrchestrator {
  private sourceRouter: SourceRouterService;
  private normalizer: NormalizerService;
  private contextStore: ContextStoreService;
  private marketContextBuilder: MarketContextBuilder;
  private decisionEngine: DecisionEngineService;
  private errorHandler: ErrorHandlerService;
  private configManager: ConfigManagerService;
  private metricsService: MetricsService;
  private decisionOnlyMode: boolean;

  constructor(
    sourceRouter: SourceRouterService,
    normalizer: NormalizerService,
    contextStore: ContextStoreService,
    marketContextBuilder: MarketContextBuilder,
    decisionEngine: DecisionEngineService,
    errorHandler: ErrorHandlerService,
    configManager: ConfigManagerService,
    metricsService: MetricsService,
    decisionOnlyMode: boolean = false
  ) {
    this.sourceRouter = sourceRouter;
    this.normalizer = normalizer;
    this.contextStore = contextStore;
    this.marketContextBuilder = marketContextBuilder;
    this.decisionEngine = decisionEngine;
    this.errorHandler = errorHandler;
    this.configManager = configManager;
    this.metricsService = metricsService;
    this.decisionOnlyMode = decisionOnlyMode;
  }

  /**
   * Process a webhook through the complete decision pipeline
   */
  async processWebhook(payload: unknown): Promise<{
    success: boolean;
    decision?: DecisionPacket;
    message: string;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      // Record the incoming request
      this.metricsService.recordRequest(0); // Will update with actual time at the end

      // Step 1: Route and normalize the webhook
      const routingResult = this.sourceRouter.routeWebhook(payload);
      if (!routingResult.success) {
        this.metricsService.recordError('routing_failed');
        return {
          success: false,
          message: `Webhook routing failed: ${routingResult.error?.message}`,
          processingTime: Date.now() - startTime
        };
      }

      const normalizedPayload = routingResult.normalized!;
      
      // Step 2: Update context store
      this.contextStore.update(normalizedPayload.partial, routingResult.source!);
      this.metricsService.recordContextUpdate();

      // Step 3: Check if we have complete context for decision making
      if (!this.contextStore.isComplete()) {
        const processingTime = Date.now() - startTime;
        this.metricsService.recordRequest(processingTime);
        return {
          success: true,
          message: `Context updated from ${routingResult.source}, waiting for complete context`,
          processingTime
        };
      }

      // Step 4: Build complete decision context
      const decisionContext = this.contextStore.build();
      if (!decisionContext) {
        this.metricsService.recordError('context_build_failed');
        const processingTime = Date.now() - startTime;
        this.metricsService.recordRequest(processingTime);
        return {
          success: false,
          message: 'Failed to build complete decision context',
          processingTime
        };
      }

      // Step 5: Fetch market context in parallel
      const marketContextStart = Date.now();
      const marketContext = await this.marketContextBuilder.buildContext(
        decisionContext.instrument.symbol
      );
      const _marketContextTime = Date.now() - marketContextStart;

      // Record market feed performance
      this.metricsService.recordMarketFeed('tradier', true, marketContext.completeness);

      // Step 6: Make the decision
      const decision = this.decisionEngine.makeDecision(decisionContext, marketContext);
      const processingTime = Date.now() - startTime;

      // Record the decision and processing time
      this.metricsService.recordDecision(decision, processingTime);
      this.metricsService.recordRequest(processingTime);

      // Step 7: Handle conditional forwarding
      await this.handleDecisionForwarding(decision);

      return {
        success: true,
        decision,
        message: `Decision made: ${decision.action} (confidence: ${decision.confidenceScore})`,
        processingTime
      };

    } catch (error) {
      console.error('Decision orchestration error:', error);
      
      const errorResponse = this.errorHandler.createErrorResponse(error as Error);
      this.metricsService.recordError('orchestration_error');
      
      const processingTime = Date.now() - startTime;
      this.metricsService.recordRequest(processingTime);

      return {
        success: false,
        message: `Processing failed: ${errorResponse.error}`,
        processingTime
      };
    }
  }

  /**
   * Process a decision-only request (for testing or validation)
   */
  async processDecisionOnly(
    decisionContext: DecisionContext,
    marketContext?: MarketContext
  ): Promise<DecisionPacket> {
    try {
      // Use provided market context or fetch fresh data
      const finalMarketContext = marketContext || 
        await this.marketContextBuilder.buildContext(decisionContext.instrument.symbol);

      // Make the decision
      const decision = this.decisionEngine.makeDecision(decisionContext, finalMarketContext);

      // In decision-only mode, we don't forward to execution
      console.log(`Decision-only mode: ${decision.action} for ${decisionContext.instrument.symbol}`);

      return decision;

    } catch (error) {
      console.error('Decision-only processing error:', error);
      throw error;
    }
  }

  /**
   * Get current context completeness status
   */
  getContextStatus(): {
    isComplete: boolean;
    completeness: number;
    requiredSources: { source: WebhookSource; available: boolean; age?: number }[];
    optionalSources: { source: WebhookSource; available: boolean; age?: number }[];
  } {
    const stats = this.contextStore.getCompletenessStats();
    
    return {
      isComplete: stats.isComplete,
      completeness: stats.overallCompleteness,
      requiredSources: stats.requiredSources,
      optionalSources: stats.optionalSources
    };
  }

  /**
   * Clear all stored context (for testing or recovery)
   */
  clearContext(): void {
    this.contextStore.clear();
    console.log('Decision orchestrator context cleared');
  }

  /**
   * Update context with partial data from a specific source
   */
  updateContext(partial: Partial<DecisionContext>, source: WebhookSource): void {
    this.contextStore.update(partial, source);
  }

  /**
   * Check if the system is ready to make decisions
   */
  isReady(): boolean {
    try {
      // Check if configuration is valid
      const config = this.configManager.getConfig();
      if (!config || !config.version) {
        return false;
      }

      // Check if all required services are initialized
      return !!(
        this.sourceRouter &&
        this.normalizer &&
        this.contextStore &&
        this.marketContextBuilder &&
        this.decisionEngine &&
        this.errorHandler
      );
    } catch (error) {
      console.error('Readiness check failed:', error);
      return false;
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      orchestrator: boolean;
      contextStore: boolean;
      marketFeeds: boolean;
      decisionEngine: boolean;
      configuration: boolean;
    };
    timestamp: number;
  }> {
    const details = {
      orchestrator: this.isReady(),
      contextStore: this.contextStore.isComplete(),
      marketFeeds: false,
      decisionEngine: true,
      configuration: true
    };

    try {
      // Test market feeds with a quick health check
      const testContext = await this.marketContextBuilder.buildContext('SPY');
      details.marketFeeds = testContext.completeness > 0;
    } catch {
      details.marketFeeds = false;
    }

    // Determine overall status
    const healthyCount = Object.values(details).filter(Boolean).length;
    const totalChecks = Object.keys(details).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalChecks) {
      status = 'healthy';
    } else if (healthyCount >= totalChecks * 0.6) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      details,
      timestamp: Date.now()
    };
  }

  /**
   * Enable or disable decision-only mode
   */
  setDecisionOnlyMode(enabled: boolean): void {
    this.decisionOnlyMode = enabled;
    console.log(`Decision-only mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current configuration
   */
  getConfiguration() {
    return this.configManager.getConfig();
  }

  /**
   * Get comprehensive metrics report
   */
  getMetricsReport() {
    return this.metricsService.getMetricsReport();
  }

  /**
   * Get system health status with metrics integration
   */
  async getSystemHealthStatus(): Promise<{
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
      decisions: unknown;
      performance: unknown;
      system: unknown;
    };
    timestamp: number;
  }> {
    // Get basic health status
    const basicHealth = await this.getHealthStatus();
    
    // Get metrics-based health assessment
    const metricsHealth = this.metricsService.getHealthStatus();
    
    // Get full metrics report
    const metricsReport = this.metricsService.getMetricsReport();

    // Combine health assessments
    const combinedScore = Math.min(
      basicHealth.details.orchestrator ? 100 : 0,
      metricsHealth.score
    );

    let combinedStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (combinedScore >= 90) {
      combinedStatus = 'healthy';
    } else if (combinedScore >= 70) {
      combinedStatus = 'degraded';
    } else {
      combinedStatus = 'unhealthy';
    }

    return {
      status: combinedStatus,
      score: combinedScore,
      issues: metricsHealth.issues,
      details: basicHealth.details,
      metrics: {
        decisions: metricsReport.decisions,
        performance: metricsReport.performance,
        system: metricsReport.system
      },
      timestamp: Date.now()
    };
  }

  // Private helper methods

  /**
   * Handle conditional forwarding based on decision action
   */
  private async handleDecisionForwarding(decision: DecisionPacket): Promise<void> {
    if (this.decisionOnlyMode) {
      console.log(`Decision-only mode: Not forwarding ${decision.action} decision`);
      return;
    }

    try {
      // Store ALL decisions in ledger (EXECUTE, WAIT, SKIP)
      try {
        const { getGlobalLedger } = await import('@/ledger/globalLedger');
        const { convertDecisionToLedgerEntry } = await import('../utils/ledger-adapter');
        
        const ledger = await getGlobalLedger();
        const ledgerEntry = convertDecisionToLedgerEntry(decision);
        await ledger.append(ledgerEntry);
        
        console.log('Decision stored in ledger:', {
          symbol: decision.inputContext.instrument.symbol,
          action: decision.action,
          confidence: decision.confidenceScore
        });
      } catch (error) {
        console.error('Failed to store decision in ledger:', error);
        // Don't throw - we still want to process the decision
      }

      // Handle action-specific forwarding
      switch (decision.action) {
        case 'EXECUTE':
          await this.forwardToExecution(decision);
          break;
        
        case 'WAIT':
        case 'SKIP':
          // Log the decision but don't execute
          console.log(`Decision logged: ${decision.action} for ${decision.inputContext.instrument.symbol} - ${decision.reasons.join(', ')}`);
          break;
        
        default:
          console.warn(`Unknown decision action: ${decision.action}`);
      }
    } catch (error) {
      console.error('Decision forwarding error:', error);
      // Don't throw - we still want to return the decision even if forwarding fails
    }
  }

  /**
   * Forward EXECUTE decisions to paper trading system
   */
  private async forwardToExecution(decision: DecisionPacket): Promise<void> {
    // In a real implementation, this would forward to the paper trading executor
    // For now, we'll just log the execution intent
    
    console.log('Forwarding to paper execution:', {
      action: decision.action,
      direction: decision.direction,
      symbol: decision.inputContext.instrument.symbol,
      sizeMultiplier: decision.finalSizeMultiplier,
      confidence: decision.confidenceScore,
      timestamp: new Date(decision.timestamp).toISOString()
    });

    // TODO: Implement actual paper trading integration
    // await this.paperTradingExecutor.execute(decision);
  }
}