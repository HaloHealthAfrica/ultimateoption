/**
 * Tests for Decision Engine Service
 * 
 * Comprehensive test suite covering all decision pipeline stages,
 * confidence calculations, and sizing logic.
 */

import { DecisionEngineService } from '../services/decision-engine.service';
import { ConfigManagerService } from '../services/config-manager.service';
import { MarketContext,
  DecisionPacket,
  GateResult } from '../types';
import { CONFIDENCE_THRESHOLDS,
  AI_SCORE_THRESHOLDS, SIZE_BOUNDS } from '../config/constants';

describe('DecisionEngineService', () => {
  let decisionEngine: DecisionEngineService;
  let configManager: ConfigManagerService;
  let mockContext: DecisionContext;
  let mockMarketContext: MarketContext;

  beforeEach(() => {
    configManager = new ConfigManagerService();
    decisionEngine = new DecisionEngineService(configManager);
    
    // Create mock decision context
    mockContext = {
      meta: {
        engineVersion: "2.5.0",
        receivedAt: Date.now(),
        completeness: 1.0
      },
      instrument: {
        symbol: "SPY",
        exchange: "ARCA",
        price: 450.00
      },
      regime: {
        phase: 2,
        phaseName: "MARKUP",
        volatility: "NORMAL",
        confidence: 85,
        bias: "LONG"
      },
      alignment: {
        tfStates: {
          "1m": "BULLISH",
          "5m": "BULLISH", 
          "15m": "BULLISH",
          "1h": "NEUTRAL"
        },
        bullishPct: 80,
        bearishPct: 20
      },
      expert: {
        direction: "LONG",
        aiScore: 8.5,
        quality: "HIGH",
        components: ["momentum", "structure", "volume"],
        rr1: 2.5,
        rr2: 4.0
      },
      structure: {
        validSetup: true,
        liquidityOk: true,
        executionQuality: "A"
      }
    };

    // Create mock market context
    mockMarketContext = {
      options: {
        putCallRatio: 0.8,
        ivPercentile: 45,
        gammaBias: "POSITIVE",
        optionVolume: 150000,
        maxPain: 445
      },
      stats: {
        atr14: 1.2,
        rv20: 0.18,
        trendSlope: 0.3,
        rsi: 65,
        volume: 85000000,
        volumeRatio: 1.2
      },
      liquidity: {
        spreadBps: 8,
        depthScore: 75,
        tradeVelocity: "NORMAL",
        bidSize: 500,
        askSize: 450
      },
      fetchTime: Date.now(),
      completeness: 1.0,
      errors: []
    };
  });

  describe('makeDecision', () => {
    it('should execute high confidence trades when all gates pass', () => {
      const decision = decisionEngine.makeDecision(mockContext, mockMarketContext);
      
      expect(decision.action).toBe("EXECUTE");
      expect(decision.direction).toBe("LONG");
      expect(decision.finalSizeMultiplier).toBeGreaterThan(0);
      expect(decision.confidenceScore).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.EXECUTE);
      expect(decision.gateResults.regime.passed).toBe(true);
      expect(decision.gateResults.structural.passed).toBe(true);
      expect(decision.gateResults.market.passed).toBe(true);
    });

    it('should wait for moderate confidence trades', () => {
      // Lower the confidence by reducing regime confidence
      mockContext.regime.confidence = 70;
      mockContext.expert.aiScore = 7.2;
      
      const decision = decisionEngine.makeDecision(mockContext, mockMarketContext);
      
      expect(decision.action).toBe("WAIT");
      expect(decision.confidenceScore).toBeLessThan(CONFIDENCE_THRESHOLDS.EXECUTE);
      expect(decision.confidenceScore).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.WAIT);
    });

    it('should skip low confidence trades', () => {
      // Significantly lower confidence
      mockContext.regime.confidence = 50;
      mockContext.expert.aiScore = 6.5;
      mockContext.alignment.bullishPct = 45;
      
      const decision = decisionEngine.makeDecision(mockContext, mockMarketContext);
      
      expect(decision.action).toBe("SKIP");
      expect(decision.confidenceScore).toBeLessThan(CONFIDENCE_THRESHOLDS.WAIT);
    });

    it('should include proper audit information', () => {
      const decision = decisionEngine.makeDecision(mockContext, mockMarketContext);
      
      expect(decision.engineVersion).toBe("2.5.0");
      expect(decision.inputContext).toEqual(mockContext);
      expect(decision.marketSnapshot).toEqual(mockMarketContext);
      expect(decision.timestamp).toBeGreaterThan(0);
      expect(Array.isArray(decision.reasons)).toBe(true);
      expect(decision.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('runRegimeGate', () => {
    it('should pass for allowed directions in current phase', () => {
      const result = decisionEngine.runRegimeGate(mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(85); // regime confidence
      expect(result.reason).toContain("Phase 2 allows LONG");
    });

    it('should fail for disallowed directions in phase 3', () => {
      mockContext.regime.phase = 3;
      mockContext.regime.phaseName = "DISTRIBUTION";
      
      const result = decisionEngine.runRegimeGate(mockContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("LONG trades not allowed in phase 3");
    });

    it('should fail for low regime confidence', () => {
      mockContext.regime.confidence = 60; // Below WAIT threshold
      
      const result = decisionEngine.runRegimeGate(mockContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Regime confidence too low");
    });

    it('should fail for conflicting regime bias', () => {
      mockContext.regime.bias = "SHORT";
      mockContext.expert.direction = "LONG";
      
      const result = decisionEngine.runRegimeGate(mockContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Regime bias (SHORT) conflicts with trade direction (LONG)");
      expect(result.score).toBe(42.5); // 85 * 0.5 penalty
    });

    it('should pass with neutral regime bias', () => {
      mockContext.regime.bias = "NEUTRAL";
      
      const result = decisionEngine.runRegimeGate(mockContext);
      
      expect(result.passed).toBe(true);
    });
  });

  describe('runStructuralGate', () => {
    it('should pass for valid high-quality setups', () => {
      const result = decisionEngine.runStructuralGate(mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(80); // High quality + good AI score
    });

    it('should fail for invalid setups', () => {
      mockContext.structure.validSetup = false;
      
      const result = decisionEngine.runStructuralGate(mockContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Invalid setup structure");
      expect(result.score).toBe(0);
    });

    it('should fail for poor liquidity', () => {
      mockContext.structure.liquidityOk = false;
      
      const result = decisionEngine.runStructuralGate(mockContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Insufficient liquidity");
    });

    it('should fail for poor execution quality', () => {
      mockContext.structure.executionQuality = "C";
      
      const result = decisionEngine.runStructuralGate(mockContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Execution quality too poor");
    });

    it('should fail for low AI scores', () => {
      mockContext.expert.aiScore = 6.5; // Below minimum threshold
      
      const result = decisionEngine.runStructuralGate(mockContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("AI score too low");
    });

    it('should score differently for A vs B quality', () => {
      const resultA = decisionEngine.runStructuralGate(mockContext);
      
      mockContext.structure.executionQuality = "B";
      const resultB = decisionEngine.runStructuralGate(mockContext);
      
      expect(resultA.score).toBeGreaterThan(resultB.score!);
    });
  });

  describe('runMarketGates', () => {
    it('should pass for good market conditions', () => {
      const result = decisionEngine.runMarketGates(mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("Spread OK");
      expect(result.reason).toContain("ATR OK");
      expect(result.reason).toContain("Depth OK");
    });

    it('should fail for wide spreads', () => {
      mockMarketContext.liquidity!.spreadBps = 15; // Above 12bps threshold
      
      const result = decisionEngine.runMarketGates(mockMarketContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Spread too wide");
    });

    it('should fail for high ATR spikes', () => {
      mockMarketContext.stats!.atr14 = 3.0; // Above 2.5 threshold
      
      const result = decisionEngine.runMarketGates(mockMarketContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("ATR spike too high");
    });

    it('should fail for low market depth', () => {
      mockMarketContext.liquidity!.depthScore = 25; // Below 30 threshold
      
      const result = decisionEngine.runMarketGates(mockMarketContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Market depth too low");
    });

    it('should handle missing market data gracefully', () => {
      const emptyMarketContext: MarketContext = {
        fetchTime: Date.now(),
        completeness: 0.3,
        errors: ["API timeout"]
      };
      
      const result = decisionEngine.runMarketGates(emptyMarketContext);
      
      expect(result.passed).toBe(true); // Should pass with missing data
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate high confidence for optimal conditions', () => {
      const confidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      
      expect(confidence).toBeGreaterThanOrEqual(80);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('should apply quality boosts correctly', () => {
      const baseConfidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      
      mockContext.expert.quality = "EXTREME";
      const boostedConfidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      
      expect(boostedConfidence).toBeGreaterThan(baseConfidence);
    });

    it('should apply alignment bonuses', () => {
      mockContext.alignment.bullishPct = 60; // Below strong alignment
      const baseConfidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      
      mockContext.alignment.bullishPct = 85; // Above strong alignment threshold
      const bonusConfidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      
      expect(bonusConfidence).toBeGreaterThan(baseConfidence);
    });

    it('should penalize low AI scores', () => {
      const baseConfidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      
      mockContext.expert.aiScore = 6.5; // Below minimum threshold
      const penalizedConfidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      
      expect(penalizedConfidence).toBeLessThan(baseConfidence);
    });

    it('should handle SHORT direction alignment correctly', () => {
      mockContext.expert.direction = "SHORT";
      mockContext.alignment.bearishPct = 85;
      mockContext.alignment.bullishPct = 15;
      
      const confidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      
      expect(confidence).toBeGreaterThan(70); // Should use bearish percentage
    });
  });

  describe('calculateSizing', () => {
    it('should calculate appropriate sizing for high confidence', () => {
      const sizing = decisionEngine.calculateSizing(mockContext, 90);
      
      expect(sizing).toBeGreaterThan(1.0);
      expect(sizing).toBeLessThanOrEqual(SIZE_BOUNDS.MAX);
    });

    it('should apply volatility caps', () => {
      mockContext.regime.volatility = "HIGH";
      const highVolSizing = decisionEngine.calculateSizing(mockContext, 90);
      
      mockContext.regime.volatility = "LOW";
      const lowVolSizing = decisionEngine.calculateSizing(mockContext, 90);
      
      expect(lowVolSizing).toBeGreaterThanOrEqual(highVolSizing);
    });

    it('should apply phase caps', () => {
      mockContext.regime.phase = 1; // sizeCap: 1.0
      const phase1Sizing = decisionEngine.calculateSizing(mockContext, 90);
      
      mockContext.regime.phase = 2; // sizeCap: 2.0
      const phase2Sizing = decisionEngine.calculateSizing(mockContext, 90);
      
      expect(phase2Sizing).toBeGreaterThanOrEqual(phase1Sizing);
    });

    it('should enforce absolute bounds', () => {
      const minSizing = decisionEngine.calculateSizing(mockContext, 10); // Very low confidence
      const maxSizing = decisionEngine.calculateSizing(mockContext, 100); // Max confidence
      
      expect(minSizing).toBeGreaterThanOrEqual(SIZE_BOUNDS.MIN);
      expect(maxSizing).toBeLessThanOrEqual(SIZE_BOUNDS.MAX);
    });

    it('should apply quality boosts to sizing', () => {
      mockContext.expert.quality = "MEDIUM";
      const mediumSizing = decisionEngine.calculateSizing(mockContext, 85);
      
      mockContext.expert.quality = "EXTREME";
      const extremeSizing = decisionEngine.calculateSizing(mockContext, 85);
      
      expect(extremeSizing).toBeGreaterThan(mediumSizing);
    });

    it('should apply alignment bonuses to sizing', () => {
      mockContext.alignment.bullishPct = 60; // Below threshold
      const baseSizing = decisionEngine.calculateSizing(mockContext, 85);
      
      mockContext.alignment.bullishPct = 85; // Above threshold
      const bonusSizing = decisionEngine.calculateSizing(mockContext, 85);
      
      expect(bonusSizing).toBeGreaterThan(baseSizing);
    });

    it('should return properly rounded values', () => {
      const sizing = decisionEngine.calculateSizing(mockContext, 87.3456);
      
      // Should be rounded to 2 decimal places
      expect(sizing).toBe(Math.round(sizing * 100) / 100);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle missing market context data', () => {
      const emptyMarketContext: MarketContext = {
        fetchTime: Date.now(),
        completeness: 0,
        errors: ["All APIs failed"]
      };
      
      const decision = decisionEngine.makeDecision(mockContext, emptyMarketContext);
      
      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();
      expect(decision.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle extreme confidence values', () => {
      const extremeConfidence = decisionEngine.calculateConfidence(mockContext, mockMarketContext);
      const sizing = decisionEngine.calculateSizing(mockContext, extremeConfidence);
      
      expect(sizing).toBeGreaterThanOrEqual(SIZE_BOUNDS.MIN);
      expect(sizing).toBeLessThanOrEqual(SIZE_BOUNDS.MAX);
    });

    it('should maintain deterministic behavior', () => {
      const decision1 = decisionEngine.makeDecision(mockContext, mockMarketContext);
      const decision2 = decisionEngine.makeDecision(mockContext, mockMarketContext);
      
      expect(decision1.action).toBe(decision2.action);
      expect(decision1.confidenceScore).toBe(decision2.confidenceScore);
      expect(decision1.finalSizeMultiplier).toBe(decision2.finalSizeMultiplier);
    });
  });
});