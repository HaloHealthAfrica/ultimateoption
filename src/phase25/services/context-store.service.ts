/**
 * Context Store Service for Phase 2.5 Decision Engine
 * 
 * Maintains the latest normalized data from each webhook source and builds
 * complete DecisionContext when ready. Handles partial updates, expiration,
 * and completeness validation.
 * 
 * THREAD-SAFE: Uses mutex to prevent race conditions from concurrent webhooks
 */

import { IContextStore, 
  StoredContext, 
  CompletenessRules, WebhookSource, DecisionContext } from '../types';
import { ENGINE_VERSION } from '../config/constants';
import { upsertPhase25ContextSnapshot } from '../utils/contextDb';
import { Mutex } from 'async-mutex';

export class ContextStoreService implements IContextStore {
  private context: StoredContext;
  private completenessRules: CompletenessRules;
  private mutex: Mutex;

  constructor(completenessRules?: Partial<CompletenessRules>) {
    this.context = {
      lastUpdated: {} as Record<WebhookSource, number>
    };
    
    // Initialize mutex for thread-safe operations
    this.mutex = new Mutex();

    // Get timeout from environment variable or use default
    const timeoutMinutes = parseInt(process.env.PHASE25_CONTEXT_TIMEOUT_MINUTES || '30');
    const maxAge = timeoutMinutes * 60 * 1000;

    // Use config values or defaults - prioritize passed config over hardcoded values
    this.completenessRules = {
      requiredSources: completenessRules?.requiredSources || ['TRADINGVIEW_SIGNAL'],
      optionalSources: completenessRules?.optionalSources || ['SATY_PHASE', 'MTF_DOTS', 'ULTIMATE_OPTIONS', 'STRAT_EXEC'],
      maxAge: completenessRules?.maxAge || maxAge
    };

    console.log(`Context store initialized with ${timeoutMinutes} minute timeout`);
    console.log(`Required sources: ${this.completenessRules.requiredSources.join(', ')}`);
  }

  /**
   * Update context with partial data from a specific webhook source
   * THREAD-SAFE: Uses mutex to ensure atomic updates
   */
  async update(partial: Partial<DecisionContext>, source: WebhookSource): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const timestamp = Date.now();

      // Update the specific sections based on what's provided
      if (partial.regime) {
        this.context.regime = { ...partial.regime };
      }

      if (partial.alignment) {
        this.context.alignment = { ...partial.alignment };
      }

      if (partial.expert) {
        this.context.expert = { ...partial.expert };
      }

      if (partial.structure) {
        this.context.structure = { ...partial.structure };
      }

      if (partial.instrument) {
        // Merge instrument data, keeping the most recent price and other fields
        this.context.instrument = {
          ...this.context.instrument,
          ...partial.instrument
        };
      }

      // Update the timestamp for this source
      this.context.lastUpdated[source] = timestamp;

      console.log(`Context updated from ${source}:`, {
        source,
        timestamp,
        hasRegime: !!this.context.regime,
        hasAlignment: !!this.context.alignment,
        hasExpert: !!this.context.expert,
        hasStructure: !!this.context.structure,
        hasInstrument: !!this.context.instrument,
        isComplete: this.isComplete()
      });

      const symbol = this.context.instrument?.symbol;
      if (symbol) {
        upsertPhase25ContextSnapshot(symbol, this.context).catch((error) => {
          console.warn('Failed to persist Phase 2.5 context snapshot:', error);
        });
      }
    });
  }

  /**
   * Build complete DecisionContext if all required data is available and fresh
   * THREAD-SAFE: Uses mutex to ensure consistent reads
   */
  async build(): Promise<DecisionContext | null> {
    return await this.mutex.runExclusive(() => {
      if (!this.isComplete()) {
        return null;
      }

      if (!this.context.instrument) {
        console.warn('Cannot build DecisionContext: missing instrument data');
        return null;
      }

      // Calculate completeness score based on available sources
      const completeness = this.calculateCompleteness();

      return {
        meta: {
          engineVersion: ENGINE_VERSION,
          receivedAt: Date.now(),
          completeness
        },
        instrument: { ...this.context.instrument },
        regime: this.context.regime!,
        alignment: this.context.alignment || this.getDefaultAlignment(),
        expert: this.context.expert!,
        structure: this.context.structure || this.getDefaultStructure()
      };
    });
  }

  /**
   * Check if context has all required data and is not expired
   */
  isComplete(): boolean {
    const now = Date.now();

    // Check if all required sources have provided data
    for (const requiredSource of this.completenessRules.requiredSources) {
      const lastUpdate = this.context.lastUpdated[requiredSource];
      
      if (!lastUpdate) {
        return false; // Missing required source
      }

      if (now - lastUpdate > this.completenessRules.maxAge) {
        return false; // Required source is too old
      }
    }

    // Check if we have at least one expert source (ULTIMATE_OPTIONS or TRADINGVIEW_SIGNAL) within time limit
    const expertSources: WebhookSource[] = ['ULTIMATE_OPTIONS', 'TRADINGVIEW_SIGNAL'];
    const hasValidExpertSource = expertSources.some(source => {
      const lastUpdate = this.context.lastUpdated[source];
      return lastUpdate && (now - lastUpdate <= this.completenessRules.maxAge);
    });

    if (!hasValidExpertSource) {
      return false; // No valid expert source
    }

    // Check if we have the minimum required context sections based on required sources
    const hasRequiredRegime = this.completenessRules.requiredSources.includes('SATY_PHASE') ? 
      !!this.context.regime : true;
    
    // Require at least one expert source (ULTIMATE_OPTIONS or TRADINGVIEW_SIGNAL)
    const hasRequiredExpert = !!this.context.expert;

    const hasRequiredAlignment = this.completenessRules.requiredSources.includes('MTF_DOTS') ? 
      !!this.context.alignment : true;

    const hasRequiredStructure = this.completenessRules.requiredSources.includes('STRAT_EXEC') ? 
      !!this.context.structure : true;

    if (!hasRequiredRegime || !hasRequiredExpert || !hasRequiredAlignment || !hasRequiredStructure) {
      return false;
    }

    // Must have instrument data
    if (!this.context.instrument) {
      return false;
    }

    return true;
  }

  /**
   * Get the timestamp of the last update from a specific source
   */
  getLastUpdate(source: WebhookSource): number | null {
    return this.context.lastUpdated[source] || null;
  }

  /**
   * Clear all stored context data
   */
  clear(): void {
    this.context = {
      lastUpdated: {} as Record<WebhookSource, number>
    };

    console.log('Context store cleared');
  }

  /**
   * Get context age for a specific source in milliseconds
   */
  getContextAge(source: WebhookSource): number | null {
    const lastUpdate = this.getLastUpdate(source);
    return lastUpdate ? Date.now() - lastUpdate : null;
  }

  /**
   * Check if a specific source's data is expired
   */
  isSourceExpired(source: WebhookSource): boolean {
    const age = this.getContextAge(source);
    return age !== null && age > this.completenessRules.maxAge;
  }

  /**
   * Get all expired sources
   */
  getExpiredSources(): WebhookSource[] {
    return Object.keys(this.context.lastUpdated)
      .filter(source => this.isSourceExpired(source as WebhookSource)) as WebhookSource[];
  }

  /**
   * Clean up expired data
   */
  cleanupExpired(): void {
    const expiredSources = this.getExpiredSources();
    
    for (const source of expiredSources) {
      delete this.context.lastUpdated[source];
      
      // Clear the associated context data
      switch (source) {
        case 'SATY_PHASE':
          delete this.context.regime;
          break;
        case 'MTF_DOTS':
          delete this.context.alignment;
          break;
        case 'ULTIMATE_OPTIONS':
        case 'TRADINGVIEW_SIGNAL':
          delete this.context.expert;
          break;
        case 'STRAT_EXEC':
          delete this.context.structure;
          break;
      }
    }

    if (expiredSources.length > 0) {
      console.log(`Cleaned up expired sources: ${expiredSources.join(', ')}`);
    }
  }

  /**
   * Get context completeness statistics
   */
  getCompletenessStats(): {
    requiredSources: { source: WebhookSource; available: boolean; age?: number }[];
    optionalSources: { source: WebhookSource; available: boolean; age?: number }[];
    overallCompleteness: number;
    isComplete: boolean;
  } {
    const requiredSources = this.completenessRules.requiredSources.map(source => ({
      source,
      available: !!this.context.lastUpdated[source],
      age: this.getContextAge(source) || undefined
    }));

    const optionalSources = this.completenessRules.optionalSources.map(source => ({
      source,
      available: !!this.context.lastUpdated[source],
      age: this.getContextAge(source) || undefined
    }));

    return {
      requiredSources,
      optionalSources,
      overallCompleteness: this.calculateCompleteness(),
      isComplete: this.isComplete()
    };
  }

  /**
   * Update completeness rules (for testing or configuration changes)
   */
  updateCompletenessRules(rules: Partial<CompletenessRules>): void {
    this.completenessRules = {
      ...this.completenessRules,
      ...rules
    };
  }

  // Private helper methods

  private calculateCompleteness(): number {
    const allSources = [...this.completenessRules.requiredSources, ...this.completenessRules.optionalSources];
    const availableSources = allSources.filter(source => 
      this.context.lastUpdated[source] && !this.isSourceExpired(source)
    );

    return allSources.length > 0 ? availableSources.length / allSources.length : 0;
  }

  private getDefaultAlignment(): DecisionContext['alignment'] {
    return {
      tfStates: {},
      bullishPct: 50,
      bearishPct: 50
    };
  }

  private getDefaultStructure(): DecisionContext['structure'] {
    // When STRAT_EXEC data is missing, use neutral defaults that don't block trades
    // This allows the decision engine to rely on other gates (regime, market, confidence)
    return {
      validSetup: true,  // Assume valid unless STRAT says otherwise
      liquidityOk: true,  // Assume OK unless STRAT says otherwise
      executionQuality: 'B'  // Neutral quality grade
    };
  }
}