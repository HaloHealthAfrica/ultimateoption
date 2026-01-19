/**
 * Rate Limit Tracker Service
 * Tracks API calls and enforces limits to prevent rate limit violations
 */

interface ProviderLimits {
  maxCallsPerDay: number;
  maxCallsPerMinute: number;
  currentDayCount: number;
  currentMinuteCount: number;
  lastResetDay: number;
  lastResetMinute: number;
}

export class RateLimitTracker {
  private limits: Map<string, ProviderLimits> = new Map();
  
  constructor() {
    // Initialize provider limits based on their tier
    this.limits.set('tradier', {
      maxCallsPerDay: 10000,      // Tradier sandbox/basic
      maxCallsPerMinute: 60,
      currentDayCount: 0,
      currentMinuteCount: 0,
      lastResetDay: Date.now(),
      lastResetMinute: Date.now()
    });
    
    this.limits.set('twelvedata', {
      maxCallsPerDay: 800,         // TwelveData free tier
      maxCallsPerMinute: 8,
      currentDayCount: 0,
      currentMinuteCount: 0,
      lastResetDay: Date.now(),
      lastResetMinute: Date.now()
    });
    
    this.limits.set('alpaca', {
      maxCallsPerDay: 200,         // Alpaca free tier
      maxCallsPerMinute: 200,
      currentDayCount: 0,
      currentMinuteCount: 0,
      lastResetDay: Date.now(),
      lastResetMinute: Date.now()
    });
  }
  
  /**
   * Check if we can make a request to the provider
   */
  canMakeRequest(provider: string): boolean {
    const limit = this.limits.get(provider);
    if (!limit) return true;
    
    this.resetCountersIfNeeded(provider);
    
    return limit.currentDayCount < limit.maxCallsPerDay &&
           limit.currentMinuteCount < limit.maxCallsPerMinute;
  }
  
  /**
   * Record that a request was made
   */
  recordRequest(provider: string): void {
    const limit = this.limits.get(provider);
    if (!limit) return;
    
    this.resetCountersIfNeeded(provider);
    
    limit.currentDayCount++;
    limit.currentMinuteCount++;
  }
  
  /**
   * Get remaining calls for a provider
   */
  getRemainingCalls(provider: string): { day: number; minute: number } | null {
    const limit = this.limits.get(provider);
    if (!limit) return null;
    
    this.resetCountersIfNeeded(provider);
    
    return {
      day: limit.maxCallsPerDay - limit.currentDayCount,
      minute: limit.maxCallsPerMinute - limit.currentMinuteCount
    };
  }
  
  /**
   * Reset counters if time windows have passed
   */
  private resetCountersIfNeeded(provider: string): void {
    const limit = this.limits.get(provider);
    if (!limit) return;
    
    const now = Date.now();
    
    // Reset daily counter (24 hours)
    if (now - limit.lastResetDay > 24 * 60 * 60 * 1000) {
      limit.currentDayCount = 0;
      limit.lastResetDay = now;
    }
    
    // Reset minute counter (60 seconds)
    if (now - limit.lastResetMinute > 60 * 1000) {
      limit.currentMinuteCount = 0;
      limit.lastResetMinute = now;
    }
  }
  
  /**
   * Get statistics for a provider
   */
  getStats(provider: string): ProviderLimits | null {
    const limit = this.limits.get(provider);
    if (!limit) return null;
    
    this.resetCountersIfNeeded(provider);
    return { ...limit };
  }
  
  /**
   * Get statistics for all providers
   */
  getAllStats(): Record<string, ProviderLimits> {
    const stats: Record<string, ProviderLimits> = {};
    
    for (const [provider, _] of this.limits) {
      const providerStats = this.getStats(provider);
      if (providerStats) {
        stats[provider] = providerStats;
      }
    }
    
    return stats;
  }
  
  /**
   * Reset all counters (for testing)
   */
  reset(): void {
    for (const [_, limit] of this.limits) {
      limit.currentDayCount = 0;
      limit.currentMinuteCount = 0;
      limit.lastResetDay = Date.now();
      limit.lastResetMinute = Date.now();
    }
  }
}
