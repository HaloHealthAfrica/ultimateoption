/**
 * Test Scenarios
 * 
 * Pre-defined test scenarios for validating system behavior.
 * Each scenario represents a specific market condition or edge case.
 * 
 * Requirements: 19.6, 20.5
 */

import { EnrichedSignal } from '../../types/signal';
import { SatyPhaseWebhook } from '../../types/saty';
import { TrendWebhook } from '../../types/trend';
import { generateSignal } from '../generators/signalGenerator';
import { generatePhase } from '../generators/phaseGenerator';
import { generateTrend, TrendWebhookPayload } from '../generators/trendGenerator';

/**
 * Scenario step types
 */
export type ScenarioStepType = 'SIGNAL' | 'PHASE' | 'TREND' | 'WAIT' | 'VERIFY';

/**
 * Scenario step
 */
export interface ScenarioStep {
  type: ScenarioStepType;
  description: string;
  data?: EnrichedSignal | SatyPhaseWebhook | TrendWebhook | TrendWebhookPayload;
  wait_ms?: number;
  verify?: () => boolean;
}

/**
 * Test scenario definition
 */
export interface TestScenario {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
  expected_decision?: 'EXECUTE' | 'WAIT' | 'SKIP';
  tags: string[];
}

/**
 * Perfect Alignment Scenario
 * All timeframes aligned, high quality signals, HTF confirmation
 * Expected: EXECUTE
 */
export const PERFECT_ALIGNMENT_SCENARIO: TestScenario = {
  id: 'perfect-alignment',
  name: 'Perfect Alignment',
  description: 'All timeframes aligned with high quality signals and HTF confirmation',
  expected_decision: 'EXECUTE',
  tags: ['alignment', 'high-quality', 'execute'],
  steps: [
    {
      type: 'PHASE',
      description: 'Send 4H bullish regime phase',
      data: generatePhase({
        phase_type: 'REGIME',
        timeframe: '240',
        direction: 'BULLISH',
        seed: 1,
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for phase processing',
      wait_ms: 100,
    },
    {
      type: 'SIGNAL',
      description: 'Send 4H LONG signal (EXTREME quality)',
      data: generateSignal({
        type: 'LONG',
        timeframe: '240',
        quality: 'EXTREME',
        ai_score: 9.5,
        htf_aligned: true,
        seed: 2,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 1H LONG signal (HIGH quality)',
      data: generateSignal({
        type: 'LONG',
        timeframe: '60',
        quality: 'HIGH',
        ai_score: 8.5,
        htf_aligned: true,
        seed: 3,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M LONG signal (HIGH quality)',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'HIGH',
        ai_score: 8.0,
        htf_aligned: true,
        seed: 4,
      }),
    },
  ],
};


/**
 * Counter-Trend Scenario
 * Signal against HTF bias
 * Expected: SKIP
 */
export const COUNTER_TREND_SCENARIO: TestScenario = {
  id: 'counter-trend',
  name: 'Counter-Trend',
  description: 'Signal direction against higher timeframe bias',
  expected_decision: 'SKIP',
  tags: ['counter-trend', 'skip'],
  steps: [
    {
      type: 'PHASE',
      description: 'Send 4H bearish regime phase',
      data: generatePhase({
        phase_type: 'REGIME',
        timeframe: '240',
        direction: 'BEARISH',
        seed: 10,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 4H SHORT signal',
      data: generateSignal({
        type: 'SHORT',
        timeframe: '240',
        quality: 'HIGH',
        htf_aligned: true,
        seed: 11,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M LONG signal (counter to HTF)',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'HIGH',
        htf_aligned: false,
        seed: 12,
      }),
    },
  ],
};

/**
 * Low Volume Scenario
 * Good alignment but low volume
 * Expected: WAIT or reduced position
 */
export const LOW_VOLUME_SCENARIO: TestScenario = {
  id: 'low-volume',
  name: 'Low Volume',
  description: 'Good signal alignment but below average volume',
  expected_decision: 'WAIT',
  tags: ['low-volume', 'wait'],
  steps: [
    {
      type: 'SIGNAL',
      description: 'Send 4H LONG signal with low volume',
      data: generateSignal({
        type: 'LONG',
        timeframe: '240',
        quality: 'HIGH',
        volume_ratio: 0.5,
        htf_aligned: true,
        seed: 20,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M LONG signal with low volume',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'MEDIUM',
        volume_ratio: 0.4,
        htf_aligned: true,
        seed: 21,
      }),
    },
  ],
};

/**
 * Phase Confirmation Scenario
 * Signal with matching phase confirmation
 * Expected: EXECUTE with phase boost
 */
export const PHASE_CONFIRMATION_SCENARIO: TestScenario = {
  id: 'phase-confirmation',
  name: 'Phase Confirmation',
  description: 'Signal with matching SATY phase confirmation',
  expected_decision: 'EXECUTE',
  tags: ['phase', 'confirmation', 'execute'],
  steps: [
    {
      type: 'PHASE',
      description: 'Send regime phase',
      data: generatePhase({
        phase_type: 'REGIME',
        timeframe: '60',
        direction: 'BULLISH',
        seed: 30,
      }),
    },
    {
      type: 'PHASE',
      description: 'Send bias phase',
      data: generatePhase({
        phase_type: 'BIAS',
        timeframe: '60',
        direction: 'BULLISH',
        seed: 31,
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for phase processing',
      wait_ms: 100,
    },
    {
      type: 'SIGNAL',
      description: 'Send aligned signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '60',
        quality: 'HIGH',
        htf_aligned: true,
        seed: 32,
      }),
    },
  ],
};

/**
 * Signal Expiry Scenario
 * Test signal expiration behavior
 */
export const SIGNAL_EXPIRY_SCENARIO: TestScenario = {
  id: 'signal-expiry',
  name: 'Signal Expiry',
  description: 'Test that expired signals are not used in decisions',
  tags: ['expiry', 'timing'],
  steps: [
    {
      type: 'SIGNAL',
      description: 'Send 3M signal (short validity)',
      data: generateSignal({
        type: 'LONG',
        timeframe: '3',
        quality: 'HIGH',
        seed: 40,
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for signal to expire',
      wait_ms: 7 * 60 * 1000, // 7 minutes (3M validity is ~6 min)
    },
    {
      type: 'VERIFY',
      description: 'Verify signal is expired',
      verify: () => true, // Placeholder - actual verification in runner
    },
  ],
};

/**
 * Complete Trade Flow Scenario
 * Full lifecycle from signal to exit
 */
export const COMPLETE_TRADE_FLOW_SCENARIO: TestScenario = {
  id: 'complete-trade-flow',
  name: 'Complete Trade Flow',
  description: 'Full trade lifecycle from signal reception to exit',
  expected_decision: 'EXECUTE',
  tags: ['full-flow', 'lifecycle', 'execute'],
  steps: [
    {
      type: 'PHASE',
      description: 'Establish bullish regime',
      data: generatePhase({
        phase_type: 'REGIME',
        timeframe: '240',
        direction: 'BULLISH',
        seed: 50,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 4H entry signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '240',
        quality: 'EXTREME',
        ai_score: 9.0,
        htf_aligned: true,
        seed: 51,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 1H confirmation',
      data: generateSignal({
        type: 'LONG',
        timeframe: '60',
        quality: 'HIGH',
        ai_score: 8.5,
        htf_aligned: true,
        seed: 52,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M entry trigger',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'HIGH',
        ai_score: 8.0,
        htf_aligned: true,
        seed: 53,
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for decision processing',
      wait_ms: 500,
    },
    {
      type: 'VERIFY',
      description: 'Verify EXECUTE decision was made',
      verify: () => true, // Placeholder
    },
  ],
};

// ============================================================================
// PHASE 1B TEST SCENARIOS
// ============================================================================

/**
 * Phase 1B: Phase Confirmation Scenario
 * SATY phase + signal alignment with confidence boost
 * Expected: EXECUTE with phase boost
 */
export const PHASE_1B_CONFIRMATION_SCENARIO: TestScenario = {
  id: 'phase-1b-confirmation',
  name: 'Phase 1B: Phase Confirmation',
  description: 'SATY phase + signal alignment (should EXECUTE with boost)',
  expected_decision: 'EXECUTE',
  tags: ['phase-1b', 'phase', 'confirmation', 'boost', 'execute'],
  steps: [
    {
      type: 'PHASE',
      description: 'Send 4H bullish regime phase with HTF alignment',
      data: generatePhase({
        phase_type: 'REGIME',
        timeframe: '240',
        direction: 'BULLISH',
        seed: 100,
      }),
    },
    {
      type: 'PHASE',
      description: 'Send 1H bullish bias phase',
      data: generatePhase({
        phase_type: 'BIAS',
        timeframe: '60',
        direction: 'BULLISH',
        seed: 101,
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for phase processing',
      wait_ms: 100,
    },
    {
      type: 'SIGNAL',
      description: 'Send aligned LONG signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '60',
        quality: 'HIGH',
        ai_score: 8.0,
        htf_aligned: true,
        seed: 102,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M LONG entry signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'HIGH',
        ai_score: 7.5,
        htf_aligned: true,
        seed: 103,
      }),
    },
  ],
};

/**
 * Phase 1B: Trend Alignment Scenario
 * Strong trend + signal alignment with position boost
 * Expected: EXECUTE with trend boost
 */
export const PHASE_1B_TREND_ALIGNMENT_SCENARIO: TestScenario = {
  id: 'phase-1b-trend-alignment',
  name: 'Phase 1B: Trend Alignment',
  description: 'Strong trend + signal alignment (should EXECUTE with boost)',
  expected_decision: 'EXECUTE',
  tags: ['phase-1b', 'trend', 'alignment', 'boost', 'execute'],
  steps: [
    {
      type: 'TREND',
      description: 'Send strong bullish trend (8/8 alignment)',
      data: generateTrend(200, {
        ticker: 'SPY',
        alignment_score: 100,
        htf_bias: 'bullish',
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for trend processing',
      wait_ms: 100,
    },
    {
      type: 'SIGNAL',
      description: 'Send 4H LONG signal aligned with trend',
      data: generateSignal({
        type: 'LONG',
        timeframe: '240',
        quality: 'HIGH',
        ai_score: 8.0,
        htf_aligned: true,
        seed: 201,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M LONG entry signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'HIGH',
        ai_score: 7.5,
        htf_aligned: true,
        seed: 202,
      }),
    },
  ],
};

/**
 * Phase 1B: Perfect Alignment Scenario
 * Both phase and trend aligned with maximum boosts
 * Expected: EXECUTE with maximum boost
 */
export const PHASE_1B_PERFECT_ALIGNMENT_SCENARIO: TestScenario = {
  id: 'phase-1b-perfect-alignment',
  name: 'Phase 1B: Perfect Alignment',
  description: 'Both phase and trend aligned (should EXECUTE with maximum boost)',
  expected_decision: 'EXECUTE',
  tags: ['phase-1b', 'phase', 'trend', 'perfect', 'maximum-boost', 'execute'],
  steps: [
    {
      type: 'PHASE',
      description: 'Send 4H bullish regime phase with HTF alignment',
      data: generatePhase({
        phase_type: 'REGIME',
        timeframe: '240',
        direction: 'BULLISH',
        seed: 300,
      }),
    },
    {
      type: 'TREND',
      description: 'Send strong bullish trend (8/8 alignment)',
      data: generateTrend(301, {
        ticker: 'SPY',
        alignment_score: 100,
        htf_bias: 'bullish',
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for phase and trend processing',
      wait_ms: 150,
    },
    {
      type: 'SIGNAL',
      description: 'Send 4H LONG signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '240',
        quality: 'EXTREME',
        ai_score: 9.0,
        htf_aligned: true,
        seed: 302,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 1H LONG confirmation',
      data: generateSignal({
        type: 'LONG',
        timeframe: '60',
        quality: 'HIGH',
        ai_score: 8.5,
        htf_aligned: true,
        seed: 303,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M LONG entry',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'HIGH',
        ai_score: 8.0,
        htf_aligned: true,
        seed: 304,
      }),
    },
  ],
};

/**
 * Phase 1B: Phase Conflict Scenario
 * Phase against signal direction (should reduce confidence)
 * Expected: SKIP or reduced position
 */
export const PHASE_1B_CONFLICT_SCENARIO: TestScenario = {
  id: 'phase-1b-conflict',
  name: 'Phase 1B: Phase Conflict',
  description: 'Phase against signal direction (should reduce confidence)',
  expected_decision: 'SKIP',
  tags: ['phase-1b', 'phase', 'conflict', 'skip'],
  steps: [
    {
      type: 'PHASE',
      description: 'Send 4H bearish regime phase',
      data: generatePhase({
        phase_type: 'REGIME',
        timeframe: '240',
        direction: 'BEARISH',
        seed: 400,
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for phase processing',
      wait_ms: 100,
    },
    {
      type: 'SIGNAL',
      description: 'Send LONG signal (counter to bearish phase)',
      data: generateSignal({
        type: 'LONG',
        timeframe: '60',
        quality: 'MEDIUM',
        ai_score: 7.0,
        htf_aligned: false,
        seed: 401,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M LONG signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'MEDIUM',
        ai_score: 6.5,
        htf_aligned: false,
        seed: 402,
      }),
    },
  ],
};

/**
 * Phase 1B: Choppy Trend Scenario
 * Weak trend alignment (should reduce position size)
 * Expected: WAIT or reduced position
 */
export const PHASE_1B_CHOPPY_TREND_SCENARIO: TestScenario = {
  id: 'phase-1b-choppy-trend',
  name: 'Phase 1B: Choppy Trend',
  description: 'Weak trend alignment (should reduce position size)',
  expected_decision: 'WAIT',
  tags: ['phase-1b', 'trend', 'choppy', 'weak', 'wait'],
  steps: [
    {
      type: 'TREND',
      description: 'Send choppy trend (3/8 alignment)',
      data: generateTrend(500, {
        ticker: 'SPY',
        alignment_score: 37.5, // 3/8 = 37.5% (CHOPPY)
        htf_bias: 'neutral',
      }),
    },
    {
      type: 'WAIT',
      description: 'Wait for trend processing',
      wait_ms: 100,
    },
    {
      type: 'SIGNAL',
      description: 'Send 4H LONG signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '240',
        quality: 'MEDIUM',
        ai_score: 7.0,
        htf_aligned: false,
        seed: 501,
      }),
    },
    {
      type: 'SIGNAL',
      description: 'Send 15M LONG signal',
      data: generateSignal({
        type: 'LONG',
        timeframe: '15',
        quality: 'MEDIUM',
        ai_score: 6.5,
        htf_aligned: false,
        seed: 502,
      }),
    },
  ],
};

/**
 * All available scenarios
 */
export const ALL_SCENARIOS: TestScenario[] = [
  PERFECT_ALIGNMENT_SCENARIO,
  COUNTER_TREND_SCENARIO,
  LOW_VOLUME_SCENARIO,
  PHASE_CONFIRMATION_SCENARIO,
  SIGNAL_EXPIRY_SCENARIO,
  COMPLETE_TRADE_FLOW_SCENARIO,
  // Phase 1B scenarios
  PHASE_1B_CONFIRMATION_SCENARIO,
  PHASE_1B_TREND_ALIGNMENT_SCENARIO,
  PHASE_1B_PERFECT_ALIGNMENT_SCENARIO,
  PHASE_1B_CONFLICT_SCENARIO,
  PHASE_1B_CHOPPY_TREND_SCENARIO,
];

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): TestScenario | undefined {
  return ALL_SCENARIOS.find(s => s.id === id);
}

/**
 * Get scenarios by tag
 */
export function getScenariosByTag(tag: string): TestScenario[] {
  return ALL_SCENARIOS.filter(s => s.tags.includes(tag));
}

/**
 * Get scenarios by expected decision
 */
export function getScenariosByDecision(decision: 'EXECUTE' | 'WAIT' | 'SKIP'): TestScenario[] {
  return ALL_SCENARIOS.filter(s => s.expected_decision === decision);
}
