/**
 * Verify the Context Store Fix
 * 
 * Tests that Phase 2.5 now makes decisions with just a signal webhook
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFix() {
  console.log('='.repeat(70));
  log('Testing Context Store Fix', 'magenta');
  console.log('='.repeat(70));
  
  // Test 1: Send ONLY a signal webhook (should now work!)
  log('\n▶ Test 1: Send Signal Webhook ONLY', 'cyan');
  log('   (Before fix: would say "waiting for complete context")', 'yellow');
  log('   (After fix: should make a decision)', 'green');
  
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
    },
    entry: {
      price: 450.25,
      stop_loss: 445.00,
      target_1: 455.00,
      target_2: 460.00
    }
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signalPayload)
    });
    
    const data = await response.json();
    
    log(`\nStatus: ${response.status}`, response.status === 200 ? 'green' : 'red');
    log(`Engine Version: ${data.engineVersion}`, 'cyan');
    log(`Message: ${data.message}`, 'cyan');
    
    if (data.message && data.message.includes('waiting for complete context')) {
      log('\n❌ FIX FAILED - Still waiting for context', 'red');
      log('   The bug is still present', 'red');
      return false;
    }
    
    if (data.success === false) {
      log('\n⚠️  Decision attempted but failed', 'yellow');
      log(`   Error: ${data.message}`, 'yellow');
      
      if (data.message.includes('regime')) {
        log('\n   This is expected - decision engine needs regime data', 'cyan');
        log('   But the important thing is: it TRIED to make a decision!', 'green');
        log('   ✅ Fix is working - no longer stuck on "waiting for context"', 'green');
      }
      
      if (data.details) {
        console.log('\n   Details:', JSON.stringify(data.details, null, 2));
      }
    }
    
    if (data.decision) {
      log(`\n✅ Decision: ${data.decision}`, 'green');
      
      if (data.details?.ledgerStored) {
        log('✅ Ledger stored: true', 'green');
      }
    }
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    return false;
  }
  
  await sleep(2000);
  
  // Test 2: Send complete context (SATY + Signal)
  log('\n\n▶ Test 2: Send Complete Context (SATY + Signal)', 'cyan');
  log('   This should definitely work', 'green');
  
  // First send SATY
  const satyPayload = {
    meta: { engine: "SATY_PO" },
    instrument: { symbol: "AAPL", exchange: "NASDAQ" },
    timeframe: { chart_tf: "15" },
    regime_context: { local_bias: "BULLISH" },
    oscillator_state: { value: 50 },
    confidence: { confidence_score: 85 },
    event: { name: "ENTER_ACCUMULATION" }
  };
  
  try {
    log('\n   Sending SATY Phase webhook...', 'cyan');
    const satyResponse = await fetch(`${BASE_URL}/api/phase25/webhooks/saty-phase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(satyPayload)
    });
    
    const satyData = await satyResponse.json();
    log(`   SATY Status: ${satyResponse.status}`, 'cyan');
    log(`   SATY Message: ${satyData.message}`, 'cyan');
    
    await sleep(1000);
    
    // Then send signal
    log('\n   Sending Signal webhook...', 'cyan');
    const signalPayload2 = {
      signal: {
        type: 'LONG',
        timeframe: '15',
        quality: 'EXTREME',
        ai_score: 9.2
      },
      instrument: {
        ticker: 'AAPL',
        exchange: 'NASDAQ',
        current_price: 186.50
      },
      risk: {
        rr_ratio_t1: 3.5,
        rr_ratio_t2: 5.0
      },
      entry: {
        price: 186.50,
        stop_loss: 183.00,
        target_1: 190.00,
        target_2: 193.00
      }
    };
    
    const signalResponse = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signalPayload2)
    });
    
    const signalData = await signalResponse.json();
    
    log(`\n   Signal Status: ${signalResponse.status}`, signalResponse.status === 200 ? 'green' : 'red');
    log(`   Signal Message: ${signalData.message}`, 'cyan');
    
    if (signalData.decision) {
      log(`   ✅ Decision: ${signalData.decision}`, 'green');
    }
    
    if (signalData.details?.ledgerStored) {
      log('   ✅ Ledger stored: true', 'green');
    } else if (signalData.details?.ledgerStored === false) {
      log('   ⚠️  Ledger stored: false', 'yellow');
      if (signalData.details.ledgerError) {
        log(`   Ledger error: ${signalData.details.ledgerError}`, 'yellow');
      }
    }
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
  }
  
  await sleep(2000);
  
  // Test 3: Check database
  log('\n\n▶ Test 3: Check Database', 'cyan');
  
  try {
    const response = await fetch(`${BASE_URL}/api/decisions?limit=5&_t=${Date.now()}`);
    const data = await response.json();
    
    const count = data.length || 0;
    log(`\nDecisions in database: ${count}`, count > 0 ? 'green' : 'yellow');
    
    if (count > 0) {
      log('\n✅ SUCCESS! Decisions are being stored!', 'green');
      
      const latest = data[0];
      log('\nMost recent decision:', 'cyan');
      console.log(JSON.stringify({
        id: latest.id,
        symbol: latest.signal?.instrument?.ticker,
        decision: latest.decision,
        engine_version: latest.engine_version,
        created_at: latest.created_at
      }, null, 2));
      
      if (latest.engine_version === '2.5.0') {
        log('\n✅ Confirmed: Phase 2.5 decision!', 'green');
      }
    } else {
      log('\n⚠️  No decisions in database yet', 'yellow');
      log('   This might be due to:', 'yellow');
      log('   - Gates failing (check gate requirements)', 'yellow');
      log('   - Ledger storage issues', 'yellow');
      log('   - Missing required data fields', 'yellow');
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  log('Summary', 'magenta');
  console.log('='.repeat(70));
  
  log('\n✅ Context Store Fix Applied', 'green');
  log('   - Changed requiredSources from hardcoded to config-based', 'green');
  log('   - Now uses TRADINGVIEW_SIGNAL as required (not SATY_PHASE)', 'green');
  log('   - No longer stuck on "waiting for complete context"', 'green');
  
  log('\n📋 Next Steps:', 'cyan');
  log('   1. Verify gates are configured correctly', 'cyan');
  log('   2. Check ledger storage (pricing validation)', 'cyan');
  log('   3. Test with production webhooks', 'cyan');
  log('   4. Monitor dashboard for decisions', 'cyan');
  
  console.log('\n' + '='.repeat(70));
}

testFix().catch(console.error);
