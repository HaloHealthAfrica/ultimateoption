/**
 * Phase Store
 * Manages active SATY phases with decay time based on timeframe
 * 
 * Requirements: 18.3, 18.7
 */

import { SatyPhaseWebhook } from '@/types/saty';

/**
 * Stored phase with metadata
 */
export interface StoredPhase {
  phase: SatyPhaseWebhook;
  received_at: number;
  expires_at: number;
  decay_minutes: number;
}

/**
 * Timeframe to decay time mapping (in minutes)
 * Higher timeframes have longer decay periods
 */
export const PHASE_DECAY_MINUTES: Readonly<Record<string, number>> = Object.freeze({
  // Regime level (longest decay)
  '4H': 480,   // 8 hours
  '240': 480,
  // Bias level
  '1H': 240,   // 4 hours
  '60': 240,
  // Setup level
  '30M': 120,  // 2 hours
  '30': 120,
  // Entry level
  '15M': 60,   // 1 hour
  '15': 60,
  // Scalp level
  '5M': 30,    // 30 minutes
  '5': 30,
  '3M': 15,    // 15 minutes
  '3': 15,
});

/**
 * Default decay time for unknown timeframes
 */
const DEFAULT_DECAY_MINUTES = 60;

/**
 * Get decay time for a phase based on its timeframe
 */
export function getPhaseDecayMinutes(phase: SatyPhaseWebhook): number {
  // Use the time_decay_minutes from risk_hints if provided
  if (phase.risk_hints.time_decay_minutes > 0) {
    return phase.risk_hints.time_decay_minutes;
  }
  
  // Otherwise use the event timeframe
  const tf = phase.timeframe.event_tf;
  return PHASE_DECAY_MINUTES[tf] ?? DEFAULT_DECAY_MINUTES;
}

/**
 * Phase Store class
 * Stores phases by timeframe role with automatic expiry
 */
export class PhaseStore {
  /**
   * Backwards-compatible singleton accessor.
   * Prefer using `getPhaseStore()` directly in new code.
   */
  static getInstance(): PhaseStore {
    return getPhaseStore();
  }

  private phases: Map<string, StoredPhase> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  constructor(private cleanupIntervalMs: number = 10000) {
    this.startCleanup();
  }

  /**
   * Generate a key for storing phases
   * Uses timeframe role + event timeframe for uniqueness
   */
  private getKey(phase: SatyPhaseWebhook): string {
    return `${phase.timeframe.tf_role}:${phase.timeframe.event_tf}`;
  }

  /**
   * Store a phase
   * 
   * @param phase - The SatyPhaseWebhook to store
   * @param receivedAt - Timestamp when received (defaults to now)
   * @returns The stored phase
   */
  storePhase(phase: SatyPhaseWebhook, receivedAt: number = Date.now()): StoredPhase {
    const key = this.getKey(phase);
    const decayMinutes = getPhaseDecayMinutes(phase);
    const expiresAt = receivedAt + (decayMinutes * 60 * 1000);
    
    const storedPhase: StoredPhase = {
      phase,
      received_at: receivedAt,
      expires_at: expiresAt,
      decay_minutes: decayMinutes,
    };
    
    this.phases.set(key, storedPhase);
    return storedPhase;
  }

  /**
   * Get phase by timeframe role and event timeframe
   */
  getPhase(tfRole: string, eventTf: string, now: number = Date.now()): StoredPhase | null {
    const key = `${tfRole}:${eventTf}`;
    const stored = this.phases.get(key);
    
    if (!stored || this.isExpired(stored, now)) {
      return null;
    }
    
    return stored;
  }

  /**
   * Get phase by timeframe (searches all roles)
   */
  getPhaseByTimeframe(tf: string, now: number = Date.now()): StoredPhase | null {
    for (const stored of this.phases.values()) {
      if (stored.phase.timeframe.event_tf === tf && !this.isExpired(stored, now)) {
        return stored;
      }
    }
    return null;
  }

  /**
   * Get all active (non-expired) phases
   */
  getActivePhases(now: number = Date.now()): Map<string, StoredPhase> {
    const active = new Map<string, StoredPhase>();
    
    for (const [key, stored] of this.phases) {
      if (!this.isExpired(stored, now)) {
        active.set(key, stored);
      }
    }
    
    return active;
  }

  /**
   * Get phases by role (REGIME, BIAS, etc.)
   */
  getPhasesByRole(role: string, now: number = Date.now()): StoredPhase[] {
    const result: StoredPhase[] = [];
    
    for (const stored of this.phases.values()) {
      if (stored.phase.timeframe.tf_role === role && !this.isExpired(stored, now)) {
        result.push(stored);
      }
    }
    
    return result;
  }

  /**
   * Check if a stored phase has expired
   */
  isExpired(stored: StoredPhase, now: number = Date.now()): boolean {
    return now >= stored.expires_at;
  }

  /**
   * Remove all expired phases
   * @returns Number of phases removed
   */
  cleanupExpired(now: number = Date.now()): number {
    let removed = 0;
    
    for (const [key, stored] of this.phases) {
      if (this.isExpired(stored, now)) {
        this.phases.delete(key);
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Get remaining decay time for a phase in milliseconds
   */
  getRemainingDecay(tfRole: string, eventTf: string, now: number = Date.now()): number {
    const stored = this.getPhase(tfRole, eventTf, now);
    if (!stored) return 0;
    return Math.max(0, stored.expires_at - now);
  }

  /**
   * Clear all phases (for testing)
   */
  clear(): void {
    this.phases.clear();
  }

  /**
   * Get count of active phases
   */
  getActiveCount(now: number = Date.now()): number {
    return this.getActivePhases(now).size;
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop automatic cleanup (for testing/cleanup)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Destroy the store and cleanup resources
   */
  destroy(): void {
    this.stopCleanup();
    this.clear();
  }
}

// Singleton instance for application use
let defaultStore: PhaseStore | null = null;

/**
 * Get the default phase store instance
 */
export function getPhaseStore(): PhaseStore {
  if (!defaultStore) {
    defaultStore = new PhaseStore();
  }
  return defaultStore;
}

/**
 * Singleton getInstance method for compatibility
 */
// (implemented as `PhaseStore.getInstance()` on the class)

/**
 * Reset the default store (for testing)
 */
export function resetPhaseStore(): void {
  if (defaultStore) {
    defaultStore.destroy();
    defaultStore = null;
  }
}
