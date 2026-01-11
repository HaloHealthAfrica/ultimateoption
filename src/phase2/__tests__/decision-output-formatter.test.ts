/**
 * Phase 2 Decision Engine - Decision Output Formatter Tests
 * 
 * Comprehensive tests for decision output formatting including
 * validation of all required fields and structure.
 */

import { DecisionOutputFormatter } from '../formatters/decision-output-formatter';
import { DecisionContext, MarketContext, GateResult, SignalType, MarketSession, GammaBias, ENGINE_VERSION } from '../types';

// Test data generators
const createBaseContext = (): DecisionContext => ({
  indicator: {
    signalType: 'LONG' as SignalType,
    aiScore: 5.0,
    satyPhase: 75,
    marketSession: 'OPEN' as MarketSession,
    symbol: 'SPY',
    timestamp: Date.now()
  }
});

const createMarketContext = (): MarketContext => ({
  optionsData: {
    putCallRatio: 1.0,
    ivPercentile: 50,
    gammaBias: 'NEUTRAL' as GammaBias,
    dataSource: 'API'
  },
  marketStats: {
    atr14: 1.0,
    rv20: 1.0,
    trendSlope: 0.1,
    dataSource: 'API'
  },
  liquidityData: {
    spreadBps: 8,
    depthScore: 75,
    tradeVelocity: 'NORMAL',
    dataSource: 'API'
  }
});

const createValidContext = (): DecisionContext => {
  const context = createBaseContext();
  context.market = createMarketContext();
  return context;
};

const createPassingGateResults = (): GateResult[] => [
  { gate: 'SPREAD_GATE', passed: true, value: 8, threshold: 12 },
  { gate: 'VOLATILITY_GATE', passed: true, value: 1.0, threshold: 2.0 },
  { gate: 'GAMMA_GATE', passed: true },
  { gate: 'PHASE_GATE', passed: true, value: 75, threshold: 65 },
  { gate: 'SESSION_GATE', passed: true }
];

const createFailingGateResults = (): GateResult[] => [
  { gate: 'SPREAD_GATE', passed: false, reason: 'SPREAD_TOO_WIDE', value: 15, threshold: 12 },
  { gate: 'VOLATILITY_GATE', passed: true, value: 1.0, threshold: 2.0 },
  { gate: 'GAMMA_GATE', passed: true },
  { gate: 'PHASE_GATE', passed: false, reason: 'PHASE_CONFIDENCE_LOW', value: 50, threshold: 65 },
  { gate: 'SESSION_GATE', passed: true }
];

describe('DecisionOutputFormatter', () => {
  let formatter: DecisionOutputFormatter;

  beforeEach(() => {
    formatter = new DecisionOutputFormatter();
  });

  describe('APPROVE Decision Formatting', () => {
    test('should format APPROVE decision with all required fields', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const confidence = 7.5;
      const processingTime = 5.25;

      const result = formatter.formatApproveDecision(context, gateResults, confidence, processingTime);

      // Basic decision fields
      expect(result.decision).toBe('APPROVE');
      expect(result.direction).toBe('LONG');
      expect(result.confidence).toBe(7.5);
      expect(result.engine_version).toBe(ENGINE_VERSION);

      // Gates
      expect(result.gates.passed).toHaveLength(5);
      expect(result.gates.failed).toHaveLength(0);
      expect(result.gates.passed).toEqual([
        'SPREAD_GATE', 'VOLATILITY_GATE', 'GAMMA_GATE', 'PHASE_GATE', 'SESSION_GATE'
      ]);

      // Should not have reasons for APPROVE
      expect(result.reasons).toBeUndefined();

      // Audit trail
      expect(result.audit).toBeDefined();
      expect(result.audit.processing_time_ms).toBe(5.25);
    });

    test('should include direction for APPROVE decisions', () => {
      const context = createValidContext();
      context.indicator.signalType = 'SHORT';
      const gateResults = createPassingGateResults();

      const result = formatter.formatApproveDecision(context, gateResults, 6.0);

      expect(result.direction).toBe('SHORT');
    });

    test('should include confidence for APPROVE decisions', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const confidence = 8.75;

      const result = formatter.formatApproveDecision(context, gateResults, confidence);

      expect(result.confidence).toBe(8.75);
    });

    test('should not include reasons for APPROVE decisions', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();

      const result = formatter.formatApproveDecision(context, gateResults, 7.0);

      expect(result.reasons).toBeUndefined();
    });
  });

  describe('REJECT Decision Formatting', () => {
    test('should format REJECT decision with all required fields', () => {
      const context = createValidContext();
      const gateResults = createFailingGateResults();
      const processingTime = 3.15;

      const result = formatter.formatRejectDecision(context, gateResults, processingTime);

      // Basic decision fields
      expect(result.decision).toBe('REJECT');
      expect(result.direction).toBeUndefined();
      expect(result.confidence).toBeUndefined();
      expect(result.engine_version).toBe(ENGINE_VERSION);

      // Gates
      expect(result.gates.passed).toHaveLength(3);
      expect(result.gates.failed).toHaveLength(2);
      expect(result.gates.failed).toEqual(['SPREAD_GATE', 'PHASE_GATE']);

      // Should have reasons for REJECT
      expect(result.reasons).toBeDefined();
      expect(result.reasons).toEqual(['SPREAD_TOO_WIDE', 'PHASE_CONFIDENCE_LOW']);

      // Audit trail
      expect(result.audit).toBeDefined();
      expect(result.audit.processing_time_ms).toBe(3.15);
    });

    test('should not include direction for REJECT decisions', () => {
      const context = createValidContext();
      const gateResults = createFailingGateResults();

      const result = formatter.formatRejectDecision(context, gateResults);

      expect(result.direction).toBeUndefined();
    });

    test('should not include confidence for REJECT decisions', () => {
      const context = createValidContext();
      const gateResults = createFailingGateResults();

      const result = formatter.formatRejectDecision(context, gateResults);

      expect(result.confidence).toBeUndefined();
    });

    test('should include reasons array for REJECT decisions', () => {
      const context = createValidContext();
      const gateResults = createFailingGateResults();

      const result = formatter.formatRejectDecision(context, gateResults);

      expect(result.reasons).toBeDefined();
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(result.reasons!.length).toBeGreaterThan(0);
    });

    test('should handle single gate failure', () => {
      const context = createValidContext();
      const gateResults = [
        { gate: 'SPREAD_GATE', passed: false, reason: 'SPREAD_TOO_WIDE', value: 15, threshold: 12 },
        { gate: 'VOLATILITY_GATE', passed: true, value: 1.0, threshold: 2.0 },
        { gate: 'GAMMA_GATE', passed: true },
        { gate: 'PHASE_GATE', passed: true, value: 75, threshold: 65 },
        { gate: 'SESSION_GATE', passed: true }
      ];

      const result = formatter.formatRejectDecision(context, gateResults);

      expect(result.gates.failed).toEqual(['SPREAD_GATE']);
      expect(result.reasons).toEqual(['SPREAD_TOO_WIDE']);
    });
  });

  describe('Audit Trail Generation', () => {
    test('should include complete audit trail', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();

      const result = formatter.formatApproveDecision(context, gateResults, 7.0, 2.5);

      expect(result.audit).toBeDefined();
      expect(result.audit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.audit.symbol).toBe('SPY');
      expect(result.audit.session).toBe('OPEN');
      expect(result.audit.context_snapshot).toEqual(context);
      expect(result.audit.gate_results).toEqual(gateResults);
      expect(result.audit.processing_time_ms).toBe(2.5);
    });

    test('should create deep copy of context for audit trail', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();

      const result = formatter.formatApproveDecision(context, gateResults, 7.0);

      // Modify original context
      context.indicator.symbol = 'MODIFIED';
      context.market!.liquidityData.spreadBps = 999;

      // Audit trail should have original values
      expect(result.audit.context_snapshot.indicator.symbol).toBe('SPY');
      expect(result.audit.context_snapshot.market!.liquidityData.spreadBps).toBe(8);
    });

    test('should handle missing processing time', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();

      const result = formatter.formatApproveDecision(context, gateResults, 7.0);

      expect(result.audit.processing_time_ms).toBe(0);
    });
  });

  describe('Gate Results Processing', () => {
    test('should correctly separate passed and failed gates', () => {
      const context = createValidContext();
      const gateResults = [
        { gate: 'GATE_A', passed: true },
        { gate: 'GATE_B', passed: false, reason: 'REASON_B' },
        { gate: 'GATE_C', passed: true },
        { gate: 'GATE_D', passed: false, reason: 'REASON_D' },
        { gate: 'GATE_E', passed: true }
      ];

      const result = formatter.formatRejectDecision(context, gateResults);

      expect(result.gates.passed).toEqual(['GATE_A', 'GATE_C', 'GATE_E']);
      expect(result.gates.failed).toEqual(['GATE_B', 'GATE_D']);
      expect(result.reasons).toEqual(['REASON_B', 'REASON_D']);
    });

    test('should handle gates without reasons', () => {
      const context = createValidContext();
      const gateResults = [
        { gate: 'GATE_A', passed: false, reason: 'REASON_A' },
        { gate: 'GATE_B', passed: false }, // No reason provided
        { gate: 'GATE_C', passed: true }
      ];

      const result = formatter.formatRejectDecision(context, gateResults);

      expect(result.reasons).toEqual(['REASON_A']); // Should filter out undefined reasons
    });
  });

  describe('Decision Output Validation', () => {
    test('should validate valid APPROVE decision', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const output = formatter.formatApproveDecision(context, gateResults, 7.5);

      expect(() => formatter.validateDecisionOutput(output)).not.toThrow();
      expect(formatter.validateDecisionOutput(output)).toBe(true);
    });

    test('should validate valid REJECT decision', () => {
      const context = createValidContext();
      const gateResults = createFailingGateResults();
      const output = formatter.formatRejectDecision(context, gateResults);

      expect(() => formatter.validateDecisionOutput(output)).not.toThrow();
      expect(formatter.validateDecisionOutput(output)).toBe(true);
    });

    test('should reject invalid decision type', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const output = formatter.formatApproveDecision(context, gateResults, 7.5);
      
      (output as any).decision = 'INVALID';

      expect(() => formatter.validateDecisionOutput(output)).toThrow('Invalid decision: must be APPROVE or REJECT');
    });

    test('should reject missing engine version', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const output = formatter.formatApproveDecision(context, gateResults, 7.5);
      
      delete (output as any).engine_version;

      expect(() => formatter.validateDecisionOutput(output)).toThrow('Invalid engine_version');
    });

    test('should reject APPROVE decision without direction', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const output = formatter.formatApproveDecision(context, gateResults, 7.5);
      
      delete (output as any).direction;

      expect(() => formatter.validateDecisionOutput(output)).toThrow('APPROVE decisions must include valid direction');
    });

    test('should reject APPROVE decision without confidence', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const output = formatter.formatApproveDecision(context, gateResults, 7.5);
      
      delete (output as any).confidence;

      expect(() => formatter.validateDecisionOutput(output)).toThrow('APPROVE decisions must include confidence');
    });

    test('should reject APPROVE decision with invalid confidence', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const output = formatter.formatApproveDecision(context, gateResults, 7.5);
      
      (output as any).confidence = 15; // Above maximum

      expect(() => formatter.validateDecisionOutput(output)).toThrow('APPROVE decisions must include confidence between 0 and 10');
    });

    test('should reject REJECT decision without reasons', () => {
      const context = createValidContext();
      const gateResults = createFailingGateResults();
      const output = formatter.formatRejectDecision(context, gateResults);
      
      delete (output as any).reasons;

      expect(() => formatter.validateDecisionOutput(output)).toThrow('REJECT decisions must include non-empty reasons array');
    });

    test('should reject REJECT decision with direction', () => {
      const context = createValidContext();
      const gateResults = createFailingGateResults();
      const output = formatter.formatRejectDecision(context, gateResults);
      
      (output as any).direction = 'LONG';

      expect(() => formatter.validateDecisionOutput(output)).toThrow('REJECT decisions should not include direction');
    });

    test('should reject missing audit trail', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const output = formatter.formatApproveDecision(context, gateResults, 7.5);
      
      delete (output as any).audit;

      expect(() => formatter.validateDecisionOutput(output)).toThrow('Invalid audit: audit trail is required');
    });

    test('should reject invalid audit timestamp', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();
      const output = formatter.formatApproveDecision(context, gateResults, 7.5);
      
      output.audit.timestamp = 'invalid-timestamp';

      expect(() => formatter.validateDecisionOutput(output)).toThrow('Invalid audit timestamp');
    });
  });

  describe('Formatter Metadata', () => {
    test('should provide formatter info', () => {
      const info = formatter.getFormatterInfo();

      expect(info.name).toBe('DecisionOutputFormatter');
      expect(info.version).toBe(ENGINE_VERSION);
      expect(info.supported_decisions).toEqual(['APPROVE', 'REJECT']);
      expect(info.validation_enabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty gate results', () => {
      const context = createValidContext();
      const gateResults: GateResult[] = [];

      const result = formatter.formatApproveDecision(context, gateResults, 7.0);

      expect(result.gates.passed).toHaveLength(0);
      expect(result.gates.failed).toHaveLength(0);
      expect(result.audit.gate_results).toHaveLength(0);
    });

    test('should handle context without market data', () => {
      const context = createBaseContext();
      // No market context
      const gateResults = createPassingGateResults();

      const result = formatter.formatApproveDecision(context, gateResults, 5.0);

      expect(result.audit.context_snapshot.market).toBeUndefined();
    });

    test('should handle zero confidence', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();

      const result = formatter.formatApproveDecision(context, gateResults, 0);

      expect(result.confidence).toBe(0);
      expect(() => formatter.validateDecisionOutput(result)).not.toThrow();
    });

    test('should handle maximum confidence', () => {
      const context = createValidContext();
      const gateResults = createPassingGateResults();

      const result = formatter.formatApproveDecision(context, gateResults, 10.0);

      expect(result.confidence).toBe(10.0);
      expect(() => formatter.validateDecisionOutput(result)).not.toThrow();
    });
  });
});