/**
 * Test Phase 2.5 Webhooks Directly
 * 
 * Tests the Phase 2.5 specific webhook endpoints
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPhase25Webhooks() {
  console.log('='.repeat(70));
  log('Testing Phase 2.5 Webhooks Directly', 'cyan');
  console.log('='.repeat(70));
  
  // Test 1: Send to Phase 2.5 SATY endpoint
  log('\n▶ Test 1: Phase 2.5 SATY Phase Webhook', 'cyan');
  
  const satyPayload = {
    meta: { engine: "SATY_PO" },
    instrument: { symbol: "SPY", exchange: "NASDAQ" },
    timeframe: { chart_tf: "15" },
    regime_context: { local_bias: "BULLISH" },
    oscillator_state: { value: 50 },
    confidence: { confidence_score: 85 }
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/saty-phase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(satyPayload)
    });
    
    const data = await response.json();
    
    log(`Status: ${response.status}`, response.status === 200 ? 'green' : 'red');
    log(`Engine Version: ${data.engineVersion}`, 'cyan');
    log(`Message: ${data.message}`, 'cyan');
    
    if (data.details) {
      console.log('Details:', JSON.stringify(data.details, null, 2));
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
  }
  
  await sleep(1000);
  
  // Test 2: Send to Phase 2.5 Signals endpoint
  log('\n▶ Test 2: Phase 2.5 Signals Webhook', 'cyan');
  
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
  
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signalPayload)
    });
    
    const data = await response.json();
    
    log(`Status: ${response.status}`, response.status === 200 ? 'green' : 'red');
    log(`Engine Version: ${data.engineVersion}`, 'cyan');
    
    if (data.decision) {
      log(`Decision: ${data.decision}`, 'cyan');
    }
    
    if (data.message) {
      log(`Message: ${data.message}`, 'cyan');
    }
    
    // Check ledger storage
    if (data.details) {
      if (data.details.ledgerStored === true) {
        log(`✅ Ledger Stored: true`, 'green');
      } else if (data.details.ledgerStored === false) {
        log(`❌ Ledger Stored: false`, 'red');
        if (data.details.ledgerError) {
          log(`   Error: ${data.details.ledgerError}`, 'red');
        }
      }
      
      if (data.details.contextUsed) {
        log(`Context Used:`, 'cyan');
        console.log(JSON.stringify(data.details.contextUsed, null, 2));
      }
    }
    
    console.log('\nFull Response:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
  }
  
  await sleep(2000);
  
  // Test 3: Check decisions API
  log('\n▶ Test 3: Check Decisions API', 'cyan');
  
  try {
    const response = await fetch(`${BASE_URL}/api/decisions?limit=5&_t=${Date.now()}`);
    const data = await response.json();
    
    log(`Status: ${response.status}`, 'cyan');
    log(`Decisions found: ${data.length}`, 'cyan');
    
    if (data.length > 0) {
      log('\nMost recent decision:', 'cyan');
      const latest = data[0];
      console.log(JSON.stringify({
        id: latest.id,
        symbol: latest.signal?.instrument?.ticker,
        decision: latest.decision,
        engine_version: latest.engine_version,
        created_at: latest.created_at
      }, null, 2));
      
      if (latest.engine_version === '2.5.0') {
        log('\n✅ Phase 2.5 decision found!', 'green');
      } else {
        log(`\n⚠️  Engine version: ${latest.engine_version} (not 2.5.0)`, 'yellow');
      }
    } else {
      log('\n⚠️  No decisions in database', 'yellow');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
  }
  
  console.log('\n' + '='.repeat(70));
}

testPhase25Webhooks().catch(console.error);
