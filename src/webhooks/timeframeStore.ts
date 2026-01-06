/**
 * Timeframe Store
 * Manages active signals with automatic expiry and conflict resolution
 * 
 * Requirements: 1.2, 1.3, 1.12
 */

import { EnrichedSignal, Timeframe, SignalQuality } from '@/types/signal';
import { calculateSignalValidityMinutes, calculateExpiryTime } from './validityCalculator';

/**
 * Stored signal with metadata
 */
export interface StoredSignal {
  signal: EnrichedSignal;
  received_at: number;
  expires_at: number;
  validity_minutes: number;
}

/**
 * Quality priority for conflict resolution (higher = better)
 */
const QUALITY_PRIORITY: Record<SignalQuality, number> = {
  'EXTREME': 3,
  'HIGH': 2,
  'MEDIUM': 1,
};

/**
 * Compare signal quality for conflict resolution
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
function compareQuality(a: SignalQuality, b: SignalQuality): number {
  return QUALITY_PRIORITY[a] - QUALITY_PRIORITY[b];
}

/**
 * Timeframe Store class
 * Stores signals by timeframe with automatic expiry
 */
export class TimeframeStore {
  /**
   * Backwards-compatible singleton accessor.
   * Prefer using `getTimeframeStore()` directly in new code.
   */
  static getInstance(): TimeframeStore {
    return getTimeframeStore();
  }

  private signals: Map<Timeframe, StoredSignal> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  constructor(private cleanupIntervalMs: number = 10000) {
    // Start automatic cleanup
    this.startCleanup();
  }

  /**
   * Store a signal, handling conflicts with existing signals
   * 
   * @param signal - The EnrichedSignal to store
   * @param receivedAt - Timestamp when received (defaults to now)
   * @returns The stored signal (may be existing if conflict resolution kept it)
   */
  storeSignal(signal: EnrichedSignal, receivedAt: number = Date.now()): StoredSignal {
    const timeframe = signal.signal.timeframe;
    const existing = this.signals.get(timeframe);
    
    // Check for conflict
    if (existing && !this.isExpired(existing, receivedAt)) {
      // Conflict resolution: higher quality wins, existing wins on tie
      const comparison = compareQuality(signal.signal.quality, existing.signal.signal.quality);
      
      if (comparison <= 0) {
        // Existing signal wins (higher or equal quality)
        return existing;
      }
      // New signal wins (higher quality) - fall through to store
    }
    
    // Calculate validity and expiry
    const validityMinutes = calculateSignalValidityMinutes(signal);
    const expiresAt = calculateExpiryTime(signal, receivedAt);
    
    const storedSignal: StoredSignal = {
      signal,
      received_at: receivedAt,
      expires_at: expiresAt,
      validity_minutes: validityMinutes,
    };
    
    this.signals.set(timeframe, storedSignal);
    return storedSignal;
  }

  /**
   * Get signal for a specific timeframe
   * Returns null if no signal or signal has expired
   */
  getSignalByTimeframe(tf: Timeframe, now: number = Date.now()): StoredSignal | null {
    const stored = this.signals.get(tf);
    if (!stored || this.isExpired(stored, now)) {
      return null;
    }
    return stored;
  }

  /**
   * Get all active (non-expired) signals
   */
  getActiveSignals(now: number = Date.now()): Map<Timeframe, StoredSignal> {
    const active = new Map<Timeframe, StoredSignal>();
    
    for (const [tf, stored] of this.signals) {
      if (!this.isExpired(stored, now)) {
        active.set(tf, stored);
      }
    }
    
    return active;
  }

  /**
   * Check if a stored signal has expired
   */
  isExpired(stored: StoredSignal, now: number = Date.now()): boolean {
    return now >= stored.expires_at;
  }

  /**
   * Remove all expired signals
   * @returns Number of signals removed
   */
  cleanupExpired(now: number = Date.now()): number {
    let removed = 0;
    
    for (const [tf, stored] of this.signals) {
      if (this.isExpired(stored, now)) {
        this.signals.delete(tf);
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Get remaining validity time for a signal in milliseconds
   */
  getRemainingValidity(tf: Timeframe, now: number = Date.now()): number {
    const stored = this.signals.get(tf);
    if (!stored) return 0;
    return Math.max(0, stored.expires_at - now);
  }

  /**
   * Clear all signals (for testing)
   */
  clear(): void {
    this.signals.clear();
  }

  /**
   * Get count of active signals
   */
  getActiveCount(now: number = Date.now()): number {
    return this.getActiveSignals(now).size;
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
let defaultStore: TimeframeStore | null = null;

/**
 * Get the default timeframe store instance
 */
export function getTimeframeStore(): TimeframeStore {
  if (!defaultStore) {
    defaultStore = new TimeframeStore();
  }
  return defaultStore;
}

/**
 * Singleton getInstance method for compatibility
 */
// (implemented as `TimeframeStore.getInstance()` on the class)

/**
 * Reset the default store (for testing)
 */
export function resetTimeframeStore(): void {
  if (defaultStore) {
    defaultStore.destroy();
    defaultStore = null;
  }
}
