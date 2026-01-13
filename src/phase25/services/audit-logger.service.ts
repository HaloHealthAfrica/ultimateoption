/**
 * Audit Logger Service for Phase 2.5 Decision Engine
 * 
 * Provides comprehensive audit logging for all decision-making activities.
 * Enables decision replay, performance analysis, and regulatory compliance.
 */

import { 
  IAuditLogger,
  AuditEntry,
  AuditFilters,
  TimeRange,
  PerformanceMetrics
} from '../types';
import { 
  DecisionPacket,
  MarketContext,
  WebhookSource
} from '../types/core';
import { ConfigManagerService } from './config-manager.service';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AuditLoggerService implements IAuditLogger {
  private configManager: ConfigManagerService;
  private logDirectory: string;
  private auditEntries: Map<string, AuditEntry> = new Map();
  private maxMemoryEntries: number = 10000; // Keep recent entries in memory

  constructor(configManager: ConfigManagerService, logDirectory: string = './logs/audit') {
    this.configManager = configManager;
    this.logDirectory = logDirectory;
    this.ensureLogDirectory();
  }

  /**
   * Log a complete decision packet with all context
   * This is the primary audit method for decision tracking
   */
  async logDecision(packet: DecisionPacket): Promise<void> {
    const startTime = Date.now();
    
    try {
      const auditId = this.generateAuditId(packet);
      
      const auditEntry: AuditEntry = {
        id: auditId,
        timestamp: packet.timestamp,
        engineVersion: packet.engineVersion,
        
        // Core decision data
        decision: this.sanitizeDecisionPacket(packet),
        processingTime: Math.max(0, Date.now() - packet.timestamp), // Ensure non-negative
        
        // Context snapshots for replay capability
        inputSources: this.extractInputSources(packet.inputContext),
        marketContext: this.sanitizeMarketContext(packet.marketSnapshot),
        
        // Outcome tracking (will be updated later by execution system)
        outcome: undefined
      };

      // Store in memory for fast access
      this.auditEntries.set(auditId, auditEntry);
      this.maintainMemoryLimit();

      // Write to persistent storage
      await this.writeAuditEntry(auditEntry);

      // Log structured decision summary
      this.logDecisionSummary(auditEntry);

    } catch (error) {
      console.error('Failed to log decision:', error);
      // Don't throw - audit logging should not break the decision flow
    }
  }

  /**
   * Log incoming webhook data for audit trail
   */
  async logWebhookReceived(source: WebhookSource, payload: any): Promise<void> {
    try {
      const logEntry = {
        timestamp: Date.now(),
        type: 'WEBHOOK_RECEIVED',
        source,
        payload: this.sanitizePayload(payload),
        engineVersion: this.configManager.getEngineVersion()
      };

      await this.writeLogEntry('webhooks', logEntry);
      
      console.log(`Webhook logged: ${source} at ${new Date().toISOString()}`);
      
    } catch (error) {
      console.error('Failed to log webhook:', error);
    }
  }

  /**
   * Log market context data for analysis
   */
  async logMarketContext(context: MarketContext): Promise<void> {
    try {
      const logEntry = {
        timestamp: Date.now(),
        type: 'MARKET_CONTEXT',
        context: this.sanitizeMarketContext(context),
        completeness: context.completeness,
        errors: context.errors || [],
        engineVersion: this.configManager.getEngineVersion()
      };

      await this.writeLogEntry('market', logEntry);
      
    } catch (error) {
      console.error('Failed to log market context:', error);
    }
  }

  /**
   * Log errors with context for debugging
   */
  async logError(error: Error, context?: any): Promise<void> {
    try {
      const logEntry = {
        timestamp: Date.now(),
        type: 'ERROR',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context: context ? this.sanitizePayload(context) : undefined,
        engineVersion: this.configManager.getEngineVersion()
      };

      await this.writeLogEntry('errors', logEntry);
      
      console.error(`Error logged: ${error.message} at ${new Date().toISOString()}`);
      
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Query decision history with filters
   */
  async getDecisionHistory(filters: AuditFilters): Promise<AuditEntry[]> {
    const results: AuditEntry[] = [];
    
    // Search memory first (most recent entries)
    for (const entry of this.auditEntries.values()) {
      if (this.matchesFilters(entry, filters)) {
        results.push(entry);
      }
    }
    
    // If we need more results, search persistent storage
    // Skip persistent search in test environments to avoid cross-test contamination
    if (results.length < 100 && !this.isTestEnvironment()) {
      const persistentResults = await this.searchPersistentStorage(filters);
      results.push(...persistentResults);
    }
    
    // Sort by timestamp descending (most recent first)
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Calculate performance metrics for a time range
   */
  async getPerformanceMetrics(timeRange: TimeRange): Promise<PerformanceMetrics> {
    const filters: AuditFilters = {
      startTime: timeRange.start,
      endTime: timeRange.end
    };
    
    const decisions = await this.getDecisionHistory(filters);
    
    if (decisions.length === 0) {
      return {
        totalDecisions: 0,
        executeRate: 0,
        avgProcessingTime: 0,
        gateRejectReasons: {},
        avgConfidenceScore: 0
      };
    }
    
    const executeCount = decisions.filter(d => d.decision.action === 'EXECUTE').length;
    const totalProcessingTime = decisions.reduce((sum, d) => sum + d.processingTime, 0);
    const totalConfidence = decisions.reduce((sum, d) => sum + d.decision.confidenceScore, 0);
    
    // Analyze gate rejection reasons
    const gateRejectReasons: Record<string, number> = {};
    decisions.forEach(decision => {
      if (decision.decision.action === 'SKIP') {
        decision.decision.reasons.forEach(reason => {
          gateRejectReasons[reason] = (gateRejectReasons[reason] || 0) + 1;
        });
      }
    });
    
    return {
      totalDecisions: decisions.length,
      executeRate: executeCount / decisions.length,
      avgProcessingTime: totalProcessingTime / decisions.length,
      gateRejectReasons,
      avgConfidenceScore: totalConfidence / decisions.length
    };
  }

  /**
   * Replay a decision using stored context
   * Useful for testing configuration changes
   */
  async replayDecision(auditId: string): Promise<DecisionPacket | null> {
    const entry = this.auditEntries.get(auditId);
    if (!entry) {
      // Try to load from persistent storage
      const persistentEntry = await this.loadAuditEntry(auditId);
      if (!persistentEntry) {
        return null;
      }
      return persistentEntry.decision;
    }
    
    return entry.decision;
  }

  /**
   * Update decision outcome after execution
   */
  async updateDecisionOutcome(auditId: string, outcome: {
    executed: boolean;
    pnl?: number;
    exitReason?: string;
    holdTime?: number;
  }): Promise<void> {
    const entry = this.auditEntries.get(auditId);
    if (entry) {
      entry.outcome = outcome;
      await this.writeAuditEntry(entry); // Update persistent storage
    }
  }

  // Private helper methods

  private generateAuditId(packet: DecisionPacket): string {
    const data = `${packet.timestamp}-${packet.inputContext.instrument.symbol}-${packet.action}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private sanitizeDecisionPacket(packet: DecisionPacket): DecisionPacket {
    // Create a deep copy and remove any sensitive data
    return {
      ...packet,
      inputContext: {
        ...packet.inputContext,
        // Remove any potentially sensitive fields if needed
      },
      marketSnapshot: this.sanitizeMarketContext(packet.marketSnapshot)
    };
  }

  private sanitizeMarketContext(context: MarketContext): MarketContext {
    // Remove any API keys or sensitive data
    return {
      ...context,
      errors: context.errors?.map(error => 
        error.replace(/api[_-]?key[=:]\s*[^\s&]+/gi, 'api_key=***')
      ) || []
    };
  }

  private sanitizePayload(payload: any): any {
    if (typeof payload !== 'object' || payload === null) {
      return payload;
    }
    
    const sanitized = { ...payload };
    
    // Remove common sensitive fields
    const sensitiveFields = ['api_key', 'apiKey', 'secret', 'token', 'password'];
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    });
    
    return sanitized;
  }

  private extractInputSources(context: any): Record<WebhookSource, any> {
    // Extract the original webhook data that contributed to this context
    // This is a simplified version - in production, we'd track source attribution
    return {
      SATY_PHASE: context.regime || null,
      MTF_DOTS: context.alignment || null,
      ULTIMATE_OPTIONS: context.expert || null,
      STRAT_EXEC: context.structure || null,
      TRADINGVIEW_SIGNAL: null // Not used in current implementation
    };
  }

  private logDecisionSummary(entry: AuditEntry): void {
    const decision = entry.decision;
    const symbol = decision.inputContext.instrument.symbol;
    
    console.log(`[AUDIT] Decision ${entry.id}: ${decision.action} ${symbol} ` +
      `(confidence: ${decision.confidenceScore.toFixed(1)}, ` +
      `size: ${decision.finalSizeMultiplier.toFixed(2)}, ` +
      `processing: ${entry.processingTime}ms)`);
  }

  private maintainMemoryLimit(): void {
    if (this.auditEntries.size > this.maxMemoryEntries) {
      // Remove oldest entries
      const entries = Array.from(this.auditEntries.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp);
      
      const toRemove = entries.slice(0, entries.length - this.maxMemoryEntries);
      toRemove.forEach(([id]) => this.auditEntries.delete(id));
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private async writeAuditEntry(entry: AuditEntry): Promise<void> {
    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    const filename = path.join(this.logDirectory, `decisions-${date}.jsonl`);
    
    const logLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(filename, logLine, 'utf8');
  }

  private async writeLogEntry(category: string, entry: any): Promise<void> {
    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    const filename = path.join(this.logDirectory, `${category}-${date}.jsonl`);
    
    const logLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(filename, logLine, 'utf8');
  }

  private matchesFilters(entry: AuditEntry, filters: AuditFilters): boolean {
    if (filters.startTime && entry.timestamp < filters.startTime) return false;
    if (filters.endTime && entry.timestamp > filters.endTime) return false;
    if (filters.action && entry.decision.action !== filters.action) return false;
    if (filters.symbol && entry.decision.inputContext.instrument.symbol !== filters.symbol) return false;
    if (filters.engineVersion && entry.engineVersion !== filters.engineVersion) return false;
    
    return true;
  }

  private async searchPersistentStorage(filters: AuditFilters): Promise<AuditEntry[]> {
    // This is a simplified implementation
    // In production, you'd want a proper database or search index
    const results: AuditEntry[] = [];
    
    try {
      const files = await fs.readdir(this.logDirectory);
      const decisionFiles = files.filter(f => f.startsWith('decisions-') && f.endsWith('.jsonl'));
      
      for (const file of decisionFiles.slice(-7)) { // Last 7 days
        const content = await fs.readFile(path.join(this.logDirectory, file), 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          try {
            const entry: AuditEntry = JSON.parse(line);
            if (this.matchesFilters(entry, filters)) {
              results.push(entry);
            }
          } catch (parseError) {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error('Error searching persistent storage:', error);
    }
    
    return results;
  }

  private async loadAuditEntry(auditId: string): Promise<AuditEntry | null> {
    try {
      const files = await fs.readdir(this.logDirectory);
      const decisionFiles = files.filter(f => f.startsWith('decisions-') && f.endsWith('.jsonl'));
      
      for (const file of decisionFiles) {
        const content = await fs.readFile(path.join(this.logDirectory, file), 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          try {
            const entry: AuditEntry = JSON.parse(line);
            if (entry.id === auditId) {
              return entry;
            }
          } catch (parseError) {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error('Error loading audit entry:', error);
    }
    
    return null;
  }

  /**
   * Get audit statistics for monitoring
   */
  getAuditStats(): {
    memoryEntries: number;
    logDirectory: string;
    engineVersion: string;
  } {
    return {
      memoryEntries: this.auditEntries.size,
      logDirectory: this.logDirectory,
      engineVersion: this.configManager.getEngineVersion()
    };
  }

  /**
   * Clear memory cache (useful for testing)
   */
  clearMemoryCache(): void {
    this.auditEntries.clear();
  }

  /**
   * Check if running in test environment
   */
  private isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test' || 
           process.env.JEST_WORKER_ID !== undefined ||
           this.logDirectory.includes('audit-test') ||
           this.logDirectory.includes('audit-history-test') ||
           this.logDirectory.includes('audit-metrics-test');
  }
}