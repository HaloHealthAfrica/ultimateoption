/**
 * Testing Module
 * 
 * Exports testing utilities for signal/phase generation,
 * webhook sending, and scenario execution.
 */

// Signal Generator
export {
  generateSignal,
  generateMultiTimeframeSignals,
  generateSignalBatch,
  wrapAsWebhookPayload,
  type SignalGeneratorOptions,
} from './generators/signalGenerator';

// Phase Generator
export {
  generatePhase,
  generateMultiTimeframePhases,
  generatePhaseBatch,
  wrapPhaseAsWebhookPayload,
  generateAlignedPhase,
  generateCounterPhase,
  type PhaseGeneratorOptions,
} from './generators/phaseGenerator';

// Webhook Sender
export {
  sendSignalWebhook,
  sendPhaseWebhook,
  sendSignalBatch,
  sendPhaseBatch,
  createWebhookSender,
  type WebhookSendResult,
  type BatchSendResult,
  type WebhookSenderConfig,
} from './senders/webhookSender';

// Scenarios
export {
  PERFECT_ALIGNMENT_SCENARIO,
  COUNTER_TREND_SCENARIO,
  LOW_VOLUME_SCENARIO,
  PHASE_CONFIRMATION_SCENARIO,
  SIGNAL_EXPIRY_SCENARIO,
  COMPLETE_TRADE_FLOW_SCENARIO,
  ALL_SCENARIOS,
  getScenarioById,
  getScenariosByTag,
  getScenariosByDecision,
  type ScenarioStepType,
  type ScenarioStep,
  type TestScenario,
} from './scenarios/scenarios';

// Scenario Runner
export {
  runScenario,
  runScenarios,
  generateRunSummary,
  createScenarioRunner,
  quickTest,
  type StepResult,
  type ScenarioResult,
  type ScenarioRunnerConfig,
} from './scenarioRunner';
