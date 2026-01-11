/**
 * Phase 2 Decision Engine - Normalizer Tests
 * 
 * Comprehensive tests for input normalization including property-based testing
 * for validation bounds and edge cases.
 */

import { Normalizer } from '../services/normalizer';
import { NORMALIZATION_RULES } from '../config';
import * as fc from 'fast-check';

describe('Normalizer', () => {
  describe('normalizeSignal', () => {
    it('should normalize valid TradingView signal payload', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 8.5,
          symbol: 'SPX',
          timestamp: 1641859200000
        },
        satyPhase: {
          phase: 75,
          confidence: 80
        },
        marketSession: 'OPEN'
      };

      const result = Normalizer.normalizeSignal(payload);

      expect(result.indicator).toEqual({
        signalType: 'LONG',
        aiScore: 8.5,
        satyPhase: 75,
        marketSession: 'OPEN',
        symbol: 'SPX',
        timestamp: 1641859200000
      });
    });

    it('should handle lowercase signal types', () => {
      const payload = {
        signal: {
          type: 'short',
          aiScore: 5.0,
          symbol: 'SPX'
        }
      };

      const result = Normalizer.normalizeSignal(payload);
      expect(result.indicator.signalType).toBe('SHORT');
    });

    it('should clamp aiScore to valid range', () => {
      const payloadHigh = {
        signal: {
          type: 'LONG',
          aiScore: 15.0,
          symbol: 'SPX'
        }
      };

      const payloadLow = {
        signal: {
          type: 'LONG',
          aiScore: -5.0,
          symbol: 'SPX'
        }
      };

      const resultHigh = Normalizer.normalizeSignal(payloadHigh);
      const resultLow = Normalizer.normalizeSignal(payloadLow);

      expect(resultHigh.indicator.aiScore).toBe(10.5);
      expect(resultLow.indicator.aiScore).toBe(0);
    });

    it('should clamp satyPhase to valid range', () => {
      const payloadHigh = {
        signal: {
          type: 'LONG',
          aiScore: 5.0,
          symbol: 'SPX'
        },
        satyPhase: {
          phase: 150
        }
      };

      const payloadLow = {
        signal: {
          type: 'LONG',
          aiScore: 5.0,
          symbol: 'SPX'
        },
        satyPhase: {
          phase: -150
        }
      };

      const resultHigh = Normalizer.normalizeSignal(payloadHigh);
      const resultLow = Normalizer.normalizeSignal(payloadLow);

      expect(resultHigh.indicator.satyPhase).toBe(100);
      expect(resultLow.indicator.satyPhase).toBe(-100);
    });

    it('should handle missing satyPhase with default', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 5.0,
          symbol: 'SPX'
        }
      };

      const result = Normalizer.normalizeSignal(payload);

      expect(result.indicator.satyPhase).toBe(0);
    });

    it('should handle invalid marketSession with default', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 5.0,
          symbol: 'SPX'
        },
        marketSession: 'INVALID_SESSION'
      };

      const result = Normalizer.normalizeSignal(payload);

      expect(result.indicator.marketSession).toBe('OPEN');
    });

    it('should handle missing marketSession with default', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 5.0,
          symbol: 'SPX'
        }
      };

      const result = Normalizer.normalizeSignal(payload);

      expect(result.indicator.marketSession).toBe('OPEN');
    });

    it('should uppercase symbol', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 5.0,
          symbol: 'spx'
        }
      };

      const result = Normalizer.normalizeSignal(payload);
      expect(result.indicator.symbol).toBe('SPX');
    });

    it('should use current timestamp if not provided', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 5.0,
          symbol: 'SPX'
        }
      };

      const beforeTime = Date.now();
      const result = Normalizer.normalizeSignal(payload);
      const afterTime = Date.now();

      expect(result.indicator.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.indicator.timestamp).toBeLessThanOrEqual(afterTime);
    });

    // Error cases
    it('should throw error for missing signal', () => {
      const payload = {};

      expect(() => Normalizer.normalizeSignal(payload)).toThrow('Missing required field: signal');
    });

    it('should throw error for missing signal type', () => {
      const payload = {
        signal: {
          aiScore: 5.0,
          symbol: 'SPX'
        }
      };

      expect(() => Normalizer.normalizeSignal(payload)).toThrow('Missing required field: signal.type');
    });

    it('should throw error for invalid signal type', () => {
      const payload = {
        signal: {
          type: 'INVALID',
          aiScore: 5.0,
          symbol: 'SPX'
        }
      };

      expect(() => Normalizer.normalizeSignal(payload)).toThrow('Invalid signal type: INVALID. Must be LONG or SHORT');
    });

    it('should throw error for missing aiScore', () => {
      const payload = {
        signal: {
          type: 'LONG',
          symbol: 'SPX'
        }
      };

      expect(() => Normalizer.normalizeSignal(payload)).toThrow('Missing or invalid field: signal.aiScore must be a number');
    });

    it('should throw error for invalid aiScore type', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 'invalid',
          symbol: 'SPX'
        }
      };

      expect(() => Normalizer.normalizeSignal(payload)).toThrow('Missing or invalid field: signal.aiScore must be a number');
    });

    it('should throw error for missing symbol', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: 5.0
        }
      };

      expect(() => Normalizer.normalizeSignal(payload)).toThrow('Missing required field: signal.symbol');
    });

    it('should handle NaN aiScore values', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: NaN,
          symbol: 'SPX'
        }
      };

      const result = Normalizer.normalizeSignal(payload);

      expect(result.indicator.aiScore).toBe(0);
    });

    it('should handle Infinity aiScore values', () => {
      const payload = {
        signal: {
          type: 'LONG',
          aiScore: Infinity,
          symbol: 'SPX'
        }
      };

      const result = Normalizer.normalizeSignal(payload);

      expect(result.indicator.aiScore).toBe(10.5);
    });
  });

  describe('normalizeSatyPhase', () => {
    it('should normalize valid SATY phase payload', () => {
      const payload = {
        phase: 85,
        confidence: 90,
        symbol: 'SPX',
        timestamp: 1641859200000
      };

      const result = Normalizer.normalizeSatyPhase(payload);

      expect(result.phase).toBe(85);
      expect(result.symbol).toBe('SPX');
      expect(result.timestamp).toBe(1641859200000);
    });

    it('should clamp phase value to valid range', () => {
      const payloadHigh = {
        phase: 150,
        symbol: 'SPX'
      };

      const payloadLow = {
        phase: -150,
        symbol: 'SPX'
      };

      const resultHigh = Normalizer.normalizeSatyPhase(payloadHigh);
      const resultLow = Normalizer.normalizeSatyPhase(payloadLow);

      expect(resultHigh.phase).toBe(100);
      expect(resultLow.phase).toBe(-100);
    });

    it('should use current timestamp if not provided', () => {
      const payload = {
        phase: 75,
        symbol: 'SPX'
      };

      const beforeTime = Date.now();
      const result = Normalizer.normalizeSatyPhase(payload);
      const afterTime = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should throw error for missing phase', () => {
      const payload = {
        symbol: 'SPX'
      };

      expect(() => Normalizer.normalizeSatyPhase(payload)).toThrow('Missing or invalid field: phase must be a number');
    });

    it('should throw error for invalid phase type', () => {
      const payload = {
        phase: 'invalid',
        symbol: 'SPX'
      };

      expect(() => Normalizer.normalizeSatyPhase(payload)).toThrow('Missing or invalid field: phase must be a number');
    });

    it('should throw error for missing symbol', () => {
      const payload = {
        phase: 75
      };

      expect(() => Normalizer.normalizeSatyPhase(payload)).toThrow('Missing required field: symbol');
    });
  });

  describe('mergeSatyPhase', () => {
    it('should merge SATY phase data into existing context', () => {
      const context = {
        indicator: {
          signalType: 'LONG' as const,
          aiScore: 8.5,
          satyPhase: 0,
          marketSession: 'OPEN' as const,
          symbol: 'SPX',
          timestamp: 1641859200000
        }
      };

      const satyData = { phase: 85, confidence: 90 };

      const result = Normalizer.mergeSatyPhase(context, satyData);

      expect(result.indicator.satyPhase).toBe(85);
      expect(result.indicator.signalType).toBe('LONG');
      expect(result.indicator.aiScore).toBe(8.5);
    });
  });

  describe('applyDefaults', () => {
    it('should apply default values for missing optional fields', () => {
      const context = {
        indicator: {
          signalType: 'LONG' as const,
          aiScore: undefined as any,
          satyPhase: undefined as any,
          marketSession: 'OPEN' as const,
          symbol: 'SPX',
          timestamp: 1641859200000
        }
      };

      const result = Normalizer.applyDefaults(context);

      expect(result.indicator.aiScore).toBe(NORMALIZATION_RULES.aiScore.default);
      expect(result.indicator.satyPhase).toBe(NORMALIZATION_RULES.satyPhase.default);
    });

    it('should preserve existing values when present', () => {
      const context = {
        indicator: {
          signalType: 'LONG' as const,
          aiScore: 8.5,
          satyPhase: 75,
          marketSession: 'OPEN' as const,
          symbol: 'SPX',
          timestamp: 1641859200000
        }
      };

      const result = Normalizer.applyDefaults(context);

      expect(result.indicator.aiScore).toBe(8.5);
      expect(result.indicator.satyPhase).toBe(75);
    });
  });

  // Property-Based Tests
  describe('Property Tests - Input Validation Bounds', () => {
    /**
     * Property 1: Input Validation Bounds
     * Validates: Requirements 2.2, 2.3
     * 
     * This property ensures that no matter what aiScore or satyPhase values
     * are provided, the normalizer always clamps them to valid ranges.
     */
    it('Property 1: aiScore is always clamped to valid range [0, 10.5]', () => {
      fc.assert(fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }), // Generate extreme values but exclude NaN
        fc.constantFrom('LONG', 'SHORT'),
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
        (aiScore, signalType, symbol) => {
          const payload = {
            signal: {
              type: signalType,
              aiScore,
              symbol
            }
          };

          const result = Normalizer.normalizeSignal(payload);
          
          // Property: aiScore must always be within valid bounds
          expect(result.indicator.aiScore).toBeGreaterThanOrEqual(0);
          expect(result.indicator.aiScore).toBeLessThanOrEqual(10.5);
          expect(Number.isFinite(result.indicator.aiScore)).toBe(true);
        }
      ), { numRuns: 100 });
    });

    it('Property 1: satyPhase is always clamped to valid range [-100, 100]', () => {
      fc.assert(fc.property(
        fc.integer({ min: -1000, max: 1000 }), // Generate extreme values
        fc.constantFrom('LONG', 'SHORT'),
        fc.string({ minLength: 1, maxLength: 10 }),
        (satyPhase, signalType, symbol) => {
          const payload = {
            signal: {
              type: signalType,
              aiScore: 5.0,
              symbol
            },
            satyPhase: {
              phase: satyPhase
            }
          };

          const result = Normalizer.normalizeSignal(payload);
          
          // Property: satyPhase must always be within valid bounds
          expect(result.indicator.satyPhase).toBeGreaterThanOrEqual(-100);
          expect(result.indicator.satyPhase).toBeLessThanOrEqual(100);
        }
      ), { numRuns: 100 });
    });

    it('Property 1: marketSession defaults to OPEN for invalid values', () => {
      fc.assert(fc.property(
        fc.string().filter(s => !['OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS'].includes(s.toUpperCase())),
        fc.constantFrom('LONG', 'SHORT'),
        fc.string({ minLength: 1, maxLength: 10 }),
        (invalidSession, signalType, symbol) => {
          const payload = {
            signal: {
              type: signalType,
              aiScore: 5.0,
              symbol
            },
            marketSession: invalidSession
          };

          const result = Normalizer.normalizeSignal(payload);
          
          // Property: Invalid sessions always default to OPEN
          expect(result.indicator.marketSession).toBe('OPEN');
        }
      ), { numRuns: 50 });
    });

    it('Property 1: signalType validation rejects invalid values', () => {
      fc.assert(fc.property(
        fc.string().filter(s => !['LONG', 'SHORT', 'long', 'short'].includes(s)),
        fc.string({ minLength: 1, maxLength: 10 }),
        (invalidType, symbol) => {
          const payload = {
            signal: {
              type: invalidType,
              aiScore: 5.0,
              symbol
            }
          };

          // Property: Invalid signal types always throw errors
          expect(() => Normalizer.normalizeSignal(payload)).toThrow();
        }
      ), { numRuns: 50 });
    });

    it('Property 1: SATY phase normalization bounds are enforced', () => {
      fc.assert(fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (phase, symbol) => {
          const payload = {
            phase,
            symbol
          };

          const result = Normalizer.normalizeSatyPhase(payload);
          
          // Property: Phase must always be within valid bounds
          expect(result.phase).toBeGreaterThanOrEqual(-100);
          expect(result.phase).toBeLessThanOrEqual(100);
        }
      ), { numRuns: 100 });
    });

    it('Property 1: Symbol normalization always produces uppercase strings', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), // Filter out empty/whitespace-only strings
        fc.constantFrom('LONG', 'SHORT'),
        (symbol, signalType) => {
          const payload = {
            signal: {
              type: signalType,
              aiScore: 5.0,
              symbol
            }
          };

          const result = Normalizer.normalizeSignal(payload);
          
          // Property: Symbol is always uppercase
          expect(result.indicator.symbol).toBe(symbol.toUpperCase());
          // Only check alphanumeric pattern if the original symbol was alphanumeric
          if (/^[a-zA-Z0-9\s]*$/.test(symbol)) {
            expect(result.indicator.symbol).toMatch(/^[A-Z0-9\s]*$/);
          }
        }
      ), { numRuns: 50 });
    });

    it('Property 1: Timestamp is always a positive number', () => {
      fc.assert(fc.property(
        fc.constantFrom('LONG', 'SHORT'),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.option(fc.integer({ min: 0, max: Date.now() * 2 })),
        (signalType, symbol, timestamp) => {
          const payload = {
            signal: {
              type: signalType,
              aiScore: 5.0,
              symbol,
              ...(timestamp !== null && { timestamp })
            }
          };

          const result = Normalizer.normalizeSignal(payload);
          
          // Property: Timestamp is always a positive number
          expect(result.indicator.timestamp).toBeGreaterThan(0);
          expect(typeof result.indicator.timestamp).toBe('number');
        }
      ), { numRuns: 50 });
    });
  });
});