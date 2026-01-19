/**
 * Phase 2.5 Paper Execution Test with Structure Data
 * 
 * This test includes STRAT_EXEC webhook to provide valid structure data,
 * which should help pass the structural gate even without market data.
 * 
 * Run with: node test-paper-with-structure.js
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
      'User-Agent': 'Phase25-Paper-Structure-Test/1.0'
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

async function testWithStructure() {
  printHeader('Phase 2.5 Paper Execution Test (With Structure Data)');
  
  try {
    // Step 1: Send SATY Phase
    print('\n📤 Step 1: Sending SATY Phase (95% confidence, LONG allowed)...', 'cyan');
    const satyResponse = await makeRequest('POST', '/api/phase25/webhooks/saty-phase', {
      "text": JSON.stringify({
        "meta": { "engine": "SATY_PO", "event_id": `test_${Date.now()}` },
        "instrument": { "symbol": "SPY" },
        "oscillator_state": { "value": 85.0 },
        "regime_context": { "local_bias": "BULLISH" },
        "confidence": { "confidence_score": 95 },
        "execution_guidance": { "trade_allowed": true, "allowed_directions": ["LONG"] }
      })
    });
    
    print(satyResponse.success ? '✅ SATY accepted' : '❌ SATY failed', satyResponse.success ? 'green' : 'red');
    await new Promise(r => setTimeout(r, 300));
    
    // Step 2: Send STRAT_EXEC (structure validation)
    print('\n📤 Step 2: Sending STRAT_EXEC (valid setup, A quality)...', 'cyan');
    const stratResponse = await makeRequest('POST', '/api/phase25/webhooks/strat-exec', {
      "symbol": "SPY",
      "setup_valid": true,
      "liquidity_ok": true,
      "quality": "A",
      "timestamp": Date.now()
    });
    
    print(stratResponse.success ? '✅ STRAT accepted' : '❌ STRAT failed', stratResponse.success ? 'green' : 'red');
    await new Promise(r => setTimeout(r, 300));
    
    // Step 3: Send Signal
    print('\n📤 Step 3: Sending Signal (LONG, EXTREME, AI 9.5)...', 'cyan');
    const signalResponse = await makeRequest('POST', '/api/phase25/webhooks/signals', {
      "signal": { "type": "LONG", "timeframe": "15", "quality": "EXTREME", "ai_score": 9.5 },
      "instrument": { "ticker": "SPY", "exchange": "NASDAQ", "current_price": 450.25 },
      "risk": { "rr_ratio_t1": 4.5, "rr_ratio_t2": 7.0 }
    });
    
    if (!signalResponse.success) {
      print('❌ Signal failed', 'red');
      console.log(signalResponse.data);
      return 1;
    }
    
    print('✅ Signal accepted', 'green');
    
    if (signalResponse.data.decision) {
      const dec = signalResponse.data.decision;
      print(`\n📊 Decision: ${dec.action}`, dec.action === 'EXECUTE' ? 'green' : 'yellow');
      print(`   Confidence: ${dec.confidenceScore}%`, 'cyan');
      print(`   Size: ${dec.finalSizeMultiplier}x`, 'cyan');
      print(`   Reasons: ${dec.reasons.join('; ')}`, 'magenta');
      
      if (dec.action !== 'EXECUTE') {
        print(`\n⚠️  Got ${dec.action} instead of EXECUTE`, 'yellow');
        print(`   This might be due to missing market data or low confidence`, 'yellow');
      }
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Step 4: Check ledger
    print('\n🔍 Step 4: Checking ledger...', 'cyan');
    const ledgerResponse = await makeRequest('GET', '/api/ledger?limit=5');
    
    if (!ledgerResponse.success) {
      print('❌ Ledger query failed', 'red');
      return 1;
    }
    
    const entries = ledgerResponse.data.data || [];
    print(`✅ Found ${entries.length} ledger entries`, 'green');
    
    const executeEntries = entries.filter(e => e.decision === 'EXECUTE');
    print(`   ${executeEntries.length} EXECUTE entries`, executeEntries.length > 0 ? 'green' : 'yellow');
    
    if (executeEntries.length > 0) {
      const entry = executeEntries[0];
      print(`\n📈 Latest EXECUTE Entry:`, 'bright');
      print(`   ID: ${entry.id}`, 'cyan');
      print(`   Symbol: ${entry.signal?.instrument?.symbol || 'N/A'}`, 'cyan');
      print(`   Confidence: ${entry.confluence_score}%`, 'cyan');
      
      if (entry.execution) {
        print(`\n   ✅ Has Execution Data:`, 'green');
        print(`      Type: ${entry.execution.option_type}`, 'cyan');
        print(`      Strike: $${entry.execution.strike}`, 'cyan');
        print(`      Contracts: ${entry.execution.filled_contracts}`, 'cyan');
        print(`      Entry: $${entry.execution.entry_price.toFixed(2)}`, 'cyan');
        print(`      DTE: ${entry.execution.dte}`, 'cyan');
      } else {
        print(`   ❌ Missing Execution Data`, 'red');
      }
      
      if (entry.exit) {
        print(`\n   ✅ Has Exit Data:`, 'green');
        print(`      Exit Price: $${entry.exit.exit_price.toFixed(2)}`, 'cyan');
        print(`      P&L Net: $${entry.exit.pnl_net.toFixed(2)}`, entry.exit.pnl_net > 0 ? 'green' : 'red');
        print(`      Reason: ${entry.exit.exit_reason}`, 'cyan');
        print(`      Hold Time: ${Math.floor(entry.exit.hold_time_seconds / 60)}m`, 'cyan');
      } else {
        print(`   ⚠️  No Exit Data (might be open position)`, 'yellow');
      }
    }
    
    // Step 5: Check metrics
    print('\n📊 Step 5: Checking metrics...', 'cyan');
    const metricsResponse = await makeRequest('GET', '/api/phase25/webhooks/metrics');
    
    if (metricsResponse.success && metricsResponse.data.paper_performance) {
      const perf = metricsResponse.data.paper_performance;
      print(`✅ Paper performance available`, 'green');
      print(`   Sample Size: ${perf.sample_size}`, 'cyan');
      if (perf.overall) {
        print(`   Total P&L: $${perf.overall.total_pnl?.toFixed(2) || 'N/A'}`, 'cyan');
        print(`   Win Rate: ${((perf.overall.win_rate || 0) * 100).toFixed(1)}%`, 'cyan');
      }
    } else {
      print(`⚠️  Metrics not available`, 'yellow');
    }
    
    // Summary
    printHeader('Test Summary');
    
    const hasExecute = executeEntries.length > 0;
    const hasExecution = hasExecute && executeEntries[0].execution;
    const hasExit = hasExecute && executeEntries[0].exit;
    
    print(`\n✓ Results:`, 'bright');
    print(`  ${hasExecute ? '✅' : '❌'} EXECUTE decision created`, hasExecute ? 'green' : 'red');
    print(`  ${hasExecution ? '✅' : '❌'} Paper execution simulated`, hasExecution ? 'green' : 'red');
    print(`  ${hasExit ? '✅' : '❌'} Exit simulated`, hasExit ? 'green' : 'red');
    
    if (hasExecute && hasExecution && hasExit) {
      print(`\n🎉 SUCCESS! Complete paper trading flow working!`, 'green');
      return 0;
    } else if (hasExecute && hasExecution) {
      print(`\n✅ PARTIAL SUCCESS: Execution working, exit might be pending`, 'yellow');
      return 0;
    } else {
      print(`\n⚠️  INCOMPLETE: Check logs for issues`, 'yellow');
      print(`   Likely cause: Market data unavailable or confidence too low`, 'yellow');
      return 1;
    }
    
  } catch (error) {
    print(`\n❌ Test error: ${error.message}`, 'red');
    console.error(error);
    return 1;
  }
}

testWithStructure()
  .then(code => process.exit(code))
  .catch(err => {
    print(`\n❌ Fatal error: ${err.message}`, 'red');
    process.exit(1);
  });
