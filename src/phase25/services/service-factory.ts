/**
 * Service Factory for Phase 2.5
 * 
 * Creates and wires together all services with proper dependency injection.
 */

import { DecisionOrchestratorService } from './decision-orchestrator.service';
import { SourceRouterService } from './source-router.service';
import { NormalizerService } from './normalizer.service';
import { ContextStoreService } from './context-store.service';
import { MarketContextBuilder } from './market-context.service';
import { DecisionEngineService } from './decision-engine.service';
import { ErrorHandlerService } from './error-handler.service';
import { ConfigManagerService } from './config-manager.service';
import { MetricsService } from './metrics.service';
import { RiskGatesService } from './risk-gates.service';

export class ServiceFactory {
  private static instance: ServiceFactory;
  private orchestrator?: DecisionOrchestratorService;

  private constructor() {}

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  /**
   * Create and configure the decision orchestrator with all dependencies
   */
  createOrchestrator(decisionOnlyMode: boolean = false): DecisionOrchestratorService {
    if (this.orchestrator) {
      return this.orchestrator;
    }

    // Initialize configuration manager
    const configManager = new ConfigManagerService();
    const config = configManager.getConfig();

    // Initialize metrics service
    const metricsService = new MetricsService(config.configHash || 'default');

    // Initialize error handler
    const errorHandler = new ErrorHandlerService();

    // Initialize source router
    const sourceRouter = new SourceRouterService();

    // Initialize normalizer
    const normalizer = new NormalizerService();

    // Initialize context store
    const contextStore = new ContextStoreService();

    // Initialize market context builder
    const marketContextBuilder = new MarketContextBuilder();

    // Initialize risk gates
    const riskGates = new RiskGatesService();

    // Initialize decision engine
    const decisionEngine = new DecisionEngineService(configManager);

    // Create orchestrator with all dependencies
    this.orchestrator = new DecisionOrchestratorService(
      sourceRouter,
      normalizer,
      contextStore,
      marketContextBuilder,
      decisionEngine,
      errorHandler,
      configManager,
      metricsService,
      decisionOnlyMode
    );

    console.log('Decision orchestrator initialized with metrics integration');
    return this.orchestrator;
  }

  /**
   * Get the current orchestrator instance
   */
  getOrchestrator(): DecisionOrchestratorService | undefined {
    return this.orchestrator;
  }

  /**
   * Reset the factory (for testing)
   */
  reset(): void {
    this.orchestrator = undefined;
  }
}