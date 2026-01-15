/**
 * Phase 2.5 End-to-End Simulation
 * 
 * Simulates the complete Phase 2.5 webhook flow using real webhook data
 * to identify gaps and validate the integration.
 * 
 * Run with: node simulate-phase25-e2e.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Test scenarios using real webhook data
const scenarios = {
  scenario1: {
    name: 'SPY LONG Signal with High Confidence SATY Phase',
    description: 'Tests complete flow: SATY phase → Signal → Decision',
    steps: [
      {
        name: 'Send SATY Phase (Accumulation)',
        endpoint: '/api/phase25/webhooks/saty-phase',
        payload: {
          "text": "{\"meta\":{\"engine\":\"SATY_PO\",\"engine_version\":\"1.0.0\",\"event_id\":\"evt_sim_001\",\"event_type\":\"REGIME_PHASE_ENTRY\",\"generated_at\":\"2026-01-14T02:00:00Z\"},\"instrument\":{\"symbol\":\"SPY\",\"exchange\":\"NASDAQ\",\"asset_class\":\"ETF\",\"session\":\"REGULAR\"},\"timeframe\":{\"chart_tf\":\"15\",\"event_tf\":\"15M\",\"tf_role\":\"SETUP_FORMATION\",\"bar_close_time\":\"2026-01-14T02:15:00Z\"},\"event\":{\"name\":\"ENTER_ACCUMULATION\",\"description\":\"Entering accumulation phase\",\"directional_implication\":\"UPSIDE_POTENTIAL\",\"event_priority\":8},\"oscillator_state\":{\"value\":85.0,\"previous_value\":78.2,\"zone_from\":\"ACCUMULATION\",\"zone_to\":\"ACCUMULATION\",\"distance_from_zero\":85.0,\"distance_from_extreme\":15.0,\"velocity\":\"INCREASING\"},\"regime_context\":{\"local_bias\":\"BULLISH\",\"htf_bias\":{\"tf\":\"60\",\"bias\":\"BULLISH\",\"osc_value\":82.3},\"macro_bias\":{\"tf\":\"240\",\"bias\":\"BULLISH\"}},\"market_structure\":{\"mean_reversion_phase\":\"EXPANSION\",\"trend_phase\":\"TRENDING\",\"is_counter_trend\":false,\"compression_state\":\"EXPANDING\"},\"confidence\":{\"raw_strength\":0.95,\"htf_alignment\":true,\"confidence_score\":95,\"confidence_tier\":\"EXTREME\"},\"execution_guidance\":{\"trade_allowed\":true,\"allowed_directions\":[\"LONG\"],\"recommended_execution_tf\":[\"5\",\"15\"],\"requires_confirmation\":[]},\"risk_hints\":{\"avoid_if\":[],\"time_decay_minutes\":30,\"cooldown_tf\":\"15\"},\"audit\":{\"source\":\"simulation\",\"alert_frequency\":\"once_per_bar\",\"deduplication_key\":\"spy_15m_sim_001\"}}"
        },
        expectedResult: 'Context updated, waiting for signal'
      },
      {
        name: 'Send Signal (LONG with high AI score)',
        endpoint: '/api/phase25/webhooks/signals',
        payload: {
          "signal": {
            "type": "LONG",
            "timeframe": "15",
            "quality": "EXTREME",
            "ai_score": 9.5
          },
          "instrument": {
            "ticker": "SPY",
            "exchange": "NASDAQ",
            "current_price": 450.25
          },
          "risk": {
            "rr_ratio_t1": 4.5,
            "rr_ratio_t2": 7.0
          }
        },
        expectedResult: 'Decision: EXECUTE with high confidence'
      }
    ]
  },
  
  scenario2: {
    name: 'AAPL SHORT Signal with Medium Confidence',
    description: 'Tests bearish scenario with lower confidence',
    steps: [
      {
        name: 'Send SATY Phase (Distribution)',
        endpoint: '/api/phase25/webhooks/saty-phase',
        payload: {
          "text": "{\"meta\":{\"engine\":\"SATY_PO\",\"engine_version\":\"1.0.0\",\"event_id\":\"evt_sim_002\",\"event_type\":\"REGIME_PHASE_ENTRY\",\"generated_at\":\"2026-01-14T02:05:00Z\"},\"instrument\":{\"symbol\":\"AAPL\",\"exchange\":\"NASDAQ\",\"asset_class\":\"STOCK\",\"session\":\"REGULAR\"},\"timeframe\":{\"chart_tf\":\"5\",\"event_tf\":\"5M\",\"tf_role\":\"SETUP_FORMATION\",\"bar_close_time\":\"2026-01-14T02:05:00Z\"},\"event\":{\"name\":\"ENTER_DISTRIBUTION\",\"description\":\"Entering distribution phase\",\"directional_implication\":\"DOWNSIDE_POTENTIAL\",\"event_priority\":7},\"oscillator_state\":{\"value\":-72.8,\"previous_value\":-65.1,\"zone_from\":\"DISTRIBUTION\",\"zone_to\":\"DISTRIBUTION\",\"distance_from_zero\":72.8,\"distance_from_extreme\":27.2,\"velocity\":\"DECREASING\"},\"regime_context\":{\"local_bias\":\"BEARISH\",\"htf_bias\":{\"tf\":\"30\",\"bias\":\"BEARISH\",\"osc_value\":-68.2},\"macro_bias\":{\"tf\":\"240\",\"bias\":\"BEARISH\"}},\"market_structure\":{\"mean_reversion_phase\":\"CONTRACTION\",\"trend_phase\":\"TRENDING\",\"is_counter_trend\":false,\"compression_state\":\"CONTRACTING\"},\"confidence\":{\"raw_strength\":0.75,\"htf_alignment\":true,\"confidence_score\":75,\"confidence_tier\":\"HIGH\"},\"execution_guidance\":{\"trade_allowed\":true,\"allowed_directions\":[\"SHORT\"],\"recommended_execution_tf\":[\"3\",\"5\"],\"requires_confirmation\":[\"VOLUME\"]},\"risk_hints\":{\"avoid_if\":[\"HIGH_VOLATILITY\"],\"time_decay_minutes\":10,\"cooldown_tf\":\"5\"},\"audit\":{\"source\":\"simulation\",\"alert_frequency\":\"once_per_bar\",\"deduplication_key\":\"aapl_5m_sim_002\"}}"
        },
        expectedResult: 'Context updated, waiting for signal'
      },
      {
        name: 'Send Signal (SHORT with medium AI score)',
        endpoint: '/api/phase25/webhooks/signals',
        payload: {
          "signal": {
            "type": "SHORT",
            "timeframe": "5",
            "quality": "HIGH",
            "ai_score": 7.8
          },
          "instrument": {
            "ticker": "AAPL",
            "exchange": "NASDAQ",
            "current_price": 185.50
          },
          "risk": {
            "rr_ratio_t1": 3.2,
            "rr_ratio_t2": 5.5
          }
        },
        expectedResult: 'Decision: WAIT or EXECUTE depending on confidence'
      }
    ]
  },
  
  scenario3: {
    name: 'Low Confidence Rejection Scenario',
    description: 'Tests rejection due to low confidence',
    steps: [
      {
        name: 'Send SATY Phase (Low Confidence)',
        endpoint: '/api/phase25/webhooks/saty-phase',
        payload: {
          "text": "{\"meta\":{\"engine\":\"SATY_PO\",\"engine_version\":\"1.0.0\",\"event_id\":\"evt_sim_003\",\"event_type\":\"REGIME_PHASE_ENTRY\",\"generated_at\":\"2026-01-14T02:10:00Z\"},\"instrument\":{\"symbol\":\"TSLA\",\"exchange\":\"NASDAQ\",\"asset_class\":\"STOCK\",\"session\":\"REGULAR\"},\"timeframe\":{\"chart_tf\":\"15\",\"event_tf\":\"15M\",\"tf_role\":\"SETUP_FORMATION\",\"bar_close_time\":\"2026-01-14T02:15:00Z\"},\"event\":{\"name\":\"ZERO_CROSS_UP\",\"description\":\"Crossing zero line upward\",\"directional_implication\":\"UPSIDE_POTENTIAL\",\"event_priority\":5},\"oscillator_state\":{\"value\":45.0,\"previous_value\":38.0,\"zone_from\":\"NEUTRAL\",\"zone_to\":\"ACCUMULATION\",\"distance_from_zero\":45.0,\"distance_from_extreme\":55.0,\"velocity\":\"INCREASING\"},\"regime_context\":{\"local_bias\":\"NEUTRAL\",\"htf_bias\":{\"tf\":\"60\",\"bias\":\"NEUTRAL\",\"osc_value\":12.3},\"macro_bias\":{\"tf\":\"240\",\"bias\":\"NEUTRAL\"}},\"market_structure\":{\"mean_reversion_phase\":\"NEUTRAL\",\"trend_phase\":\"RANGING\",\"is_counter_trend\":false,\"compression_state\":\"NEUTRAL\"},\"confidence\":{\"raw_strength\":0.45,\"htf_alignment\":false,\"confidence_score\":45,\"confidence_tier\":\"LOW\"},\"execution_guidance\":{\"trade_allowed\":false,\"allowed_directions\":[],\"recommended_execution_tf\":[],\"requires_confirmation\":[\"PRICE_ACTION\",\"VOLUME\",\"STRUCTURE\"]},\"risk_hints\":{\"avoid_if\":[\"LOW_VOLUME\",\"HIGH_VOLATILITY\"],\"time_decay_minutes\":5,\"cooldown_tf\":\"15\"},\"audit\":{\"source\":\"simulation\",\"alert_frequency\":\"once_per_bar\",\"deduplication_key\":\"tsla_15m_sim_003\"}}"
        },
        expectedResult: 'Context updated, waiting for signal'
      },
      {
        name: 'Send Signal (LONG with low AI score)',
        endpoint: '/api/phase25/webhooks/signals',
        payload: {
          "signal": {
            "type": "LONG",
            "timeframe": "15",
            "quality": "MEDIUM",
            "ai_score": 6.2
          },
          "instrument": {
            "ticker": "TSLA",
            "exchange": "NASDAQ",
            "current_price": 245.75
          },
          "risk": {
            "rr_ratio_t1": 2.1,
            "rr_ratio_t2": 3.5
          }
        },
        expectedResult: 'Decision: SKIP due to low confidence'
      }
    ]
  },
  
  scenario4: {
    name: 'Signal-Only Scenario (No SATY Phase)',
    description: 'Tests what happens when only signal is received',
    steps: [
      {
        name: 'Send Signal Without Prior SATY Phase',
        endpoint: '/api/phase25/webhooks/signals',
        payload: {
          "signal": {
            "type": "LONG",
            "timeframe": "15",
            "quality": "HIGH",
            "ai_score": 8.2
          },
          "instrument": {
            "ticker": "QQQ",
            "exchange": "NASDAQ",
            "current_price": 385.50
          },
          "risk": {
            "rr_ratio_t1": 3.8,
            "rr_ratio_t2": 6.2
          }
        },
        expectedResult: 'Context incomplete, waiting for SATY phase'
      }
    ]
  }
};

// Results tracking
const results = {
  scenarios: [],
  gaps: [],
  successes: [],
  failures: []
};

/**
 * Make HTTP request
 */
async function makeRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Phase25-E2E-Simulation/1.0'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      success: response.status >= 200 && response.status < 300
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      success: false
    };
  }
}

/**
 * Print colored output
 */
function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print section header
 */
function printHeader(text) {
  const line = '='.repeat(80);
  print(`\n${line}`, 'cyan');
  print(text, 'bright');
  print(line, 'cyan');
}

/**
 * Print step header
 */
function printStep(number, total, text) {
  print(`\n${'─'.repeat(80)}`, 'blue');
  print(`Step ${number}/${total}: ${text}`, 'bright');
  print('─'.repeat(80), 'blue');
}

/**
 * Analyze response for gaps
 */
function analyzeResponse(response, expectedResult, stepName) {
  const gaps = [];
  
  // Check if response is successful
  if (!response.success) {
    gaps.push({
      type: 'ERROR',
      step: stepName,
      issue: `Request failed with status ${response.status}`,
      details: response.data || response.error
    });
    return gaps;
  }
  
  // Check for expected fields in Phase 2.5 response
  const data = response.data;
  
  if (!data.engineVersion) {
    gaps.push({
      type: 'MISSING_FIELD',
      step: stepName,
      issue: 'Missing engineVersion field',
      details: 'Response should include engine version'
    });
  }
  
  if (!data.requestId) {
    gaps.push({
      type: 'MISSING_FIELD',
      step: stepName,
      issue: 'Missing requestId field',
      details: 'Response should include request ID for tracking'
    });
  }
  
  if (data.processingTime === undefined) {
    gaps.push({
      type: 'MISSING_FIELD',
      step: stepName,
      issue: 'Missing processingTime field',
      details: 'Response should include processing time metrics'
    });
  }
  
  // Check for decision packet if decision was made
  if (data.decision) {
    if (!data.decision.action) {
      gaps.push({
        type: 'INCOMPLETE_DECISION',
        step: stepName,
        issue: 'Decision packet missing action field',
        details: 'Decision should include action (EXECUTE/WAIT/SKIP)'
      });
    }
    
    if (data.decision.confidenceScore === undefined) {
      gaps.push({
        type: 'INCOMPLETE_DECISION',
        step: stepName,
        issue: 'Decision packet missing confidenceScore',
        details: 'Decision should include confidence score'
      });
    }
    
    if (!data.decision.reasons || data.decision.reasons.length === 0) {
      gaps.push({
        type: 'INCOMPLETE_DECISION',
        step: stepName,
        issue: 'Decision packet missing reasons',
        details: 'Decision should include reasoning'
      });
    }
  }
  
  return gaps;
}

/**
 * Run a single scenario
 */
async function runScenario(scenarioKey, scenario) {
  printHeader(`Scenario: ${scenario.name}`);
  print(`Description: ${scenario.description}`, 'cyan');
  
  const scenarioResult = {
    name: scenario.name,
    steps: [],
    gaps: [],
    success: true
  };
  
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    printStep(i + 1, scenario.steps.length, step.name);
    
    print(`\nEndpoint: POST ${step.endpoint}`, 'yellow');
    print(`Payload: ${JSON.stringify(step.payload, null, 2).substring(0, 200)}...`, 'magenta');
    
    // Make request
    const response = await makeRequest('POST', step.endpoint, step.payload);
    
    // Print response
    print(`\nResponse Status: ${response.status}`, response.success ? 'green' : 'red');
    print(`Response Data:`, 'yellow');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Analyze for gaps
    const stepGaps = analyzeResponse(response, step.expectedResult, step.name);
    
    // Record step result
    const stepResult = {
      name: step.name,
      success: response.success && stepGaps.length === 0,
      response: response.data,
      gaps: stepGaps
    };
    
    scenarioResult.steps.push(stepResult);
    scenarioResult.gaps.push(...stepGaps);
    
    if (!stepResult.success) {
      scenarioResult.success = false;
    }
    
    // Print step result
    if (stepResult.success) {
      print(`\n✅ Step completed successfully`, 'green');
    } else {
      print(`\n❌ Step completed with issues`, 'red');
      if (stepGaps.length > 0) {
        print(`\nGaps identified:`, 'yellow');
        stepGaps.forEach(gap => {
          print(`  - [${gap.type}] ${gap.issue}`, 'red');
          print(`    ${gap.details}`, 'magenta');
        });
      }
    }
    
    // Wait between steps
    if (i < scenario.steps.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Print scenario summary
  print(`\n${'═'.repeat(80)}`, 'cyan');
  if (scenarioResult.success) {
    print(`✅ Scenario "${scenario.name}" completed successfully`, 'green');
  } else {
    print(`❌ Scenario "${scenario.name}" completed with ${scenarioResult.gaps.length} gaps`, 'red');
  }
  print('═'.repeat(80), 'cyan');
  
  return scenarioResult;
}

/**
 * Print final summary
 */
function printSummary() {
  printHeader('End-to-End Simulation Summary');
  
  const totalScenarios = results.scenarios.length;
  const successfulScenarios = results.scenarios.filter(s => s.success).length;
  const failedScenarios = totalScenarios - successfulScenarios;
  const totalGaps = results.scenarios.reduce((sum, s) => sum + s.gaps.length, 0);
  
  print(`\nTotal Scenarios: ${totalScenarios}`, 'cyan');
  print(`✅ Successful: ${successfulScenarios}`, 'green');
  print(`❌ Failed: ${failedScenarios}`, failedScenarios > 0 ? 'red' : 'green');
  print(`🔍 Total Gaps Identified: ${totalGaps}`, totalGaps > 0 ? 'yellow' : 'green');
  
  // Group gaps by type
  if (totalGaps > 0) {
    print(`\n${'─'.repeat(80)}`, 'yellow');
    print('Gaps by Type:', 'bright');
    print('─'.repeat(80), 'yellow');
    
    const gapsByType = {};
    results.scenarios.forEach(scenario => {
      scenario.gaps.forEach(gap => {
        if (!gapsByType[gap.type]) {
          gapsByType[gap.type] = [];
        }
        gapsByType[gap.type].push(gap);
      });
    });
    
    Object.keys(gapsByType).forEach(type => {
      print(`\n${type} (${gapsByType[type].length} occurrences):`, 'yellow');
      gapsByType[type].forEach(gap => {
        print(`  • ${gap.issue}`, 'red');
        print(`    Step: ${gap.step}`, 'magenta');
        print(`    Details: ${gap.details}`, 'cyan');
      });
    });
  }
  
  // Recommendations
  print(`\n${'─'.repeat(80)}`, 'green');
  print('Recommendations:', 'bright');
  print('─'.repeat(80), 'green');
  
  if (totalGaps === 0) {
    print('\n✅ Phase 2.5 integration is working correctly!', 'green');
    print('   All scenarios completed successfully with no gaps identified.', 'green');
  } else {
    print('\n🔧 Action Items:', 'yellow');
    
    const hasErrors = results.scenarios.some(s => s.gaps.some(g => g.type === 'ERROR'));
    const hasMissingFields = results.scenarios.some(s => s.gaps.some(g => g.type === 'MISSING_FIELD'));
    const hasIncompleteDecisions = results.scenarios.some(s => s.gaps.some(g => g.type === 'INCOMPLETE_DECISION'));
    
    if (hasErrors) {
      print('   1. Fix request errors - check service initialization and error handling', 'red');
    }
    if (hasMissingFields) {
      print('   2. Add missing response fields for complete API contract', 'yellow');
    }
    if (hasIncompleteDecisions) {
      print('   3. Ensure decision packets include all required fields', 'yellow');
    }
  }
  
  print(`\n${'═'.repeat(80)}`, 'cyan');
}

/**
 * Main execution
 */
async function main() {
  printHeader('Phase 2.5 End-to-End Simulation');
  print(`Base URL: ${BASE_URL}`, 'cyan');
  print(`Scenarios: ${Object.keys(scenarios).length}`, 'cyan');
  
  // Run all scenarios
  for (const [key, scenario] of Object.entries(scenarios)) {
    const result = await runScenario(key, scenario);
    results.scenarios.push(result);
    
    // Wait between scenarios
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print summary
  printSummary();
  
  // Exit with appropriate code
  const hasFailures = results.scenarios.some(s => !s.success);
  process.exit(hasFailures ? 1 : 0);
}

// Run simulation
main().catch(error => {
  print(`\n❌ Simulation failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
