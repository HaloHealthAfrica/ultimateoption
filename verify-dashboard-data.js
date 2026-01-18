/**
 * Verify Dashboard Data Script
 * 
 * Sends test webhooks and verifies they appear on the Phase 2.5 dashboard
 * Run with: node verify-dashboard-data.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'cyan');
  console.log('='.repeat(70));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a webhook
 */
async function sendWebhook(endpoint, payload) {
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dashboard-Verification/1.0'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    return {
      status: response.status,
      data
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message
    };
  }
}

/**
 * Query decisions API
 */
async function getDecisions(limit = 10) {
  const url = `${BASE_URL}/api/decisions?limit=${limit}&_t=${Date.now()}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      status: response.status,
      data
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message
    };
  }
}

/**
 * Main verification flow
 */
async function verifyDashboard() {
  console.log('='.repeat(70));
  log('Phase 2.5 Dashboard Data Verification', 'magenta');
  console.log('='.repeat(70));
  log(`Base URL: ${BASE_URL}`, 'cyan');
  log(`Timestamp: ${new Date().toISOString()}`, 'cyan');
  
  // Step 1: Check current dashboard state
  logSection('Step 1: Check Current Dashboard State');
  log('Querying /api/decisions...', 'blue');
  
  const beforeDecisions = await getDecisions(5);
  
  if (beforeDecisions.error) {
    log(`❌ Error: ${beforeDecisions.error}`, 'red');
    return;
  }
  
  if (beforeDecisions.status !== 200) {
    log(`❌ HTTP ${beforeDecisions.status}`, 'red');
    return;
  }
  
  const beforeCount = beforeDecisions.data.length || 0;
  log(`✅ Current decisions in database: ${beforeCount}`, 'green');
  
  if (beforeCount > 0) {
    log('\nMost recent decision:', 'cyan');
    const latest = beforeDecisions.data[0];
    console.log(JSON.stringify({
      id: latest.id,
      symbol: latest.signal?.instrument?.ticker,
      decision: latest.decision,
      engine_version: latest.engine_version,
      created_at: latest.created_at
    }, null, 2));
  }
  
  // Step 2: Send SATY Phase webhook
  logSection('Step 2: Send SATY Phase Webhook');
  
  const satyPayload = {
    meta: {
      engine: "SATY_PO",
      event_type: "REGIME_PHASE_ENTRY"
    },
    instrument: {
      symbol: "SPY",
      exchange: "NASDAQ"
    },
    timeframe: {
      chart_tf: "15"
    },
    regime_context: {
      local_bias: "BULLISH"
    },
    oscillator_state: {
      value: 50
    },
    confidence: {
      confidence_score: 85
    }
  };
  
  log('Sending SATY Phase webhook...', 'blue');
  const satyResponse = await sendWebhook('/api/webhooks/saty-phase', satyPayload);
  
  if (satyResponse.error) {
    log(`❌ Error: ${satyResponse.error}`, 'red');
  } else if (satyResponse.status === 200) {
    log(`✅ HTTP ${satyResponse.status} - SATY Phase webhook accepted`, 'green');
    if (satyResponse.data.message) {
      log(`   Message: ${satyResponse.data.message}`, 'cyan');
    }
  } else {
    log(`❌ HTTP ${satyResponse.status}`, 'red');
    console.log(satyResponse.data);
  }
  
  await sleep(1000);
  
  // Step 3: Send Trend webhook
  logSection('Step 3: Send Trend Webhook');
  
  const trendPayload = {
    text: JSON.stringify({
      ticker: "SPY",
      exchange: "NASDAQ",
      timestamp: new Date().toISOString(),
      price: 450.50,
      timeframes: {
        tf15min: { direction: "bullish", open: 449.00, close: 450.50 },
        tf60min: { direction: "bullish", open: 447.50, close: 450.50 }
      }
    })
  };
  
  log('Sending Trend webhook...', 'blue');
  const trendResponse = await sendWebhook('/api/webhooks/trend', trendPayload);
  
  if (trendResponse.error) {
    log(`❌ Error: ${trendResponse.error}`, 'red');
  } else if (trendResponse.status === 200) {
    log(`✅ HTTP ${trendResponse.status} - Trend webhook accepted`, 'green');
  } else {
    log(`❌ HTTP ${trendResponse.status}`, 'red');
    console.log(trendResponse.data);
  }
  
  await sleep(1000);
  
  // Step 4: Send Signal webhook (should trigger decision)
  logSection('Step 4: Send Signal Webhook (Trigger Decision)');
  
  const signalPayload = {
    signal: {
      type: 'LONG',
      timeframe: '15',
      quality: 'EXTREME',
      ai_score: 9.2
    },
    instrument: {
      ticker: 'SPY',
      exchange: 'NASDAQ',
      current_price: 450.25
    },
    risk: {
      rr_ratio_t1: 3.5,
      rr_ratio_t2: 5.0
    }
  };
  
  log('Sending Signal webhook...', 'blue');
  const signalResponse = await sendWebhook('/api/webhooks/signals', signalPayload);
  
  if (signalResponse.error) {
    log(`❌ Error: ${signalResponse.error}`, 'red');
  } else if (signalResponse.status === 200) {
    log(`✅ HTTP ${signalResponse.status} - Signal webhook accepted`, 'green');
    
    if (signalResponse.data.decision) {
      log(`   Decision: ${signalResponse.data.decision}`, 'cyan');
    }
    
    if (signalResponse.data.engine_version) {
      log(`   Engine Version: ${signalResponse.data.engine_version}`, 'cyan');
    }
    
    // Check ledger storage
    if (signalResponse.data.details) {
      if (signalResponse.data.details.ledgerStored === true) {
        log(`   ✅ Ledger Stored: true`, 'green');
      } else if (signalResponse.data.details.ledgerStored === false) {
        log(`   ❌ Ledger Stored: false`, 'red');
        if (signalResponse.data.details.ledgerError) {
          log(`   Ledger Error: ${signalResponse.data.details.ledgerError}`, 'red');
        }
      }
    }
    
    // Check gates
    if (signalResponse.data.gates) {
      const passed = signalResponse.data.gates.passed?.length || 0;
      const failed = signalResponse.data.gates.failed?.length || 0;
      log(`   Gates: ${passed} passed, ${failed} failed`, 'cyan');
    }
  } else {
    log(`❌ HTTP ${signalResponse.status}`, 'red');
    console.log(signalResponse.data);
  }
  
  // Step 5: Wait and check dashboard again
  logSection('Step 5: Verify Data on Dashboard');
  log('Waiting 2 seconds for data to propagate...', 'yellow');
  await sleep(2000);
  
  log('Querying /api/decisions again...', 'blue');
  const afterDecisions = await getDecisions(5);
  
  if (afterDecisions.error) {
    log(`❌ Error: ${afterDecisions.error}`, 'red');
    return;
  }
  
  if (afterDecisions.status !== 200) {
    log(`❌ HTTP ${afterDecisions.status}`, 'red');
    return;
  }
  
  const afterCount = afterDecisions.data.length || 0;
  log(`✅ Decisions in database now: ${afterCount}`, 'green');
  
  // Check if new decision was added
  const newDecisions = afterCount - beforeCount;
  if (newDecisions > 0) {
    log(`\n🎉 SUCCESS! ${newDecisions} new decision(s) added to dashboard!`, 'green');
    
    // Show the new decision
    log('\nNew decision details:', 'cyan');
    const latest = afterDecisions.data[0];
    console.log(JSON.stringify({
      id: latest.id,
      symbol: latest.signal?.instrument?.ticker,
      decision: latest.decision,
      engine_version: latest.engine_version,
      price: latest.signal?.instrument?.current_price,
      created_at: latest.created_at,
      gates_passed: latest.gates?.passed?.length,
      gates_failed: latest.gates?.failed?.length
    }, null, 2));
    
    // Check if it's Phase 2.5
    if (latest.engine_version === '2.5.0') {
      log('\n✅ Confirmed: This is a Phase 2.5 decision!', 'green');
    } else if (latest.engine_version === '2.0.0') {
      log('\n⚠️  Note: This is a Phase 2.0 decision, not Phase 2.5', 'yellow');
    }
  } else {
    log('\n⚠️  WARNING: No new decisions added to dashboard', 'yellow');
    log('This could mean:', 'yellow');
    log('  - Decision was rejected (check gates)', 'yellow');
    log('  - Ledger storage failed', 'yellow');
    log('  - Database connection issue', 'yellow');
  }
  
  // Step 6: Check Phase 2.5 specific endpoint
  logSection('Step 6: Check Phase 2.5 Context Status');
  
  try {
    const contextUrl = `${BASE_URL}/api/phase25/context/status`;
    log(`Querying ${contextUrl}...`, 'blue');
    
    const contextResponse = await fetch(contextUrl);
    const contextData = await contextResponse.json();
    
    if (contextResponse.status === 200) {
      log('✅ Phase 2.5 context endpoint responding', 'green');
      
      if (contextData.symbols) {
        const symbolCount = Object.keys(contextData.symbols).length;
        log(`   Symbols in context: ${symbolCount}`, 'cyan');
        
        if (contextData.symbols.SPY) {
          log('   ✅ SPY context found', 'green');
          const spy = contextData.symbols.SPY;
          if (spy.satyPhase) log('      - SATY Phase: present', 'cyan');
          if (spy.trend) log('      - Trend: present', 'cyan');
          if (spy.signal) log('      - Signal: present', 'cyan');
        }
      }
    } else {
      log(`⚠️  HTTP ${contextResponse.status}`, 'yellow');
    }
  } catch (error) {
    log(`⚠️  Could not check Phase 2.5 context: ${error.message}`, 'yellow');
  }
  
  // Final summary
  logSection('Summary');
  
  if (newDecisions > 0) {
    log('✅ VERIFICATION PASSED', 'green');
    log('   - Webhooks are being processed', 'green');
    log('   - Data is being stored in database', 'green');
    log('   - Decisions appear on dashboard', 'green');
    log('\n📊 View dashboard at:', 'cyan');
    log(`   ${BASE_URL}`, 'cyan');
  } else {
    log('⚠️  VERIFICATION INCOMPLETE', 'yellow');
    log('   - Webhooks processed successfully', 'yellow');
    log('   - But no new decisions in database', 'yellow');
    log('   - Check ledger storage and gates', 'yellow');
  }
  
  console.log('\n' + '='.repeat(70));
}

// Run verification
verifyDashboard().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
