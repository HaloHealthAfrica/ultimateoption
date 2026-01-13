/**
 * Phase 2 Decision Engine - Input Normalization Layer
 * 
 * Converts webhook JSON payloads into canonical DecisionContext format.
 * Applies validation rules, clamping, and default values.
 * No business logic - pure data transformation only.
 */

import { TradingViewSignal, 
  SatyPhaseWebhook, SignalType, 
  MarketSession, DecisionContext } from '../types';
import { NORMALIZATION_RULES } from '../config/index';
import { VALIDATION_CONSTANTS } from '../constants/gates';

export class Normalizer {
  /**
   * Normalize TradingView signal webhook to DecisionContext
   */
  static normalizeSignal(payload: unknown): DecisionContext {
    const data = payload as any;
    
    // Validate required fields
    if (!data.signal) {
      throw new Error('Missing required field: signal');
    }
    
    if (!data.signal.type) {
      throw new Error('Missing required field: signal.type');
    }
    
    if (typeof data.signal.aiScore !== 'number') {
      throw new Error('Missing or invalid field: signal.aiScore must be a number');
    }
    
    if (!data.signal.symbol) {
      throw new Error('Missing required field: signal.symbol');
    }
    
    // Validate and normalize signal type
    const signalType = this.normalizeSignalType(data.signal.type);
    
    // Validate and clamp aiScore (0-10.5)
    const aiScore = this.clampAiScore(data.signal.aiScore);
    
    // Extract and validate satyPhase
    const satyPhase = this.normalizeSatyPhaseFromSignal(data.satyPhase);
    
    // Validate and normalize market session
    const marketSession = this.normalizeMarketSession(data.marketSession);
    
    // Extract timestamp (use current time if not provided)
    const timestamp = data.signal.timestamp || Date.now();
    
    const context: DecisionContext = {
      indicator: {
        signalType: signalType,
        aiScore,
        satyPhase,
        marketSession,
        symbol: data.signal.symbol.toString().toUpperCase(),
        timestamp
      }
    };
    
    return context;
  }
  
  /**
   * Normalize SATY phase webhook payload
   */
  static normalizeSatyPhase(payload: unknown): SatyPhaseWebhook {
    const data = payload as any;
    
    // Validate required fields
    if (typeof data.phase !== 'number') {
      throw new Error('Missing or invalid field: phase must be a number');
    }
    
    if (!data.symbol) {
      throw new Error('Missing required field: symbol');
    }
    
    // Clamp phase value (-100 to 100)
    const phase = this.clampSatyPhaseValue(data.phase);
    
    // Extract confidence (default to phase absolute value if not provided)
    const confidence = typeof data.confidence === 'number' 
      ? Math.abs(data.confidence) 
      : Math.abs(phase);
    
    const timestamp = data.timestamp || Date.now();
    
    return {
      phase,
      confidence,
      symbol: data.symbol.toString().toUpperCase(),
      timestamp
    };
  }
  
  /**
   * Validate and normalize signal type
   */
  private static normalizeSignalType(type: unknown): SignalType {
    if (typeof type !== 'string') {
      throw new Error('signal.type must be a string');
    }
    
    const upperType = type.toUpperCase();
    if (!VALIDATION_CONSTANTS.VALID_SIGNAL_TYPES.includes(upperType as SignalType)) {
      throw new Error(`Invalid signal type: ${type}. Must be LONG or SHORT`);
    }
    
    return upperType as SignalType;
  }
  
  /**
   * Clamp aiScore to valid range (0-10.5)
   */
  private static clampAiScore(score: number): number {
    // Handle NaN values
    if (isNaN(score)) {
      return NORMALIZATION_RULES.aiScore.min;
    }
    
    const { min, max } = NORMALIZATION_RULES.aiScore;
    
    if (score < min) {
      return min;
    }
    
    if (score > max) {
      return max;
    }
    
    return score;
  }
  
  /**
   * Extract and normalize SATY phase value from signal payload
   */
  private static normalizeSatyPhaseFromSignal(satyPhase: unknown): number {
    const data = satyPhase as any;
    
    // If no satyPhase provided, use default
    if (!satyPhase || typeof data.phase !== 'number') {
      return NORMALIZATION_RULES.satyPhase.default;
    }
    
    return this.clampSatyPhaseValue(data.phase);
  }
  
  /**
   * Clamp SATY phase value to valid range (-100 to 100)
   */
  private static clampSatyPhaseValue(phase: number): number {
    const { min, max } = NORMALIZATION_RULES.satyPhase;
    
    if (phase < min) {
      return min;
    }
    
    if (phase > max) {
      return max;
    }
    
    return phase;
  }
  
  /**
   * Validate and normalize market session
   */
  private static normalizeMarketSession(session: unknown): MarketSession {
    // If no session provided, default to OPEN
    if (!session) {
      return 'OPEN';
    }
    
    if (typeof session !== 'string') {
      return 'OPEN';
    }
    
    const upperSession = session.toUpperCase();
    if (!NORMALIZATION_RULES.validSessions.includes(upperSession as MarketSession)) {
      return 'OPEN';
    }
    
    return upperSession as MarketSession;
  }
  
  /**
   * Merge SATY phase data into existing DecisionContext
   */
  static mergeSatyPhase(context: DecisionContext, satyData: { phase: number; confidence: number }): DecisionContext {
    return {
      ...context,
      indicator: {
        ...context.indicator,
        satyPhase: satyData.phase
      }
    };
  }
  
  /**
   * Apply default values for optional fields
   */
  static applyDefaults(context: DecisionContext): DecisionContext {
    return {
      ...context,
      indicator: {
        ...context.indicator,
        // Ensure all required fields have valid values
        aiScore: context.indicator.aiScore ?? NORMALIZATION_RULES.aiScore.default,
        satyPhase: context.indicator.satyPhase ?? NORMALIZATION_RULES.satyPhase.default
      }
    };
  }
}