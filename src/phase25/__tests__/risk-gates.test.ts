/**
 * Tests for Risk Gates Service
 * 
 * Comprehensive test suite covering all risk gate implementations,
 * edge cases, and integration scenarios.
 */

import { RiskGatesService } from '../services/risk-gates.service';
import { ConfigManagerService } from '../services/config-manager.service';
import { 
  DecisionContext, 
  MarketContext,
  GateResult
} from '../types';
import { 
  RISK_GATES
} from '../config/constants';

describe('RiskGatesService', () => {
  let riskGates: RiskGatesService;
  let configManager: ConfigManagerService;
  let mockContext: DecisionContext;
  let mockMarketContext: MarketContext;

  beforeEach(() => {
    configManager = new ConfigManagerService();
    riskGates = new RiskGatesService(configManager);
    
    // Create mock decision context
    mockContext = {
      meta: {
        engineVersion: "2.5.0",
        receivedAt: new Date('2024-01-15T14:30:00.000Z').getTime(), // Monday 2:30 PM EST
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

    // Create mock market context with good conditions
    mockMarketContext = {
      options: {
        putCallRatio: 0.8,
        ivPercentile: 45,
        gammaBias: "POSITIVE", // Aligned with LONG direction
        optionVolume: 150000,
        maxPain: 445
      },
      stats: {
        atr14: 1.2, // Below 2.5 threshold
        rv20: 0.18,
        trendSlope: 0.3,
        rsi: 65,
        volume: 85000000,
        volumeRatio: 1.2
      },
      liquidity: {
        spreadBps: 8, // Below 12bps threshold
        depthScore: 75, // Above 30 threshold
        tradeVelocity: "NORMAL",
        bidSize: 500,
        askSize: 450
      },
      fetchTime: Date.now(),
      completeness: 1.0,
      errors: []
    };
  });

  describe('checkSpreadGate', () => {
    it('should pass for acceptable spreads', () => {
      const result = riskGates.checkSpreadGate(mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("Spread acceptable");
      expect(result.score).toBeGreaterThan(50);
    });

    it('should fail for wide spreads', () => {
      mockMarketContext.liquidity!.spreadBps = 15; // Above 12bps threshold
      
      const result = riskGates.checkSpreadGate(mockMarketContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Spread too wide");
      expect(result.reason).toContain("15bps > 12bps");
    });

    it('should pass with warning when no spread data available', () => {
      delete mockMarketContext.liquidity;
      
      const result = riskGates.checkSpreadGate(mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("No spread data available");
      expect(result.score).toBe(50);
    });

    it('should calculate score based on spread width', () => {
      mockMarketContext.liquidity!.spreadBps = 5;
      const result1 = riskGates.checkSpreadGate(mockMarketContext);
      
      mockMarketContext.liquidity!.spreadBps = 10;
      const result2 = riskGates.checkSpreadGate(mockMarketContext);
      
      expect(result1.score).toBeGreaterThan(result2.score!);
    });
  });

  describe('checkVolatilityGate', () => {
    it('should pass for normal ATR levels', () => {
      const result = riskGates.checkVolatilityGate(mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("ATR normal");
      expect(result.score).toBeGreaterThan(60);
    });

    it('should fail for high ATR spikes', () => {
      mockMarketContext.stats!.atr14 = 3.0; // Above 2.5 threshold
      
      const result = riskGates.checkVolatilityGate(mockMarketContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("ATR spike detected");
      expect(result.reason).toContain("3.00 > 2.5");
    });

    it('should pass with warning when no ATR data available', () => {
      delete mockMarketContext.stats;
      
      const result = riskGates.checkVolatilityGate(mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("No ATR data available");
      expect(result.score).toBe(50);
    });

    it('should calculate score based on ATR level', () => {
      mockMarketContext.stats!.atr14 = 1.0;
      const result1 = riskGates.checkVolatilityGate(mockMarketContext);
      
      mockMarketContext.stats!.atr14 = 2.0;
      const result2 = riskGates.checkVolatilityGate(mockMarketContext);
      
      expect(result1.score).toBeGreaterThan(result2.score!);
    });
  });

  describe('checkGammaGate', () => {
    it('should pass when gamma bias aligns with trade direction', () => {
      // POSITIVE gamma bias with LONG direction should pass
      const result = riskGates.checkGammaGate(mockContext, mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("No gamma conflict");
      expect(result.score).toBe(85);
    });

    it('should fail when gamma bias conflicts with trade direction', () => {
      mockMarketContext.options!.gammaBias = "NEGATIVE"; // Conflicts with LONG
      
      const result = riskGates.checkGammaGate(mockContext, mockMarketContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Gamma headwind");
      expect(result.reason).toContain("NEGATIVE bias conflicts with LONG");
      expect(result.score).toBe(25);
    });

    it('should allow override with very strong alignment', () => {
      mockMarketContext.options!.gammaBias = "NEGATIVE"; // Conflicts with LONG
      mockContext.alignment.bullishPct = 90; // Very strong alignment
      
      const result = riskGates.checkGammaGate(mockContext, mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("Gamma conflict overridden");
      expect(result.reason).toContain("90% longish");
      expect(result.score).toBe(70);
    });

    it('should pass with neutral gamma bias', () => {
      mockMarketContext.options!.gammaBias = "NEUTRAL";
      
      const result = riskGates.checkGammaGate(mockContext, mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("NEUTRAL bias compatible with LONG");
    });

    it('should pass when no gamma data available', () => {
      delete mockMarketContext.options;
      
      const result = riskGates.checkGammaGate(mockContext, mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("No gamma data available");
      expect(result.score).toBe(50);
    });

    it('should handle SHORT direction correctly', () => {
      mockContext.expert.direction = "SHORT";
      mockContext.alignment.bearishPct = 70; // Below 85 threshold, no override
      mockMarketContext.options!.gammaBias = "POSITIVE"; // Conflicts with SHORT
      
      const result = riskGates.checkGammaGate(mockContext, mockMarketContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("POSITIVE bias conflicts with SHORT");
    });
  });

  describe('checkLiquidityGate', () => {
    it('should pass for adequate liquidity', () => {
      const result = riskGates.checkLiquidityGate(mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("Adequate liquidity");
      expect(result.score).toBe(75); // Same as depth score
    });

    it('should fail for insufficient liquidity', () => {
      mockMarketContext.liquidity!.depthScore = 25; // Below 30 threshold
      
      const result = riskGates.checkLiquidityGate(mockMarketContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Insufficient liquidity");
      expect(result.reason).toContain("25 < 30");
      expect(result.score).toBe(25);
    });

    it('should pass when no depth data available', () => {
      delete mockMarketContext.liquidity;
      
      const result = riskGates.checkLiquidityGate(mockMarketContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("No depth data available");
      expect(result.score).toBe(50);
    });
  });

  describe('checkSessionGate', () => {
    it('should pass during regular trading hours', () => {
      // Monday 2:30 PM EST (regular hours)
      const result = riskGates.checkSessionGate(mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("Execution allowed during REGULAR session");
      expect(result.score).toBe(100);
    });

    it('should fail during restricted afterhours session', () => {
      // Monday 6:00 PM EST (afterhours)
      mockContext.meta.receivedAt = new Date('2024-01-15T23:00:00.000Z').getTime();
      
      const result = riskGates.checkSessionGate(mockContext);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Execution restricted during AFTERHOURS session");
      expect(result.score).toBe(0);
    });

    it('should pass during premarket hours', () => {
      // Monday 8:00 AM EST (premarket)
      mockContext.meta.receivedAt = new Date('2024-01-15T13:00:00.000Z').getTime();
      
      const result = riskGates.checkSessionGate(mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("Execution allowed during PREMARKET session");
    });

    it('should handle weekend correctly', () => {
      // Saturday
      mockContext.meta.receivedAt = new Date('2024-01-13T18:00:00.000Z').getTime();
      
      const result = riskGates.checkSessionGate(mockContext);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toContain("Execution allowed during WEEKEND session");
    });
  });

  describe('runAllGates', () => {
    it('should return results for all gates', () => {
      const results = riskGates.runAllGates(mockContext, mockMarketContext);
      
      expect(results).toHaveLength(5); // 5 gates total
      expect(results.every(r => r.passed)).toBe(true); // All should pass with good conditions
    });

    it('should fail when any gate fails', () => {
      mockMarketContext.liquidity!.spreadBps = 20; // Fail spread gate
      
      const results = riskGates.runAllGates(mockContext, mockMarketContext);
      
      expect(results).toHaveLength(5);
      expect(results.some(r => !r.passed)).toBe(true); // At least one should fail
    });

    it('should include all expected gate types', () => {
      const results = riskGates.runAllGates(mockContext, mockMarketContext);
      const reasons = results.map(r => r.reason || '').join(' ');
      
      expect(reasons).toContain('Spread');
      expect(reasons).toContain('ATR');
      expect(reasons).toContain('liquidity');
      expect(reasons).toContain('gamma');
      expect(reasons).toContain('session');
    });
  });

  describe('getGatesSummary', () => {
    it('should provide comprehensive summary for passing gates', () => {
      const summary = riskGates.getGatesSummary(mockContext, mockMarketContext);
      
      expect(summary.allPassed).toBe(true);
      expect(summary.passedCount).toBe(5);
      expect(summary.totalCount).toBe(5);
      expect(summary.failedGates).toHaveLength(0);
      expect(summary.averageScore).toBeGreaterThan(70);
    });

    it('should provide summary for mixed gate results', () => {
      mockMarketContext.liquidity!.spreadBps = 20; // Fail spread gate
      mockMarketContext.stats!.atr14 = 3.0; // Fail volatility gate
      
      const summary = riskGates.getGatesSummary(mockContext, mockMarketContext);
      
      expect(summary.allPassed).toBe(false);
      expect(summary.passedCount).toBe(3);
      expect(summary.totalCount).toBe(5);
      expect(summary.failedGates).toHaveLength(2);
      expect(summary.failedGates[0]).toContain('Spread too wide');
      expect(summary.failedGates[1]).toContain('ATR spike detected');
    });
  });

  describe('helper methods', () => {
    it('should determine market session correctly', () => {
      // Test regular hours
      expect(riskGates.isRegularTradingHours(new Date('2024-01-15T14:30:00.000Z'))).toBe(true);
      
      // Test afterhours
      expect(riskGates.isRegularTradingHours(new Date('2024-01-15T23:00:00.000Z'))).toBe(false);
      
      // Test weekend
      expect(riskGates.isRegularTradingHours(new Date('2024-01-13T18:00:00.000Z'))).toBe(false);
    });

    it('should return gate configuration', () => {
      const config = riskGates.getGateConfiguration();
      
      expect(config.maxSpreadBps).toBe(RISK_GATES.MAX_SPREAD_BPS);
      expect(config.maxAtrSpike).toBe(RISK_GATES.MAX_ATR_SPIKE);
      expect(config.minDepthScore).toBe(RISK_GATES.MIN_DEPTH_SCORE);
      expect(config.restrictedSessions).toEqual(['AFTERHOURS']);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle missing market context gracefully', () => {
      const emptyMarketContext: MarketContext = {
        fetchTime: Date.now(),
        completeness: 0,
        errors: ["All APIs failed"]
      };
      
      const results = riskGates.runAllGates(mockContext, emptyMarketContext);
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.passed)).toBe(true); // Should pass with missing data
    });

    it('should handle partial market context', () => {
      const partialMarketContext: MarketContext = {
        liquidity: {
          spreadBps: 8,
          depthScore: 75,
          tradeVelocity: "NORMAL",
          bidSize: 500,
          askSize: 450
        },
        fetchTime: Date.now(),
        completeness: 0.3,
        errors: ["Tradier API timeout", "TwelveData API error"]
      };
      
      const results = riskGates.runAllGates(mockContext, partialMarketContext);
      
      expect(results).toHaveLength(5);
      // Should pass spread and liquidity gates, others should pass with warnings
      expect(results.filter(r => r.passed)).toHaveLength(5);
    });

    it('should maintain deterministic behavior', () => {
      const results1 = riskGates.runAllGates(mockContext, mockMarketContext);
      const results2 = riskGates.runAllGates(mockContext, mockMarketContext);
      
      expect(results1).toEqual(results2);
    });

    it('should handle extreme values gracefully', () => {
      mockMarketContext.liquidity!.spreadBps = 1000; // Extreme spread
      mockMarketContext.stats!.atr14 = 100; // Extreme volatility
      mockMarketContext.liquidity!.depthScore = -10; // Invalid depth score
      
      const results = riskGates.runAllGates(mockContext, mockMarketContext);
      
      expect(results).toHaveLength(5);
      expect(results.every(r => typeof r.passed === 'boolean')).toBe(true);
      expect(results.every(r => typeof r.score === 'number')).toBe(true);
    });
  });
});