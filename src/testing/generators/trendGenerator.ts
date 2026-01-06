/**
 * Trend Generator for Testing
 * Generates realistic TrendWebhook data for property-based testing
 * 
 * Requirements: 21.1, 21.5
 */

import { TrendWebhook, TimeframeData } from '../../types/trend';

export interface TrendOptions {
  ticker?: string;
  alignment_score?: number;
  htf_bias?: 'bullish' | 'bearish' | 'neutral';
  bullishCount?: number;
  bearishCount?: number;
  price?: number;
}

/**
 * Webhook payload format for trend data
 */
export interface TrendWebhookPayload {
  text: string;
}

/**
 * Simple deterministic random number generator
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Generate realistic TrendWebhook for testing
 * 
 * @param seed - Deterministic seed for reproducible output
 * @param options - Optional overrides for specific fields
 * @returns Generated TrendWebhookPayload with text field
 */
export function generateTrend(seed: number, options: TrendOptions = {}): TrendWebhookPayload {
  const rng = seededRandom(seed);
  
  // Default ticker
  const ticker = options.ticker || 'SPY';
  
  // Base price for calculations
  const basePrice = options.price || (400 + (rng() * 100)); // $400-500 range or specified price
  
  // Determine bullish/bearish counts based on desired alignment score
  let bullishCount: number;
  let bearishCount: number;
  let alignmentScore: number;
  
  if (options.alignment_score !== undefined) {
    // Use the exact alignment score provided
    alignmentScore = options.alignment_score;
    
    // Calculate counts to achieve the desired alignment score
    const targetScore = options.alignment_score;
    const dominantCount = Math.round((targetScore / 100) * 8); // Round instead of ceil for better accuracy
    
    // Determine which direction should be dominant based on htf_bias
    const htfBias = options.htf_bias || 'bullish';
    
    if (htfBias === 'bullish') {
      bullishCount = dominantCount;
      bearishCount = Math.floor((8 - dominantCount) / 2);
    } else if (htfBias === 'bearish') {
      bearishCount = dominantCount;
      bullishCount = Math.floor((8 - dominantCount) / 2);
    } else {
      // For neutral, distribute more evenly
      bullishCount = Math.floor((8 - dominantCount) / 2);
      bearishCount = Math.floor((8 - dominantCount) / 2);
    }
  } else {
    // Use provided counts or generate random ones
    bullishCount = options.bullishCount ?? Math.floor(rng() * 9);
    bearishCount = options.bearishCount ?? Math.floor(rng() * (8 - bullishCount + 1));
    
    // Ensure counts don't exceed 8 total
    const totalCount = bullishCount + bearishCount;
    if (totalCount > 8) {
      bearishCount = 8 - bullishCount;
    }
    
    const neutralCount = 8 - bullishCount - bearishCount;
    
    // Calculate alignment score from actual counts
    const dominantCount = Math.max(bullishCount, bearishCount, neutralCount);
    alignmentScore = (dominantCount / 8) * 100;
  }
  
  const neutralCount = 8 - bullishCount - bearishCount;
  
  // Determine HTF bias
  let htfBias = options.htf_bias;
  if (!htfBias) {
    if (bullishCount > bearishCount && bullishCount > neutralCount) {
      htfBias = 'bullish';
    } else if (bearishCount > bullishCount && bearishCount > neutralCount) {
      htfBias = 'bearish';
    } else {
      htfBias = 'neutral';
    }
  }
  
  // Determine dominant direction based on alignment
  let dominantDirection: 'bullish' | 'bearish' | 'neutral';
  if (bullishCount > bearishCount && bullishCount > neutralCount) {
    dominantDirection = 'bullish';
  } else if (bearishCount > bullishCount && bearishCount > neutralCount) {
    dominantDirection = 'bearish';
  } else {
    dominantDirection = 'neutral';
  }
  
  // Generate timeframe directions based on counts
  const directions: ('bullish' | 'bearish' | 'neutral')[] = [];
  
  // Fill with bullish directions
  for (let i = 0; i < bullishCount; i++) {
    directions.push('bullish');
  }
  
  // Fill with bearish directions
  for (let i = 0; i < bearishCount; i++) {
    directions.push('bearish');
  }
  
  // Fill with neutral directions
  for (let i = 0; i < neutralCount; i++) {
    directions.push('neutral');
  }
  
  // Shuffle directions
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [directions[i], directions[j]] = [directions[j], directions[i]];
  }
  
  // Ensure 4H timeframe has the HTF bias
  if (directions.length >= 6) {
    directions[5] = htfBias; // tf240min is index 5 in our array
  }
  
  // Calculate LTF bias from 3M/5M average
  const ltfDirections = [directions[0], directions[1]]; // tf3min, tf5min
  const ltfBullish = ltfDirections.filter(d => d === 'bullish').length;
  const ltfBearish = ltfDirections.filter(d => d === 'bearish').length;
  const ltfBias: 'bullish' | 'bearish' | 'neutral' = ltfBullish > ltfBearish ? 'bullish' :
                  ltfBearish > ltfBullish ? 'bearish' : 'neutral';

  // Generate timeframe data with open/close prices
  function generateTimeframeData(direction: 'bullish' | 'bearish' | 'neutral', index: number): TimeframeData {
    const priceVariation = (rng() - 0.5) * 10; // ±$5 variation
    const open = basePrice + priceVariation + (index * 0.1); // Slight variation per timeframe
    
    let close: number;
    if (direction === 'bullish') {
      close = open + (rng() * 2) + 0.5; // Bullish: close higher
    } else if (direction === 'bearish') {
      close = open - (rng() * 2) - 0.5; // Bearish: close lower
    } else {
      close = open + ((rng() - 0.5) * 0.5); // Neutral: small variation
    }
    
    return {
      direction,
      open: Math.round(open * 100) / 100, // Round to 2 decimals
      close: Math.round(close * 100) / 100,
    };
  }
  
  // Create timeframe data structure
  const timeframes = {
    tf3min: generateTimeframeData(directions[0], 0),
    tf5min: generateTimeframeData(directions[1], 1),
    tf15min: generateTimeframeData(directions[2], 2),
    tf30min: generateTimeframeData(directions[3], 3),
    tf60min: generateTimeframeData(directions[4], 4),
    tf240min: generateTimeframeData(htfBias, 5), // Ensure 4H has the specified HTF bias
    tf1week: generateTimeframeData(directions[6], 6),
    tf1month: generateTimeframeData(directions[7], 7),
  };
  
  // Generate deterministic timestamp using fixed base + bounded seed
  const baseTimestamp = 1640995200000; // Fixed timestamp: 2022-01-01T00:00:00.000Z
  const boundedSeed = Math.abs(seed) % (365 * 24 * 60 * 60 * 1000); // Limit to 1 year range
  const deterministicTimestamp = new Date(baseTimestamp + boundedSeed).toISOString();
  
  return {
    text: JSON.stringify({
      ticker,
      exchange: 'NASDAQ',
      timestamp: deterministicTimestamp,
      price: Math.round(basePrice * 100) / 100,
      timeframes: {
        tf3min: generateTimeframeData(directions[0], 0),
        tf5min: generateTimeframeData(directions[1], 1),
        tf15min: generateTimeframeData(directions[2], 2),
        tf30min: generateTimeframeData(directions[3], 3),
        tf60min: generateTimeframeData(directions[4], 4),
        tf240min: generateTimeframeData(htfBias, 5), // 4H - Ensure HTF bias
        tf1week: generateTimeframeData(directions[6], 6),
        tf1month: generateTimeframeData(directions[7], 7),
      },
      alignment: {
        score: Math.round(alignmentScore),
        strength: alignmentScore >= 75 ? 'STRONG' : 
                 alignmentScore >= 62.5 ? 'MODERATE' : 
                 alignmentScore >= 50 ? 'WEAK' : 'CHOPPY',
        dominant_direction: dominantDirection,
        htf_bias: htfBias,
        ltf_bias: ltfBias,
      },
      metadata: {
        source: 'test_generator',
        version: '1.0.0',
        generated_at: deterministicTimestamp,
      },
    }),
  };
}

/**
 * Generate batch of trends for testing
 * 
 * @param count - Number of trends to generate
 * @param baseSeed - Base seed for deterministic generation
 * @param options - Optional overrides applied to all trends
 * @returns Array of generated trends
 */
export function generateTrendBatch(
  count: number, 
  baseSeed: number, 
  options: TrendOptions = {}
): TrendWebhookPayload[] {
  const trends: TrendWebhookPayload[] = [];
  
  for (let i = 0; i < count; i++) {
    const seed = baseSeed + i * 1000; // Ensure different seeds
    trends.push(generateTrend(seed, options));
  }
  
  return trends;
}

/**
 * Generate multi-ticker trend data sets for testing
 * 
 * @param tickers - Array of ticker symbols to generate trends for
 * @param baseSeed - Base seed for deterministic generation
 * @param options - Optional overrides applied to all trends (ticker will be overridden)
 * @returns Map of ticker to TrendWebhook
 */
export function generateMultiTickerTrends(
  tickers: string[],
  baseSeed: number,
  options: Omit<TrendOptions, 'ticker'> = {}
): Map<string, TrendWebhookPayload> {
  const trends = new Map<string, TrendWebhookPayload>();
  
  tickers.forEach((ticker, index) => {
    const seed = baseSeed + index * 10000; // Ensure different seeds per ticker
    const trend = generateTrend(seed, { ...options, ticker });
    trends.set(ticker, trend);
  });
  
  return trends;
}