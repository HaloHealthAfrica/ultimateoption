/**
 * Risk Gates Service for Phase 2.5 Decision Engine
 * 
 * Implements individual risk gate validations to prevent execution
 * under adverse market conditions. Each gate enforces specific
 * risk thresholds with clear rejection reasons.
 */

import { IRiskGates, MarketContext,
  GateResult, DecisionContext } from '../types';
import { ConfigManagerService } from './config-manager.service';
// import { ALIGNMENT_THRESHOLDS } from '../config/constants'; // Unused

export class RiskGatesService implements IRiskGates {
  private configManager: ConfigManagerService;

  constructor(configManager: ConfigManagerService) {
    this.configManager = configManager;
  }

  /**
   * Run all risk gates and return results
   * All gates must pass for trade execution
   */
  runAllGates(context: DecisionContext, marketContext: MarketContext): GateResult[] {
    const results: GateResult[] = [];

    // Market-based gates
    results.push(this.checkSpreadGate(marketContext));
    results.push(this.checkVolatilityGate(marketContext));
    results.push(this.checkLiquidityGate(marketContext));

    // Context-based gates
    results.push(this.checkGammaGate(context, marketContext));
    results.push(this.checkSessionGate(context));

    return results;
  }

  /**
   * Spread Gate: Prevents execution when bid-ask spreads are too wide
   * Protects against poor execution quality
   */
  checkSpreadGate(marketContext: MarketContext): GateResult {
    const config = this.configManager.getConfig();
    const maxSpreadBps = config.gates.maxSpreadBps;

    // If no liquidity data available, pass with warning
    if (!marketContext.liquidity?.spreadBps) {
      return {
        passed: true,
        reason: "No spread data available, assuming acceptable",
        score: 50
      };
    }

    const currentSpread = marketContext.liquidity.spreadBps;

    if (currentSpread > maxSpreadBps) {
      return {
        passed: false,
        reason: `Spread too wide: ${currentSpread}bps > ${maxSpreadBps}bps threshold`,
        score: Math.max(0, 100 - (currentSpread - maxSpreadBps) * 5)
      };
    }

    return {
      passed: true,
      reason: `Spread acceptable: ${currentSpread}bps ≤ ${maxSpreadBps}bps`,
      score: Math.max(50, 100 - currentSpread * 2)
    };
  }

  /**
   * Volatility Spike Gate: Prevents execution during extreme volatility
   * Uses ATR (Average True Range) to detect volatility spikes
   */
  checkVolatilityGate(marketContext: MarketContext): GateResult {
    const config = this.configManager.getConfig();
    const maxAtrSpike = config.gates.maxAtrSpike;

    // If no volatility data available, pass with warning
    if (!marketContext.stats?.atr14) {
      return {
        passed: true,
        reason: "No ATR data available, assuming normal volatility",
        score: 50
      };
    }

    const currentAtr = marketContext.stats.atr14;

    if (currentAtr > maxAtrSpike) {
      return {
        passed: false,
        reason: `ATR spike detected: ${currentAtr.toFixed(2)} > ${maxAtrSpike} threshold`,
        score: Math.max(0, 100 - (currentAtr - maxAtrSpike) * 20)
      };
    }

    return {
      passed: true,
      reason: `ATR normal: ${currentAtr.toFixed(2)} ≤ ${maxAtrSpike}`,
      score: Math.max(60, 100 - currentAtr * 15)
    };
  }

  /**
   * Gamma Headwind Gate: Prevents trades against strong gamma bias
   * Protects against directional conflicts with market maker positioning
   */
  checkGammaGate(context: DecisionContext, marketContext: MarketContext): GateResult {
    // If no options data available, pass
    if (!marketContext.options?.gammaBias) {
      return {
        passed: true,
        reason: "No gamma data available, no directional conflict detected",
        score: 50
      };
    }

    const gammaBias = marketContext.options.gammaBias;
    const tradeDirection = context.expert.direction;

    // Check for strong directional conflicts
    const hasConflict = (
      (gammaBias === "POSITIVE" && tradeDirection === "SHORT") ||
      (gammaBias === "NEGATIVE" && tradeDirection === "LONG")
    );

    if (hasConflict) {
      // Additional check: if alignment is very strong, allow override
      const alignmentPct = tradeDirection === "LONG" ? 
        context.alignment.bullishPct : context.alignment.bearishPct;
      
      if (alignmentPct >= 85) { // Very strong alignment threshold
        return {
          passed: true,
          reason: `Gamma conflict overridden by strong alignment: ${alignmentPct}% ${tradeDirection.toLowerCase()}ish`,
          score: 70
        };
      }

      return {
        passed: false,
        reason: `Gamma headwind: ${gammaBias} bias conflicts with ${tradeDirection} direction`,
        score: 25
      };
    }

    return {
      passed: true,
      reason: `No gamma conflict: ${gammaBias} bias compatible with ${tradeDirection}`,
      score: 85
    };
  }

  /**
   * Liquidity Gate: Ensures sufficient market depth for execution
   * Prevents execution in illiquid conditions
   */
  checkLiquidityGate(marketContext: MarketContext): GateResult {
    const config = this.configManager.getConfig();
    const minDepthScore = config.gates.minDepthScore;

    // If no liquidity data available, pass with warning
    if (!marketContext.liquidity?.depthScore) {
      return {
        passed: true,
        reason: "No depth data available, assuming adequate liquidity",
        score: 50
      };
    }

    const currentDepth = marketContext.liquidity.depthScore;

    if (currentDepth < minDepthScore) {
      return {
        passed: false,
        reason: `Insufficient liquidity: depth score ${currentDepth} < ${minDepthScore} threshold`,
        score: currentDepth
      };
    }

    return {
      passed: true,
      reason: `Adequate liquidity: depth score ${currentDepth} ≥ ${minDepthScore}`,
      score: currentDepth
    };
  }

  /**
   * Session Restriction Gate: Prevents execution during restricted sessions
   * Protects against execution during low-liquidity periods
   */
  checkSessionGate(context: DecisionContext): GateResult {
    const config = this.configManager.getConfig();
    const restrictedSessions = config.gates.restrictedSessions;

    // Determine current session based on timestamp
    const currentTime = new Date(context.meta.receivedAt);
    const currentSession = this.determineMarketSession(currentTime);

    if (restrictedSessions.includes(currentSession)) {
      return {
        passed: false,
        reason: `Execution restricted during ${currentSession} session`,
        score: 0
      };
    }

    return {
      passed: true,
      reason: `Execution allowed during ${currentSession} session`,
      score: 100
    };
  }

  /**
   * Get summary of all gate results
   * Useful for decision audit trails
   */
  getGatesSummary(context: DecisionContext, marketContext: MarketContext): {
    allPassed: boolean;
    passedCount: number;
    totalCount: number;
    failedGates: string[];
    averageScore: number;
  } {
    const results = this.runAllGates(context, marketContext);
    
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const failedGates = results
      .filter(r => !r.passed)
      .map(r => r.reason || 'Unknown gate failure');
    
    const averageScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / totalCount;

    return {
      allPassed: passedCount === totalCount,
      passedCount,
      totalCount,
      failedGates,
      averageScore: Math.round(averageScore * 10) / 10
    };
  }

  // Private helper methods

  /**
   * Determine market session based on timestamp
   * Uses US Eastern Time for market hours
   */
  private determineMarketSession(timestamp: Date): string {
    // Convert to US Eastern Time
    const easternTime = new Date(timestamp.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = easternTime.getHours();
    const minute = easternTime.getMinutes();
    const dayOfWeek = easternTime.getDay(); // 0 = Sunday, 6 = Saturday

    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'WEEKEND';
    }

    // Convert to minutes for easier comparison
    const currentMinutes = hour * 60 + minute;
    const marketOpen = 9 * 60 + 30;  // 9:30 AM
    const marketClose = 16 * 60;     // 4:00 PM
    const afterHoursEnd = 20 * 60;   // 8:00 PM

    if (currentMinutes < marketOpen) {
      return 'PREMARKET';
    } else if (currentMinutes >= marketOpen && currentMinutes < marketClose) {
      return 'REGULAR';
    } else if (currentMinutes >= marketClose && currentMinutes < afterHoursEnd) {
      return 'AFTERHOURS';
    } else {
      return 'CLOSED';
    }
  }

  /**
   * Check if current time is within regular trading hours
   */
  isRegularTradingHours(timestamp: Date): boolean {
    return this.determineMarketSession(timestamp) === 'REGULAR';
  }

  /**
   * Get risk gate configuration for debugging
   */
  getGateConfiguration(): unknown {
    const config = this.configManager.getConfig();
    return {
      maxSpreadBps: config.gates.maxSpreadBps,
      maxAtrSpike: config.gates.maxAtrSpike,
      minDepthScore: config.gates.minDepthScore,
      minConfidence: config.gates.minConfidence,
      restrictedSessions: [...config.gates.restrictedSessions]
    };
  }
}