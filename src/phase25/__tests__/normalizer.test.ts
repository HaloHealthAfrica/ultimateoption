/**
 * Normalizer Service Tests
 * 
 * Tests for webhook source detection and normalization to DecisionContext.
 */

import { NormalizerService } from '../services/normalizer.service';
import { WebhookSource } from '../types';

describe('NormalizerService', () => {
  let normalizer: NormalizerService;

  beforeEach(() => {
    normalizer = new NormalizerService();
  });

  describe('Source Detection', () => {
    it('should detect SATY_PHASE webhook', () => {
      const payload = {
        meta: {
          engine: 'SATY_PO',
          engine_version: '1.0.0'
        },
        instrument: { symbol: 'SPY' }
      };

      const source = normalizer.detectSource(payload);
      expect(source).toBe('SATY_PHASE');
    });

    it('should detect MTF_DOTS webhook', () => {
      const payload = {
        ticker: 'SPY',
        timeframes: {
          tf3min: { direction: 'bullish' },
          tf5min: { direction: 'bearish' },
          tf15min: { direction: 'neutral' }
        }
      };

      const source = normalizer.detectSource(payload);
      expect(source).toBe('MTF_DOTS');
    });

    it('should detect ULTIMATE_OPTIONS webhook', () => {
      const payload = {
        signal: {
          type: 'LONG',
          ai_score: 8.5,
          quality: 'HIGH'
          // No timeframe field - this distinguishes from TradingView
        },
        instrument: { ticker: 'SPY' }
      };

      const source = normalizer.detectSource(payload);
      expect(source).toBe('ULTIMATE_OPTIONS');
    });

    it('should detect STRAT_EXEC webhook', () => {
      const payload = {
        setup_valid: true,
        liquidity_ok: false,
        quality: 'B',
        symbol: 'SPY'
      };

      const source = normalizer.detectSource(payload);
      expect(source).toBe('STRAT_EXEC');
    });

    it('should detect TRADINGVIEW_SIGNAL webhook', () => {
      const payload = {
        signal: {
          type: 'LONG',
          timeframe: '15',
          quality: 'HIGH',
          ai_score: 8.5
        },
        instrument: {
          ticker: 'SPY',
          exchange: 'ARCA'
        }
      };

      const source = normalizer.detectSource(payload);
      expect(source).toBe('TRADINGVIEW_SIGNAL');
    });

    it('should throw error for unknown webhook format', () => {
      const payload = {
        unknown: 'format',
        random: 'data'
      };

      expect(() => normalizer.detectSource(payload)).toThrow('Unknown webhook source');
    });

    it('should throw error for invalid payload', () => {
      expect(() => normalizer.detectSource(null)).toThrow('Invalid payload');
      expect(() => normalizer.detectSource('string')).toThrow('Invalid payload');
      expect(() => normalizer.detectSource(123)).toThrow('Invalid payload');
    });
  });

  describe('SATY Phase Normalization', () => {
    it('should normalize SATY phase webhook correctly', () => {
      const payload = {
        meta: {
          engine: 'SATY_PO',
          engine_version: '1.0.0'
        },
        instrument: {
          symbol: 'SPY',
          exchange: 'ARCA'
        },
        event: {
          name: 'ENTER_ACCUMULATION'
        },
        confidence: {
          confidence_score: 85
        },
        regime_context: {
          local_bias: 'BULLISH'
        }
      };

      const result = normalizer.normalize(payload, 'SATY_PHASE');

      expect(result.source).toBe('SATY_PHASE');
      expect(result.partial.instrument).toEqual({
        symbol: 'SPY',
        exchange: 'ARCA',
        price: 0,
        timestamp: expect.any(Number)
      });
      expect(result.partial.regime).toEqual({
        phase: 1,
        phaseName: 'ACCUMULATION',
        volatility: 'NORMAL',
        confidence: 85,
        bias: 'LONG',
        timestamp: expect.any(Number)
      });
      expect(result.timestamp).toBeDefined();
    });

    it('should handle different phase names', () => {
      const testCases = [
        { eventName: 'ENTER_MARKUP', expectedPhase: 2, expectedPhaseName: 'MARKUP' },
        { eventName: 'EXIT_DISTRIBUTION', expectedPhase: 3, expectedPhaseName: 'DISTRIBUTION' },
        { eventName: 'ENTER_MARKDOWN', expectedPhase: 4, expectedPhaseName: 'MARKDOWN' },
        { eventName: 'UNKNOWN_EVENT', expectedPhase: 1, expectedPhaseName: 'ACCUMULATION' }
      ];

      testCases.forEach(({ eventName, expectedPhase, expectedPhaseName }) => {
        const payload = {
          meta: { engine: 'SATY_PO' },
          instrument: { symbol: 'SPY' },
          event: { name: eventName },
          confidence: { confidence_score: 75 }
        };

        const result = normalizer.normalize(payload, 'SATY_PHASE');
        expect(result.partial.regime?.phase).toBe(expectedPhase);
        expect(result.partial.regime?.phaseName).toBe(expectedPhaseName);
      });
    });

    it('should handle different bias values', () => {
      const testCases = [
        { bias: 'BULLISH', expected: 'LONG' },
        { bias: 'BEARISH', expected: 'SHORT' },
        { bias: 'NEUTRAL', expected: 'NEUTRAL' },
        { bias: undefined, expected: 'NEUTRAL' }
      ];

      testCases.forEach(({ bias, expected }) => {
        const payload = {
          meta: { engine: 'SATY_PO' },
          instrument: { symbol: 'SPY' },
          event: { name: 'ENTER_ACCUMULATION' },
          confidence: { confidence_score: 75 },
          regime_context: { local_bias: bias }
        };

        const result = normalizer.normalize(payload, 'SATY_PHASE');
        expect(result.partial.regime?.bias).toBe(expected);
      });
    });
  });

  describe('MTF Dots Normalization', () => {
    it('should normalize MTF Dots webhook correctly', () => {
      const payload = {
        ticker: 'SPY',
        exchange: 'ARCA',
        price: 450.25,
        timeframes: {
          tf3min: { direction: 'bullish' },
          tf5min: { direction: 'bullish' },
          tf15min: { direction: 'bearish' },
          tf30min: { direction: 'neutral' },
          tf60min: { direction: 'bullish' },
          tf240min: { direction: 'bullish' }
        }
      };

      const result = normalizer.normalize(payload, 'MTF_DOTS');

      expect(result.source).toBe('MTF_DOTS');
      expect(result.partial.instrument).toEqual({
        symbol: 'SPY',
        exchange: 'ARCA',
        price: 450.25
      });
      expect(result.partial.alignment).toEqual({
        tfStates: {
          tf3min: 'BULLISH',
          tf5min: 'BULLISH',
          tf15min: 'BEARISH',
          tf30min: 'NEUTRAL',
          tf60min: 'BULLISH',
          tf240min: 'BULLISH'
        },
        bullishPct: 66.67, // 4 out of 6 timeframes
        bearishPct: 16.67  // 1 out of 6 timeframes
      });
    });

    it('should handle missing timeframes gracefully', () => {
      const payload = {
        ticker: 'SPY',
        timeframes: {
          tf3min: { direction: 'bullish' },
          tf5min: { direction: 'bearish' }
          // Missing other timeframes
        }
      };

      const result = normalizer.normalize(payload, 'MTF_DOTS');
      
      expect(result.partial.alignment?.bullishPct).toBe(50); // 1 out of 2
      expect(result.partial.alignment?.bearishPct).toBe(50); // 1 out of 2
    });

    it('should normalize direction values correctly', () => {
      const payload = {
        ticker: 'SPY',
        timeframes: {
          tf3min: { direction: 'bull' },
          tf5min: { direction: 'bear' },
          tf15min: { direction: 'invalid' }
        }
      };

      const result = normalizer.normalize(payload, 'MTF_DOTS');
      
      expect(result.partial.alignment?.tfStates.tf3min).toBe('BULLISH');
      expect(result.partial.alignment?.tfStates.tf5min).toBe('BEARISH');
      expect(result.partial.alignment?.tfStates.tf15min).toBe('NEUTRAL');
    });
  });

  describe('Ultimate Options Normalization', () => {
    it('should normalize Ultimate Options webhook correctly', () => {
      const payload = {
        signal: {
          type: 'LONG',
          ai_score: 8.5,
          quality: 'HIGH',
          components: ['RSI', 'MACD', 'Volume']
        },
        instrument: {
          ticker: 'SPY',
          exchange: 'ARCA',
          current_price: 450.25
        },
        risk: {
          rr_ratio_t1: 2.5,
          rr_ratio_t2: 4.0
        }
      };

      const result = normalizer.normalize(payload, 'ULTIMATE_OPTIONS');

      expect(result.source).toBe('ULTIMATE_OPTIONS');
      expect(result.partial.instrument).toEqual({
        symbol: 'SPY',
        exchange: 'ARCA',
        price: 450.25,
        timestamp: expect.any(Number)
      });
      expect(result.partial.expert).toEqual({
        direction: 'LONG',
        aiScore: 8.5,
        quality: 'HIGH',
        components: ['RSI', 'MACD', 'Volume'],
        rr1: 2.5,
        rr2: 4.0,
        timestamp: expect.any(Number)
      });
    });

    it('should handle missing optional fields', () => {
      const payload = {
        signal: {
          type: 'SHORT',
          ai_score: 7.2,
          quality: 'MEDIUM'
          // Missing components
        },
        instrument: {
          ticker: 'AAPL'
          // Missing exchange and price
        }
        // Missing risk section
      };

      const result = normalizer.normalize(payload, 'ULTIMATE_OPTIONS');

      expect(result.partial.expert).toEqual({
        direction: 'SHORT',
        aiScore: 7.2,
        quality: 'MEDIUM',
        components: [],
        rr1: 0,
        rr2: 0,
        timestamp: expect.any(Number)
      });
      expect(result.partial.instrument?.symbol).toBe('AAPL');
      expect(result.partial.instrument?.price).toBe(0);
    });
  });

  describe('STRAT Execution Normalization', () => {
    it('should normalize STRAT execution webhook correctly', () => {
      const payload = {
        setup_valid: true,
        liquidity_ok: false,
        quality: 'A',
        symbol: 'SPY',
        exchange: 'ARCA',
        price: 450.25
      };

      const result = normalizer.normalize(payload, 'STRAT_EXEC');

      expect(result.source).toBe('STRAT_EXEC');
      expect(result.partial.instrument).toEqual({
        symbol: 'SPY',
        exchange: 'ARCA',
        price: 450.25
      });
      expect(result.partial.structure).toEqual({
        validSetup: true,
        liquidityOk: false,
        executionQuality: 'A'
      });
    });

    it('should handle boolean conversion correctly', () => {
      const payload = {
        setup_valid: false,
        liquidity_ok: true,
        quality: 'C',
        symbol: 'AAPL'
      };

      const result = normalizer.normalize(payload, 'STRAT_EXEC');

      expect(result.partial.structure?.validSetup).toBe(false);
      expect(result.partial.structure?.liquidityOk).toBe(true);
      expect(result.partial.structure?.executionQuality).toBe('C');
    });
  });

  describe('TradingView Signal Normalization', () => {
    it('should normalize TradingView signal webhook correctly', () => {
      const payload = {
        signal: {
          type: 'LONG',
          timeframe: '15',
          quality: 'HIGH',
          ai_score: 8.5
        },
        instrument: {
          ticker: 'SPY',
          exchange: 'ARCA',
          current_price: 450.25
        },
        risk: {
          rr_ratio_t1: 2.5,
          rr_ratio_t2: 4.0
        }
      };

      const result = normalizer.normalize(payload, 'TRADINGVIEW_SIGNAL');

      expect(result.source).toBe('TRADINGVIEW_SIGNAL');
      expect(result.partial.expert).toEqual({
        direction: 'LONG',
        aiScore: 8.5,
        quality: 'HIGH',
        components: [], // TradingView doesn't provide component breakdown
        rr1: 2.5,
        rr2: 4.0,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Auto-detection and Normalization', () => {
    it('should auto-detect source and normalize correctly', () => {
      const payload = {
        meta: { engine: 'SATY_PO' },
        instrument: { symbol: 'SPY' },
        event: { name: 'ENTER_ACCUMULATION' },
        confidence: { confidence_score: 85 }
      };

      const result = normalizer.normalize(payload); // No source specified

      expect(result.source).toBe('SATY_PHASE');
      expect(result.partial.regime?.phaseName).toBe('ACCUMULATION');
    });

    it('should throw error for unsupported source', () => {
      const payload = { unknown: 'format' };

      expect(() => normalizer.normalize(payload)).toThrow('Unknown webhook source');
    });
  });
});