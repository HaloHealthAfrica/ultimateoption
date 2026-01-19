/**
 * Phase 2.5 Paper Execution End-to-End Test
 * 
 * Tests the complete flow including paper execution and exit simulation:
 * 1. Send webhooks (SATY + Signal)
 * 2. Verify EXECUTE decision is made
 * 3. Verify paper execution is created in ledger
 * 4. Verify exit simulation is applied
 * 5. Verify metrics are calculated correctly
 * 
 * Run with: node test-paper-execution-e2e.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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

function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(text) {
  const line = '='.repeat(80);
  print(`\n${line}`, 'cyan');
  print(text, 'bright');
  print(line, 'cyan');
}

async function makeRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Phase25-Paper-E2E-Test/1.0'
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

async function testPaperExecution() {
  printHeader('Phase 2.5 Paper Execution E2E Test');
  
  const results = {
    webhooksSent: false,
    decisionMade: false,
    executionCreated: false,
    exitSimulated: false,
    metricsCalculated: false,
    errors: []
  };
  
  try {
    // Step 1: Send SATY Phase webhook (high confidence)
    print('\n📤 Step 1: Sending SATY Phase webhook (Accumulation, 95% confidence)...', 'cyan');
    const satyPayload = {
      "text": JSON.stringify({
        "meta": {
          "engine": "SATY_PO",
          "engine_version": "1.0.0",
          "event_id": `evt_test_${Date.now()}`,
          "event_type": "REGIME_PHASE_ENTRY",
          "generated_at": new Date().toISOString()
        },
        "instrument": {
          "symbol": "SPY",
          "exchange": "NASDAQ",
          "asset_class": "ETF",
          "session": "REGULAR"
        },
        "timeframe": {
          "chart_tf": "15",
          "event_tf": "15M",
          "tf_role": "SETUP_FORMATION",
          "bar_close_time": new Date().toISOString()
        },
        "event": {
          "name": "ENTER_ACCUMULATION",
          "description": "Entering accumulation phase",
          "directional_implication": "UPSIDE_POTENTIAL",
          "event_priority": 8
        },
        "oscillator_state": {
          "value": 85.0,
          "previous_value": 78.2,
          "zone_from": "ACCUMULATION",
          "zone_to": "ACCUMULATION",
          "distance_from_zero": 85.0,
          "distance_from_extreme": 15.0,
          "velocity": "INCREASING"
        },
        "regime_context": {
          "local_bias": "BULLISH",
          "htf_bias": {
            "tf": "60",
            "bias": "BULLISH",
            "osc_value": 82.3
          },
          "macro_bias": {
            "tf": "240",
            "bias": "BULLISH"
          }
        },
        "market_structure": {
          "mean_reversion_phase": "EXPANSION",
          "trend_phase": "TRENDING",
          "is_counter_trend": false,
          "compression_state": "EXPANDING"
        },
        "confidence": {
          "raw_strength": 0.95,
          "htf_alignment": true,
          "confidence_score": 95,
          "confidence_tier": "EXTREME"
        },
        "execution_guidance": {
          "trade_allowed": true,
          "allowed_directions": ["LONG"],
          "recommended_execution_tf": ["5", "15"],
          "requires_confirmation": []
        },
        "risk_hints": {
          "avoid_if": [],
          "time_decay_minutes": 30,
          "cooldown_tf": "15"
        },
        "audit": {
          "source": "e2e_test",
          "alert_frequency": "once_per_bar",
          "deduplication_key": `spy_15m_test_${Date.now()}`
        }
      })
    };
    
    const satyResponse = await makeRequest('POST', '/api/phase25/webhooks/saty-phase', satyPayload);
    
    if (!satyResponse.success) {
      results.errors.push(`SATY webhook failed: ${satyResponse.error || satyResponse.data?.message}`);
      print(`❌ SATY webhook failed`, 'red');
      console.log(satyResponse.data);
    } else {
      print(`✅ SATY webhook accepted`, 'green');
      print(`   Message: ${satyResponse.data.message}`, 'yellow');
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Send Signal webhook (LONG with EXTREME quality)
    print('\n📤 Step 2: Sending Signal webhook (LONG, EXTREME quality, AI 9.5)...', 'cyan');
    const signalPayload = {
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
      },
      "components": ["momentum", "volume", "structure"]
    };
    
    const signalResponse = await makeRequest('POST', '/api/phase25/webhooks/signals', signalPayload);
    
    if (!signalResponse.success) {
      results.errors.push(`Signal webhook failed: ${signalResponse.error || signalResponse.data?.message}`);
      print(`❌ Signal webhook failed`, 'red');
      console.log(signalResponse.data);
    } else {
      results.webhooksSent = true;
      print(`✅ Signal webhook accepted`, 'green');
      print(`   Message: ${signalResponse.data.message}`, 'yellow');
      
      // Check if decision was made
      if (signalResponse.data.decision) {
        results.decisionMade = true;
        const decision = signalResponse.data.decision;
        print(`\n📊 Decision Made:`, 'bright');
        print(`   Action: ${decision.action}`, decision.action === 'EXECUTE' ? 'green' : 'yellow');
        print(`   Confidence: ${decision.confidenceScore}%`, 'cyan');
        print(`   Size Multiplier: ${decision.finalSizeMultiplier}x`, 'cyan');
        print(`   Reasons: ${decision.reasons.join(', ')}`, 'magenta');
        
        if (decision.action !== 'EXECUTE') {
          results.errors.push(`Expected EXECUTE decision but got ${decision.action}`);
          print(`\n⚠️  Expected EXECUTE but got ${decision.action}`, 'yellow');
        }
      } else {
        results.errors.push('No decision in response');
        print(`\n⚠️  No decision in response`, 'yellow');
      }
    }
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3: Check ledger for execution
    print('\n🔍 Step 3: Checking ledger for paper execution...', 'cyan');
    const ledgerResponse = await makeRequest('GET', '/api/ledger?limit=1&decision=EXECUTE');
    
    if (!ledgerResponse.success) {
      results.errors.push(`Ledger query failed: ${ledgerResponse.error || ledgerResponse.data?.message}`);
      print(`❌ Ledger query failed`, 'red');
    } else {
      const entries = ledgerResponse.data.data || ledgerResponse.data.entries || [];
      
      if (entries.length === 0) {
        results.errors.push('No EXECUTE entries found in ledger');
        print(`❌ No EXECUTE entries found in ledger`, 'red');
      } else {
        const entry = entries[0];
        print(`✅ Found ledger entry: ${entry.id}`, 'green');
        
        // Check for execution data
        if (entry.execution) {
          results.executionCreated = true;
          const exec = entry.execution;
          print(`\n📈 Paper Execution Details:`, 'bright');
          print(`   Symbol: ${entry.signal?.instrument?.symbol || 'N/A'}`, 'cyan');
          print(`   Option Type: ${exec.option_type}`, 'cyan');
          print(`   Strike: $${exec.strike}`, 'cyan');
          print(`   Expiry: ${exec.expiry}`, 'cyan');
          print(`   DTE: ${exec.dte}`, 'cyan');
          print(`   Contracts: ${exec.filled_contracts}`, 'cyan');
          print(`   Entry Price: $${exec.entry_price.toFixed(2)}`, 'cyan');
          print(`   Entry Delta: ${exec.entry_delta.toFixed(3)}`, 'cyan');
          print(`   Entry IV: ${(exec.entry_iv * 100).toFixed(1)}%`, 'cyan');
          print(`   Risk Amount: $${exec.risk_amount.toFixed(2)}`, 'cyan');
          print(`   Fill Quality: ${exec.fill_quality}`, 'cyan');
        } else {
          results.errors.push('Ledger entry missing execution data');
          print(`❌ Ledger entry missing execution data`, 'red');
        }
        
        // Check for exit data
        if (entry.exit) {
          results.exitSimulated = true;
          const exit = entry.exit;
          print(`\n🎯 Paper Exit Simulation:`, 'bright');
          print(`   Exit Price: $${exit.exit_price.toFixed(2)}`, 'cyan');
          print(`   Exit Reason: ${exit.exit_reason}`, exit.exit_reason.includes('TARGET') ? 'green' : 'red');
          print(`   P&L Gross: $${exit.pnl_gross.toFixed(2)}`, exit.pnl_gross > 0 ? 'green' : 'red');
          print(`   P&L Net: $${exit.pnl_net.toFixed(2)}`, exit.pnl_net > 0 ? 'green' : 'red');
          print(`   Hold Time: ${Math.floor(exit.hold_time_seconds / 60)}m ${exit.hold_time_seconds % 60}s`, 'cyan');
          print(`   Delta Contribution: $${exit.pnl_from_delta.toFixed(2)}`, 'magenta');
          print(`   IV Contribution: $${exit.pnl_from_iv.toFixed(2)}`, 'magenta');
          print(`   Theta Contribution: $${exit.pnl_from_theta.toFixed(2)}`, 'magenta');
          print(`   Total Commission: $${exit.total_commission.toFixed(2)}`, 'yellow');
          print(`   Total Spread Cost: $${exit.total_spread_cost.toFixed(2)}`, 'yellow');
          print(`   Total Slippage: $${exit.total_slippage.toFixed(2)}`, 'yellow');
        } else {
          results.errors.push('Ledger entry missing exit data');
          print(`❌ Ledger entry missing exit data`, 'red');
        }
      }
    }
    
    // Step 4: Check metrics endpoint
    print('\n📊 Step 4: Checking Phase 2.5 metrics...', 'cyan');
    const metricsResponse = await makeRequest('GET', '/api/phase25/webhooks/metrics');
    
    if (!metricsResponse.success) {
      results.errors.push(`Metrics query failed: ${metricsResponse.error || metricsResponse.data?.message}`);
      print(`❌ Metrics query failed`, 'red');
    } else {
      const metrics = metricsResponse.data;
      
      if (metrics.paper_performance) {
        results.metricsCalculated = true;
        const perf = metrics.paper_performance;
        print(`✅ Paper performance metrics available`, 'green');
        print(`\n💰 Performance Summary:`, 'bright');
        print(`   Sample Size: ${perf.sample_size}`, 'cyan');
        
        if (perf.overall) {
          print(`   Total P&L: $${perf.overall.total_pnl?.toFixed(2) || 'N/A'}`, 'cyan');
          print(`   Win Rate: ${((perf.overall.win_rate || 0) * 100).toFixed(1)}%`, 'cyan');
          print(`   Total Trades: ${perf.overall.total_trades || 0}`, 'cyan');
          print(`   Status: ${perf.overall.status}`, 'cyan');
        }
        
        if (perf.streaks) {
          print(`\n🔥 Streaks:`, 'bright');
          print(`   Current: ${perf.streaks.currentStreak} ${perf.streaks.currentStreakType}`, 'cyan');
          print(`   Max Win Streak: ${perf.streaks.maxWinStreak}`, 'green');
          print(`   Max Loss Streak: ${perf.streaks.maxLossStreak}`, 'red');
        }
      } else {
        results.errors.push('Metrics response missing paper_performance');
        print(`❌ Metrics response missing paper_performance`, 'red');
      }
      
      // Check decision metrics
      if (metrics.decisions) {
        print(`\n🎯 Decision Metrics:`, 'bright');
        print(`   Total Decisions: ${metrics.decisions.total}`, 'cyan');
        print(`   EXECUTE: ${metrics.decisions.by_action?.EXECUTE || 0}`, 'green');
        print(`   WAIT: ${metrics.decisions.by_action?.WAIT || 0}`, 'yellow');
        print(`   SKIP: ${metrics.decisions.by_action?.SKIP || 0}`, 'red');
      }
    }
    
  } catch (error) {
    results.errors.push(`Test execution error: ${error.message}`);
    print(`\n❌ Test execution error: ${error.message}`, 'red');
    console.error(error);
  }
  
  // Print summary
  printHeader('Test Results Summary');
  
  const checks = [
    { name: 'Webhooks Sent', passed: results.webhooksSent },
    { name: 'Decision Made', passed: results.decisionMade },
    { name: 'Paper Execution Created', passed: results.executionCreated },
    { name: 'Exit Simulated', passed: results.exitSimulated },
    { name: 'Metrics Calculated', passed: results.metricsCalculated }
  ];
  
  print('\n✓ Test Checks:', 'bright');
  checks.forEach(check => {
    const icon = check.passed ? '✅' : '❌';
    const color = check.passed ? 'green' : 'red';
    print(`  ${icon} ${check.name}`, color);
  });
  
  const passedChecks = checks.filter(c => c.passed).length;
  const totalChecks = checks.length;
  
  print(`\n📊 Score: ${passedChecks}/${totalChecks} checks passed`, passedChecks === totalChecks ? 'green' : 'yellow');
  
  if (results.errors.length > 0) {
    print(`\n⚠️  Errors (${results.errors.length}):`, 'yellow');
    results.errors.forEach((error, i) => {
      print(`  ${i + 1}. ${error}`, 'red');
    });
  }
  
  if (passedChecks === totalChecks && results.errors.length === 0) {
    print(`\n🎉 SUCCESS! Paper execution flow is working end-to-end!`, 'green');
    print(`   ✅ Webhooks → Decision → Paper Execution → Exit Simulation → Metrics`, 'green');
    return 0;
  } else {
    print(`\n⚠️  PARTIAL SUCCESS: Some checks failed`, 'yellow');
    print(`   Review the errors above and fix the issues`, 'yellow');
    return 1;
  }
}

// Run test
testPaperExecution()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    print(`\n❌ Test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
