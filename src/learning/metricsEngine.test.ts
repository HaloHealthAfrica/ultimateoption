/**
 * Metrics Engine Property Tests
 * 
 * Property 29: Metrics Minimum Sample Size
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import * as fc from 'fast-check';
import {
  calculateMetrics,
  getRollingMetrics,
  getMetricsByDTEBucket,
  calculateStreakStats,
  MINIMUM_SAMPLE_SIZE,
} from './metricsEngine';
import { LedgerEntry } from '../types/ledger';
import { EnrichedSignal } from '../types/signal';
import { DecisionBreakdown } from '../types/decision';
import { Execution } from '../types/options';
import { ExitData } from '../types/ledger';

// Helper to create a valid EnrichedSignal for testing
function createTestSignal(overrides: Partial<EnrichedSignal> = {}): EnrichedSignal {
  return {
    signal: {
      type: 'LONG',
      timeframe: '15',
      quality: 'HIGH',
      ai_score: 7.5,
      timestamp: Date.now(),
      bar_time: new Date().toISOString(),
    },
    instrument: {
      exchange: 'NYSE',
      ticker: 'SPY',
      current_price: 450.00,
    },
    entry: {
      price: 450.00,
      stop_loss: 445.00,
      target_1: 455.00,
      target_2: 460.00,
      stop_reason: 'ATR',
    },
    risk: {
      amount: 500,
      rr_ratio_t1: 2.0,
      rr_ratio_t2: 4.0,
      stop_distance_pct: 1.1,
      recommended_shares: 100,
      recommended_contracts: 5,
      position_multiplier: 1.0,
      account_risk_pct: 1.0,
      max_loss_dollars: 500,
    },
    market_context: {
      vwap: 449.50,
      pmh: 452.00,
      pml: 447.00,
      day_open: 448.00,
      day_change_pct: 0.5,
      price_vs_vwap_pct: 0.1,
      distance_to_pmh_pct: 0.4,
      distance_to_pml_pct: 0.7,
      atr: 5.0,
      volume_vs_avg: 1.2,
      candle_direction: 'GREEN',
      candle_size_atr: 0.8,
    },
    trend: {
      ema_8: 449.00,
      ema_21: 448.00,
      ema_50: 446.00,
      alignment: 'BULLISH',
      strength: 75,
      rsi: 55,
      macd_signal: 'BULLISH',
    },
    mtf_context: {
      '4h_bias': 'LONG',
      '4h_rsi': 60,
      '1h_bias': 'LONG',
    },
    score_breakdown: {
      strat: 2,
      trend: 1.5,
      gamma: 1,
      vwap: 1,
      mtf: 1.5,
      golf: 0.5,
    },
    components: ['STRAT', 'TREND', 'MTF'],
    time_context: {
      market_session: 'MIDDAY',
      day_of_week: 'TUESDAY',
    },
    ...overrides,
  } as EnrichedSignal;
}

// Helper to create a valid DecisionBreakdown
function createTestBreakdown(): DecisionBreakdown {
  return {
    confluence_multiplier: 1.5,
    quality_multiplier: 1.1,
    htf_alignment_multiplier: 1.3,
    rr_multiplier: 1.0,
    volume_multiplier: 1.0,
    trend_multiplier: 1.0,
    session_multiplier: 1.0,
    day_multiplier: 1.1,
    phase_confidence_boost: 0,
    phase_position_boost: 0,
    final_multiplier: 1.5,
  };
}

// Helper to create a test execution
function createTestExecution(dte: number = 5): Execution {
  return {
    option_type: 'CALL',
    strike: 450,
    expiry: '2024-01-19',
    dte,
    contracts: 5,
    entry_price: 3.50,
    entry_iv: 0.25,
    entry_delta: 0.55,
    entry_theta: -0.05,
    entry_gamma: 0.08,
    entry_vega: 0.15,
    spread_cost: 0.05,
    slippage: 0.02,
    fill_quality: 'FULL',
    filled_contracts: 5,
    commission: 6.50,
    underlying_at_entry: 450.00,
    risk_amount: 500,
  };
}

// Helper to create exit data
function createTestExit(pnlNet: number, holdTimeSeconds: number = 3600): ExitData {
  return {
    exit_time: Date.now(),
    exit_price: 4.00,
    exit_iv: 0.24,
    exit_delta: 0.60,
    underlying_at_exit: 452.00,
    pnl_gross: pnlNet + 20,
    pnl_net: pnlNet,
    hold_time_seconds: holdTimeSeconds,
    exit_reason: pnlNet > 0 ? 'TARGET_1' : 'STOP_LOSS',
    pnl_from_delta: pnlNet * 0.6,
    pnl_from_iv: pnlNet * 0.2,
    pnl_from_theta: pnlNet * -0.1,
    pnl_from_gamma: pnlNet * 0.3,
    total_commission: 13.00,
    total_spread_cost: 5.00,
    total_slippage: 2.00,
  };
}

// Helper to create a closed trade entry
function createClosedTrade(
  pnlNet: number,
  createdAt: number = Date.now(),
  dte: number = 5
): LedgerEntry {
  return {
    id: 'test-' + Math.random().toString(36).substr(2, 9),
    created_at: createdAt,
    engine_version: '1.0.0',
    signal: createTestSignal(),
    decision: 'EXECUTE',
    decision_reason: 'Test',
    decision_breakdown: createTestBreakdown(),
    confluence_score: 75,
    regime: {
      volatility: 'NORMAL',
      trend: 'BULL',
      liquidity: 'NORMAL',
      iv_rank: 45,
    },
    execution: createTestExecution(dte),
    exit: createTestExit(pnlNet),
  };
}

// Helper to create multiple closed trades
function createClosedTrades(count: number, winRate: number = 0.5): LedgerEntry[] {
  const trades: LedgerEntry[] = [];
  const winCount = Math.floor(count * winRate);
  
  for (let i = 0; i < count; i++) {
    const isWin = i < winCount;
    const pnl = isWin ? 100 + Math.random() * 200 : -(50 + Math.random() * 100);
    trades.push(createClosedTrade(pnl, Date.now() - i * 1000));
  }
  
  return trades;
}

describe('Metrics Engine', () => {
  describe('Property 29: Metrics Minimum Sample Size', () => {
    /**
     * Property 29: Metrics Minimum Sample Size
     * *For any* input with fewer than 30 trades, Metrics_Engine SHALL return status INSUFFICIENT_DATA.
     * **Validates: Requirements 8.1**
     */
    
    it('should return INSUFFICIENT_DATA for sample size < 30', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 29 }),
          (count) => {
            const trades = createClosedTrades(count);
            const metrics = calculateMetrics(trades);
            
            expect(metrics.status).toBe('INSUFFICIENT_DATA');
            expect(metrics.sample_size).toBe(count);
            expect(metrics.required).toBe(MINIMUM_SAMPLE_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return VALID for sample size >= 30', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 30, max: 100 }),
          (count) => {
            const trades = createClosedTrades(count);
            const metrics = calculateMetrics(trades);
            
            expect(metrics.status).toBe('VALID');
            expect(metrics.sample_size).toBe(count);
            expect(metrics.required).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return INSUFFICIENT_DATA for exactly 29 trades', () => {
      const trades = createClosedTrades(29);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('INSUFFICIENT_DATA');
      expect(metrics.sample_size).toBe(29);
    });

    it('should return VALID for exactly 30 trades', () => {
      const trades = createClosedTrades(30);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.sample_size).toBe(30);
    });

    it('should only count closed trades (EXECUTE with exit)', () => {
      // Create 40 entries but only 20 are closed trades
      const closedTrades = createClosedTrades(20);
      const openTrades: LedgerEntry[] = [];
      
      for (let i = 0; i < 20; i++) {
        openTrades.push({
          id: 'open-' + i,
          created_at: Date.now(),
          engine_version: '1.0.0',
          signal: createTestSignal(),
          decision: 'EXECUTE',
          decision_reason: 'Test',
          decision_breakdown: createTestBreakdown(),
          confluence_score: 75,
          regime: {
            volatility: 'NORMAL',
            trend: 'BULL',
            liquidity: 'NORMAL',
            iv_rank: 45,
          },
          execution: createTestExecution(),
          // No exit data - open trade
        });
      }
      
      const allEntries = [...closedTrades, ...openTrades];
      const metrics = calculateMetrics(allEntries);
      
      expect(metrics.status).toBe('INSUFFICIENT_DATA');
      expect(metrics.sample_size).toBe(20); // Only closed trades counted
    });
  });

  describe('Core Metrics Calculation (Requirement 8.2)', () => {
    it('should calculate win_rate correctly', () => {
      // Create 30 trades with 60% win rate
      const trades = createClosedTrades(30, 0.6);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.win_rate).toBeCloseTo(0.6, 1);
    });

    it('should calculate avg_win and avg_loss correctly', () => {
      const trades = createClosedTrades(30, 0.5);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.avg_win).toBeGreaterThan(0);
      expect(metrics.avg_loss).toBeGreaterThan(0); // avg_loss is absolute value
    });

    it('should calculate expectancy correctly', () => {
      const trades = createClosedTrades(30, 0.5);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.expectancy).toBeDefined();
      // Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
      const expectedExpectancy = 
        (metrics.win_rate! * metrics.avg_win!) - 
        ((1 - metrics.win_rate!) * metrics.avg_loss!);
      expect(metrics.expectancy).toBeCloseTo(expectedExpectancy, 2);
    });

    it('should calculate profit_factor correctly', () => {
      const trades = createClosedTrades(30, 0.5);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.profit_factor).toBeDefined();
      expect(metrics.profit_factor).toBeGreaterThanOrEqual(0);
    });

    it('should calculate max_drawdown as non-negative', () => {
      const trades = createClosedTrades(30, 0.5);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.max_drawdown).toBeDefined();
      expect(metrics.max_drawdown).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Attribution Metrics (Requirement 8.3)', () => {
    it('should calculate attribution metrics', () => {
      const trades = createClosedTrades(30);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.avg_delta_contribution).toBeDefined();
      expect(metrics.avg_iv_contribution).toBeDefined();
      expect(metrics.avg_theta_drag).toBeDefined();
      expect(metrics.avg_gamma_contribution).toBeDefined();
    });
  });

  describe('Stability Metrics (Requirement 8.4)', () => {
    it('should calculate R standard deviation', () => {
      const trades = createClosedTrades(30);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.r_std).toBeDefined();
      expect(metrics.r_std).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average hold time in hours', () => {
      const trades = createClosedTrades(30);
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.avg_hold_time_hours).toBeDefined();
      expect(metrics.avg_hold_time_hours).toBeGreaterThan(0);
    });
  });

  describe('Rolling Metrics', () => {
    it('should calculate metrics for 30d, 60d, 90d windows', () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      
      // Create trades spread across time
      const trades: LedgerEntry[] = [];
      for (let i = 0; i < 100; i++) {
        const daysAgo = i; // 0 to 99 days ago
        trades.push(createClosedTrade(
          Math.random() > 0.5 ? 100 : -50,
          now - daysAgo * msPerDay
        ));
      }
      
      const rolling = getRollingMetrics(trades);
      
      expect(rolling['30d']).toBeDefined();
      expect(rolling['60d']).toBeDefined();
      expect(rolling['90d']).toBeDefined();
      
      // 30d should have ~30 trades, 60d ~60, 90d ~90
      expect(rolling['30d'].sample_size).toBeLessThanOrEqual(31);
      expect(rolling['60d'].sample_size).toBeLessThanOrEqual(61);
      expect(rolling['90d'].sample_size).toBeLessThanOrEqual(91);
    });
  });

  describe('DTE Bucket Isolation (Requirement 7.5)', () => {
    it('should calculate separate metrics for each DTE bucket', () => {
      const trades: LedgerEntry[] = [];
      
      // Create trades with different DTEs
      for (let i = 0; i < 35; i++) {
        trades.push(createClosedTrade(100, Date.now(), 0)); // 0DTE
      }
      for (let i = 0; i < 35; i++) {
        trades.push(createClosedTrade(100, Date.now(), 5)); // WEEKLY
      }
      
      const byDTE = getMetricsByDTEBucket(trades);
      
      expect(byDTE.get('0DTE')?.status).toBe('VALID');
      expect(byDTE.get('0DTE')?.sample_size).toBe(35);
      
      expect(byDTE.get('WEEKLY')?.status).toBe('VALID');
      expect(byDTE.get('WEEKLY')?.sample_size).toBe(35);
      
      // MONTHLY and LEAP should have insufficient data
      expect(byDTE.get('MONTHLY')?.status).toBe('INSUFFICIENT_DATA');
      expect(byDTE.get('LEAP')?.status).toBe('INSUFFICIENT_DATA');
    });
  });

  describe('Streak Statistics', () => {
    it('should calculate win/loss streaks', () => {
      const trades: LedgerEntry[] = [];
      
      // Create a pattern: 3 wins, 2 losses, 4 wins
      const pnls = [100, 100, 100, -50, -50, 100, 100, 100, 100];
      for (const pnl of pnls) {
        trades.push(createClosedTrade(pnl));
      }
      
      const streaks = calculateStreakStats(trades);
      
      expect(streaks.maxWinStreak).toBeGreaterThanOrEqual(3);
      expect(streaks.maxLossStreak).toBeGreaterThanOrEqual(2);
    });

    it('should return zeros for empty trades', () => {
      const streaks = calculateStreakStats([]);
      
      expect(streaks.currentStreak).toBe(0);
      expect(streaks.currentStreakType).toBe('NONE');
      expect(streaks.maxWinStreak).toBe(0);
      expect(streaks.maxLossStreak).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all winning trades', () => {
      const trades = createClosedTrades(30, 1.0); // 100% win rate
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.win_rate).toBe(1.0);
      expect(metrics.avg_loss).toBe(0);
      expect(metrics.profit_factor).toBe(Infinity);
    });

    it('should handle all losing trades', () => {
      const trades = createClosedTrades(30, 0.0); // 0% win rate
      const metrics = calculateMetrics(trades);
      
      expect(metrics.status).toBe('VALID');
      expect(metrics.win_rate).toBe(0);
      expect(metrics.avg_win).toBe(0);
      expect(metrics.profit_factor).toBe(0);
    });

    it('should handle empty input', () => {
      const metrics = calculateMetrics([]);
      
      expect(metrics.status).toBe('INSUFFICIENT_DATA');
      expect(metrics.sample_size).toBe(0);
    });
  });
});
