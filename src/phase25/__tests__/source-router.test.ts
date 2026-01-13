/**
 * Source Router Service Tests
 * 
 * Tests for webhook routing, error handling, and source detection.
 */

import { SourceRouterService } from '../services/source-router.service';
import { WebhookErrorType } from '../types';

describe('SourceRouterService', () => {
  let router: SourceRouterService;

  beforeEach(() => {
    router = new SourceRouterService();
  });

  describe('Webhook Routing', () => {
    it('should route SATY phase webhook successfully', () => {
      const payload = {
        meta: { engine: 'SATY_PO' },
        instrument: { symbol: 'SPY' },
        event: { name: 'ENTER_ACCUMULATION' },
        confidence: { confidence_score: 85 }
      };

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.source).toBe('SATY_PHASE');
      expect(result.normalized?.partial.regime?.phaseName).toBe('ACCUMULATION');
      expect(result.normalized?.timestamp).toBeDefined();
    });

    it('should route MTF Dots webhook successfully', () => {
      const payload = {
        ticker: 'SPY',
        timeframes: {
          tf3min: { direction: 'bullish' },
          tf5min: { direction: 'bearish' }
        }
      };

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.source).toBe('MTF_DOTS');
      expect(result.normalized?.partial.alignment?.bullishPct).toBe(50);
    });

    it('should route Ultimate Options webhook successfully', () => {
      const payload = {
        signal: {
          type: 'LONG',
          ai_score: 8.5,
          quality: 'HIGH'
        },
        instrument: { ticker: 'SPY' }
      };

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.source).toBe('ULTIMATE_OPTIONS');
      expect(result.normalized?.partial.expert?.direction).toBe('LONG');
    });

    it('should route STRAT execution webhook successfully', () => {
      const payload = {
        setup_valid: true,
        liquidity_ok: false,
        quality: 'A',
        symbol: 'SPY'
      };

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.source).toBe('STRAT_EXEC');
      expect(result.normalized?.partial.structure?.validSetup).toBe(true);
    });

    it('should route TradingView signal webhook successfully', () => {
      const payload = {
        signal: {
          type: 'LONG',
          timeframe: '15',
          quality: 'HIGH',
          ai_score: 8.5
        },
        instrument: { ticker: 'SPY' }
      };

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.source).toBe('TRADINGVIEW_SIGNAL');
      expect(result.normalized?.partial.expert?.direction).toBe('LONG');
    });
  });

  describe('Error Handling', () => {
    it('should return error for unrecognized payload', () => {
      const payload = {
        unknown: 'format',
        random: 'data'
      };

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(WebhookErrorType.UNKNOWN_SOURCE);
      expect(result.error?.message).toContain('Unable to detect webhook source');
    });

    it('should return error for invalid payload', () => {
      const payload = null;

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(WebhookErrorType.SCHEMA_VALIDATION);
      expect(result.error?.message).toContain('Invalid payload structure');
    });

    it('should include detection hints in error details', () => {
      const payload = {
        signal: {
          // Missing required fields
          type: 'LONG'
        }
      };

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.error?.details.detectionHints).toBeDefined();
      expect(result.error?.details.supportedSources).toEqual([
        "SATY_PHASE",
        "MTF_DOTS", 
        "ULTIMATE_OPTIONS",
        "STRAT_EXEC",
        "TRADINGVIEW_SIGNAL"
      ]);
    });

    it('should provide helpful error messages for partial matches', () => {
      const payload = {
        signal: {
          type: 'LONG'
          // Missing ai_score, quality, or timeframe
        }
      };

      const result = router.routeWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Signal payload missing required fields');
    });
  });

  describe('Source Detection Utilities', () => {
    it('should return supported sources', () => {
      const sources = router.getSupportedSources();
      
      expect(sources).toEqual([
        "SATY_PHASE",
        "MTF_DOTS", 
        "ULTIMATE_OPTIONS",
        "STRAT_EXEC",
        "TRADINGVIEW_SIGNAL"
      ]);
    });

    it('should validate source support correctly', () => {
      expect(router.isSourceSupported('SATY_PHASE')).toBe(true);
      expect(router.isSourceSupported('MTF_DOTS')).toBe(true);
      expect(router.isSourceSupported('UNKNOWN_SOURCE')).toBe(false);
      expect(router.isSourceSupported('')).toBe(false);
    });

    it('should provide detection hints for debugging', () => {
      const payload = {
        meta: { engine: 'SATY_PO' },
        signal: { type: 'LONG', timeframe: '15' },
        timeframes: { tf3min: { direction: 'bullish' } }
      };

      const hints = router.getSourceDetectionHints(payload);

      expect(hints).toEqual({
        hasSatyMeta: true,
        hasMtfTimeframes: false, // Missing tf5min
        hasUltimateOptionsSignal: false, // Has timeframe
        hasStratFields: false,
        hasTradingViewSignal: false // Missing instrument.ticker
      });
    });

    it('should handle empty payload for detection hints', () => {
      const hints = router.getSourceDetectionHints(null);
      expect(hints).toEqual({});

      const hints2 = router.getSourceDetectionHints({});
      expect(Object.values(hints2).every(v => v === false)).toBe(true);
    });
  });

  describe('Payload Sanitization', () => {
    it('should sanitize sensitive data from logs', () => {
      const payload = {
        signal: { type: 'LONG' },
        apiKey: 'secret-key',
        token: 'secret-token',
        auth: 'secret-auth'
      };

      // This should not throw but will log sanitized payload
      const result = router.routeWebhook(payload);
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(WebhookErrorType.UNKNOWN_SOURCE);
    });

    it('should truncate large arrays in logs', () => {
      const payload = {
        signal: { type: 'LONG' },
        largeArray: new Array(20).fill('item')
      };

      const result = router.routeWebhook(payload);
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(WebhookErrorType.UNKNOWN_SOURCE);
    });
  });

  describe('Routing Statistics', () => {
    it('should return routing statistics', () => {
      const stats = router.getRoutingStats();
      
      expect(stats).toEqual({
        "SATY_PHASE": 0,
        "MTF_DOTS": 0,
        "ULTIMATE_OPTIONS": 0,
        "STRAT_EXEC": 0,
        "TRADINGVIEW_SIGNAL": 0
      });
    });
  });
});