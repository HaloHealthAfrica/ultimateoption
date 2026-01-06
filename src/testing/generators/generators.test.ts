/**
 * Generator Tests
 * 
 * Property tests for signal and phase generators.
 * Validates determinism and output validity.
 * 
 * Requirements: 19.5, 21.5
 */

import * as fc from 'fast-check';
import { generateSignal, generateSignalBatch, SignalGeneratorOptions } from './signalGenerator';
import { generatePhase, generatePhaseBatch, PhaseGeneratorOptions } from './phaseGenerator';
import { generateTrend, generateTrendBatch, generateMultiTickerTrends, TrendOptions } from './trendGenerator';
import { EnrichedSignalSchema } from '../../types/signal';
import { SatyPhaseWebhookSchema } from '../../types/saty';

describe('Property 33: Test Generator Determinism', () => {
  describe('Signal Generator', () => {
    it('should produce identical signals for identical seeds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          (seed) => {
            const signal1 = generateSignal({ seed });
            const signal2 = generateSignal({ seed });
            
            // Compare key fields (timestamps will differ)
            expect(signal1.signal.type).toBe(signal2.signal.type);
            expect(signal1.signal.timeframe).toBe(signal2.signal.timeframe);
            expect(signal1.signal.quality).toBe(signal2.signal.quality);
            expect(signal1.signal.ai_score).toBe(signal2.signal.ai_score);
            expect(signal1.instrument.ticker).toBe(signal2.instrument.ticker);
            expect(signal1.entry.price).toBe(signal2.entry.price);
            expect(signal1.entry.stop_loss).toBe(signal2.entry.stop_loss);
            expect(signal1.entry.target_1).toBe(signal2.entry.target_1);
            expect(signal1.entry.target_2).toBe(signal2.entry.target_2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different signals for different seeds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 1000000 }),
          (seed1, seed2) => {
            fc.pre(seed1 !== seed2);
            
            const signal1 = generateSignal({ seed: seed1 });
            const signal2 = generateSignal({ seed: seed2 });
            
            // At least some fields should differ
            const hasDifference = 
              signal1.market_context.vwap !== signal2.market_context.vwap ||
              signal1.trend.ema_8 !== signal2.trend.ema_8 ||
              signal1.score_breakdown.strat !== signal2.score_breakdown.strat;
            
            expect(hasDifference).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid EnrichedSignal schema', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          (seed) => {
            const signal = generateSignal({ seed });
            const result = EnrichedSignalSchema.safeParse(signal);
            
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect provided options', () => {
      const options: SignalGeneratorOptions = {
        type: 'SHORT',
        timeframe: '60',
        quality: 'EXTREME',
        ai_score: 9.5,
        ticker: 'QQQ',
        price: 380,
        seed: 42,
      };
      
      const signal = generateSignal(options);
      
      expect(signal.signal.type).toBe('SHORT');
      expect(signal.signal.timeframe).toBe('60');
      expect(signal.signal.quality).toBe('EXTREME');
      expect(signal.signal.ai_score).toBe(9.5);
      expect(signal.instrument.ticker).toBe('QQQ');
      expect(signal.instrument.current_price).toBe(380);
    });

    it('should generate valid batch signals', () => {
      const batch = generateSignalBatch(10, 12345);
      
      expect(batch.length).toBe(10);
      
      for (const signal of batch) {
        const result = EnrichedSignalSchema.safeParse(signal);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Phase Generator', () => {
    it('should produce identical phases for identical seeds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          (seed) => {
            const phase1 = generatePhase({ seed });
            const phase2 = generatePhase({ seed });
            
            // Compare key fields (timestamps will differ)
            expect(phase1.meta.event_type).toBe(phase2.meta.event_type);
            expect(phase1.timeframe.chart_tf).toBe(phase2.timeframe.chart_tf);
            expect(phase1.regime_context.local_bias).toBe(phase2.regime_context.local_bias);
            expect(phase1.confidence.confidence_score).toBe(phase2.confidence.confidence_score);
            expect(phase1.oscillator_state.value).toBe(phase2.oscillator_state.value);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different phases for different seeds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 1000000 }),
          (seed1, seed2) => {
            fc.pre(seed1 !== seed2);
            
            const phase1 = generatePhase({ seed: seed1 });
            const phase2 = generatePhase({ seed: seed2 });
            
            const hasDifference = 
              phase1.oscillator_state.value !== phase2.oscillator_state.value ||
              phase1.confidence.confidence_score !== phase2.confidence.confidence_score ||
              phase1.confidence.raw_strength !== phase2.confidence.raw_strength;
            
            expect(hasDifference).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid SatyPhaseWebhook schema', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          (seed) => {
            const phase = generatePhase({ seed });
            const result = SatyPhaseWebhookSchema.safeParse(phase);
            
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect provided options', () => {
      const options: PhaseGeneratorOptions = {
        phase_type: 'BIAS',
        timeframe: '240',
        direction: 'BEARISH',
        ticker: 'IWM',
        price: 200,
        seed: 42,
      };
      
      const phase = generatePhase(options);
      
      // Check that options are reflected in the generated phase
      expect(phase.timeframe.chart_tf).toBe('240');
      expect(phase.regime_context.local_bias).toBe('BEARISH');
      expect(phase.instrument.symbol).toBe('IWM');
    });

    it('should generate valid batch phases', () => {
      const batch = generatePhaseBatch(10, 12345);
      
      expect(batch.length).toBe(10);
      
      for (const phase of batch) {
        const result = SatyPhaseWebhookSchema.safeParse(phase);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Trend Generator', () => {
    it('should produce identical trends for identical seeds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          (seed) => {
            const trend1 = generateTrend(seed);
            const trend2 = generateTrend(seed);
            
            expect(trend1).toEqual(trend2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different trends for different seeds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 1000000 }),
          (seed1, seed2) => {
            fc.pre(seed1 !== seed2);
            
            const trend1 = generateTrend(seed1);
            const trend2 = generateTrend(seed2);
            
            expect(trend1).not.toEqual(trend2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid TrendWebhook schema', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          (seed) => {
            const trend = generateTrend(seed);
            const parsed = JSON.parse(trend.text);
            
            expect(typeof parsed.ticker).toBe('string');
            expect(typeof parsed.timestamp).toBe('string');
            expect(typeof parsed.timeframes).toBe('object');
            expect(typeof parsed.alignment).toBe('object');
            expect(typeof parsed.metadata).toBe('object');
            
            // Validate timeframes structure
            expect(parsed.timeframes.tf3min).toBeDefined();
            expect(parsed.timeframes.tf5min).toBeDefined();
            expect(parsed.timeframes.tf15min).toBeDefined();
            expect(parsed.timeframes.tf30min).toBeDefined();
            expect(parsed.timeframes.tf60min).toBeDefined();
            expect(parsed.timeframes.tf240min).toBeDefined();
            expect(parsed.timeframes.tf1week).toBeDefined();
            expect(parsed.timeframes.tf1month).toBeDefined();
            
            // Validate alignment structure
            expect(typeof parsed.alignment.score).toBe('number');
            expect(typeof parsed.alignment.strength).toBe('string');
            expect(typeof parsed.alignment.dominant_direction).toBe('string');
            expect(typeof parsed.alignment.htf_bias).toBe('string');
            expect(typeof parsed.alignment.ltf_bias).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect provided options', () => {
      const options: TrendOptions = {
        ticker: 'AAPL',
        alignment_score: 85,
        htf_bias: 'bearish'
      };
      
      const trend = generateTrend(123, options);
      const parsed = JSON.parse(trend.text);
      
      expect(parsed.ticker).toBe('AAPL');
      expect(parsed.alignment.score).toBe(85);
      expect(parsed.alignment.htf_bias).toBe('bearish');
    });

    it('should generate valid batch trends', () => {
      const batch = generateTrendBatch(10, 12345);
      
      expect(batch.length).toBe(10);
      
      for (const trend of batch) {
        const parsed = JSON.parse(trend.text);
        expect(typeof parsed.ticker).toBe('string');
        expect(typeof parsed.alignment).toBe('object');
      }
    });

    it('should generate multi-ticker trends correctly', () => {
      const tickers = ['SPY', 'AAPL', 'MSFT'];
      const trends = generateMultiTickerTrends(tickers, 789);
      
      expect(trends.size).toBe(3);
      expect(trends.has('SPY')).toBe(true);
      expect(trends.has('AAPL')).toBe(true);
      expect(trends.has('MSFT')).toBe(true);
      
      // Verify each trend has the correct ticker
      tickers.forEach(ticker => {
        const trend = trends.get(ticker);
        expect(trend).toBeDefined();
        const parsed = JSON.parse(trend!.text);
        expect(parsed.ticker).toBe(ticker);
      });
    });

    it('should generate deterministic multi-ticker trends', () => {
      const tickers = ['SPY', 'AAPL'];
      const trends1 = generateMultiTickerTrends(tickers, 999);
      const trends2 = generateMultiTickerTrends(tickers, 999);
      
      expect(trends1).toEqual(trends2);
    });
  });
});
