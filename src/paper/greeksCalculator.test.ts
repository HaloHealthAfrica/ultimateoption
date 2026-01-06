/**
 * Greeks Calculator Property Tests
 * Tests for mathematical validity of Greeks calculations
 * 
 * Requirements: 5.7
 */

import * as fc from 'fast-check';
import { calculateGreeks, normalCDF, normalPDF, estimateIV } from './greeksCalculator';
import { OptionContract, OptionType } from '@/types/options';

// Generate valid option contracts
const optionContractArb: fc.Arbitrary<OptionContract> = fc.record({
  type: fc.constantFrom('CALL', 'PUT') as fc.Arbitrary<OptionType>,
  strike: fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
  expiry: fc.constant('2025-01-17'), // Fixed expiry for testing
  dte: fc.integer({ min: 0, max: 365 }),
});

describe('Property 23: Greeks Mathematical Validity', () => {
  describe('Delta bounds', () => {
    it('should have delta between -1 and 1 for all options', () => {
      fc.assert(
        fc.property(
          optionContractArb,
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          fc.integer({ min: 0, max: 100 }),
          (contract, underlyingPrice, ivRank) => {
            const greeks = calculateGreeks(contract, underlyingPrice, ivRank);
            expect(greeks.delta).toBeGreaterThanOrEqual(-1);
            expect(greeks.delta).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have positive delta for CALL options', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          fc.integer({ min: 0, max: 365 }),
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          (strike, dte, underlyingPrice) => {
            const contract: OptionContract = {
              type: 'CALL',
              strike,
              expiry: '2025-01-17',
              dte,
            };
            const greeks = calculateGreeks(contract, underlyingPrice);
            expect(greeks.delta).toBeGreaterThanOrEqual(0);
            expect(greeks.delta).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have negative delta for PUT options', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          fc.integer({ min: 0, max: 365 }),
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          (strike, dte, underlyingPrice) => {
            const contract: OptionContract = {
              type: 'PUT',
              strike,
              expiry: '2025-01-17',
              dte,
            };
            const greeks = calculateGreeks(contract, underlyingPrice);
            expect(greeks.delta).toBeGreaterThanOrEqual(-1);
            expect(greeks.delta).toBeLessThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Gamma bounds', () => {
    it('should have non-negative gamma for all options', () => {
      fc.assert(
        fc.property(
          optionContractArb,
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          fc.integer({ min: 0, max: 100 }),
          (contract, underlyingPrice, ivRank) => {
            const greeks = calculateGreeks(contract, underlyingPrice, ivRank);
            expect(greeks.gamma).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Theta bounds', () => {
    it('should have negative or zero theta for long options (time decay)', () => {
      fc.assert(
        fc.property(
          optionContractArb,
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          fc.integer({ min: 0, max: 100 }),
          (contract, underlyingPrice, ivRank) => {
            const greeks = calculateGreeks(contract, underlyingPrice, ivRank);
            // Theta should be negative (time decay hurts long options)
            // Allow small positive values due to deep ITM puts with high rates
            expect(greeks.theta).toBeLessThanOrEqual(0.1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Vega bounds', () => {
    it('should have non-negative vega for all options', () => {
      fc.assert(
        fc.property(
          optionContractArb,
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          fc.integer({ min: 0, max: 100 }),
          (contract, underlyingPrice, ivRank) => {
            const greeks = calculateGreeks(contract, underlyingPrice, ivRank);
            expect(greeks.vega).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('IV estimation', () => {
    it('should return positive IV for all contracts', () => {
      fc.assert(
        fc.property(
          optionContractArb,
          fc.integer({ min: 0, max: 100 }),
          (contract, ivRank) => {
            const iv = estimateIV(contract, ivRank);
            expect(iv).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have IV in Greeks match estimated IV', () => {
      fc.assert(
        fc.property(
          optionContractArb,
          fc.float({ min: Math.fround(50), max: Math.fround(600), noNaN: true }),
          fc.integer({ min: 0, max: 100 }),
          (contract, underlyingPrice, ivRank) => {
            const greeks = calculateGreeks(contract, underlyingPrice, ivRank);
            const estimatedIV = estimateIV(contract, ivRank);
            expect(greeks.iv).toBeCloseTo(estimatedIV, 4);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Normal Distribution Functions', () => {
  it('normalCDF should return values between 0 and 1', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }),
        (x) => {
          const result = normalCDF(x);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('normalCDF(0) should be approximately 0.5', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
  });

  it('normalPDF should return non-negative values', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }),
        (x) => {
          const result = normalPDF(x);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('normalPDF(0) should be maximum (approximately 0.399)', () => {
    const pdf0 = normalPDF(0);
    expect(pdf0).toBeCloseTo(0.3989, 3);
  });
});

describe('Greeks Edge Cases', () => {
  it('should handle 0DTE contracts', () => {
    const contract: OptionContract = {
      type: 'CALL',
      strike: 450,
      expiry: '2025-01-03',
      dte: 0,
    };
    const greeks = calculateGreeks(contract, 450);
    
    expect(greeks.delta).toBeGreaterThanOrEqual(-1);
    expect(greeks.delta).toBeLessThanOrEqual(1);
    expect(greeks.gamma).toBeGreaterThanOrEqual(0);
    expect(greeks.vega).toBeGreaterThanOrEqual(0);
  });

  it('should handle deep ITM options', () => {
    const contract: OptionContract = {
      type: 'CALL',
      strike: 400,
      expiry: '2025-02-21',
      dte: 45,
    };
    const greeks = calculateGreeks(contract, 500); // Deep ITM
    
    // Deep ITM call should have delta close to 1
    expect(greeks.delta).toBeGreaterThan(0.8);
  });

  it('should handle deep OTM options', () => {
    const contract: OptionContract = {
      type: 'CALL',
      strike: 600,
      expiry: '2025-02-21',
      dte: 45,
    };
    const greeks = calculateGreeks(contract, 400); // Deep OTM
    
    // Deep OTM call should have delta close to 0
    expect(greeks.delta).toBeLessThan(0.2);
  });
});
