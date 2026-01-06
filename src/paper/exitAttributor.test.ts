/**
 * Exit Attributor Property Tests
 * 
 * Property 24: P&L Attribution Sum - attributions sum to gross P&L
 * Property 25: R-Multiple Calculation - R = pnl_net / risk_amount
 * 
 * Requirements: 6.1, 6.2, 6.4
 */

import * as fc from 'fast-check';
import {
  calculateExitAttribution,
  determineExitReason,
  ExitReason,
} from './exitAttributor';

// Arbitrary for valid Greeks
const greeksArb = fc.record({
  delta: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
  gamma: fc.float({ min: Math.fround(0), max: Math.fround(0.1), noNaN: true }),
  theta: fc.float({ min: Math.fround(-0.5), max: Math.fround(0), noNaN: true }),
  vega: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
  iv: fc.float({ min: Math.fround(0.1), max: Math.fround(2), noNaN: true }),
});

// Arbitrary for entry data
const entryDataArb = fc.record({
  entry_price: fc.float({ min: Math.fround(0.5), max: Math.fround(50), noNaN: true }),
  entry_time: fc.integer({ min: 1704067200000, max: 1735689600000 })
    .map(ts => new Date(ts).toISOString()),
  contracts: fc.integer({ min: 1, max: 100 }),
  filled_contracts: fc.integer({ min: 1, max: 100 }),
  spread_cost: fc.float({ min: Math.fround(0), max: Math.fround(0.1), noNaN: true }),
  slippage: fc.float({ min: Math.fround(0), max: Math.fround(0.05), noNaN: true }),
  risk_amount: fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
  underlying_at_entry: fc.float({ min: Math.fround(100), max: Math.fround(500), noNaN: true }),
  entry_greeks: greeksArb,
}).chain(entry => {
  // Ensure filled_contracts <= contracts
  const filledContracts = Math.min(entry.filled_contracts, entry.contracts);
  return fc.constant({
    ...entry,
    filled_contracts: Math.max(1, filledContracts),
  });
});

// Arbitrary for exit context
const exitContextArb = (entryTime: string) => fc.record({
  exit_price: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
  exit_time: fc.integer({ 
    min: new Date(entryTime).getTime() + 60000, // At least 1 minute after entry
    max: new Date(entryTime).getTime() + 86400000 * 30 // Up to 30 days
  }).map(ts => new Date(ts).toISOString()),
  exit_reason: fc.constantFrom('TARGET_1', 'TARGET_2', 'STOP_LOSS', 'THETA_DECAY', 'MANUAL') as fc.Arbitrary<ExitReason>,
  underlying_at_exit: fc.float({ min: Math.fround(80), max: Math.fround(600), noNaN: true }),
  exit_iv: fc.float({ min: Math.fround(0.1), max: Math.fround(2), noNaN: true }),
  exit_greeks: greeksArb,
});

describe('Exit Attributor', () => {
  describe('Property 24: P&L Attribution Sum', () => {
    it('attributions should sum to gross P&L', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            const attributionSum = 
              result.attribution.delta_contribution +
              result.attribution.gamma_contribution +
              result.attribution.iv_contribution +
              result.attribution.theta_contribution;
            
            // Attribution sum should equal gross P&L (within floating point tolerance)
            const tolerance = Math.abs(result.pnl_gross) * 0.001 + 0.01;
            expect(Math.abs(attributionSum - result.pnl_gross)).toBeLessThanOrEqual(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('net P&L should equal gross P&L minus total costs', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            const expectedNet = result.pnl_gross - result.total_costs;
            
            // Net P&L should equal gross minus costs
            expect(Math.abs(result.pnl_net - expectedNet)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('total costs should equal sum of commission, spread, and slippage', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            const expectedTotal = 
              result.commission_cost + 
              result.spread_cost + 
              result.slippage_cost;
            
            expect(Math.abs(result.total_costs - expectedTotal)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 25: R-Multiple Calculation', () => {
    it('R-multiple should equal pnl_net / risk_amount', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            if (entry.risk_amount > 0) {
              const expectedR = result.pnl_net / entry.risk_amount;
              expect(Math.abs(result.r_multiple - expectedR)).toBeLessThan(0.0001);
            } else {
              expect(result.r_multiple).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('positive P&L should result in positive R-multiple when risk > 0', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            // Generate exit price higher than entry for positive P&L
            fc.record({
              exit_price: fc.float({ 
                min: Math.fround(entry.entry_price * 1.5), 
                max: Math.fround(entry.entry_price * 3), 
                noNaN: true 
              }),
              exit_time: fc.integer({ 
                min: new Date(entry.entry_time).getTime() + 60000,
                max: new Date(entry.entry_time).getTime() + 86400000
              }).map(ts => new Date(ts).toISOString()),
              exit_reason: fc.constant('TARGET_1' as ExitReason),
              underlying_at_exit: fc.float({ min: Math.fround(100), max: Math.fround(500), noNaN: true }),
              exit_iv: fc.float({ min: Math.fround(0.1), max: Math.fround(2), noNaN: true }),
              exit_greeks: greeksArb,
            }).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            // With significantly higher exit price, gross P&L should be positive
            // and R-multiple should be positive (unless costs exceed gains)
            if (result.pnl_gross > result.total_costs) {
              expect(result.r_multiple).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('R-multiple should be a finite number', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            // R-multiple should be a finite number
            expect(Number.isFinite(result.r_multiple)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Commission Calculation', () => {
    it('commission should be 2 × contracts × $0.65', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            const expectedCommission = entry.filled_contracts * 2 * 0.65;
            expect(Math.abs(result.commission_cost - expectedCommission)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Hold Time Calculation', () => {
    it('hold time should be non-negative', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            expect(result.hold_time_minutes).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('hold time should reflect actual time difference', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            const entryMs = new Date(entry.entry_time).getTime();
            const exitMs = new Date(exit.exit_time).getTime();
            const expectedMinutes = Math.floor((exitMs - entryMs) / (1000 * 60));
            
            expect(result.hold_time_minutes).toBe(expectedMinutes);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Exit Reason Determination', () => {
    it('should return TARGET_2 when price exceeds target2 for long', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(100), max: Math.fround(200), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.1), noNaN: true }),
          (entryPrice, targetPct) => {
            const stopLoss = entryPrice * 0.95;
            const target1 = entryPrice * (1 + targetPct);
            const target2 = entryPrice * (1 + targetPct * 2);
            const exitPrice = target2 * 1.01; // Above target2
            
            const reason = determineExitReason(exitPrice, entryPrice, stopLoss, target1, target2, true);
            expect(reason).toBe('TARGET_2');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return TARGET_1 when price hits target1 but not target2 for long', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(100), max: Math.fround(200), noNaN: true }),
          fc.float({ min: Math.fround(0.05), max: Math.fround(0.1), noNaN: true }),
          (entryPrice, targetPct) => {
            const stopLoss = entryPrice * 0.95;
            const target1 = entryPrice * (1 + targetPct);
            const target2 = entryPrice * (1 + targetPct * 2);
            const exitPrice = target1 + (target2 - target1) * 0.3; // Between target1 and target2
            
            const reason = determineExitReason(exitPrice, entryPrice, stopLoss, target1, target2, true);
            expect(reason).toBe('TARGET_1');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return STOP_LOSS when price hits stop for long', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(100), max: Math.fround(200), noNaN: true }),
          fc.float({ min: Math.fround(0.03), max: Math.fround(0.1), noNaN: true }),
          (entryPrice, stopPct) => {
            const stopLoss = entryPrice * (1 - stopPct);
            const target1 = entryPrice * 1.05;
            const target2 = entryPrice * 1.10;
            const exitPrice = stopLoss * 0.99; // Below stop
            
            const reason = determineExitReason(exitPrice, entryPrice, stopLoss, target1, target2, true);
            expect(reason).toBe('STOP_LOSS');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return THETA_DECAY when premium lost exceeds threshold', () => {
      const entryPrice = 5.0;
      const exitPrice = 2.0; // 60% loss
      const stopLoss = 1.5; // Stop below exit price so it doesn't trigger
      const target1 = 6.0;
      const target2 = 7.0;
      
      const reason = determineExitReason(exitPrice, entryPrice, stopLoss, target1, target2, true, 0.5);
      expect(reason).toBe('THETA_DECAY');
    });

    it('should return MANUAL when no other condition is met', () => {
      const entryPrice = 5.0;
      const exitPrice = 4.8; // Small loss, not hitting stop
      const stopLoss = 4.5;
      const target1 = 6.0;
      const target2 = 7.0;
      
      const reason = determineExitReason(exitPrice, entryPrice, stopLoss, target1, target2, true);
      expect(reason).toBe('MANUAL');
    });
  });

  describe('Schema Validation', () => {
    it('exit data should pass schema validation', () => {
      fc.assert(
        fc.property(
          entryDataArb.chain(entry => 
            exitContextArb(entry.entry_time).map(exit => ({ entry, exit }))
          ),
          ({ entry, exit }) => {
            const result = calculateExitAttribution(entry, exit);
            
            // All required fields should be present
            expect(result.exit_time).toBeDefined();
            expect(result.exit_price).toBeGreaterThan(0);
            expect(typeof result.pnl_gross).toBe('number');
            expect(typeof result.pnl_net).toBe('number');
            expect(result.total_costs).toBeGreaterThanOrEqual(0);
            expect(result.commission_cost).toBeGreaterThanOrEqual(0);
            expect(result.spread_cost).toBeGreaterThanOrEqual(0);
            expect(result.slippage_cost).toBeGreaterThanOrEqual(0);
            expect(typeof result.r_multiple).toBe('number');
            expect(result.hold_time_minutes).toBeGreaterThanOrEqual(0);
            expect(result.attribution).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
