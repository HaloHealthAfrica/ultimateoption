/**
 * Fill Simulator Property Tests
 * Tests for conservative pricing and partial fills
 * 
 * Requirements: 5.3, 5.6
 */

import * as fc from 'fast-check';
import {
  simulateFill,
  simulateExitFill,
  calculateBidAsk,
  calculateSlippage,
  determineFillQuality,
  calculateCommission,
  calculateTheoreticalPrice,
} from './fillSimulator';
import { OptionContract, OptionType, Greeks, COMMISSION_PER_CONTRACT } from '@/types/options';

// Generate valid option contracts
const optionContractArb: fc.Arbitrary<OptionContract> = fc.record({
  type: fc.constantFrom('CALL', 'PUT') as fc.Arbitrary<OptionType>,
  strike: fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
  expiry: fc.constant('2025-01-17'),
  dte: fc.integer({ min: 0, max: 365 }),
});

// Generate valid Greeks
const greeksArb: fc.Arbitrary<Greeks> = fc.record({
  delta: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
  gamma: fc.float({ min: Math.fround(0), max: Math.fround(0.1), noNaN: true }),
  theta: fc.float({ min: Math.fround(-1), max: Math.fround(0), noNaN: true }),
  vega: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
  iv: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
});

describe('Property 21: Conservative Fill Pricing', () => {
  it('should have entry price >= theoretical ask', () => {
    fc.assert(
      fc.property(
        optionContractArb,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
        greeksArb,
        (contract, contracts, underlyingPrice, greeks) => {
          const fill = simulateFill(contract, contracts, underlyingPrice, greeks);
          const theoreticalPrice = calculateTheoreticalPrice(contract, underlyingPrice, greeks);
          const { ask } = calculateBidAsk(theoreticalPrice, contract.dte);
          
          // Entry price should be >= ask (conservative)
          expect(fill.price).toBeGreaterThanOrEqual(ask - 0.01); // Allow small rounding
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have exit price <= theoretical bid', () => {
    fc.assert(
      fc.property(
        optionContractArb,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
        greeksArb,
        (contract, contracts, underlyingPrice, greeks) => {
          const { exitPrice } = simulateExitFill(contract, contracts, underlyingPrice, greeks);
          const theoreticalPrice = calculateTheoreticalPrice(contract, underlyingPrice, greeks);
          const { bid } = calculateBidAsk(theoreticalPrice, contract.dte);
          
          // Exit price should be <= bid (conservative)
          expect(exitPrice).toBeLessThanOrEqual(bid + 0.01); // Allow small rounding
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always have positive fill price', () => {
    fc.assert(
      fc.property(
        optionContractArb,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
        greeksArb,
        (contract, contracts, underlyingPrice, greeks) => {
          const fill = simulateFill(contract, contracts, underlyingPrice, greeks);
          expect(fill.price).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include slippage in fill price', () => {
    fc.assert(
      fc.property(
        optionContractArb,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
        greeksArb,
        (contract, contracts, underlyingPrice, greeks) => {
          const fill = simulateFill(contract, contracts, underlyingPrice, greeks);
          // Slippage should be non-negative
          expect(fill.slippage).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 22: Partial Fill Simulation', () => {
  it('should fully fill orders <= 50 contracts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (contracts) => {
          const { fillQuality, filledContracts } = determineFillQuality(contracts);
          expect(fillQuality).toBe('FULL');
          expect(filledContracts).toBe(contracts);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should partially fill orders > 50 contracts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 500 }),
        (contracts) => {
          const { fillQuality, filledContracts } = determineFillQuality(contracts);
          expect(fillQuality).toBe('PARTIAL');
          // Should fill approximately 85%
          expect(filledContracts).toBeLessThan(contracts);
          expect(filledContracts).toBeGreaterThanOrEqual(Math.floor(contracts * 0.8));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fill approximately 85% for large orders', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 500 }),
        (contracts) => {
          const { filledContracts } = determineFillQuality(contracts);
          const fillRatio = filledContracts / contracts;
          // Should be approximately 85% (allow 80-90% range)
          expect(fillRatio).toBeGreaterThanOrEqual(0.80);
          expect(fillRatio).toBeLessThanOrEqual(0.90);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always fill at least 1 contract', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (contracts) => {
          const { filledContracts } = determineFillQuality(contracts);
          expect(filledContracts).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Commission Calculation', () => {
  it('should calculate commission as $0.65 per contract', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (contracts) => {
          const commission = calculateCommission(contracts);
          expect(commission).toBeCloseTo(contracts * COMMISSION_PER_CONTRACT, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Bid/Ask Spread', () => {
  it('should have ask > bid', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
        fc.integer({ min: 0, max: 365 }),
        (price, dte) => {
          const { bid, ask } = calculateBidAsk(price, dte);
          expect(ask).toBeGreaterThan(bid);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have wider spreads for shorter DTE', () => {
    const price = 5.0;
    const { spreadPercent: spread0DTE } = calculateBidAsk(price, 0);
    const { spreadPercent: spreadMonthly } = calculateBidAsk(price, 30);
    
    // 0DTE should have wider spread than monthly
    expect(spread0DTE).toBeGreaterThan(spreadMonthly);
  });
});

describe('Slippage Calculation', () => {
  it('should have larger slippage for larger orders', () => {
    const price = 5.0;
    const smallSlippage = calculateSlippage(1, price);
    const largeSlippage = calculateSlippage(100, price);
    
    expect(largeSlippage).toBeGreaterThan(smallSlippage);
  });

  it('should always return non-negative slippage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
        (contracts, price) => {
          const slippage = calculateSlippage(contracts, price);
          expect(slippage).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
