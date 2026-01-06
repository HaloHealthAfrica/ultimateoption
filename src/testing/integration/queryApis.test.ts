/**
 * Query APIs Integration Tests
 * 
 * Property-based tests for Phase and Trend query APIs.
 * Tests GET endpoints for regime context and trend alignment data.
 * 
 * Task: 27.4 - Test query APIs
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fc from 'fast-check';
import { NextRequest } from 'next/server';
import { GET as phaseGet } from '@/app/api/phase/current/route';
import { GET as trendGet } from '@/app/api/trend/current/route';
import { PhaseStore } from '@/saty/storage/phaseStore';
import { TrendStore } from '@/trend/storage/trendStore';
import type { SatyPhaseWebhook, TrendWebhook, TimeframeData } from '@/types';

// Simple test data generators
const createTestPhase = (
  symbol: string = 'SPY',
  timeframe: '15M' | '1H' | '4H' | '1D' = '4H',
  localBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'BULLISH'
): SatyPhaseWebhook => ({
  instrument: { symbol },
  timeframe: { event_tf: timeframe },
  meta: {
    event_type: 'REGIME_PHASE_ENTRY',
    generated_at: Date.now(),
  },
  event: { name: 'ENTER_ACCUMULATION' },
  regime_context: { local_bias: localBias },
  confidence: {
    confidence_score: 75,
    htf_alignment: true,
  },
  risk_hints: {
    time_decay_minutes: 240,
  },
});

const createTestTrend = (
  ticker: string = 'SPY',
  bullishCount: number = 4,
  bearishCount: number = 2
): TrendWebhook => {
  const neutralCount = 8 - bullishCount - bearishCount;
  
  // Create timeframe directions (lowercase to match schema)
  const directions: ('bullish' | 'bearish' | 'neutral')[] = [];
  for (let i = 0; i < bullishCount; i++) directions.push('bullish');
  for (let i = 0; i < bearishCount; i++) directions.push('bearish');
  for (let i = 0; i < neutralCount; i++) directions.push('neutral');
  
  // Shuffle directions
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [directions[i], directions[j]] = [directions[j], directions[i]];
  }

  return {
    ticker,
    exchange: 'NASDAQ',
    timestamp: new Date().toISOString(),
    price: 450.00,
    timeframes: {
      tf3min: { direction: directions[0], open: 450, close: directions[0] === 'bullish' ? 452 : directions[0] === 'bearish' ? 448 : 450 },
      tf5min: { direction: directions[1], open: 450, close: directions[1] === 'bullish' ? 452 : directions[1] === 'bearish' ? 448 : 450 },
      tf15min: { direction: directions[2], open: 450, close: directions[2] === 'bullish' ? 452 : directions[2] === 'bearish' ? 448 : 450 },
      tf30min: { direction: directions[3], open: 450, close: directions[3] === 'bullish' ? 452 : directions[3] === 'bearish' ? 448 : 450 },
      tf60min: { direction: directions[4], open: 450, close: directions[4] === 'bullish' ? 452 : directions[4] === 'bearish' ? 448 : 450 },
      tf240min: { direction: directions[5], open: 450, close: directions[5] === 'bullish' ? 452 : directions[5] === 'bearish' ? 448 : 450 },
      tf1week: { direction: directions[6], open: 450, close: directions[6] === 'bullish' ? 452 : directions[6] === 'bearish' ? 448 : 450 },
      tf1month: { direction: directions[7], open: 450, close: directions[7] === 'bullish' ? 452 : directions[7] === 'bearish' ? 448 : 450 },
    },
  };
};

describe('Query APIs Integration Tests', () => {
  let phaseStore: PhaseStore;
  let trendStore: TrendStore;

  beforeEach(() => {
    // Get singleton store instances (same ones used by API routes)
    phaseStore = PhaseStore.getInstance();
    trendStore = TrendStore.getInstance();
    
    // Clear them for clean test state
    phaseStore.clear();
    trendStore.clear();
  });

  afterEach(() => {
    // Clean up stores after each test
    phaseStore.clear();
    trendStore.clear();
  });

  describe('Phase Current API', () => {
    /**
     * Property 40: Phase API Returns Valid Regime Context
     * 
     * Tests that GET /api/phase/current returns valid regime context
     * for any symbol with proper structure and data types.
     * 
     * Validates: Requirements 26.1, 26.3
     */
    it('should return valid regime context for any symbol', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('SPY', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'META', 'AMZN'),
          fc.array(
            fc.record({
              timeframe: fc.constantFrom('15M', '1H', '4H', '1D'),
              localBias: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL'),
            }),
            { minLength: 0, maxLength: 4 }
          ),
          async (symbol, phaseConfigs) => {
            // Ensure unique timeframes (phases overwrite if same timeframe)
            const uniquePhases = new Map<string, typeof phaseConfigs[0]>();
            phaseConfigs.forEach(config => {
              uniquePhases.set(config.timeframe, config);
            });
            const uniquePhaseConfigs = Array.from(uniquePhases.values());
            
            // Clear store before test to ensure clean state
            phaseStore.clear();
            
            // Store phases for the symbol
            for (const config of uniquePhaseConfigs) {
              const phase = createTestPhase(
                symbol,
                config.timeframe as any,
                config.localBias as any
              );
              
              phaseStore.updatePhase(phase);
            }

            // Create request URL
            const url = `http://localhost:3000/api/phase/current?symbol=${symbol}`;
            const request = new NextRequest(url);

            // Call API
            const response = await phaseGet(request);
            const data = await response.json();

            // Verify response structure
            expect(response.status).toBe(200);
            expect(data).toHaveProperty('symbol', symbol);
            expect(data).toHaveProperty('regime_context');
            expect(data).toHaveProperty('alignment');
            expect(data).toHaveProperty('retrieved_at');

            // Verify regime context structure
            const regimeContext = data.regime_context;
            expect(regimeContext).toHaveProperty('setup_phase');
            expect(regimeContext).toHaveProperty('bias_phase');
            expect(regimeContext).toHaveProperty('regime_phase');
            expect(regimeContext).toHaveProperty('structural_phase');

            // Verify alignment structure
            const alignment = data.alignment;
            expect(alignment).toHaveProperty('is_aligned');
            expect(alignment).toHaveProperty('active_count');
            expect(typeof alignment.is_aligned).toBe('boolean');
            expect(typeof alignment.active_count).toBe('number');
            expect(alignment.active_count).toBeGreaterThanOrEqual(0);
            expect(alignment.active_count).toBeLessThanOrEqual(4);
            expect(alignment.active_count).toBe(uniquePhaseConfigs.length);

            // Verify timestamp is recent
            expect(typeof data.retrieved_at).toBe('number');
            expect(data.retrieved_at).toBeGreaterThan(Date.now() - 5000);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 41: Phase API Defaults to SPY
     * 
     * Tests that GET /api/phase/current defaults to SPY symbol
     * when no symbol parameter is provided.
     * 
     * Validates: Requirements 26.1, 26.3
     */
    it('should default to SPY when no symbol provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              timeframe: fc.constantFrom('15M', '1H', '4H', '1D'),
              localBias: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL'),
            }),
            { minLength: 1, maxLength: 4 }
          ),
          async (phaseConfigs) => {
            // Ensure unique timeframes (phases overwrite if same timeframe)
            const uniquePhases = new Map<string, typeof phaseConfigs[0]>();
            phaseConfigs.forEach(config => {
              uniquePhases.set(config.timeframe, config);
            });
            const uniquePhaseConfigs = Array.from(uniquePhases.values());
            
            // Clear store before test to ensure clean state
            phaseStore.clear();
            
            // Store phases for SPY
            for (const config of uniquePhaseConfigs) {
              const phase = createTestPhase(
                'SPY',
                config.timeframe as any,
                config.localBias as any
              );
              
              phaseStore.updatePhase(phase);
            }

            // Create request without symbol parameter
            const url = 'http://localhost:3000/api/phase/current';
            const request = new NextRequest(url);

            // Call API
            const response = await phaseGet(request);
            const data = await response.json();

            // Verify defaults to SPY
            expect(response.status).toBe(200);
            expect(data.symbol).toBe('SPY');
            expect(data.alignment.active_count).toBe(uniquePhaseConfigs.length);
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * Property 42: Phase API Handles Empty Store
     * 
     * Tests that GET /api/phase/current returns valid response
     * even when no phases are stored for the symbol.
     * 
     * Validates: Requirements 26.1, 26.3
     */
    it('should handle empty phase store gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('SPY', 'AAPL', 'MSFT', 'GOOGL', 'TSLA'),
          async (symbol) => {
            // Don't store any phases - test empty store

            // Create request URL
            const url = `http://localhost:3000/api/phase/current?symbol=${symbol}`;
            const request = new NextRequest(url);

            // Call API
            const response = await phaseGet(request);
            const data = await response.json();

            // Verify response structure for empty store
            expect(response.status).toBe(200);
            expect(data.symbol).toBe(symbol);
            expect(data.regime_context.setup_phase).toBeNull();
            expect(data.regime_context.bias_phase).toBeNull();
            expect(data.regime_context.regime_phase).toBeNull();
            expect(data.regime_context.structural_phase).toBeNull();
            expect(data.alignment.is_aligned).toBe(false);
            expect(data.alignment.active_count).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Trend Current API', () => {
    /**
     * Property 43: Trend API Returns Valid Alignment Data
     * 
     * Tests that GET /api/trend/current returns valid trend data
     * and alignment metrics for any ticker with proper structure.
     * 
     * Validates: Requirements 26.2, 26.4
     */
    it('should return valid alignment data for any ticker', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('SPY', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'META', 'AMZN'),
          fc.record({
            bullishCount: fc.integer({ min: 1, max: 8 }),
            bearishCount: fc.integer({ min: 0, max: 7 }),
          }),
          async (ticker, config) => {
            // Ensure counts don't exceed 8 total
            if (config.bullishCount + config.bearishCount > 8) {
              config.bearishCount = 8 - config.bullishCount;
            }

            // Generate and store trend data
            const trend = createTestTrend(ticker, config.bullishCount, config.bearishCount);
            trendStore.storeTrend(trend);

            // Create request URL
            const url = `http://localhost:3000/api/trend/current?ticker=${ticker}`;
            const request = new NextRequest(url);

            // Call API
            const response = await trendGet(request);
            const data = await response.json();

            // Verify response structure
            expect(response.status).toBe(200);
            expect(data).toHaveProperty('ticker', ticker);
            expect(data).toHaveProperty('exchange');
            expect(data).toHaveProperty('price');
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('timeframes');
            expect(data).toHaveProperty('alignment');
            expect(data).toHaveProperty('storage');
            expect(data).toHaveProperty('retrieved_at');

            // Verify all 8 timeframes are present
            const timeframes = data.timeframes;
            const expectedTimeframes = [
              'tf3min', 'tf5min', 'tf15min', 'tf30min',
              'tf60min', 'tf240min', 'tf1week', 'tf1month'
            ];
            
            for (const tf of expectedTimeframes) {
              expect(timeframes).toHaveProperty(tf);
              expect(timeframes[tf]).toHaveProperty('direction');
              expect(timeframes[tf]).toHaveProperty('open');
              expect(timeframes[tf]).toHaveProperty('close');
              expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(timeframes[tf].direction.toUpperCase());
            }

            // Verify alignment metrics
            const alignment = data.alignment;
            expect(alignment).toHaveProperty('score');
            expect(alignment).toHaveProperty('strength');
            expect(alignment).toHaveProperty('dominant_trend');
            expect(alignment).toHaveProperty('counts');
            expect(alignment).toHaveProperty('bias');

            // Verify alignment score is valid percentage
            expect(alignment.score).toBeGreaterThanOrEqual(0);
            expect(alignment.score).toBeLessThanOrEqual(100);

            // Verify strength classification
            expect(['STRONG', 'MODERATE', 'WEAK', 'CHOPPY']).toContain(alignment.strength);

            // Verify storage metadata
            expect(data.storage.ttl_minutes).toBe(60);
            expect(data.storage.active_tickers).toBeGreaterThanOrEqual(1);
            expect(typeof data.storage.last_update).toBe('number');
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 44: Trend API Returns 404 for Missing Data
     * 
     * Tests that GET /api/trend/current returns 404 status
     * when no trend data exists for the requested ticker.
     * 
     * Validates: Requirements 26.2, 26.5
     */
    it('should return 404 when no trend data exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('SPY', 'AAPL', 'MSFT', 'GOOGL', 'TSLA'),
          async (ticker) => {
            // Don't store any trend data - test missing data

            // Create request URL
            const url = `http://localhost:3000/api/trend/current?ticker=${ticker}`;
            const request = new NextRequest(url);

            // Call API
            const response = await trendGet(request);
            const data = await response.json();

            // Verify 404 response
            expect(response.status).toBe(404);
            expect(data).toHaveProperty('error', 'No trend data found');
            expect(data).toHaveProperty('ticker', ticker);
            expect(data).toHaveProperty('message');
            expect(data.message).toContain(ticker);
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * Property 45: Trend API Defaults to SPY
     * 
     * Tests that GET /api/trend/current defaults to SPY ticker
     * when no ticker parameter is provided.
     * 
     * Validates: Requirements 26.2, 26.4
     */
    it('should default to SPY when no ticker provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            bullishCount: fc.integer({ min: 1, max: 8 }),
            bearishCount: fc.integer({ min: 0, max: 7 }),
          }),
          async (config) => {
            // Ensure counts don't exceed 8 total
            if (config.bullishCount + config.bearishCount > 8) {
              config.bearishCount = 8 - config.bullishCount;
            }

            // Generate and store trend data for SPY
            const trend = createTestTrend('SPY', config.bullishCount, config.bearishCount);
            trendStore.storeTrend(trend);

            // Create request without ticker parameter
            const url = 'http://localhost:3000/api/trend/current';
            const request = new NextRequest(url);

            // Call API
            const response = await trendGet(request);
            const data = await response.json();

            // Verify defaults to SPY
            expect(response.status).toBe(200);
            expect(data.ticker).toBe('SPY');
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * Property 46: Trend API Alignment Score Calculation
     * 
     * Tests that alignment score is calculated correctly as
     * (dominant_count / 8) × 100 for any trend configuration.
     * 
     * Validates: Requirements 24.4, 26.2
     */
    it('should calculate alignment score correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('SPY', 'AAPL', 'MSFT', 'GOOGL', 'TSLA'),
          fc.integer({ min: 1, max: 8 }),
          fc.integer({ min: 0, max: 7 }),
          async (ticker, bullishCount, bearishCount) => {
            // Ensure counts don't exceed 8 total
            const totalCount = bullishCount + bearishCount;
            if (totalCount > 8) {
              const excess = totalCount - 8;
              bearishCount = Math.max(0, bearishCount - excess);
            }

            const neutralCount = 8 - bullishCount - bearishCount;
            const dominantCount = Math.max(bullishCount, bearishCount, neutralCount);
            const expectedScore = (dominantCount / 8) * 100;

            // Generate and store trend data
            const trend = createTestTrend(ticker, bullishCount, bearishCount);
            trendStore.storeTrend(trend);

            // Create request URL
            const url = `http://localhost:3000/api/trend/current?ticker=${ticker}`;
            const request = new NextRequest(url);

            // Call API
            const response = await trendGet(request);
            const data = await response.json();

            // Verify alignment score calculation
            expect(response.status).toBe(200);
            expect(data.alignment.score).toBeCloseTo(expectedScore, 1);
            expect(data.alignment.counts.bullish).toBe(bullishCount);
            expect(data.alignment.counts.bearish).toBe(bearishCount);
            expect(data.alignment.counts.neutral).toBe(neutralCount);
          }
        ),
        { numRuns: 25 }
      );
    });

    /**
     * Property 47: Trend API Strength Classification
     * 
     * Tests that trend strength is classified correctly based on
     * alignment score thresholds (STRONG >=75%, MODERATE >=62.5%, etc.).
     * 
     * Validates: Requirements 24.5, 26.2
     */
    it('should classify trend strength correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('SPY', 'AAPL', 'MSFT', 'GOOGL', 'TSLA'),
          fc.integer({ min: 4, max: 8 }), // Only use realistic dominant counts (4-8 out of 8 total)
          fc.constantFrom('bullish', 'bearish', 'neutral'),
          async (ticker, dominantCount, dominantDirection) => {
            // Create trend with specific dominant count and direction
            let bullishCount = 0;
            let bearishCount = 0;
            let neutralCount = 0;

            // Assign the dominant count to the specified direction
            // Ensure the specified direction truly has the maximum count
            if (dominantDirection === 'bullish') {
              bullishCount = dominantCount;
              // Other directions get at most dominantCount - 1
              const maxOther = Math.max(0, dominantCount - 1);
              const remaining = 8 - dominantCount;
              bearishCount = Math.min(maxOther, Math.floor(remaining / 2));
              neutralCount = remaining - bearishCount;
              // If neutralCount would exceed dominantCount, redistribute
              if (neutralCount >= dominantCount) {
                neutralCount = maxOther;
                bearishCount = remaining - neutralCount;
              }
            } else if (dominantDirection === 'bearish') {
              bearishCount = dominantCount;
              // Other directions get at most dominantCount - 1
              const maxOther = Math.max(0, dominantCount - 1);
              const remaining = 8 - dominantCount;
              bullishCount = Math.min(maxOther, Math.floor(remaining / 2));
              neutralCount = remaining - bullishCount;
              // If neutralCount would exceed dominantCount, redistribute
              if (neutralCount >= dominantCount) {
                neutralCount = maxOther;
                bullishCount = remaining - neutralCount;
              }
            } else {
              neutralCount = dominantCount;
              // Other directions get at most dominantCount - 1
              const maxOther = Math.max(0, dominantCount - 1);
              const remaining = 8 - dominantCount;
              bullishCount = Math.min(maxOther, Math.floor(remaining / 2));
              bearishCount = remaining - bullishCount;
              // If bearishCount would exceed dominantCount, redistribute
              if (bearishCount >= dominantCount) {
                bearishCount = maxOther;
                bullishCount = remaining - bearishCount;
              }
            }

            const alignmentScore = (dominantCount / 8) * 100;
            let expectedStrength: string;
            
            if (alignmentScore >= 75) {
              expectedStrength = 'STRONG';
            } else if (alignmentScore >= 62.5) {
              expectedStrength = 'MODERATE';
            } else if (alignmentScore >= 50) {
              expectedStrength = 'WEAK';
            } else {
              expectedStrength = 'CHOPPY';
            }

            // Generate and store trend data
            const trend = createTestTrend(ticker, bullishCount, bearishCount);
            trendStore.storeTrend(trend);

            // Create request URL
            const url = `http://localhost:3000/api/trend/current?ticker=${ticker}`;
            const request = new NextRequest(url);

            // Call API
            const response = await trendGet(request);
            const data = await response.json();

            // Verify strength classification
            expect(response.status).toBe(200);
            expect(data.alignment.strength).toBe(expectedStrength);
            expect(data.alignment.score).toBeCloseTo(alignmentScore, 1);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('API Error Handling', () => {
    /**
     * Property 48: APIs Block Non-GET Methods
     * 
     * Tests that both Phase and Trend APIs return 405 Method Not Allowed
     * for POST, PUT, DELETE requests.
     * 
     * Validates: Requirements 26.1, 26.2
     */
    it('should block non-GET methods with 405', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('POST', 'PUT', 'DELETE'),
          fc.constantFrom('/api/phase/current', '/api/trend/current'),
          async (method, endpoint) => {
            // Import the appropriate handler
            let handler;
            if (endpoint === '/api/phase/current') {
              const module = await import('@/app/api/phase/current/route');
              handler = (module as any)[method];
            } else {
              const module = await import('@/app/api/trend/current/route');
              handler = (module as any)[method];
            }

            // Call the method handler
            const response = await handler();
            const data = await response.json();

            // Verify 405 response
            expect(response.status).toBe(405);
            expect(data).toHaveProperty('error');
            expect(data.error).toContain('Method not allowed');
          }
        ),
        { numRuns: 12 }
      );
    });
  });
});