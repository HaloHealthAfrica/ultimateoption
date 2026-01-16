/**
 * Test ledger append directly via test endpoint
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function test() {
  console.log('🔍 Testing ledger append via test endpoint...\n');
  
  const response = await fetch(`${BASE_URL}/api/admin/test-ledger-append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✅ SUCCESS! Ledger append worked!');
    console.log('   Entry ID:', data.entryId);
    console.log('   Symbol:', data.entry.signal.instrument.ticker);
    console.log('   Decision:', data.entry.decision);
  } else {
    console.log('❌ FAILED!');
    console.log('   Error:', data.error);
    console.log('   Error Type:', data.errorType);
    if (data.stack) {
      console.log('\n   Stack trace:');
      console.log(data.stack);
    }
    if (data.details) {
      console.log('\n   Details:', JSON.stringify(data.details, null, 2));
    }
  }
}

test();
