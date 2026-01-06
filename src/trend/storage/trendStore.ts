/**
 * Trend Store - Singleton storage for multi-timeframe trend alignment data
 * Manages trends with 1-hour TTL and alignment calculation
 * 
 * Requirements: 24.3, 24.4, 24.5, 24.6, 24.7
 */

import { TrendWebhook, TrendAlignment, calculateTrendAlignment } from '../../types/trend';

export interface StoredTrend {
  trend: TrendWebhook;
  received_at: number;
  expires_at: number;
  is_active: boolean;
}

/**
 * Singleton Trend Store
 * Requirements: 24.3, 24.4, 24.5, 24.6, 24.7
 */
export class TrendStore {
  private static instance: TrendStore | null = null;
  private trends: Map<string, StoredTrend> = new Map();
  private readonly TTL_MINUTES = 60; // 1 hour TTL
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  static getInstance(): TrendStore {
    if (!TrendStore.instance) {
      TrendStore.instance = new TrendStore();
    }
    return TrendStore.instance;
  }
  
  /**
   * Create a new instance (for testing)
   */
  static createInstance(): TrendStore {
    // Private constructor; test helper uses a safe cast to instantiate.
    return new (TrendStore as unknown as { new (): TrendStore })();
  }
  
  /**
   * Update trend in store with 1-hour TTL
   * Requirements: 24.3
   */
  updateTrend(trend: TrendWebhook): void {
    const key = trend.ticker;
    const now = Date.now();
    const expires_at = now + (this.TTL_MINUTES * 60 * 1000);
    
    const storedTrend: StoredTrend = {
      trend,
      received_at: now,
      expires_at,
      is_active: true,
    };
    
    this.trends.set(key, storedTrend);
    
    // Clean up expired trends
    this.cleanupExpired();
  }
  
  /**
   * Alias for updateTrend for compatibility
   */
  storeTrend(trend: TrendWebhook): void {
    this.updateTrend(trend);
  }
  
  /**
   * Get trend data for ticker
   */
  getTrend(ticker: string): TrendWebhook | null {
    const stored = this.trends.get(ticker);
    
    if (!stored || !stored.is_active || Date.now() > stored.expires_at) {
      return null;
    }
    
    return stored.trend;
  }
  
  /**
   * Calculate trend alignment metrics for ticker
   * Requirements: 24.4, 24.5, 24.6, 24.7
   */
  getAlignment(ticker: string): TrendAlignment | null {
    const trend = this.getTrend(ticker);
    
    if (!trend) {
      return null;
    }
    
    return calculateTrendAlignment(trend);
  }
  
  /**
   * Get count of active tickers with trend data
   */
  getActiveTickerCount(): number {
    this.cleanupExpired();
    return Array.from(this.trends.values()).filter(t => t.is_active).length;
  }
  
  /**
   * Get timestamp of most recent trend update
   */
  getLastUpdateTime(): number | null {
    const activeTrendTimes = Array.from(this.trends.values())
      .filter(t => t.is_active)
      .map(t => t.received_at);
    
    return activeTrendTimes.length > 0 ? Math.max(...activeTrendTimes) : null;
  }
  
  /**
   * Get HTF bias from 4H timeframe
   * Requirements: 24.6
   */
  getHtfBias(ticker: string): 'bullish' | 'bearish' | 'neutral' | null {
    const trend = this.getTrend(ticker);
    
    if (!trend) {
      return null;
    }
    
    return trend.timeframes.tf240min.direction;
  }
  
  /**
   * Get LTF bias from 3M/5M average
   * Requirements: 24.7
   */
  getLtfBias(ticker: string): 'bullish' | 'bearish' | 'neutral' | null {
    const trend = this.getTrend(ticker);
    
    if (!trend) {
      return null;
    }
    
    const ltf_directions = [
      trend.timeframes.tf3min.direction,
      trend.timeframes.tf5min.direction
    ];
    
    const ltf_bullish = ltf_directions.filter(d => d === 'bullish').length;
    const ltf_bearish = ltf_directions.filter(d => d === 'bearish').length;
    
    return ltf_bullish > ltf_bearish ? 'bullish' :
           ltf_bearish > ltf_bullish ? 'bearish' : 'neutral';
  }
  
  /**
   * Clean up expired trends
   * Requirements: 24.3
   */
  private cleanupExpired(): void {
    const now = Date.now();
    
    for (const stored of this.trends.values()) {
      if (now > stored.expires_at) {
        stored.is_active = false;
        // Keep expired trends for audit but mark inactive
      }
    }
  }
  
  /**
   * Clear all trends (for testing)
   */
  clear(): void {
    this.trends.clear();
  }
  
  /**
   * Destroy singleton instance (for testing)
   */
  destroy(): void {
    this.trends.clear();
    TrendStore.instance = null;
  }
}