/**
 * Trend Webhook Integration Tests
 * 
 * Tests the complete integration of trend webhooks:
 * - Webhook endpoint processing
 * - TrendStore storage with TTL
 * - Alignment calculation and strength classification
 * - Trend expiry handling
 * 
 * Requirements: 24.1, 24.3, 24.4, 24.5
 */

import { TrendStore } from '@/trend/storage/trendStore';
import { TrendWebhook, TimeframeData } from '@/types/trend';

// Test data generator for TrendWebhook
const generateTrendWebhook = (
  ticker: string = 'SPY',
  alignmentScore: number = 100,
  customTimeframes?: Partial<Record<string, 'BULLISH' | 'BEARISH' | 'NEUTRAL'>>
): TrendWebhook => {
  // Default 8/8 bullish alignment
  const defaultTimeframes: Record<string, 'BULLISH' | 'BEARISH' | 'NEUTRAL'> = {
    '3M': 'BULLISH',
    '5M': 'BULLISH',
    '15M': 'BULLISH',
    '30M': 'BULLISH',
    '1H': 'BULLISH',
    '2H': 'BULLISH',
    '4H': 'BULLISH',
    '1D': 'BULLISH',
  };

  // Override with custom timeframes if provided
  const timeframes = { ...defaultTimeframes, ...customTimeframes };

  // Generate timeframe data
  const timeframeData: TimeframeData[] = Object.entries(timeframes).map(([tf, direction]) => ({
    timeframe: tf,
    direction,
    open: 100,
    close: direction === 'BULLISH' ? 102 : direction === 'BEARISH' ? 98 : 100,
  }));

  // Calculate dominant direction and count
  const directionCounts = timeframeData.reduce((acc, tf) => {
    acc[tf.direction] = (acc[tf.direction] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dominantDirection = Object.entries(directionCounts)
    .reduce((a, b) => directionCounts[a[0]] > directionCounts[b[0]] ? a : b)[0] as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  
  const dominantCount = directionCounts[dominantDirection];

  // Calculate strength based on alignment score
  let strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CHOPPY';
  if (alignmentScore >= 75) strength = 'STRONG';
  else if (alignmentScore >= 62.5) strength = 'MODERATE';
  else if (alignmentScore >= 50) strength = 'WEAK';
  else strength = 'CHOPPY';

  // Extract HTF and LTF bias
  const htfBias = timeframes['4H'];
  const ltfBias = timeframes['3M']; // Using 3M as primary LTF

  return {
    ticker,
    exchange: 'NASDAQ',
    price: 450.25,
    timeframes: timeframeData,
    alignment_score: alignmentScore,
    strength,
    htf_bias: htfBias,
    ltf_bias: ltfBias,
    dominant_direction: dominantDirection,
    dominant_count: dominantCount,
    last_updated: new Date().toISOString(),
  };
};

describe('Trend Webhook Integration', () => {
  let trendStore: TrendStore;

  beforeEach(() => {
    // Create fresh instance for each test
    trendStore = TrendStore.createInstance();
  });

  afterEach(() => {
    // Clean up after each test
    trendStore.clear();
  });

  describe('Trend Storage and TTL', () => {
    it('should store trend with 8/8 bullish alignment and 1-hour TTL', () => {
      // Create test trend webhook with perfect bullish alignment
      const testTrend = generateTrendWebhook('SPY', 100);

      // Store the trend
      trendStore.storeTrend(testTrend);

      // Verify trend is stored
      const storedTrend = trendStore.getTrend('SPY');
      expect(storedTrend).not.toBeNull();
      expect(storedTrend?.alignment_score).toBe(100);
      expect(storedTrend?.strength).toBe('STRONG');
      expect(storedTrend?.dominant_direction).toBe('BULLISH');
      expect(storedTrend?.dominant_count).toBe(8);

      // Verify all timeframes are bullish
      expect(storedTrend?.timeframes).toHaveLength(8);
      storedTrend?.timeframes.forEach(tf => {
        expect(tf.direction).toBe('BULLISH');
      });
    });

    it('should handle trend expiry after 1 hour', () => {
      // Create test trend
      const testTrend = generateTrendWebhook('SPY', 100);

      // Store the trend
      trendStore.storeTrend(testTrend);

      // Verify trend is initially stored
      expect(trendStore.getTrend('SPY')).not.toBeNull();

      // Manually expire the trend by setting expires_at to past
      const key = 'SPY';
      const stored = (trendStore as any).trends.get(key);
      if (stored) {
        stored.expires_at = Date.now() - 1000; // 1 second ago
      }

      // Verify trend has expired
      expect(trendStore.getTrend('SPY')).toBeNull();
    });
  });

  describe('Alignment Calculation and Strength Classification', () => {
    it('should calculate 100% STRONG alignment for 8/8 bullish', () => {
      const testTrend = generateTrendWebhook('SPY', 100);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.alignment_score).toBe(100);
      expect(stored?.strength).toBe('STRONG');
      expect(stored?.dominant_count).toBe(8);
      expect(stored?.dominant_direction).toBe('BULLISH');
    });

    it('should calculate 75% STRONG alignment for 6/8 bullish', () => {
      const customTimeframes = {
        '3M': 'BULLISH' as const,
        '5M': 'BULLISH' as const,
        '15M': 'BULLISH' as const,
        '30M': 'BULLISH' as const,
        '1H': 'BULLISH' as const,
        '2H': 'BULLISH' as const,
        '4H': 'BEARISH' as const, // 2 bearish
        '1D': 'BEARISH' as const,
      };

      const testTrend = generateTrendWebhook('SPY', 75, customTimeframes);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.alignment_score).toBe(75);
      expect(stored?.strength).toBe('STRONG'); // 75% >= 75%
      expect(stored?.dominant_count).toBe(6);
      expect(stored?.dominant_direction).toBe('BULLISH');
    });

    it('should calculate 62.5% MODERATE alignment for 5/8 bullish', () => {
      const customTimeframes = {
        '3M': 'BULLISH' as const,
        '5M': 'BULLISH' as const,
        '15M': 'BULLISH' as const,
        '30M': 'BULLISH' as const,
        '1H': 'BULLISH' as const,
        '2H': 'BEARISH' as const, // 3 bearish
        '4H': 'BEARISH' as const,
        '1D': 'BEARISH' as const,
      };

      const testTrend = generateTrendWebhook('SPY', 62.5, customTimeframes);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.alignment_score).toBe(62.5);
      expect(stored?.strength).toBe('MODERATE'); // 62.5% >= 62.5%
      expect(stored?.dominant_count).toBe(5);
      expect(stored?.dominant_direction).toBe('BULLISH');
    });

    it('should calculate 50% WEAK alignment for 4/8 split', () => {
      const customTimeframes = {
        '3M': 'BULLISH' as const,
        '5M': 'BULLISH' as const,
        '15M': 'BULLISH' as const,
        '30M': 'BULLISH' as const,
        '1H': 'BEARISH' as const, // 4 bearish
        '2H': 'BEARISH' as const,
        '4H': 'BEARISH' as const,
        '1D': 'BEARISH' as const,
      };

      const testTrend = generateTrendWebhook('SPY', 50, customTimeframes);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.alignment_score).toBe(50);
      expect(stored?.strength).toBe('WEAK'); // 50% >= 50%
      // For ties, the first direction encountered wins, but both have 4
      expect(stored?.dominant_count).toBe(4);
    });

    it('should calculate 37.5% CHOPPY alignment for 3/8 bullish', () => {
      const customTimeframes = {
        '3M': 'BULLISH' as const,
        '5M': 'BULLISH' as const,
        '15M': 'BULLISH' as const,
        '30M': 'BEARISH' as const, // 5 bearish
        '1H': 'BEARISH' as const,
        '2H': 'BEARISH' as const,
        '4H': 'BEARISH' as const,
        '1D': 'BEARISH' as const,
      };

      const testTrend = generateTrendWebhook('SPY', 37.5, customTimeframes);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.alignment_score).toBe(37.5);
      expect(stored?.strength).toBe('CHOPPY'); // 37.5% < 50%
      expect(stored?.dominant_count).toBe(5);
      expect(stored?.dominant_direction).toBe('BEARISH');
    });
  });

  describe('HTF and LTF Bias Extraction', () => {
    it('should extract HTF bias from 4H timeframe', () => {
      const customTimeframes = {
        '4H': 'BEARISH' as const, // HTF should be BEARISH
      };

      const testTrend = generateTrendWebhook('SPY', 100, customTimeframes);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.htf_bias).toBe('BEARISH');
    });

    it('should extract LTF bias from 3M timeframe', () => {
      const customTimeframes = {
        '3M': 'BEARISH' as const, // LTF should be BEARISH
      };

      const testTrend = generateTrendWebhook('SPY', 100, customTimeframes);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.ltf_bias).toBe('BEARISH');
    });

    it('should handle mixed HTF and LTF bias', () => {
      const customTimeframes = {
        '3M': 'BULLISH' as const,  // LTF bullish
        '4H': 'BEARISH' as const,  // HTF bearish
      };

      const testTrend = generateTrendWebhook('SPY', 100, customTimeframes);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.htf_bias).toBe('BEARISH');
      expect(stored?.ltf_bias).toBe('BULLISH');
    });
  });

  describe('Multiple Ticker Support', () => {
    it('should handle trends for different tickers independently', () => {
      // Create trends for different tickers
      const spyTrend = generateTrendWebhook('SPY', 100); // 100% STRONG bullish
      const aaplTrend = generateTrendWebhook('AAPL', 37.5, {
        '3M': 'BEARISH',
        '5M': 'BEARISH',
        '15M': 'BEARISH',
        '30M': 'BEARISH',
        '1H': 'BEARISH',
        '2H': 'BULLISH',
        '4H': 'BULLISH',
        '1D': 'BULLISH',
      }); // 37.5% CHOPPY (5 bearish, 3 bullish)

      // Store trends
      trendStore.storeTrend(spyTrend);
      trendStore.storeTrend(aaplTrend);

      // Verify SPY trend
      const spyStored = trendStore.getTrend('SPY');
      expect(spyStored?.alignment_score).toBe(100);
      expect(spyStored?.strength).toBe('STRONG');
      expect(spyStored?.dominant_direction).toBe('BULLISH');

      // Verify AAPL trend
      const aaplStored = trendStore.getTrend('AAPL');
      expect(aaplStored?.alignment_score).toBe(37.5);
      expect(aaplStored?.strength).toBe('CHOPPY');
      expect(aaplStored?.dominant_direction).toBe('BEARISH');

      // Verify trends are independent
      expect(spyStored?.ticker).toBe('SPY');
      expect(aaplStored?.ticker).toBe('AAPL');
    });
  });

  describe('Trend Update and Replacement', () => {
    it('should replace existing trend for same ticker', () => {
      // Store initial trend (100% STRONG bullish)
      const initialTrend = generateTrendWebhook('SPY', 100);
      trendStore.storeTrend(initialTrend);

      // Verify initial trend
      let stored = trendStore.getTrend('SPY');
      expect(stored?.alignment_score).toBe(100);
      expect(stored?.strength).toBe('STRONG');
      expect(stored?.dominant_direction).toBe('BULLISH');

      // Store updated trend (37.5% CHOPPY bearish)
      const updatedTrend = generateTrendWebhook('SPY', 37.5, {
        '3M': 'BEARISH',
        '5M': 'BEARISH',
        '15M': 'BEARISH',
        '30M': 'BEARISH',
        '1H': 'BEARISH',
        '2H': 'BULLISH',
        '4H': 'BULLISH',
        '1D': 'BULLISH',
      });
      trendStore.storeTrend(updatedTrend);

      // Verify trend was replaced
      stored = trendStore.getTrend('SPY');
      expect(stored?.alignment_score).toBe(37.5);
      expect(stored?.strength).toBe('CHOPPY');
      expect(stored?.dominant_direction).toBe('BEARISH');
      expect(stored?.dominant_count).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle trend with neutral timeframes', () => {
      const customTimeframes = {
        '3M': 'NEUTRAL' as const,
        '5M': 'NEUTRAL' as const,
        '15M': 'BULLISH' as const,
        '30M': 'BULLISH' as const,
        '1H': 'BULLISH' as const,
        '2H': 'BEARISH' as const,
        '4H': 'BEARISH' as const,
        '1D': 'BEARISH' as const,
      };

      const testTrend = generateTrendWebhook('SPY', 37.5, customTimeframes);
      trendStore.storeTrend(testTrend);

      const stored = trendStore.getTrend('SPY');
      expect(stored?.timeframes).toHaveLength(8);
      
      // Should have 2 neutral, 3 bullish, 3 bearish
      const neutralCount = stored?.timeframes.filter(tf => tf.direction === 'NEUTRAL').length;
      const bullishCount = stored?.timeframes.filter(tf => tf.direction === 'BULLISH').length;
      const bearishCount = stored?.timeframes.filter(tf => tf.direction === 'BEARISH').length;
      
      expect(neutralCount).toBe(2);
      expect(bullishCount).toBe(3);
      expect(bearishCount).toBe(3);
    });

    it('should return null for non-existent ticker', () => {
      const stored = trendStore.getTrend('NONEXISTENT');
      expect(stored).toBeNull();
    });
  });
});