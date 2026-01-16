/**
 * Diagnose Database Connection
 * 
 * Tests if the database is connected and working
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function diagnose() {
  console.log('🔍 Diagnosing database connection...\n');
  
  // Test 1: Check if table exists
  console.log('1️⃣  Checking if ledger table exists...');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/create-ledger-table`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      console.log('   ✅ Table exists:', data.table);
    } else {
      console.log('   ❌ Error:', data.error);
    }
  } catch (e) {
    console.log('   ❌ Failed:', e.message);
  }
  
  console.log();
  
  // Test 2: Try to query decisions
  console.log('2️⃣  Querying decisions...');
  try {
    const res = await fetch(`${BASE_URL}/api/decisions?limit=5`);
    const data = await res.json();
    console.log('   ✅ Query successful');
    console.log('   📊 Total decisions:', data.data?.length || 0);
    if (data.data?.length > 0) {
      console.log('   Latest:', data.data[0].decision, 'at', new Date(data.data[0].created_at).toISOString());
    }
  } catch (e) {
    console.log('   ❌ Failed:', e.message);
  }
  
  console.log();
  
  // Test 3: Send webhook and check immediately
  console.log('3️⃣  Sending test webhook...');
  try {
    const res = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "signal": {
          "type": "LONG",
          "timeframe": "15",
          "quality": "EXTREME",
          "ai_score": 9.5,
          "timestamp": Date.now(),
          "bar_time": new Date().toISOString()
        },
        "instrument": {
          "ticker": "DIAG",
          "exchange": "NASDAQ",
          "current_price": 100
        }
      })
    });
    const data = await res.json();
    console.log('   ✅ Webhook processed');
    console.log('   Response:', data.message);
    if (data.decision) {
      console.log('   Decision:', data.decision.action);
    }
  } catch (e) {
    console.log('   ❌ Failed:', e.message);
  }
  
  console.log();
  
  // Test 4: Query again to see if data was stored
  console.log('4️⃣  Querying decisions again...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  try {
    const res = await fetch(`${BASE_URL}/api/decisions?limit=5&_t=${Date.now()}`);
    const data = await res.json();
    console.log('   ✅ Query successful');
    console.log('   📊 Total decisions:', data.data?.length || 0);
    if (data.data?.length > 0) {
      console.log('   Latest:', data.data[0].decision, 'for', data.data[0].signal?.instrument?.ticker);
    } else {
      console.log('   ⚠️  NO DATA - Decisions are not being stored!');
    }
  } catch (e) {
    console.log('   ❌ Failed:', e.message);
  }
  
  console.log();
  console.log('=' .repeat(60));
  console.log('📋 DIAGNOSIS COMPLETE');
  console.log('=' .repeat(60));
  console.log();
  console.log('If "NO DATA" above, the problem is:');
  console.log('  - Decisions are being made');
  console.log('  - But NOT being stored in database');
  console.log('  - Check Vercel function logs for errors');
  console.log();
}

diagnose();
