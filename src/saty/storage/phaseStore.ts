/**
 * SATY Phase Store - Singleton storage for SATY Phase Oscillator events
 * Manages phases with automatic expiry and regime context aggregation
 * 
 * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5
 */

import { SatyPhaseWebhook } from '../../types/saty';

export interface StoredPhase {
  phase: SatyPhaseWebhook;
  received_at: number;
  expires_at: number;
  is_active: boolean;
}

export interface RegimeContext {
  setup_phase: SatyPhaseWebhook | null;      // 15M
  bias_phase: SatyPhaseWebhook | null;       // 1H  
  regime_phase: SatyPhaseWebhook | null;     // 4H
  structural_phase: SatyPhaseWebhook | null; // 1D
  is_aligned: boolean;
  active_count: number;
}

/**
 * Calculate phase decay time based on timeframe
 * Requirements: 18.7, 25.1
 */
function calculatePhaseDecayTime(phase: SatyPhaseWebhook): number {
  const timeframe = phase.timeframe.event_tf;
  
  // Use explicit time_decay_minutes if provided
  if (phase.risk_hints.time_decay_minutes > 0) {
    return phase.risk_hints.time_decay_minutes;
  }
  
  // Default decay times based on timeframe
  const decayMap: Record<string, number> = {
    '15M': 60,   // 1 hour
    '1H': 240,   // 4 hours
    '4H': 960,   // 16 hours
    '1D': 2880,  // 48 hours
  };
  
  return decayMap[timeframe] || 60; // Default 1 hour
}

/**
 * Map timeframe to regime role
 */
/**
 * Singleton SATY Phase Store
 * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5
 */
export class PhaseStore {
  private static instance: PhaseStore | null = null;
  private phases: Map<string, StoredPhase> = new Map();
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  static getInstance(): PhaseStore {
    if (!PhaseStore.instance) {
      PhaseStore.instance = new PhaseStore();
    }
    return PhaseStore.instance;
  }
  
  /**
   * Create a new instance (for testing)
   */
  static createInstance(): PhaseStore {
    // Private constructor; test helper uses a safe cast to instantiate.
    return new (PhaseStore as unknown as { new (): PhaseStore })();
  }
  
  /**
   * Update phase in store with automatic expiry
   * Requirements: 25.1
   */
  updatePhase(phase: SatyPhaseWebhook): void {
    const key = `${phase.instrument.symbol}:${phase.timeframe.event_tf}`;
    const now = Date.now();
    const decayMinutes = calculatePhaseDecayTime(phase);
    const expires_at = now + (decayMinutes * 60 * 1000);
    
    const storedPhase: StoredPhase = {
      phase,
      received_at: now,
      expires_at,
      is_active: true,
    };
    
    this.phases.set(key, storedPhase);
    
    // Clean up expired phases
    this.cleanupExpired();
  }
  
  /**
   * Get specific phase by symbol and timeframe
   */
  getPhase(symbol: string, timeframe: string): SatyPhaseWebhook | null {
    const key = `${symbol}:${timeframe}`;
    const stored = this.phases.get(key);
    
    if (!stored || !stored.is_active || Date.now() > stored.expires_at) {
      return null;
    }
    
    return stored.phase;
  }
  
  /**
   * Get regime context for symbol across 15M/1H/4H/1D timeframes
   * Requirements: 25.2, 25.3, 25.4, 25.5
   */
  getRegimeContext(symbol: string): RegimeContext {
    const context: RegimeContext = {
      setup_phase: this.getPhase(symbol, '15M'),
      bias_phase: this.getPhase(symbol, '1H'),
      regime_phase: this.getPhase(symbol, '4H'),
      structural_phase: this.getPhase(symbol, '1D'),
      is_aligned: false,
      active_count: 0,
    };
    
    // Count active phases
    const activePhases = [
      context.setup_phase,
      context.bias_phase,
      context.regime_phase,
      context.structural_phase,
    ].filter(phase => phase !== null);
    
    context.active_count = activePhases.length;
    
    // Calculate alignment: 2+ phases with same local_bias
    if (activePhases.length >= 2) {
      const biases = activePhases.map(phase => phase!.regime_context.local_bias);
      const biasCount: Record<string, number> = {};
      
      biases.forEach(bias => {
        biasCount[bias] = (biasCount[bias] || 0) + 1;
      });
      
      // Check if any bias appears 2+ times
      context.is_aligned = Object.values(biasCount).some(count => count >= 2);
    }
    
    return context;
  }
  
  /**
   * Get count of all active phases
   */
  getActiveCount(): number {
    this.cleanupExpired();
    return Array.from(this.phases.values()).filter(p => p.is_active).length;
  }
  
  /**
   * Get all active phases as a Map (for decision engine)
   */
  getActivePhases(): Map<string, StoredPhase> {
    this.cleanupExpired();
    const activePhases = new Map<string, StoredPhase>();
    
    for (const [key, stored] of this.phases.entries()) {
      if (stored.is_active && Date.now() <= stored.expires_at) {
        activePhases.set(key, stored);
      }
    }
    
    return activePhases;
  }
  
  /**
   * Get timestamp of most recent phase
   */
  getLastPhaseTime(): number | null {
    const activePhaseTimes = Array.from(this.phases.values())
      .filter(p => p.is_active)
      .map(p => p.received_at);
    
    return activePhaseTimes.length > 0 ? Math.max(...activePhaseTimes) : null;
  }
  
  /**
   * Clean up expired phases
   * Requirements: 18.7, 25.1
   */
  private cleanupExpired(): void {
    const now = Date.now();
    
    for (const stored of this.phases.values()) {
      if (now > stored.expires_at) {
        stored.is_active = false;
        // Keep expired phases for audit but mark inactive
      }
    }
  }
  
  /**
   * Clear all phases (for testing)
   */
  clear(): void {
    this.phases.clear();
  }
  
  /**
   * Destroy singleton instance (for testing)
   */
  destroy(): void {
    this.phases.clear();
    PhaseStore.instance = null;
  }
}