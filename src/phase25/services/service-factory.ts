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
import { AuditLoggerService } from './audit-logger.service';
import { RiskGatesService } from './risk-gates.service';
import { getEngineConfig, validateEngineConfig } from '../config/engine.config';

export class ServiceFactory {
  private static instance: ServiceFactory;
  private orchestrator?: DecisionOrchestratorService;

  private constructor() {}

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
      
      // Validate configuration at startup
      const config = getEngineConfig();
      const errors = validateEngineConfig(config);
      
      if (errors.length > 0) {
        console.error('❌ CRITICAL: Invalid Phase 2.5 configuration detected!');
        console.error('Configuration errors:');
        errors.forEach(error => console.error(`  - ${error}`));
        throw new Error(`Invalid Phase 2.5 configuration: ${errors.join('; ')}`);
      }
      
      console.log('✅ Phase 2.5 configuration validated successfully');
      console.log(`Engine version: ${config.version}`);
      console.log(`Required sources: ${config.contextRules.requiredSources.join(', ')}`);
      console.log(`Confidence thresholds: EXECUTE=${config.confidenceThresholds.execute}, WAIT=${config.confidenceThresholds.wait}`);
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
    const configHash = JSON.stringify(config).slice(0, 8); // Simple hash from config
    const metricsService = new MetricsService(configHash);

    // Initialize audit logger
    const auditLogger = new AuditLoggerService(configManager);

    // Initialize error handler
    const errorHandler = new ErrorHandlerService(configManager, auditLogger);

    // Initialize source router
    const sourceRouter = new SourceRouterService();

    // Initialize normalizer
    const normalizer = new NormalizerService();

    // Initialize context store
    const contextStore = new ContextStoreService();

    // Initialize market context builder
    const marketContextBuilder = new MarketContextBuilder();

    // Initialize risk gates (not currently used but may be needed in future)
    const _riskGates = new RiskGatesService(configManager);

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