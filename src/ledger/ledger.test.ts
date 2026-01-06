/**
 * Ledger Property Tests
 * 
 * Property 17: Ledger Append-Only Invariant
 * Property 18: Ledger Entry Completeness
 * 
 * Requirements: 4.1, 4.2
 */

import * as fc from 'fast-check';
import { InMemoryLedger } from './inMemoryLedger';
import { LedgerError } from './ledger';
import {
  LedgerEntryCreate,
  ExitData,
  Hypothetical,
  RegimeSnapshot,
} from '../types/ledger';
import { EnrichedSignal } from '../types/signal';
import { DecisionBreakdown } from '../types/decision';
import { Execution } from '../types/options';

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
    trend_alignment_boost: 0,
    final_multiplier: 1.5,
  };
}

// Helper to create a valid RegimeSnapshot
function createTestRegime(): RegimeSnapshot {
  return {
    volatility: 'NORMAL',
    trend: 'BULL',
    liquidity: 'NORMAL',
    iv_rank: 45,
  };
}

// Helper to create a valid Execution
function createTestExecution(): Execution {
  return {
    option_type: 'CALL',
    strike: 450,
    expiry: '2024-01-19',
    dte: 5,
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

// Arbitrary for valid ledger entry
const ledgerEntryArb = fc.record({
  created_at: fc.integer({ min: 1704067200000, max: 1735689600000 }),
  engine_version: fc.constant('1.0.0'),
  signal: fc.constant(createTestSignal()),
  decision: fc.constantFrom('EXECUTE' as const, 'WAIT' as const, 'SKIP' as const),
  decision_reason: fc.string({ minLength: 1, maxLength: 100 }),
  decision_breakdown: fc.constant(createTestBreakdown()),
  confluence_score: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  regime: fc.constant(createTestRegime()),
}).chain(entry => {
  // Add execution only for EXECUTE decisions
  if (entry.decision === 'EXECUTE') {
    return fc.constant({
      ...entry,
      execution: createTestExecution(),
    } as LedgerEntryCreate);
  }
  return fc.constant(entry as LedgerEntryCreate);
});

// Arbitrary for exit data
const exitDataArb: fc.Arbitrary<ExitData> = fc.record({
  exit_time: fc.integer({ min: 1704067200000, max: 1735689600000 }),
  exit_price: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
  exit_iv: fc.float({ min: Math.fround(0.1), max: Math.fround(2), noNaN: true }),
  exit_delta: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
  underlying_at_exit: fc.float({ min: Math.fround(100), max: Math.fround(600), noNaN: true }),
  pnl_gross: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true }),
  pnl_net: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true }),
  hold_time_seconds: fc.integer({ min: 0, max: 86400 * 30 }),
  exit_reason: fc.constantFrom('TARGET_1' as const, 'TARGET_2' as const, 'STOP_LOSS' as const, 'THETA_DECAY' as const, 'MANUAL' as const),
  pnl_from_delta: fc.float({ min: Math.fround(-5000), max: Math.fround(5000), noNaN: true }),
  pnl_from_iv: fc.float({ min: Math.fround(-5000), max: Math.fround(5000), noNaN: true }),
  pnl_from_theta: fc.float({ min: Math.fround(-5000), max: Math.fround(5000), noNaN: true }),
  pnl_from_gamma: fc.float({ min: Math.fround(-5000), max: Math.fround(5000), noNaN: true }),
  total_commission: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  total_spread_cost: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  total_slippage: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
});

// Arbitrary for hypothetical data
const hypotheticalArb: fc.Arbitrary<Hypothetical> = fc.record({
  would_have_executed: fc.boolean(),
  would_have_hit_target_1: fc.boolean(),
  would_have_hit_target_2: fc.boolean(),
  would_have_hit_stop: fc.boolean(),
  hypothetical_pnl: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true }),
});

describe('Ledger', () => {
  describe('Property 17: Ledger Append-Only Invariant', () => {
    it('should reject delete operations', async () => {
      await fc.assert(
        fc.asyncProperty(ledgerEntryArb, async (entry) => {
          const ledger = new InMemoryLedger(); // Fresh ledger per run
          const created = await ledger.append(entry);
          
          // Attempt to delete should throw LedgerError with DELETE_NOT_ALLOWED type
          try {
            await ledger.delete(created.id);
            throw new Error('Expected delete to throw');
          } catch (err) {
            expect(err).toBeInstanceOf(LedgerError);
            expect((err as LedgerError).type).toBe('DELETE_NOT_ALLOWED');
          }
          
          // Entry should still exist
          const retrieved = await ledger.get(created.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved?.id).toBe(created.id);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject overwrite operations', async () => {
      await fc.assert(
        fc.asyncProperty(ledgerEntryArb, ledgerEntryArb, async (entry1, entry2) => {
          const ledger = new InMemoryLedger(); // Fresh ledger per run
          const created = await ledger.append(entry1);
          
          // Attempt to overwrite should throw LedgerError with OVERWRITE_NOT_ALLOWED type
          try {
            await ledger.overwrite(created.id, entry2);
            throw new Error('Expected overwrite to throw');
          } catch (err) {
            expect(err).toBeInstanceOf(LedgerError);
            expect((err as LedgerError).type).toBe('OVERWRITE_NOT_ALLOWED');
          }
          
          // Original entry should be unchanged
          const retrieved = await ledger.get(created.id);
          expect(retrieved?.decision).toBe(entry1.decision);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow append operations', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(ledgerEntryArb, { minLength: 1, maxLength: 10 }), async (entries) => {
          const ledger = new InMemoryLedger(); // Fresh ledger per run
          const createdIds: string[] = [];
          
          for (const entry of entries) {
            const created = await ledger.append(entry);
            createdIds.push(created.id);
          }
          
          // All entries should exist
          expect(ledger.getCount()).toBe(entries.length);
          
          for (const id of createdIds) {
            const retrieved = await ledger.get(id);
            expect(retrieved).not.toBeNull();
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should reject exit data overwrite', async () => {
      await fc.assert(
        fc.asyncProperty(exitDataArb, exitDataArb, async (exit1, exit2) => {
          const ledger = new InMemoryLedger(); // Fresh ledger per run
          
          // Create an EXECUTE entry
          const entry: LedgerEntryCreate = {
            created_at: Date.now(),
            engine_version: '1.0.0',
            signal: createTestSignal(),
            decision: 'EXECUTE',
            decision_reason: 'Test',
            decision_breakdown: createTestBreakdown(),
            confluence_score: 75,
            regime: createTestRegime(),
            execution: createTestExecution(),
          };
          
          const created = await ledger.append(entry);
          
          // First exit update should succeed
          await ledger.updateExit(created.id, exit1);
          
          // Second exit update should fail with OVERWRITE_NOT_ALLOWED
          try {
            await ledger.updateExit(created.id, exit2);
            throw new Error('Expected second exit update to throw');
          } catch (err) {
            expect(err).toBeInstanceOf(LedgerError);
            expect((err as LedgerError).type).toBe('OVERWRITE_NOT_ALLOWED');
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should reject hypothetical data overwrite', async () => {
      await fc.assert(
        fc.asyncProperty(hypotheticalArb, hypotheticalArb, async (hypo1, hypo2) => {
          const ledger = new InMemoryLedger(); // Fresh ledger per run
          
          // Create a SKIP entry
          const entry: LedgerEntryCreate = {
            created_at: Date.now(),
            engine_version: '1.0.0',
            signal: createTestSignal(),
            decision: 'SKIP',
            decision_reason: 'Test',
            decision_breakdown: createTestBreakdown(),
            confluence_score: 45,
            regime: createTestRegime(),
          };
          
          const created = await ledger.append(entry);
          
          // First hypothetical update should succeed
          await ledger.updateHypothetical(created.id, hypo1);
          
          // Second hypothetical update should fail with OVERWRITE_NOT_ALLOWED
          try {
            await ledger.updateHypothetical(created.id, hypo2);
            throw new Error('Expected second hypothetical update to throw');
          } catch (err) {
            expect(err).toBeInstanceOf(LedgerError);
            expect((err as LedgerError).type).toBe('OVERWRITE_NOT_ALLOWED');
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 18: Ledger Entry Completeness', () => {
    it('should contain all required fields after append', async () => {
      await fc.assert(
        fc.asyncProperty(ledgerEntryArb, async (entry) => {
          const ledger = new InMemoryLedger(); // Fresh ledger per run
          const created = await ledger.append(entry);
          
          // Check all required fields are present
          expect(created.id).toBeDefined();
          expect(typeof created.id).toBe('string');
          expect(created.id.length).toBeGreaterThan(0);
          
          expect(created.created_at).toBeDefined();
          expect(typeof created.created_at).toBe('number');
          
          expect(created.engine_version).toBeDefined();
          expect(typeof created.engine_version).toBe('string');
          
          expect(created.signal).toBeDefined();
          expect(created.signal.signal).toBeDefined();
          expect(created.signal.instrument).toBeDefined();
          
          expect(created.decision).toBeDefined();
          expect(['EXECUTE', 'WAIT', 'SKIP']).toContain(created.decision);
          
          expect(created.decision_reason).toBeDefined();
          expect(typeof created.decision_reason).toBe('string');
          
          expect(created.decision_breakdown).toBeDefined();
          expect(created.decision_breakdown.final_multiplier).toBeDefined();
          
          expect(created.confluence_score).toBeDefined();
          expect(created.confluence_score).toBeGreaterThanOrEqual(0);
          expect(created.confluence_score).toBeLessThanOrEqual(100);
          
          expect(created.regime).toBeDefined();
          expect(created.regime.volatility).toBeDefined();
          expect(created.regime.trend).toBeDefined();
          expect(created.regime.liquidity).toBeDefined();
          expect(created.regime.iv_rank).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should have execution data for EXECUTE decisions', async () => {
      const ledger = new InMemoryLedger();
      
      const entry: LedgerEntryCreate = {
        created_at: Date.now(),
        engine_version: '1.0.0',
        signal: createTestSignal(),
        decision: 'EXECUTE',
        decision_reason: 'All conditions met',
        decision_breakdown: createTestBreakdown(),
        confluence_score: 80,
        regime: createTestRegime(),
        execution: createTestExecution(),
      };
      
      const created = await ledger.append(entry);
      
      expect(created.execution).toBeDefined();
      expect(created.execution?.option_type).toBeDefined();
      expect(created.execution?.strike).toBeDefined();
      expect(created.execution?.contracts).toBeDefined();
    });

    it('should not have execution data for WAIT/SKIP decisions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('WAIT' as const, 'SKIP' as const),
          async (decision) => {
            const ledger = new InMemoryLedger(); // Fresh ledger per run
            
            const entry: LedgerEntryCreate = {
              created_at: Date.now(),
              engine_version: '1.0.0',
              signal: createTestSignal(),
              decision,
              decision_reason: 'Test',
              decision_breakdown: createTestBreakdown(),
              confluence_score: 45,
              regime: createTestRegime(),
            };
            
            const created = await ledger.append(entry);
            expect(created.execution).toBeUndefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should generate unique IDs for each entry', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(ledgerEntryArb, { minLength: 10, maxLength: 50 }), async (entries) => {
          const ledger = new InMemoryLedger(); // Fresh ledger per run
          const ids = new Set<string>();
          
          for (const entry of entries) {
            const created = await ledger.append(entry);
            expect(ids.has(created.id)).toBe(false);
            ids.add(created.id);
          }
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Exit Data Updates', () => {
    it('should only allow exit updates on EXECUTE entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('WAIT' as const, 'SKIP' as const),
          exitDataArb,
          async (decision, exitData) => {
            const ledger = new InMemoryLedger(); // Fresh ledger per run
            
            const entry: LedgerEntryCreate = {
              created_at: Date.now(),
              engine_version: '1.0.0',
              signal: createTestSignal(),
              decision,
              decision_reason: 'Test',
              decision_breakdown: createTestBreakdown(),
              confluence_score: 45,
              regime: createTestRegime(),
            };
            
            const created = await ledger.append(entry);
            
            try {
              await ledger.updateExit(created.id, exitData);
              throw new Error('Expected exit update to throw');
            } catch (err) {
              expect(err).toBeInstanceOf(LedgerError);
              expect((err as LedgerError).type).toBe('INVALID_UPDATE');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Hypothetical Data Updates', () => {
    it('should only allow hypothetical updates on non-EXECUTE entries', async () => {
      await fc.assert(
        fc.asyncProperty(hypotheticalArb, async (hypothetical) => {
          const ledger = new InMemoryLedger(); // Fresh ledger per run
          
          const entry: LedgerEntryCreate = {
            created_at: Date.now(),
            engine_version: '1.0.0',
            signal: createTestSignal(),
            decision: 'EXECUTE',
            decision_reason: 'Test',
            decision_breakdown: createTestBreakdown(),
            confluence_score: 80,
            regime: createTestRegime(),
            execution: createTestExecution(),
          };
          
          const created = await ledger.append(entry);
          
          try {
            await ledger.updateHypothetical(created.id, hypothetical);
            throw new Error('Expected hypothetical update to throw');
          } catch (err) {
            expect(err).toBeInstanceOf(LedgerError);
            expect((err as LedgerError).type).toBe('INVALID_UPDATE');
          }
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Query Functionality', () => {
    it('should return entries matching filters', async () => {
      const ledger = new InMemoryLedger();
      
      // Create entries with different decisions
      const executeEntry: LedgerEntryCreate = {
        created_at: Date.now(),
        engine_version: '1.0.0',
        signal: createTestSignal(),
        decision: 'EXECUTE',
        decision_reason: 'Test',
        decision_breakdown: createTestBreakdown(),
        confluence_score: 80,
        regime: createTestRegime(),
        execution: createTestExecution(),
      };
      
      const waitEntry: LedgerEntryCreate = {
        created_at: Date.now() + 1000,
        engine_version: '1.0.0',
        signal: createTestSignal(),
        decision: 'WAIT',
        decision_reason: 'Test',
        decision_breakdown: createTestBreakdown(),
        confluence_score: 55,
        regime: createTestRegime(),
      };
      
      await ledger.append(executeEntry);
      await ledger.append(waitEntry);
      
      // Query for EXECUTE only
      const executeResults = await ledger.query({ decision: 'EXECUTE' });
      expect(executeResults.length).toBe(1);
      expect(executeResults[0].decision).toBe('EXECUTE');
      
      // Query for WAIT only
      const waitResults = await ledger.query({ decision: 'WAIT' });
      expect(waitResults.length).toBe(1);
      expect(waitResults[0].decision).toBe('WAIT');
    });

    it('should respect limit parameter', async () => {
      const ledger = new InMemoryLedger();
      
      // Create 20 entries
      for (let i = 0; i < 20; i++) {
        await ledger.append({
          created_at: Date.now() + i,
          engine_version: '1.0.0',
          signal: createTestSignal(),
          decision: 'SKIP',
          decision_reason: `Test ${i}`,
          decision_breakdown: createTestBreakdown(),
          confluence_score: 45,
          regime: createTestRegime(),
        });
      }
      
      const results = await ledger.query({ limit: 5 });
      expect(results.length).toBe(5);
    });

    it('should cap limit at 1000', async () => {
      const ledger = new InMemoryLedger();
      
      // Create 5 entries
      for (let i = 0; i < 5; i++) {
        await ledger.append({
          created_at: Date.now() + i,
          engine_version: '1.0.0',
          signal: createTestSignal(),
          decision: 'SKIP',
          decision_reason: `Test ${i}`,
          decision_breakdown: createTestBreakdown(),
          confluence_score: 45,
          regime: createTestRegime(),
        });
      }
      
      // Request more than 1000
      const results = await ledger.query({ limit: 2000 });
      expect(results.length).toBe(5); // Only 5 entries exist
    });
  });
});
