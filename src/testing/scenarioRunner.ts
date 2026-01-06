/**
 * Scenario Runner
 * 
 * Executes multi-step test scenarios.
 * Supports mixed signal/phase webhooks with timing control.
 * 
 * Requirements: 20.1, 20.2
 */

import { EnrichedSignal } from '../types/signal';
import { SatyPhaseWebhook } from '../types/saty';
import { TestScenario, ScenarioStep } from './scenarios/scenarios';
import { 
  sendSignalWebhook, 
  sendPhaseWebhook, 
  WebhookSendResult,
  WebhookSenderConfig,
} from './senders/webhookSender';

/**
 * Step execution result
 */
export interface StepResult {
  step_index: number;
  step_type: string;
  description: string;
  success: boolean;
  duration_ms: number;
  webhook_result?: WebhookSendResult;
  verify_result?: boolean;
  error?: string;
}

/**
 * Scenario execution result
 */
export interface ScenarioResult {
  scenario_id: string;
  scenario_name: string;
  success: boolean;
  total_steps: number;
  completed_steps: number;
  failed_steps: number;
  total_duration_ms: number;
  step_results: StepResult[];
  expected_decision?: string;
  actual_decision?: string;
  decision_match?: boolean;
  error?: string;
}

/**
 * Runner configuration
 */
export interface ScenarioRunnerConfig {
  webhookConfig?: Partial<WebhookSenderConfig>;
  stopOnFailure?: boolean;
  defaultWaitMs?: number;
}

/**
 * Default runner configuration
 */
const DEFAULT_RUNNER_CONFIG: ScenarioRunnerConfig = {
  stopOnFailure: false,
  defaultWaitMs: 100,
};

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a single scenario step
 */
async function executeStep(
  step: ScenarioStep,
  stepIndex: number,
  config: ScenarioRunnerConfig
): Promise<StepResult> {
  const startTime = Date.now();
  
  try {
    switch (step.type) {
      case 'SIGNAL': {
        const signal = step.data as EnrichedSignal;
        const result = await sendSignalWebhook(signal, config.webhookConfig);
        
        return {
          step_index: stepIndex,
          step_type: 'SIGNAL',
          description: step.description,
          success: result.success,
          duration_ms: Date.now() - startTime,
          webhook_result: result,
        };
      }
      
      case 'PHASE': {
        const phase = step.data as SatyPhaseWebhook;
        const result = await sendPhaseWebhook(phase, config.webhookConfig);
        
        return {
          step_index: stepIndex,
          step_type: 'PHASE',
          description: step.description,
          success: result.success,
          duration_ms: Date.now() - startTime,
          webhook_result: result,
        };
      }
      
      case 'WAIT': {
        const waitMs = step.wait_ms || config.defaultWaitMs || 100;
        await sleep(waitMs);
        
        return {
          step_index: stepIndex,
          step_type: 'WAIT',
          description: step.description,
          success: true,
          duration_ms: waitMs,
        };
      }
      
      case 'VERIFY': {
        const verifyResult = step.verify ? step.verify() : true;
        
        return {
          step_index: stepIndex,
          step_type: 'VERIFY',
          description: step.description,
          success: verifyResult,
          duration_ms: Date.now() - startTime,
          verify_result: verifyResult,
        };
      }
      
      default:
        return {
          step_index: stepIndex,
          step_type: step.type,
          description: step.description,
          success: false,
          duration_ms: Date.now() - startTime,
          error: `Unknown step type: ${step.type}`,
        };
    }
  } catch (error) {
    return {
      step_index: stepIndex,
      step_type: step.type,
      description: step.description,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


/**
 * Run a single scenario
 * Requirement 20.1, 20.2
 * 
 * @param scenario - Scenario to run
 * @param config - Runner configuration
 * @returns Scenario execution result
 */
export async function runScenario(
  scenario: TestScenario,
  config: ScenarioRunnerConfig = {}
): Promise<ScenarioResult> {
  const cfg = { ...DEFAULT_RUNNER_CONFIG, ...config };
  const startTime = Date.now();
  const stepResults: StepResult[] = [];
  let failedSteps = 0;
  
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    const result = await executeStep(step, i, cfg);
    stepResults.push(result);
    
    if (!result.success) {
      failedSteps++;
      
      if (cfg.stopOnFailure) {
        break;
      }
    }
  }
  
  const success = failedSteps === 0;
  
  return {
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    success,
    total_steps: scenario.steps.length,
    completed_steps: stepResults.length,
    failed_steps: failedSteps,
    total_duration_ms: Date.now() - startTime,
    step_results: stepResults,
    expected_decision: scenario.expected_decision,
    // actual_decision would be populated by checking the system state
  };
}

/**
 * Run multiple scenarios
 * 
 * @param scenarios - Scenarios to run
 * @param config - Runner configuration
 * @returns Array of scenario results
 */
export async function runScenarios(
  scenarios: TestScenario[],
  config: ScenarioRunnerConfig = {}
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  
  for (const scenario of scenarios) {
    const result = await runScenario(scenario, config);
    results.push(result);
  }
  
  return results;
}

/**
 * Generate scenario run summary
 * 
 * @param results - Scenario results
 * @returns Summary string
 */
export function generateRunSummary(results: ScenarioResult[]): string {
  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = total - passed;
  const totalDuration = results.reduce((sum, r) => sum + r.total_duration_ms, 0);
  
  const lines: string[] = [
    '=== Scenario Run Summary ===',
    '',
    `Total Scenarios: ${total}`,
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    `Pass Rate: ${((passed / total) * 100).toFixed(1)}%`,
    `Total Duration: ${totalDuration}ms`,
    '',
  ];
  
  if (failed > 0) {
    lines.push('=== Failed Scenarios ===');
    lines.push('');
    
    for (const result of results.filter(r => !r.success)) {
      lines.push(`${result.scenario_name} (${result.scenario_id})`);
      
      for (const step of result.step_results.filter(s => !s.success)) {
        lines.push(`  Step ${step.step_index}: ${step.description}`);
        if (step.error) {
          lines.push(`    Error: ${step.error}`);
        }
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Create a scenario runner with pre-configured settings
 * 
 * @param config - Runner configuration
 * @returns Configured runner functions
 */
export function createScenarioRunner(config: ScenarioRunnerConfig = {}) {
  const cfg = { ...DEFAULT_RUNNER_CONFIG, ...config };
  
  return {
    run: (scenario: TestScenario) => runScenario(scenario, cfg),
    runAll: (scenarios: TestScenario[]) => runScenarios(scenarios, cfg),
    summarize: generateRunSummary,
  };
}

/**
 * Quick test runner for development
 * Runs a scenario and logs results to console
 * 
 * @param scenario - Scenario to test
 * @param config - Runner configuration
 */
export async function quickTest(
  scenario: TestScenario,
  config: ScenarioRunnerConfig = {}
): Promise<void> {
  console.log(`Running scenario: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log('---');
  
  const result = await runScenario(scenario, config);
  
  for (const step of result.step_results) {
    const status = step.success ? '✓' : '✗';
    console.log(`${status} Step ${step.step_index}: ${step.description} (${step.duration_ms}ms)`);
    
    if (!step.success && step.error) {
      console.log(`  Error: ${step.error}`);
    }
  }
  
  console.log('---');
  console.log(`Result: ${result.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Duration: ${result.total_duration_ms}ms`);
}
