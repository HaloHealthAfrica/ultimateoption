/**
 * Diagnose Phase 2.5 Routing Issue
 * 
 * Checks:
 * 1. Which webhook endpoints are receiving traffic
 * 2. Whether Phase 2.5 endpoints exist and are accessible
 * 3. Context store completeness requirements
 * 4. Why only 2 decisions on Phase 2.5 dashboard
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function checkWebhookStats() {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 1: Check Webhook Statistics');
  console.log('='.repeat(70));
  
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/stats`);
    const stats = await response.json();
    
    if (!stats.success) {
      console.log('❌ Failed to get webhook stats:', stats.error);
      return null;
    }
    
    console.log('\n📊 Total Webhooks:');
    console.log(`  Total: ${stats.totals.total}`);
    console.log(`  Successful: ${stats.totals.successful} (${(stats.totals.successful / stats.totals.total * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${stats.totals.failed} (${(stats.totals.failed / stats.totals.total * 100).toFixed(1)}%)`);
    
    console.log('\n📈 By Kind and Status:');
    const byKind = {};
    stats.by_kind_and_status.forEach(row => {
      if (!byKind[row.kind]) {
        byKind[row.kind] = { successful: 0, failed: 0 };
      }
      if (row.ok) {
        byKind[row.kind].successful = parseInt(row.count);
      } else {
        byKind[row.kind].failed = parseInt(row.count);
      }
    });
    
    Object.entries(byKind).forEach(([kind, counts]) => {
      const total = counts.successful + counts.failed;
      const successRate = (counts.successful / total * 100).toFixed(1);
      console.log(`  ${kind}:`);
      console.log(`    ✓ Successful: ${counts.successful}`);
      console.log(`    ✗ Failed: ${counts.failed}`);
      console.log(`    Success Rate: ${successRate}%`);
    });
    
    return stats;
  } catch (error) {
    console.error('❌ Error fetching webhook stats:', error.message);
    return null;
  }
}

async function checkPhase25Endpoints() {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 2: Check Phase 2.5 Endpoints');
  console.log('='.repeat(70));
  
  const endpoints = [
    '/api/phase25/webhooks/signals',
    '/api/phase25/webhooks/saty-phase',
    '/api/phase25/webhooks/health'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET'
      });
      
      const status = response.status;
      const statusText = response.statusText;
      
      if (status === 405) {
        console.log(`✓ ${endpoint} - EXISTS (Method Not Allowed for GET, expects POST)`);
      } else if (status === 200) {
        console.log(`✓ ${endpoint} - EXISTS and responds to GET`);
      } else {
        console.log(`⚠ ${endpoint} - Status ${status} ${statusText}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - NOT ACCESSIBLE: ${error.message}`);
    }
  }
}

async function testPhase25SignalWebhook() {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 3: Test Phase 2.5 Signal Webhook');
  console.log('='.repeat(70));
  
  const testPayload = {
    ticker: 'SPY',
    trend: 'BULLISH',
    score: 8.5,
    timeframe: '15'
  };
  
  console.log('\n📤 Sending test signal to Phase 2.5 endpoint...');
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    console.log(`\n📥 Response (${response.status}):`);
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✓ Webhook processed successfully');
      console.log(`  Message: ${result.message}`);
      if (result.decision) {
        console.log(`  Decision: ${result.decision.decision}`);
      } else {
        console.log(`  ⚠ No decision made (likely waiting for complete context)`);
      }
    } else {
      console.log('\n❌ Webhook processing failed');
      console.log(`  Message: ${result.message}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error testing Phase 2.5 webhook:', error.message);
    return null;
  }
}

async function testPhase25SatyWebhook() {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 4: Test Phase 2.5 SATY Webhook');
  console.log('='.repeat(70));
  
  const testPayload = {
    symbol: 'SPY',
    timeframe: '15',
    bias: 'BULLISH',
    oscillator_value: 50
  };
  
  console.log('\n📤 Sending test SATY phase to Phase 2.5 endpoint...');
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/saty-phase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    console.log(`\n📥 Response (${response.status}):`);
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✓ Webhook processed successfully');
      console.log(`  Message: ${result.message}`);
      if (result.decision) {
        console.log(`  Decision: ${result.decision.decision}`);
      } else {
        console.log(`  ⚠ No decision made (likely waiting for complete context)`);
      }
    } else {
      console.log('\n❌ Webhook processing failed');
      console.log(`  Message: ${result.message}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error testing Phase 2.5 webhook:', error.message);
    return null;
  }
}

async function checkPhase25Health() {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 5: Check Phase 2.5 Health');
  console.log('='.repeat(70));
  
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/health/detailed`);
    const health = await response.json();
    
    console.log('\n🏥 Phase 2.5 Health Status:');
    console.log(JSON.stringify(health, null, 2));
    
    return health;
  } catch (error) {
    console.error('❌ Error checking Phase 2.5 health:', error.message);
    return null;
  }
}

async function analyzeRootCause() {
  console.log('\n' + '='.repeat(70));
  console.log('ROOT CAUSE ANALYSIS');
  console.log('='.repeat(70));
  
  console.log('\n🔍 Key Questions:');
  console.log('\n1. Are webhooks going to Phase 2 or Phase 2.5 endpoints?');
  console.log('   - Phase 2: /api/webhooks/signals, /api/webhooks/saty-phase');
  console.log('   - Phase 2.5: /api/phase25/webhooks/signals, /api/phase25/webhooks/saty-phase');
  console.log('   ⚠ HYPOTHESIS: Webhooks are going to Phase 2, NOT Phase 2.5!');
  
  console.log('\n2. What are Phase 2.5 completeness requirements?');
  console.log('   - Required: SATY_PHASE');
  console.log('   - Required: At least one expert source (ULTIMATE_OPTIONS or TRADINGVIEW_SIGNAL)');
  console.log('   - Optional: MTF_DOTS, STRAT_EXEC');
  console.log('   - Timeout: 15 minutes (configurable)');
  console.log('   ⚠ HYPOTHESIS: Context rarely becomes complete!');
  
  console.log('\n3. Why only 2 decisions on Phase 2.5 dashboard?');
  console.log('   - Possibility A: Webhooks not routed to Phase 2.5 endpoints');
  console.log('   - Possibility B: Context never becomes complete (missing sources)');
  console.log('   - Possibility C: Decisions made but not displayed on dashboard');
  
  console.log('\n💡 RECOMMENDED FIXES:');
  console.log('   1. Route webhooks to Phase 2.5 endpoints instead of Phase 2');
  console.log('   2. OR: Make Phase 2 endpoints also update Phase 2.5 context store');
  console.log('   3. Relax completeness requirements (only require SATY_PHASE + one signal)');
  console.log('   4. Add logging to track context completeness');
}

async function runDiagnostics() {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 2.5 ROUTING DIAGNOSTICS');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  // Run all checks
  await checkWebhookStats();
  await checkPhase25Endpoints();
  await testPhase25SignalWebhook();
  
  // Small delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testPhase25SatyWebhook();
  await checkPhase25Health();
  await analyzeRootCause();
  
  console.log('\n' + '='.repeat(70));
  console.log('DIAGNOSTICS COMPLETE');
  console.log('='.repeat(70));
}

// Run diagnostics
runDiagnostics().catch(console.error);
