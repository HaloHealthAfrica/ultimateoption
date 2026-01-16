/**
 * Decision Engine Service for Phase 2.5
 * 
 * Core decision-making logic with deterministic pipeline stages.
 * Implements regime gates, structural validation, expert confirmation,
 * and confidence-based sizing calculations.
 */

import { IDecisionEngine, MarketContext,
  DecisionPacket,
  GateResult,
  EngineAction,
  TradeDirection,
  DecisionContext } from '../types';
import { ConfigManagerService } from './config-manager.service';
import { PHASE_RULES,
  VOLATILITY_CAPS,
  QUALITY_BOOSTS,
  CONFIDENCE_THRESHOLDS,
  AI_SCORE_THRESHOLDS, 
  ALIGNMENT_THRESHOLDS,
  SIZE_BOUNDS } from '../config/constants';

export class DecisionEngineService implements IDecisionEngine {
  private configManager: ConfigManagerService;

  constructor(configManager: ConfigManagerService) {
    this.configManager = configManager;
  }

  /**
   * Main decision-making method
   * Runs the complete pipeline and returns a decision packet
   */
  makeDecision(context: DecisionContext, marketContext: MarketContext): DecisionPacket {
    const startTime = Date.now();
    const config = this.configManager.getConfig();
    
    // Run all gates in sequence
    const regimeGate = this.runRegimeGate(context);
    const structuralGate = this.runStructuralGate(context);
    const marketGate = this.runMarketGates(marketContext);
    
    // Calculate confidence score
    const confidenceScore = this.calculateConfidence(context, marketContext);
    
    // Determine action based on gates and confidence
    let action: EngineAction = "SKIP";
    let direction: TradeDirection | undefined;
    let finalSizeMultiplier = 0;
    const reasons: string[] = [];
    
    // Check if all gates pass
    if (!regimeGate.passed) {
      reasons.push(`Regime gate failed: ${regimeGate.reason}`);
    }
    
    if (!structuralGate.passed) {
      reasons.push(`Structural gate failed: ${structuralGate.reason}`);
    }
    
    if (!marketGate.passed) {
      reasons.push(`Market gate failed: ${marketGate.reason}`);
    }
    
    // If all gates pass, determine action based on confidence
    if (regimeGate.passed && structuralGate.passed && marketGate.passed) {
      if (confidenceScore >= CONFIDENCE_THRESHOLDS.EXECUTE) {
        action = "EXECUTE";
        direction = context.expert.direction;
        finalSizeMultiplier = this.calculateSizing(context, confidenceScore);
        reasons.push(`High confidence execution (${confidenceScore.toFixed(1)})`);
      } else if (confidenceScore >= CONFIDENCE_THRESHOLDS.WAIT) {
        action = "WAIT";
        reasons.push(`Moderate confidence, waiting for better setup (${confidenceScore.toFixed(1)})`);
      } else {
        action = "SKIP";
        reasons.push(`Low confidence, skipping trade (${confidenceScore.toFixed(1)})`);
      }
    }
    
    return {
      action,
      direction,
      finalSizeMultiplier,
      confidenceScore,
      reasons,
      engineVersion: config.version,
      gateResults: {
        regime: regimeGate,
        structural: structuralGate,
        market: marketGate
      },
      inputContext: context,
      marketSnapshot: marketContext,
      timestamp: startTime
    };
  }

  /**
   * Regime Gate: Validates SATY phase alignment with trade direction
   */
  runRegimeGate(context: DecisionContext): GateResult {
    const phase = context.regime.phase;
    const direction = context.expert.direction;
    const phaseRules = PHASE_RULES[phase];
    
    // Check if direction is allowed in current phase
    if (!phaseRules || !(phaseRules.allowed as readonly TradeDirection[]).includes(direction)) {
      return {
        passed: false,
        reason: `${direction} trades not allowed in phase ${phase} (${context.regime.phaseName})`,
        score: 0
      };
    }
    
    // Check minimum confidence threshold
    if (context.regime.confidence < CONFIDENCE_THRESHOLDS.WAIT) {
      return {
        passed: false,
        reason: `Regime confidence too low: ${context.regime.confidence}% < ${CONFIDENCE_THRESHOLDS.WAIT}%`,
        score: context.regime.confidence
      };
    }
    
    // Check regime bias alignment
    const regimeBias = context.regime.bias;
    if (regimeBias !== "NEUTRAL" && regimeBias !== direction) {
      return {
        passed: false,
        reason: `Regime bias (${regimeBias}) conflicts with trade direction (${direction})`,
        score: context.regime.confidence * 0.5 // Penalize conflicting bias
      };
    }
    
    return {
      passed: true,
      reason: `Phase ${phase} allows ${direction}, confidence ${context.regime.confidence}%`,
      score: context.regime.confidence
    };
  }

  /**
   * Structural Gate: Validates setup quality and execution conditions
   */
  runStructuralGate(context: DecisionContext): GateResult {
    // Check if setup is valid
    if (!context.structure.validSetup) {
      return {
        passed: false,
        reason: "Invalid setup structure detected",
        score: 0
      };
    }
    
    // Check liquidity conditions
    if (!context.structure.liquidityOk) {
      return {
        passed: false,
        reason: "Insufficient liquidity for execution",
        score: 25
      };
    }
    
    // Check execution quality
    const quality = context.structure.executionQuality;
    if (quality === "C") {
      return {
        passed: false,
        reason: "Execution quality too poor (Grade C)",
        score: 40
      };
    }
    
    // Check AI score threshold
    if (context.expert.aiScore < AI_SCORE_THRESHOLDS.MINIMUM) {
      return {
        passed: false,
        reason: `AI score too low: ${context.expert.aiScore} < ${AI_SCORE_THRESHOLDS.MINIMUM}`,
        score: (context.expert.aiScore / AI_SCORE_THRESHOLDS.MINIMUM) * 100
      };
    }
    
    // Calculate structural score based on quality and AI score
    const qualityScore = quality === "A" ? 100 : 75; // A=100, B=75
    const aiScoreNormalized = Math.min(100, (context.expert.aiScore / 10.5) * 100);
    const structuralScore = (qualityScore + aiScoreNormalized) / 2;
    
    return {
      passed: true,
      reason: `Valid setup with ${quality} quality, AI score ${context.expert.aiScore}`,
      score: structuralScore
    };
  }

  /**
   * Market Gates: Validates current market conditions
   */
  runMarketGates(marketContext: MarketContext): GateResult {
    const reasons: string[] = [];
    let minScore = 100;
    
    // Check spread conditions
    if (marketContext.liquidity?.spreadBps !== undefined) {
      const spreadBps = marketContext.liquidity.spreadBps;
      const maxSpread = this.configManager.getConfig().gates.maxSpreadBps;
      
      if (spreadBps > maxSpread) {
        return {
          passed: false,
          reason: `Spread too wide: ${spreadBps}bps > ${maxSpread}bps`,
          score: Math.max(0, 100 - (spreadBps - maxSpread) * 10)
        };
      }
      
      reasons.push(`Spread OK: ${spreadBps}bps`);
      minScore = Math.min(minScore, Math.max(50, 100 - spreadBps));
    }
    
    // Check volatility spike conditions
    if (marketContext.stats?.atr14 !== undefined) {
      const atr = marketContext.stats.atr14;
      const maxAtrSpike = this.configManager.getConfig().gates.maxAtrSpike;
      
      if (atr > maxAtrSpike) {
        return {
          passed: false,
          reason: `ATR spike too high: ${atr.toFixed(2)} > ${maxAtrSpike}`,
          score: Math.max(0, 100 - (atr - maxAtrSpike) * 20)
        };
      }
      
      reasons.push(`ATR OK: ${atr.toFixed(2)}`);
      minScore = Math.min(minScore, Math.max(60, 100 - atr * 10));
    }
    
    // Check depth score
    if (marketContext.liquidity?.depthScore !== undefined) {
      const depthScore = marketContext.liquidity.depthScore;
      const minDepth = this.configManager.getConfig().gates.minDepthScore;
      
      if (depthScore < minDepth) {
        return {
          passed: false,
          reason: `Market depth too low: ${depthScore} < ${minDepth}`,
          score: depthScore
        };
      }
      
      reasons.push(`Depth OK: ${depthScore}`);
      minScore = Math.min(minScore, depthScore);
    }
    
    return {
      passed: true,
      reason: reasons.join(', '),
      score: minScore
    };
  }

  /**
   * Calculate overall confidence score
   * Combines regime confidence, expert quality, alignment, and market conditions
   */
  calculateConfidence(context: DecisionContext, marketContext: MarketContext): number {
    let confidence = 0;
    let weightSum = 0;
    
    // Base confidence from regime (weight: 30%)
    const regimeWeight = 0.3;
    confidence += context.regime.confidence * regimeWeight;
    weightSum += regimeWeight;
    
    // Expert AI score contribution (weight: 25%)
    const expertWeight = 0.25;
    const aiScoreNormalized = Math.min(100, (context.expert.aiScore / 10.5) * 100);
    let expertScore = aiScoreNormalized;
    
    // Apply quality boost
    const qualityMultiplier = QUALITY_BOOSTS[context.expert.quality];
    expertScore *= qualityMultiplier;
    
    // Apply penalty for low AI scores
    if (context.expert.aiScore < AI_SCORE_THRESHOLDS.MINIMUM) {
      expertScore *= AI_SCORE_THRESHOLDS.PENALTY_BELOW;
    }
    
    confidence += Math.min(100, expertScore) * expertWeight;
    weightSum += expertWeight;
    
    // Multi-timeframe alignment contribution (weight: 20%)
    const alignmentWeight = 0.2;
    const direction = context.expert.direction;
    const alignmentPct = direction === "LONG" ? context.alignment.bullishPct : context.alignment.bearishPct;
    
    let alignmentScore = alignmentPct;
    if (alignmentPct >= ALIGNMENT_THRESHOLDS.STRONG_ALIGNMENT) {
      alignmentScore *= ALIGNMENT_THRESHOLDS.BONUS_MULTIPLIER;
    }
    
    confidence += Math.min(100, alignmentScore) * alignmentWeight;
    weightSum += alignmentWeight;
    
    // Market conditions contribution (weight: 15%)
    const marketWeight = 0.15;
    const marketGate = this.runMarketGates(marketContext);
    const marketScore = marketGate.score || 50;
    
    confidence += marketScore * marketWeight;
    weightSum += marketWeight;
    
    // Structural quality contribution (weight: 10%)
    const structuralWeight = 0.1;
    const structuralGate = this.runStructuralGate(context);
    const structuralScore = structuralGate.score || 50;
    
    confidence += structuralScore * structuralWeight;
    weightSum += structuralWeight;
    
    // Normalize by total weight
    const finalConfidence = confidence / weightSum;
    
    return Math.round(finalConfidence * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Calculate position sizing multiplier
   * Based on confidence, volatility, phase rules, and quality
   */
  calculateSizing(context: DecisionContext, confidence: number): number {
    // Start with base size from confidence
    let sizeMultiplier = confidence / 100; // 0-1 based on confidence
    
    // Apply volatility cap
    const volatilityCap = VOLATILITY_CAPS[context.regime.volatility];
    sizeMultiplier = Math.min(sizeMultiplier, volatilityCap);
    
    // Apply phase-specific size cap
    const phaseCap = PHASE_RULES[context.regime.phase].sizeCap;
    sizeMultiplier = Math.min(sizeMultiplier, phaseCap);
    
    // Apply quality boost
    const qualityBoost = QUALITY_BOOSTS[context.expert.quality];
    sizeMultiplier *= qualityBoost;
    
    // Apply alignment bonus
    const direction = context.expert.direction;
    const alignmentPct = direction === "LONG" ? context.alignment.bullishPct : context.alignment.bearishPct;
    
    if (alignmentPct >= ALIGNMENT_THRESHOLDS.STRONG_ALIGNMENT) {
      sizeMultiplier *= ALIGNMENT_THRESHOLDS.BONUS_MULTIPLIER;
    }
    
    // Enforce absolute bounds
    sizeMultiplier = Math.max(SIZE_BOUNDS.MIN, Math.min(SIZE_BOUNDS.MAX, sizeMultiplier));
    
    return Math.round(sizeMultiplier * 100) / 100; // Round to 2 decimal places
  }
}