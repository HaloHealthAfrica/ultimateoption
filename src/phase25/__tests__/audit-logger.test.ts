/**
 * Tests for AuditLoggerService
 * 
 * Validates audit logging functionality including decision packet logging,
 * context snapshots, decision replay, and performance metrics.
 */

import { AuditLoggerService } from '../services/audit-logger.service';
import { ConfigManagerService } from '../services/config-manager.service';
import { 
  DecisionPacket,
  MarketContext,
  DecisionContext,
  WebhookSource
} from '../types/core';
import { AuditFilters, TimeRange } from '../types/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('AuditLoggerService', () => {
  let auditLogger: AuditLoggerService;
  let configManager: ConfigManagerService;
  let tempLogDir: string;

  beforeEach(async () => {
    configManager = new ConfigManagerService();
    
    // Create temporary log directory
    tempLogDir = path.join(os.tmpdir(), `audit-test-${Date.now()}`);
    await fs.mkdir(tempLogDir, { recursive: true });
    
    auditLogger = new AuditLoggerService(configManager, tempLogDir);
    
    // Clear any existing entries
    auditLogger.clearMemoryCache();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempLogDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Helper functions
  const createMockDecisionPacket = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
    action: "EXECUTE",
    direction: "LONG",
    finalSizeMultiplier: 1.5,
    confidenceScore: 85.5,
    reasons: ["High confidence execution"],
    engineVersion: "2.5.0",
    gateResults: {
      regime: { passed: true, reason: "Phase allows LONG", score: 85 },
      structural: { passed: true, reason: "Valid setup", score: 90 },
      market: { passed: true, reason: "Good conditions", score: 80 }
    },
    inputContext: createMockDecisionContext(),
    marketSnapshot: createMockMarketContext(),
    timestamp: Date.now(),
    ...overrides
  });

  const createMockDecisionContext = (): DecisionContext => ({
    meta: {
      engineVersion: "2.5.0",
      receivedAt: Date.now(),
      completeness: 1.0
    },
    instrument: {
      symbol: "SPY",
      exchange: "NYSE",
      price: 450.25
    },
    regime: {
      phase: 2,
      phaseName: "MARKUP",
      volatility: "NORMAL",
      confidence: 85,
      bias: "LONG"
    },
    alignment: {
      tfStates: { "1h": "BULLISH", "4h": "BULLISH", "1d": "NEUTRAL" },
      bullishPct: 75,
      bearishPct: 25
    },
    expert: {
      direction: "LONG",
      aiScore: 8.5,
      quality: "HIGH",
      components: ["momentum", "structure"],
      rr1: 2.5,
      rr2: 4.0
    },
    structure: {
      validSetup: true,
      liquidityOk: true,
      executionQuality: "A"
    }
  });

  const createMockMarketContext = (): MarketContext => ({
    options: {
      putCallRatio: 0.8,
      ivPercentile: 45,
      gammaBias: "POSITIVE",
      optionVolume: 150000,
      maxPain: 445
    },
    stats: {
      atr14: 2.5,
      rv20: 0.25,
      trendSlope: 0.3,
      rsi: 65,
      volume: 50000000,
      volumeRatio: 1.2
    },
    liquidity: {
      spreadBps: 8,
      depthScore: 85,
      tradeVelocity: "NORMAL",
      bidSize: 500,
      askSize: 600
    },
    fetchTime: Date.now(),
    completeness: 1.0,
    errors: []
  });

  describe('logDecision', () => {
    it('should log decision packet successfully', async () => {
      const packet = createMockDecisionPacket();
      
      await auditLogger.logDecision(packet);
      
      const stats = auditLogger.getAuditStats();
      expect(stats.memoryEntries).toBe(1);
    });

    it('should generate unique audit IDs for different decisions', async () => {
      const packet1 = createMockDecisionPacket({ timestamp: 1000 });
      const packet2 = createMockDecisionPacket({ timestamp: 2000 });
      
      await auditLogger.logDecision(packet1);
      await auditLogger.logDecision(packet2);
      
      const stats = auditLogger.getAuditStats();
      expect(stats.memoryEntries).toBe(2);
    });

    it('should sanitize sensitive data in decision packets', async () => {
      const packet = createMockDecisionPacket();
      packet.marketSnapshot.errors = ['API error: api_key=secret123'];
      
      await auditLogger.logDecision(packet);
      
      // Verify the logged entry doesn't contain the API key
      const history = await auditLogger.getDecisionHistory({});
      expect(history[0].marketContext.errors[0]).toContain('api_key=***');
    });

    it('should handle logging errors gracefully', async () => {
      // Create invalid log directory to trigger error
      const invalidLogger = new AuditLoggerService(configManager, '/invalid/path');
      const packet = createMockDecisionPacket();
      
      // Should not throw
      await expect(invalidLogger.logDecision(packet)).resolves.toBeUndefined();
    });

    it('should maintain memory limit', async () => {
      // Create logger with small memory limit for testing
      const smallLogger = new AuditLoggerService(configManager, tempLogDir);
      (smallLogger as any).maxMemoryEntries = 3;
      
      // Log 5 decisions
      for (let i = 0; i < 5; i++) {
        const packet = createMockDecisionPacket({ timestamp: Date.now() + i });
        await smallLogger.logDecision(packet);
      }
      
      const stats = smallLogger.getAuditStats();
      expect(stats.memoryEntries).toBe(3);
    });
  });

  describe('logWebhookReceived', () => {
    it('should log webhook data', async () => {
      const payload = { signal: { type: "BUY", symbol: "SPY" } };
      
      await auditLogger.logWebhookReceived("ULTIMATE_OPTIONS", payload);
      
      // Verify log file was created
      const files = await fs.readdir(tempLogDir);
      const webhookFiles = files.filter(f => f.startsWith('webhooks-'));
      expect(webhookFiles.length).toBe(1);
    });

    it('should sanitize webhook payloads', async () => {
      const payload = { 
        signal: { type: "BUY" },
        api_key: "secret123",
        token: "bearer_token"
      };
      
      await auditLogger.logWebhookReceived("ULTIMATE_OPTIONS", payload);
      
      // Read the log file and verify sanitization
      const files = await fs.readdir(tempLogDir);
      const webhookFile = files.find(f => f.startsWith('webhooks-'));
      const content = await fs.readFile(path.join(tempLogDir, webhookFile!), 'utf8');
      const logEntry = JSON.parse(content.trim());
      
      expect(logEntry.payload.api_key).toBe('***');
      expect(logEntry.payload.token).toBe('***');
    });
  });

  describe('logMarketContext', () => {
    it('should log market context data', async () => {
      const context = createMockMarketContext();
      
      await auditLogger.logMarketContext(context);
      
      // Verify log file was created
      const files = await fs.readdir(tempLogDir);
      const marketFiles = files.filter(f => f.startsWith('market-'));
      expect(marketFiles.length).toBe(1);
    });

    it('should include completeness and error information', async () => {
      const context = createMockMarketContext();
      context.completeness = 0.8;
      context.errors = ['Tradier API timeout'];
      
      await auditLogger.logMarketContext(context);
      
      // Read and verify log content
      const files = await fs.readdir(tempLogDir);
      const marketFile = files.find(f => f.startsWith('market-'));
      const content = await fs.readFile(path.join(tempLogDir, marketFile!), 'utf8');
      const logEntry = JSON.parse(content.trim());
      
      expect(logEntry.completeness).toBe(0.8);
      expect(logEntry.errors).toEqual(['Tradier API timeout']);
    });
  });

  describe('logError', () => {
    it('should log error with context', async () => {
      const error = new Error('Test error');
      const context = { symbol: 'SPY', action: 'EXECUTE' };
      
      await auditLogger.logError(error, context);
      
      // Verify log file was created
      const files = await fs.readdir(tempLogDir);
      const errorFiles = files.filter(f => f.startsWith('errors-'));
      expect(errorFiles.length).toBe(1);
    });

    it('should capture error details', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      await auditLogger.logError(error);
      
      // Read and verify log content
      const files = await fs.readdir(tempLogDir);
      const errorFile = files.find(f => f.startsWith('errors-'));
      const content = await fs.readFile(path.join(tempLogDir, errorFile!), 'utf8');
      const logEntry = JSON.parse(content.trim());
      
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.error.stack).toBe('Error stack trace');
    });
  });

  describe('getDecisionHistory', () => {
    let isolatedAuditLogger: AuditLoggerService;
    let isolatedTempDir: string;
    
    beforeEach(async () => {
      // Create isolated logger for these tests
      isolatedTempDir = path.join(os.tmpdir(), `audit-history-test-${Date.now()}`);
      await fs.mkdir(isolatedTempDir, { recursive: true });
      isolatedAuditLogger = new AuditLoggerService(configManager, isolatedTempDir);
      
      // Log some test decisions
      const baseTime = Date.now();
      
      await isolatedAuditLogger.logDecision(createMockDecisionPacket({
        action: "EXECUTE",
        timestamp: baseTime,
        inputContext: { ...createMockDecisionContext(), instrument: { symbol: "SPY", exchange: "NYSE", price: 450 } }
      }));
      
      await isolatedAuditLogger.logDecision(createMockDecisionPacket({
        action: "WAIT",
        timestamp: baseTime + 1000,
        inputContext: { ...createMockDecisionContext(), instrument: { symbol: "QQQ", exchange: "NASDAQ", price: 350 } }
      }));
      
      await isolatedAuditLogger.logDecision(createMockDecisionPacket({
        action: "SKIP",
        timestamp: baseTime + 2000,
        inputContext: { ...createMockDecisionContext(), instrument: { symbol: "SPY", exchange: "NYSE", price: 451 } }
      }));
    });

    afterEach(async () => {
      try {
        await fs.rm(isolatedTempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should return all decisions without filters', async () => {
      const history = await isolatedAuditLogger.getDecisionHistory({});
      expect(history.length).toBe(3);
    });

    it('should filter by action', async () => {
      const history = await isolatedAuditLogger.getDecisionHistory({ action: "EXECUTE" });
      expect(history.length).toBe(1);
      expect(history[0].decision.action).toBe("EXECUTE");
    });

    it('should filter by symbol', async () => {
      const history = await isolatedAuditLogger.getDecisionHistory({ symbol: "SPY" });
      expect(history.length).toBe(2);
      history.forEach(entry => {
        expect(entry.decision.inputContext.instrument.symbol).toBe("SPY");
      });
    });

    it('should filter by time range', async () => {
      const baseTime = Date.now();
      const history = await isolatedAuditLogger.getDecisionHistory({
        startTime: baseTime + 500,
        endTime: baseTime + 1500
      });
      expect(history.length).toBe(1);
      expect(history[0].decision.action).toBe("WAIT");
    });

    it('should sort results by timestamp descending', async () => {
      const history = await isolatedAuditLogger.getDecisionHistory({});
      expect(history.length).toBe(3);
      
      for (let i = 1; i < history.length; i++) {
        expect(history[i-1].timestamp).toBeGreaterThanOrEqual(history[i].timestamp);
      }
    });
  });

  describe('getPerformanceMetrics', () => {
    let isolatedAuditLogger: AuditLoggerService;
    let isolatedTempDir: string;
    
    beforeEach(async () => {
      // Create isolated logger for these tests
      isolatedTempDir = path.join(os.tmpdir(), `audit-metrics-test-${Date.now()}`);
      await fs.mkdir(isolatedTempDir, { recursive: true });
      isolatedAuditLogger = new AuditLoggerService(configManager, isolatedTempDir);
      
      const baseTime = Date.now();
      
      // Log decisions with different outcomes
      await isolatedAuditLogger.logDecision(createMockDecisionPacket({
        action: "EXECUTE",
        confidenceScore: 90,
        timestamp: baseTime
      }));
      
      await isolatedAuditLogger.logDecision(createMockDecisionPacket({
        action: "EXECUTE", 
        confidenceScore: 85,
        timestamp: baseTime + 1000
      }));
      
      await isolatedAuditLogger.logDecision(createMockDecisionPacket({
        action: "SKIP",
        confidenceScore: 60,
        reasons: ["Low confidence", "Market gate failed"],
        timestamp: baseTime + 2000
      }));
      
      await isolatedAuditLogger.logDecision(createMockDecisionPacket({
        action: "WAIT",
        confidenceScore: 75,
        timestamp: baseTime + 3000
      }));
    });

    afterEach(async () => {
      try {
        await fs.rm(isolatedTempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should calculate basic performance metrics', async () => {
      const timeRange: TimeRange = {
        start: Date.now() - 10000,
        end: Date.now() + 10000
      };
      
      const metrics = await isolatedAuditLogger.getPerformanceMetrics(timeRange);
      
      expect(metrics.totalDecisions).toBe(4);
      expect(metrics.executeRate).toBe(0.5); // 2 out of 4
      expect(metrics.avgConfidenceScore).toBe(77.5); // (90+85+60+75)/4
      expect(metrics.avgProcessingTime).toBeGreaterThanOrEqual(0); // Allow 0 for fast tests
    });

    it('should analyze gate rejection reasons', async () => {
      const timeRange: TimeRange = {
        start: Date.now() - 10000,
        end: Date.now() + 10000
      };
      
      const metrics = await isolatedAuditLogger.getPerformanceMetrics(timeRange);
      
      expect(metrics.gateRejectReasons["Low confidence"]).toBe(1);
      expect(metrics.gateRejectReasons["Market gate failed"]).toBe(1);
    });

    it('should handle empty time ranges', async () => {
      const timeRange: TimeRange = {
        start: Date.now() + 10000,
        end: Date.now() + 20000
      };
      
      const metrics = await auditLogger.getPerformanceMetrics(timeRange);
      
      expect(metrics.totalDecisions).toBe(0);
      expect(metrics.executeRate).toBe(0);
      expect(metrics.avgProcessingTime).toBe(0);
      expect(metrics.avgConfidenceScore).toBe(0);
    });
  });

  describe('replayDecision', () => {
    it('should replay decision from memory', async () => {
      const originalPacket = createMockDecisionPacket();
      await auditLogger.logDecision(originalPacket);
      
      const history = await auditLogger.getDecisionHistory({});
      const auditId = history[0].id;
      
      const replayedPacket = await auditLogger.replayDecision(auditId);
      
      expect(replayedPacket).toBeDefined();
      expect(replayedPacket!.action).toBe(originalPacket.action);
      expect(replayedPacket!.confidenceScore).toBe(originalPacket.confidenceScore);
    });

    it('should return null for non-existent audit ID', async () => {
      const replayedPacket = await auditLogger.replayDecision('non-existent-id');
      expect(replayedPacket).toBeNull();
    });
  });

  describe('updateDecisionOutcome', () => {
    it('should update decision outcome', async () => {
      const packet = createMockDecisionPacket();
      await auditLogger.logDecision(packet);
      
      const history = await auditLogger.getDecisionHistory({});
      const auditId = history[0].id;
      
      const outcome = {
        executed: true,
        pnl: 150.50,
        exitReason: "Target reached",
        holdTime: 3600000 // 1 hour
      };
      
      await auditLogger.updateDecisionOutcome(auditId, outcome);
      
      // Verify outcome was updated in memory
      const updatedHistory = await auditLogger.getDecisionHistory({});
      expect(updatedHistory[0].outcome).toEqual(outcome);
    });
  });

  describe('utility methods', () => {
    it('should provide audit statistics', () => {
      const stats = auditLogger.getAuditStats();
      
      expect(stats).toHaveProperty('memoryEntries');
      expect(stats).toHaveProperty('logDirectory');
      expect(stats).toHaveProperty('engineVersion');
      expect(stats.logDirectory).toBe(tempLogDir);
    });

    it('should clear memory cache', async () => {
      await auditLogger.logDecision(createMockDecisionPacket());
      expect(auditLogger.getAuditStats().memoryEntries).toBe(1);
      
      auditLogger.clearMemoryCache();
      expect(auditLogger.getAuditStats().memoryEntries).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed log files gracefully', async () => {
      // Create a malformed log file
      const malformedFile = path.join(tempLogDir, 'decisions-2024-01-01.jsonl');
      await fs.writeFile(malformedFile, 'invalid json\n{"valid": "json"}\n');
      
      // Should not throw when searching
      const history = await auditLogger.getDecisionHistory({});
      expect(Array.isArray(history)).toBe(true);
    });

    it('should handle file system errors gracefully', async () => {
      // Create logger with read-only directory
      const readOnlyDir = path.join(tempLogDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444); // Read-only
      
      const readOnlyLogger = new AuditLoggerService(configManager, readOnlyDir);
      const packet = createMockDecisionPacket();
      
      // Should not throw
      await expect(readOnlyLogger.logDecision(packet)).resolves.toBeUndefined();
      
      // Restore permissions for cleanup
      await fs.chmod(readOnlyDir, 0o755);
    });

    it('should handle concurrent logging operations', async () => {
      const promises = [];
      
      // Log 10 decisions concurrently
      for (let i = 0; i < 10; i++) {
        const packet = createMockDecisionPacket({ timestamp: Date.now() + i });
        promises.push(auditLogger.logDecision(packet));
      }
      
      await Promise.all(promises);
      
      const stats = auditLogger.getAuditStats();
      expect(stats.memoryEntries).toBe(10);
    });
  });
});