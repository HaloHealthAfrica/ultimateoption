/**
 * Contract Selector Property Tests
 * Tests for option type and DTE selection
 * 
 * Requirements: 5.1, 5.2
 */

import * as fc from 'fast-check';
import {
  selectOptionType,
  selectDTE,
  selectStrike,
  getNextFridayDTE,
  getMonthlyDTE,
  calculateExpiryDate,
} from './contractSelector';
import { getDteBucket } from '@/types/options';

describe('Property 19: Option Type Selection', () => {
  it('should select CALL for LONG signals', () => {
    const result = selectOptionType('LONG');
    expect(result).toBe('CALL');
  });

  it('should select PUT for SHORT signals', () => {
    const result = selectOptionType('SHORT');
    expect(result).toBe('PUT');
  });

  it('should always return CALL or PUT for any direction', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('LONG', 'SHORT') as fc.Arbitrary<'LONG' | 'SHORT'>,
        (direction) => {
          const result = selectOptionType(direction);
          expect(['CALL', 'PUT']).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should map LONG to CALL and SHORT to PUT consistently', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('LONG', 'SHORT') as fc.Arbitrary<'LONG' | 'SHORT'>,
        (direction) => {
          const result = selectOptionType(direction);
          if (direction === 'LONG') {
            expect(result).toBe('CALL');
          } else {
            expect(result).toBe('PUT');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 20: DTE Selection by Timeframe', () => {
  it('should select 0DTE for scalp timeframes (3M, 5M)', () => {
    expect(selectDTE(3)).toBe(0);
    expect(selectDTE(5)).toBe(0);
  });

  it('should select weekly DTE for day trading timeframes (15M, 30M, 60M)', () => {
    const dte15 = selectDTE(15);
    const dte30 = selectDTE(30);
    const dte60 = selectDTE(60);
    
    // Weekly should be 0-7 days
    expect(dte15).toBeGreaterThanOrEqual(0);
    expect(dte15).toBeLessThanOrEqual(7);
    expect(dte30).toBeGreaterThanOrEqual(0);
    expect(dte30).toBeLessThanOrEqual(7);
    expect(dte60).toBeGreaterThanOrEqual(0);
    expect(dte60).toBeLessThanOrEqual(7);
  });

  it('should select monthly DTE for swing timeframes (240M)', () => {
    const dte240 = selectDTE(240);
    
    // Monthly should be 30-45 days
    expect(dte240).toBeGreaterThanOrEqual(30);
    expect(dte240).toBeLessThanOrEqual(45);
  });

  it('should return valid DTE for all standard timeframes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(3, 5, 15, 30, 60, 240),
        (timeframe) => {
          const dte = selectDTE(timeframe);
          expect(dte).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(dte)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should map timeframes to correct DTE buckets', () => {
    // Scalp timeframes → 0DTE
    expect(getDteBucket(selectDTE(3))).toBe('0DTE');
    expect(getDteBucket(selectDTE(5))).toBe('0DTE');
    
    // Day trading timeframes → WEEKLY (or 0DTE if Friday)
    const dte15 = selectDTE(15);
    const bucket15 = getDteBucket(dte15);
    expect(['0DTE', 'WEEKLY']).toContain(bucket15);
    
    // Swing timeframes → MONTHLY
    expect(getDteBucket(selectDTE(240))).toBe('MONTHLY');
  });
});

describe('Strike Selection', () => {
  it('should round to nearest 0.5 for prices under $50', () => {
    expect(selectStrike(25.3, 'CALL')).toBe(25.5);
    expect(selectStrike(25.1, 'CALL')).toBe(25);
    expect(selectStrike(49.7, 'PUT')).toBe(49.5);
  });

  it('should round to nearest 1 for prices $50-$200', () => {
    expect(selectStrike(75.3, 'CALL')).toBe(75);
    expect(selectStrike(75.7, 'CALL')).toBe(76);
    expect(selectStrike(150.4, 'PUT')).toBe(150);
  });

  it('should round to nearest 5 for prices $200-$500', () => {
    expect(selectStrike(253, 'CALL')).toBe(255);
    expect(selectStrike(251, 'CALL')).toBe(250);
    expect(selectStrike(450, 'PUT')).toBe(450);
  });

  it('should round to nearest 10 for prices over $500', () => {
    expect(selectStrike(503, 'CALL')).toBe(500);
    expect(selectStrike(507, 'CALL')).toBe(510);
    expect(selectStrike(595, 'PUT')).toBe(600);
  });

  it('should always return positive strike prices', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        fc.constantFrom('CALL', 'PUT') as fc.Arbitrary<'CALL' | 'PUT'>,
        (price, optionType) => {
          const strike = selectStrike(price, optionType);
          expect(strike).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Expiry Date Calculation', () => {
  it('should return valid date string format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 }),
        (dte) => {
          const expiry = calculateExpiryDate(dte);
          // Should match YYYY-MM-DD format
          expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return today for 0DTE', () => {
    const expiry = calculateExpiryDate(0);
    const today = new Date().toISOString().split('T')[0];
    expect(expiry).toBe(today);
  });
});

describe('Next Friday DTE', () => {
  it('should return 0-7 days', () => {
    const dte = getNextFridayDTE();
    expect(dte).toBeGreaterThanOrEqual(0);
    expect(dte).toBeLessThanOrEqual(7);
  });
});

describe('Monthly DTE', () => {
  it('should return 30-45 days', () => {
    const dte = getMonthlyDTE();
    expect(dte).toBeGreaterThanOrEqual(30);
    expect(dte).toBeLessThanOrEqual(45);
  });
});
