/**
 * Property Tests for Trend Store
 * Tests trend alignment calculation and strength classification
 * 
 * Requirements: 24.4, 24.5
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { TrendStore } from './trendStore';
import { TrendWebhook, Direction } from '../../types/trend';

// Test data generators
const generateTrend = (
  ticker: string = 'SPY',
  directions: Direction[] = ['bullish', 'bullish', 'bullish', 'bullish', 'bullish', 'bullish', 'bullish', 'bullish']
): TrendWebhook => {
  const timeframes = [
    'tf3min', 'tf5min', 'tf15min', 'tf30min', 
    'tf60min', 'tf240min', 'tf1week', 'tf1month'
  ];
  
  const timeframeData: unknown = {};
  timeframes.forEach((tf, index) => {
    timeframeData[tf] = {
      direction: directions[index] || 'neutral',
      open: 100 + Math.random() * 10,
      close: 100 + Math.random() * 10,
    };
  });
  
  return {
    ticker,
    exchange: 'NASDAQ',
    timestamp: new Date().toISOString(),
    price: 100 + Math.random() * 10,
    timeframes: timeframeData,
  };
};

describe('TrendStore Property Tests', () => {
  let store: TrendStore;
  
  beforeEach(() => {
    // Create a fresh instance for each test to avoid singleton issues
    store = TrendStore.createInstance();
  });
  
  afterEach(() => {
    // Clean up after each test
    store.clear();
  });
  
  /**
   * Property 34: Trend Alignment Score Calculation
   * Validates: Requirements 24.4
   */
  describe('Property 34: Trend Alignment Score Calculation', () => {
    it('should calculate alignment score as (dominant_count / 8) × 100', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('bullish', 'bearish', 'neutral'), { minLength: 8, maxLength: 8 }),
          (directions) => {
            // Ensure clean state
            store.clear();
            
            const trend = generateTrend('SPY', directions as Direction[]);
            store.updateTrend(trend);
            
            const alignment = store.getAlignment('SPY');
            expect(alignment).not.toBeNull();
            
            // Count directions manually
            const bullish = 0;
            const bearish = 0;
            const neutral = 0;
            
            directions.forEach(dir => {
              if (dir === 'bullish') bullish++;
              else if (dir === 'bearish') bearish++;
              else neutral++;
            });
            
            // Verify counts
            expect(alignment!.bullish_count).toBe(bullish);
            expect(alignment!.bearish_count).toBe(bearish);
            expect(alignment!.neutral_count).toBe(neutral);
            
            // Determine expected dominant with same logic as implementation
            let expectedDominant: Direction = 'neutral';
            let dominantCount = neutral;
            
            if (bullish > bearish && bullish > neutral) {
              expectedDominant = 'bullish';
              dominantCount = bullish;
            } else if (bearish > bullish && bearish > neutral) {
              expectedDominant = 'bearish';
              dominantCount = bearish;
            } else if (neutral > bullish && neutral > bearish) {
              expectedDominant = 'neutral';
              dominantCount = neutral;
            } else {
              // Handle ties - pick the one with highest count, prefer bullish > bearish > neutral
              const maxCount = Math.max(bullish, bearish, neutral);
              if (bullish === maxCount) {
                expectedDominant = 'bullish';
                dominantCount = bullish;
              } else if (bearish === maxCount) {
                expectedDominant = 'bearish';
                dominantCount = bearish;
              } else {
                expectedDominant = 'neutral';
                dominantCount = neutral;
              }
            }
            
            // Verify dominant trend
            expect(alignment!.dominant_trend).toBe(expectedDominant);
            
            // Verify alignment score calculation
            const expectedScore = (dominantCount / 8) * 100;
            expect(alignment!.alignment_score).toBe(expectedScore);
            
            // Clean up
            store.clear();
          }
        ),
        { numRuns: 10, verbose: false }
      );
    });
  });
  
  /**
   * Property 35: Trend Strength Classification
   * Validates: Requirements 24.5
   */
  describe('Property 35: Trend Strength Classification', () => {
    it('should classify strength based on alignment score thresholds', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('bullish', 'bearish', 'neutral'), { minLength: 8, maxLength: 8 }),
          (directions) => {
            // Ensure clean state
            store.clear();
            
            const trend = generateTrend('SPY', directions as Direction[]);
            store.updateTrend(trend);
            
            const alignment = store.getAlignment('SPY');
            expect(alignment).not.toBeNull();
            
            const score = alignment!.alignment_score;
            let expectedStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CHOPPY';
            
            if (score >= 75) expectedStrength = 'STRONG';      // 6+ aligned (>=75%)
            else if (score >= 62.5) expectedStrength = 'MODERATE';  // 5 aligned (>=62.5%)
            else if (score >= 50) expectedStrength = 'WEAK';        // 4 aligned (>=50%)
            else expectedStrength = 'CHOPPY';  // Less than 4 aligned (<50%)
            
            expect(alignment!.strength).toBe(expectedStrength);
            
            // Clean up
            store.clear();
          }
        ),
        { numRuns: 10, verbose: false }
      );
    });
    
    it('should classify specific strength thresholds correctly', () => {
      // Test exact threshold boundaries
      const testCases = [
        // STRONG: >= 75% (6+ out of 8)
        { bullish: 8, bearish: 0, neutral: 0, expected: 'STRONG' },   // 100%
        { bullish: 7, bearish: 1, neutral: 0, expected: 'STRONG' },   // 87.5%
        { bullish: 6, bearish: 2, neutral: 0, expected: 'STRONG' },   // 75%
        
        // MODERATE: >= 62.5% (5 out of 8)
        { bullish: 5, bearish: 3, neutral: 0, expected: 'MODERATE' }, // 62.5%
        
        // WEAK: >= 50% (4 out of 8)
        { bullish: 4, bearish: 4, neutral: 0, expected: 'WEAK' },     // 50% (tie, bullish wins alphabetically)
        
        // CHOPPY: < 50% (less than 4 out of 8)
        { bullish: 3, bearish: 3, neutral: 2, expected: 'CHOPPY' },   // 37.5% max
        { bullish: 2, bearish: 2, neutral: 4, expected: 'WEAK' },     // 50% neutral wins
        { bullish: 1, bearish: 1, neutral: 6, expected: 'STRONG' },   // 75% neutral wins
      ];
      
      testCases.forEach(({ bullish, bearish, neutral, expected }) => {
        store.clear();
        
        // Create directions array with specified counts
        const directions: Direction[] = [];
        for (let i = 0; i < bullish; i++) directions.push('bullish');
        for (let i = 0; i < bearish; i++) directions.push('bearish');
        for (let i = 0; i < neutral; i++) directions.push('neutral');
        
        const trend = generateTrend('SPY', directions);
        store.updateTrend(trend);
        
        const alignment = store.getAlignment('SPY');
        expect(alignment).not.toBeNull();
        
        expect(alignment!.strength).toBe(expected);
      });
    });
  });
  
  describe('HTF and LTF Bias Tests', () => {
    it('should extract HTF bias from 4H timeframe', () => {
      const directions: Direction[] = ['neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'bullish', 'neutral', 'neutral'];
      const trend = generateTrend('SPY', directions);
      store.updateTrend(trend);
      
      const htfBias = store.getHtfBias('SPY');
      expect(htfBias).toBe('bullish'); // tf240min (index 5) is bullish
    });
    
    it('should calculate LTF bias from 3M/5M average', () => {
      // Test cases for LTF bias calculation
      const testCases = [
        { tf3min: 'bullish', tf5min: 'bullish', expected: 'bullish' },
        { tf3min: 'bearish', tf5min: 'bearish', expected: 'bearish' },
        { tf3min: 'bullish', tf5min: 'bearish', expected: 'neutral' },
        { tf3min: 'bullish', tf5min: 'neutral', expected: 'bullish' },
        { tf3min: 'neutral', tf5min: 'bearish', expected: 'bearish' },
        { tf3min: 'neutral', tf5min: 'neutral', expected: 'neutral' },
      ];
      
      testCases.forEach(({ tf3min, tf5min, expected }) => {
        store.clear();
        
        const directions: Direction[] = [
          tf3min as Direction, tf5min as Direction, 
          'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral'
        ];
        const trend = generateTrend('SPY', directions);
        store.updateTrend(trend);
        
        const ltfBias = store.getLtfBias('SPY');
        expect(ltfBias).toBe(expected);
      });
    });
  });
  
  describe('Basic functionality tests', () => {
    it('should store and retrieve trends correctly', () => {
      const trend = generateTrend('SPY');
      store.updateTrend(trend);
      
      const retrieved = store.getTrend('SPY');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.ticker).toBe('SPY');
      
      store.clear();
    });
    
    it('should return null for non-existent trends', () => {
      const retrieved = store.getTrend('NONEXISTENT');
      expect(retrieved).toBeNull();
      
      const alignment = store.getAlignment('NONEXISTENT');
      expect(alignment).toBeNull();
    });
    
    it('should handle multiple tickers independently', () => {
      const spyTrend = generateTrend('SPY', ['bullish', 'bullish', 'bullish', 'bullish', 'bullish', 'bullish', 'bullish', 'bullish']);
      const qqqTrend = generateTrend('QQQ', ['bearish', 'bearish', 'bearish', 'bearish', 'bearish', 'bearish', 'bearish', 'bearish']);
      
      store.updateTrend(spyTrend);
      store.updateTrend(qqqTrend);
      
      const spyAlignment = store.getAlignment('SPY');
      const qqqAlignment = store.getAlignment('QQQ');
      
      expect(spyAlignment?.dominant_trend).toBe('bullish');
      expect(qqqAlignment?.dominant_trend).toBe('bearish');
      
      store.clear();
    });
    
    it('should enforce 1-hour TTL', () => {
      const trend = generateTrend('SPY');
      store.updateTrend(trend);
      
      // Should be active immediately
      expect(store.getTrend('SPY')).not.toBeNull();
      
      // Manually expire the trend
      const stored = (store as unknown).trends.get('SPY');
      if (stored) {
        stored.expires_at = Date.now() - 1000; // Set to past
      }
      
      // Should be null after expiry
      expect(store.getTrend('SPY')).toBeNull();
      expect(store.getAlignment('SPY')).toBeNull();
    });
  });
});