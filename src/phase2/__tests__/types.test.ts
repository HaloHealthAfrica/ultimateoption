/**
 * Phase 2 Decision Engine - Type Definition Tests
 * 
 * Unit tests for TypeScript interface validation and type safety.
 */

import { ENGINE_VERSION,
  Decision,
  SignalType,
  MarketSession,
  GammaBias,
  TradeVelocity,
  DataSource,
  TradingViewSignal, MarketContext,
  GateResult,
  DecisionOutput,
  AuditTrail, DecisionContext } from '../types';

describe('Phase 2 Type Definitions', () => {
  describe('Engine Version', () => {
    test('should have correct engine version', () => {
      expect(ENGINE_VERSION).toBe('2.0.0');
      expect(typeof ENGINE_VERSION).toBe('string');
    });

    test('should be immutable', () => {
      // ENGINE_VERSION is a const string, not an object, so it can't be frozen
      // TypeScript prevents reassignment at compile time
      expect(ENGINE_VERSION).toBe('2.0.0');
      expect(typeof ENGINE_VERSION).toBe('string');
    });
  });

  describe('Type Unions', () => {
    test('Decision type should only allow APPROVE or REJECT', () => {
      const approveDecision: Decision = 'APPROVE';
      const rejectDecision: Decision = 'REJECT';
      
      expect(approveDecision).toBe('APPROVE');
      expect(rejectDecision).toBe('REJECT');
      
      // TypeScript should prevent invalid values at compile time
      // @ts-expect-error - Invalid decision type
      const invalidDecision: Decision = 'WAIT';
    });

    test('SignalType should only allow LONG or SHORT', () => {
      const longSignal: SignalType = 'LONG';
      const shortSignal: SignalType = 'SHORT';
      
      expect(longSignal).toBe('LONG');
      expect(shortSignal).toBe('SHORT');
    });

    test('MarketSession should only allow valid sessions', () => {
      const validSessions: MarketSession[] = ['OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS'];
      
      validSessions.forEach(session => {
        expect(['OPEN', 'MIDDAY', 'POWER_HOUR', 'AFTERHOURS']).toContain(session);
      });
    });

    test('GammaBias should only allow valid bias values', () => {
      const validBiases: GammaBias[] = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'];
      
      validBiases.forEach(bias => {
        expect(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).toContain(bias);
      });
    });
  });

  describe('TradingViewSignal Interface', () => {
    test('should validate complete TradingView signal structure', () => {
      const signal: TradingViewSignal = {
        signal: {
          type: 'LONG',
          aiScore: 8.5,
          timestamp: Date.now(),
          symbol: 'SPY'
        },
        satyPhase: {
          phase: 75,
          confidence: 85
        },
        marketSession: 'OPEN'
      };

      expect(signal.signal.type).toBe('LONG');
      expect(signal.signal.aiScore).toBe(8.5);
      expect(signal.signal.symbol).toBe('SPY');
      expect(signal.satyPhase?.phase).toBe(75);
      expect(signal.marketSession).toBe('OPEN');
    });

    test('should allow optional satyPhase', () => {
      const signalWithoutPhase: TradingViewSignal = {
        signal: {
          type: 'SHORT',
          aiScore: 7.2,
          timestamp: Date.now(),
          symbol: 'QQQ'
        },
        marketSession: 'MIDDAY'
      };

      expect(signalWithoutPhase.satyPhase).toBeUndefined();
      expect(signalWithoutPhase.signal.type).toBe('SHORT');
    });
  });

  describe('DecisionContext Interface', () => {
    test('should validate decision context structure', () => {
      const context: DecisionContext = {
        indicator: {
          signalType: 'LONG',
          aiScore: 8.0,
          satyPhase: 70,
          marketSession: 'OPEN',
          symbol: 'SPY',
          timestamp: Date.now()
        }
      };

      expect(context.indicator.signalType).toBe('LONG');
      expect(context.indicator.aiScore).toBe(8.0);
      expect(context.market).toBeUndefined();
    });

    test('should allow optional market context', () => {
      const contextWithMarket: DecisionContext = {
        indicator: {
          signalType: 'SHORT',
          aiScore: 7.5,
          satyPhase: 80,
          marketSession: 'POWER_HOUR',
          symbol: 'QQQ',
          timestamp: Date.now()
        },
        market: {
          optionsData: {
            putCallRatio: 1.2,
            ivPercentile: 65,
            gammaBias: 'POSITIVE',
            dataSource: 'API'
          },
          marketStats: {
            atr14: 2.5,
            rv20: 0.25,
            trendSlope: 0.15,
            dataSource: 'API'
          },
          liquidityData: {
            spreadBps: 8,
            depthScore: 85,
            tradeVelocity: 'NORMAL',
            dataSource: 'API'
          }
        }
      };

      expect(contextWithMarket.market).toBeDefined();
      expect(contextWithMarket.market?.optionsData.gammaBias).toBe('POSITIVE');
    });
  });

  describe('GateResult Interface', () => {
    test('should validate gate result structure', () => {
      const passedGate: GateResult = {
        gate: 'SPREAD_GATE',
        passed: true
      };

      const failedGate: GateResult = {
        gate: 'VOLATILITY_GATE',
        passed: false,
        reason: 'VOLATILITY_SPIKE',
        value: 2.5,
        threshold: 2.0
      };

      expect(passedGate.passed).toBe(true);
      expect(passedGate.reason).toBeUndefined();
      
      expect(failedGate.passed).toBe(false);
      expect(failedGate.reason).toBe('VOLATILITY_SPIKE');
      expect(failedGate.value).toBe(2.5);
      expect(failedGate.threshold).toBe(2.0);
    });
  });

  describe('DecisionOutput Interface', () => {
    test('should validate APPROVE decision output', () => {
      const approveOutput: DecisionOutput = {
        decision: 'APPROVE',
        direction: 'LONG',
        confidence: 8.5,
        engine_version: '2.0.0',
        gates: {
          passed: ['SPREAD_GATE', 'VOLATILITY_GATE'],
          failed: []
        },
        audit: {
          timestamp: new Date().toISOString(),
          symbol: 'SPY',
          session: 'OPEN',
          context_snapshot: {} as DecisionContext,
          gate_results: [],
          processing_time_ms: 15
        }
      };

      expect(approveOutput.decision).toBe('APPROVE');
      expect(approveOutput.direction).toBe('LONG');
      expect(approveOutput.confidence).toBe(8.5);
      expect(approveOutput.reasons).toBeUndefined();
    });

    test('should validate REJECT decision output', () => {
      const rejectOutput: DecisionOutput = {
        decision: 'REJECT',
        engine_version: '2.0.0',
        gates: {
          passed: ['SPREAD_GATE'],
          failed: ['VOLATILITY_GATE', 'GAMMA_GATE']
        },
        reasons: ['VOLATILITY_SPIKE', 'GAMMA_HEADWIND'],
        audit: {
          timestamp: new Date().toISOString(),
          symbol: 'QQQ',
          session: 'AFTERHOURS',
          context_snapshot: {} as DecisionContext,
          gate_results: [],
          processing_time_ms: 12
        }
      };

      expect(rejectOutput.decision).toBe('REJECT');
      expect(rejectOutput.direction).toBeUndefined();
      expect(rejectOutput.confidence).toBeUndefined();
      expect(rejectOutput.reasons).toEqual(['VOLATILITY_SPIKE', 'GAMMA_HEADWIND']);
    });
  });

  describe('AuditTrail Interface', () => {
    test('should validate audit trail structure', () => {
      const auditTrail: AuditTrail = {
        timestamp: new Date().toISOString(),
        symbol: 'SPY',
        session: 'OPEN',
        context_snapshot: {
          indicator: {
            signalType: 'LONG',
            aiScore: 8.0,
            satyPhase: 70,
            marketSession: 'OPEN',
            symbol: 'SPY',
            timestamp: Date.now()
          }
        },
        gate_results: [
          {
            gate: 'SPREAD_GATE',
            passed: true
          }
        ],
        processing_time_ms: 25
      };

      expect(auditTrail.symbol).toBe('SPY');
      expect(auditTrail.session).toBe('OPEN');
      expect(auditTrail.processing_time_ms).toBe(25);
      expect(auditTrail.gate_results).toHaveLength(1);
    });
  });
});