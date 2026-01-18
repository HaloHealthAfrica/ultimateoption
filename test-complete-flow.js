/**
 * Test Complete Flow - Webhook to Database
 */

const BASE_URL = 'http://localhost:3000';

async function testCompleteFlow() {
  console.log('='.repeat(70));
  console.log('Testing Complete Flow: Webhook → Decision → Database');
  console.log('='.repeat(70));
  
  // Step 1: Check initial state
  console.log('\n1️⃣  Checking initial database state...');
  const before = await fetch(`${BASE_URL}/api/decisions?limit=1`);
  const beforeData = await before.json();
  const beforeCount = beforeData.data?.length || 0;
  console.log(`   Current decisions: ${beforeCount}`);
  
  // Step 2: Send webhook with complete data
  console.log('\n2️⃣  Sending Phase 2.5 signal webhook...');
  
  const payload = {
    signal: {
      type: 'LONG',
      timeframe: '15',
      quality: 'EXTREME',
      ai_score: 9.5
    },
    instrument: {
      ticker: 'TSLA',
      exchange: 'NASDAQ',
      current_price: 250.75
    },
    risk: {
      rr_ratio_t1: 3.5,
      rr_ratio_t2: 5.0
    },
    entry: {
      price: 250.75,
      stop_loss: 245.00,
      target_1: 258.00,
      target_2: 265.00
    }
  };
  
  const response = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  
  console.log(`   Status: ${response.status}`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Message: ${result.message}`);
  
  if (result.decision) {
    console.log(`   Decision Action: ${result.decision.action}`);
    console.log(`   Decision Direction: ${result.decision.direction}`);
    console.log(`   Confidence: ${result.decision.confidenceScore}`);
  }
  
  if (result.details) {
    console.log(`   Ledger Stored: ${result.details.ledgerStored}`);
    if (result.details.ledgerError) {
      console.log(`   Ledger Error: ${result.details.ledgerError}`);
    }
  }
  
  // Step 3: Wait a moment for database write
  console.log('\n3️⃣  Waiting 2 seconds for database write...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 4: Check database again
  console.log('\n4️⃣  Checking database...');
  const after = await fetch(`${BASE_URL}/api/decisions?limit=5&_t=${Date.now()}`);
  const afterData = await after.json();
  const afterCount = afterData.data?.length || 0;
  
  console.log(`   Decisions now: ${afterCount}`);
  
  if (afterCount > beforeCount) {
    console.log(`\n   ✅ SUCCESS! ${afterCount - beforeCount} new decision(s) added!`);
    
    const latest = afterData.data[0];
    console.log('\n   Latest decision:');
    console.log(`   - ID: ${latest.id}`);
    console.log(`   - Symbol: ${latest.signal?.instrument?.ticker}`);
    console.log(`   - Decision: ${latest.decision}`);
    console.log(`   - Engine: ${latest.engine_version}`);
    console.log(`   - Price: $${latest.signal?.instrument?.current_price}`);
    console.log(`   - Created: ${latest.created_at}`);
  } else {
    console.log('\n   ❌ No new decisions added');
    console.log('\n   Debugging info:');
    console.log(`   - Webhook response success: ${result.success}`);
    console.log(`   - Ledger stored: ${result.details?.ledgerStored}`);
    console.log(`   - Ledger error: ${result.details?.ledgerError || 'none'}`);
  }
  
  // Step 5: Check ledger directly
  console.log('\n5️⃣  Checking ledger API...');
  try {
    const ledgerResponse = await fetch(`${BASE_URL}/api/ledger?limit=5`);
    const ledgerData = await ledgerResponse.json();
    console.log(`   Ledger entries: ${ledgerData.length || 0}`);
    
    if (ledgerData.length > 0) {
      const latest = ledgerData[0];
      console.log(`   Latest entry: ${latest.signal?.instrument?.ticker} - ${latest.decision}`);
    }
  } catch (error) {
    console.log(`   Could not check ledger: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(70));
}

testCompleteFlow().catch(console.error);
