/**
 * Decision Engine Service for Phase 2.5
 * 
 * Core decision-making logic with deterministic pipeline stages.
 * Implements regime gates, structural validation, expert confirmation,
 * and confidence-based sizing calculations.
 * 
 * REFACTORED:
 * - Gate results are now cached to prevent double execution
 * - Magic numbers extracted to named constants
 * - Market gate collects all failure reasons
 * - Regime gate fallback behavior is configurable
 * - Quality boost is only applied once (in sizing, not confidence)
 */

import {
  IDecisionEngine,
  MarketContext,
  DecisionPacket,
  EngineAction,
  TradeDirection,
  DecisionContext,
} from '../types';
import { GateResult, GateResults, GateConfig } from '../types/gates';
import { ConfigManagerService } from './config-manager.service';
import {
  PHASE_RULES,
  VOLATILITY_CAPS,
  QUALITY_BOOSTS,
  AI_SCORE_MAX,
  NEUTRAL_SCORE,
  FAILURE_SCORES,
} from '../config/constants';
import {
  CONFIDENCE_THRESHOLDS,
  AI_SCORE_THRESHOLDS,
  ALIGNMENT_THRESHOLDS,
  SIZE_BOUNDS,
  CONFIDENCE_WEIGHTS,
  DEFAULT_GATE_CONFIG,
} from '../config/trading-rules.config';

export class DecisionEngineService implements IDecisionEngine {
  private configManager: ConfigManagerService;
  private gateConfig: GateConfig;

  constructor(configManager: ConfigManagerService, gateConfig?: Partial<GateConfig>) {
    this.configManager = configManager;
    this.gateConfig = { ...DEFAULT_GATE_CONFIG, ...gateConfig };
  }

  /**
   * Main decision-making method
   * Runs the complete pipeline and returns a decision packet
   */
  makeDecision(context: DecisionContext, marketContext: MarketContext): DecisionPacket {
    const startTime = Date.now();
    const config = this.configManager.getConfig();
    
    // Run all gates ONCE and cache results
    const gateResults: GateResults = {
      regime: this.runRegimeGate(context),
      structural: this.runStructuralGate(context),
      market: this.runMarketGates(marketContext),
    };
    
    // Calculate confidence using cached gate results
    const confidenceScore = this.calculateConfidence(context, marketContext, gateResults);
    
    // Determine action based on gates and confidence
    const { action, direction, reasons } = this.determineAction(
      context,
      gateResults,
      confidenceScore
    );
    
    // Calculate sizing only for EXECUTE actions
    const finalSizeMultiplier =
      action === 'EXECUTE' ? this.calculateSizing(context, confidenceScore) : 0;
    
    return {
      action,
      direction,
      finalSizeMultiplier,
      confidenceScore,
      reasons,
      engineVersion: config.version,
      gateResults,
      inputContext: context,
      marketSnapshot: marketContext,
      timestamp: startTime,
    };
  }

  /**
   * Determine action based on gate results and confidence
   * Extracted for clarity and testability
   */
  private determineAction(
    context: DecisionContext,
    gateResults: GateResults,
    confidenceScore: number
  ): { action: EngineAction; direction?: TradeDirection; reasons: string[] } {
    const reasons: string[] = [];
    
    // Collect gate failure reasons
    if (!gateResults.regime.passed) {
      reasons.push(`Regime gate failed: ${gateResults.regime.reason}`);
    }
    if (!gateResults.structural.passed) {
      reasons.push(`Structural gate failed: ${gateResults.structural.reason}`);
    }
    if (!gateResults.market.passed) {
      reasons.push(`Market gate failed: ${gateResults.market.reason}`);
    }
    
    // If any gate failed, skip
    const allGatesPassed =
      gateResults.regime.passed && gateResults.structural.passed && gateResults.market.passed;
    
    if (!allGatesPassed) {
      return { action: 'SKIP', reasons };
    }
    
    // All gates passed - determine action based on confidence
    if (confidenceScore >= CONFIDENCE_THRESHOLDS.EXECUTE) {
      return {
        action: 'EXECUTE',
        direction: context.expert.direction,
        reasons: [`High confidence execution (${confidenceScore.toFixed(1)})`],
      };
    }
    
    if (confidenceScore >= CONFIDENCE_THRESHOLDS.WAIT) {
      return {
        action: 'WAIT',
        reasons: [`Moderate confidence, waiting for better setup (${confidenceScore.toFixed(1)})`],
      };
    }
    
    return {
      action: 'SKIP',
      reasons: [`Low confidence, skipping trade (${confidenceScore.toFixed(1)})`],
    };
  }

  /**
   * Regime Gate: Validates SATY phase alignment with trade direction
   * 
   * Behavior when regime data is missing is configurable via gateConfig.
   */
  runRegimeGate(context: DecisionContext): GateResult {
    // Handle missing regime data based on configuration
    if (!context.regime) {
      if (this.gateConfig.allowSignalOnlyMode) {
        return {
          passed: true,
          reason: 'No regime data available, allowing trade (signal-only mode)',
          score: this.gateConfig.signalOnlyScore,
        };
      }
      return {
        passed: false,
        reason: 'Regime data required but not available',
        score: FAILURE_SCORES.CRITICAL,
      };
    }
    
    const { phase, phaseName, confidence, bias } = context.regime;
    const direction = context.expert.direction;
    const phaseRules = PHASE_RULES[phase];
    
    // Check if direction is allowed in current phase
    if (!phaseRules || !(phaseRules.allowed as readonly TradeDirection[]).includes(direction)) {
      return {
        passed: false,
        reason: `${direction} trades not allowed in phase ${phase} (${phaseName})`,
        score: FAILURE_SCORES.CRITICAL,
        details: { phase, phaseName, direction, allowed: phaseRules?.allowed },
      };
    }
    
    // Check minimum confidence threshold
    if (confidence < CONFIDENCE_THRESHOLDS.WAIT) {
      return {
        passed: false,
        reason: `Regime confidence too low: ${confidence}% < ${CONFIDENCE_THRESHOLDS.WAIT}%`,
        score: confidence,
      };
    }
    
    // Check regime bias alignment
    if (bias !== 'NEUTRAL' && bias !== direction) {
      return {
        passed: false,
        reason: `Regime bias (${bias}) conflicts with trade direction (${direction})`,
        score: confidence * 0.5,
      };
    }
    
    return {
      passed: true,
      reason: `Phase ${phase} allows ${direction}, confidence ${confidence}%`,
      score: confidence,
    };
  }

  /**
   * Structural Gate: Validates setup quality and execution conditions
   */
  runStructuralGate(context: DecisionContext): GateResult {
    const { structure, expert } = context;
    
    // Check if setup is valid
    if (!structure.validSetup) {
      return {
        passed: false,
        reason: 'Invalid setup structure detected',
        score: FAILURE_SCORES.CRITICAL,
      };
    }
    
    // Check liquidity conditions
    if (!structure.liquidityOk) {
      return {
        passed: false,
        reason: 'Insufficient liquidity for execution',
        score: FAILURE_SCORES.LIQUIDITY,
      };
    }
    
    // Check execution quality
    if (structure.executionQuality === 'C') {
      return {
        passed: false,
        reason: 'Execution quality too poor (Grade C)',
        score: FAILURE_SCORES.QUALITY,
      };
    }
    
    // Check AI score threshold
    if (expert.aiScore < AI_SCORE_THRESHOLDS.MINIMUM) {
      const proportionalScore = (expert.aiScore / AI_SCORE_THRESHOLDS.MINIMUM) * 100;
      return {
        passed: false,
        reason: `AI score too low: ${expert.aiScore} < ${AI_SCORE_THRESHOLDS.MINIMUM}`,
        score: proportionalScore,
      };
    }
    
    // Calculate structural score based on quality and AI score
    const qualityScore = structure.executionQuality === 'A' ? 100 : 75;
    const aiScoreNormalized = Math.min(100, (expert.aiScore / AI_SCORE_MAX) * 100);
    const structuralScore = (qualityScore + aiScoreNormalized) / 2;
    
    return {
      passed: true,
      reason: `Valid setup with ${structure.executionQuality} quality, AI score ${expert.aiScore}`,
      score: structuralScore,
      details: { qualityScore, aiScoreNormalized },
    };
  }

  /**
   * Market Gates: Validates current market conditions
   * 
   * CONSERVATIVE: Fails if critical market data is unavailable.
   * IMPROVED: Collects all failure reasons instead of returning on first failure.
   */
  runMarketGates(marketContext: MarketContext): GateResult {
    const failures: string[] = [];
    const scores: number[] = [];
    const config = this.configManager.getConfig();
    
    // Check spread conditions
    if (marketContext.liquidity?.spreadBps === undefined) {
      failures.push('Spread data unavailable - cannot assess execution quality');
      scores.push(FAILURE_SCORES.CRITICAL);
    } else {
      const spreadBps = marketContext.liquidity.spreadBps;
      const maxSpread = config.gates.maxSpreadBps;
      
      if (spreadBps > maxSpread) {
        failures.push(`Spread too wide: ${spreadBps}bps > ${maxSpread}bps`);
        scores.push(Math.max(0, 100 - (spreadBps - maxSpread) * 10));
      } else {
        scores.push(Math.max(50, 100 - spreadBps));
      }
    }
    
    // Check volatility spike conditions
    if (marketContext.stats?.atr14 === undefined) {
      failures.push('Volatility data unavailable - cannot assess risk');
      scores.push(FAILURE_SCORES.CRITICAL);
    } else {
      const atr = marketContext.stats.atr14;
      const maxAtrSpike = config.gates.maxAtrSpike;
      
      if (atr > maxAtrSpike) {
        failures.push(`ATR spike too high: ${atr.toFixed(2)} > ${maxAtrSpike}`);
        scores.push(Math.max(0, 100 - (atr - maxAtrSpike) * 20));
      } else {
        scores.push(Math.max(60, 100 - atr * 10));
      }
    }
    
    // Check depth score
    if (marketContext.liquidity?.depthScore === undefined) {
      failures.push('Market depth data unavailable - cannot assess liquidity');
      scores.push(FAILURE_SCORES.CRITICAL);
    } else {
      const depthScore = marketContext.liquidity.depthScore;
      const minDepth = config.gates.minDepthScore;
      
      if (depthScore < minDepth) {
        failures.push(`Market depth too low: ${depthScore} < ${minDepth}`);
        scores.push(depthScore);
      } else {
        scores.push(depthScore);
      }
    }
    
    // Return combined result
    if (failures.length > 0) {
      return {
        passed: false,
        reason: failures.join('; '),
        score: Math.min(...scores),
        details: { failures, scores },
      };
    }
    
    return {
      passed: true,
      reason: `All market conditions OK (spread, ATR, depth)`,
      score: Math.min(...scores),
      details: { scores },
    };
  }

  /**
   * Calculate overall confidence score
   * 
   * Uses cached gate results to avoid re-running gates.
   * Quality boost is NOT applied here (only in sizing) to avoid double-reward.
   * 
   * PRIVATE: Not part of public interface, only used internally by makeDecision.
   */
  private calculateConfidence(
    context: DecisionContext,
    _marketContext: MarketContext,
    gateResults: GateResults
  ): number {
    let confidence = 0;
    let weightSum = 0;
    
    // Base confidence from regime (weight from config)
    if (context.regime) {
      const regimeWeight = CONFIDENCE_WEIGHTS.REGIME;
      confidence += context.regime.confidence * regimeWeight;
      weightSum += regimeWeight;
    }
    
    // Expert AI score contribution (WITHOUT quality boost - applied only in sizing)
    const expertWeight = CONFIDENCE_WEIGHTS.EXPERT;
    let expertScore = Math.min(100, (context.expert.aiScore / AI_SCORE_MAX) * 100);
    
    // Apply penalty for low AI scores
    if (context.expert.aiScore < AI_SCORE_THRESHOLDS.MINIMUM) {
      expertScore *= AI_SCORE_THRESHOLDS.PENALTY_MULTIPLIER;
    }
    
    confidence += Math.min(100, expertScore) * expertWeight;
    weightSum += expertWeight;
    
    // Multi-timeframe alignment contribution (weight from config)
    if (context.alignment) {
      const alignmentWeight = CONFIDENCE_WEIGHTS.ALIGNMENT;
      const direction = context.expert.direction;
      const alignmentPct = direction === "LONG" ? context.alignment.bullishPct : context.alignment.bearishPct;
      
      let alignmentScore = alignmentPct;
      if (alignmentPct >= ALIGNMENT_THRESHOLDS.STRONG_ALIGNMENT) {
        alignmentScore *= ALIGNMENT_THRESHOLDS.BONUS_MULTIPLIER;
      }
      
      confidence += Math.min(100, alignmentScore) * alignmentWeight;
      weightSum += alignmentWeight;
    }
    
    // Market conditions contribution (use cached gate result)
    const marketWeight = CONFIDENCE_WEIGHTS.MARKET;
    const marketScore = gateResults.market.score || NEUTRAL_SCORE;
    confidence += marketScore * marketWeight;
    weightSum += marketWeight;
    
    // Structural quality contribution (use cached gate result)
    const structuralWeight = CONFIDENCE_WEIGHTS.STRUCTURAL;
    const structuralScore = gateResults.structural.score || NEUTRAL_SCORE;
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
    
    // Apply volatility cap (use NORMAL if no regime data)
    const volatility = context.regime?.volatility || 'NORMAL';
    const volatilityCap = VOLATILITY_CAPS[volatility];
    sizeMultiplier = Math.min(sizeMultiplier, volatilityCap);
    
    // Apply phase-specific size cap (use phase 2 if no regime data)
    const phase = context.regime?.phase || 2;
    const phaseCap = PHASE_RULES[phase].sizeCap;
    sizeMultiplier = Math.min(sizeMultiplier, phaseCap);
    
    // Apply quality boost
    const qualityBoost = QUALITY_BOOSTS[context.expert.quality];
    sizeMultiplier *= qualityBoost;
    
    // Apply alignment bonus (skip if no alignment data)
    if (context.alignment) {
      const direction = context.expert.direction;
      const alignmentPct = direction === "LONG" ? context.alignment.bullishPct : context.alignment.bearishPct;
      
      if (alignmentPct >= ALIGNMENT_THRESHOLDS.STRONG_ALIGNMENT) {
        sizeMultiplier *= ALIGNMENT_THRESHOLDS.BONUS_MULTIPLIER;
      }
    }
    
    // Enforce absolute bounds
    sizeMultiplier = Math.max(SIZE_BOUNDS.MIN, Math.min(SIZE_BOUNDS.MAX, sizeMultiplier));
    
    return Math.round(sizeMultiplier * 100) / 100; // Round to 2 decimal places
  }
}