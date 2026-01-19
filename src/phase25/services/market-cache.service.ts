/**
 * Market Data Cache Service
 * Caches API responses to reduce provider calls and avoid rate limits
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

export class MarketCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  
  // Cache TTLs (in milliseconds)
  public readonly TTL = {
    QUOTE: 60 * 1000,           // 1 minute - real-time data
    ATR: 5 * 60 * 1000,         // 5 minutes - slower moving
    RSI: 5 * 60 * 1000,         // 5 minutes - slower moving
    OPTIONS: 5 * 60 * 1000,     // 5 minutes - slower moving
    TIMESERIES: 15 * 60 * 1000, // 15 minutes - historical data
    LIQUIDITY: 60 * 1000        // 1 minute - real-time data
  };
  
  /**
   * Get cached data if available and not expired
   */
  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Store data in cache with TTL
   */
  set(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[]; hitRate?: number } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
  
  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}
