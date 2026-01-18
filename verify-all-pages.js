/**
 * Verify All Pages Are Working
 */

const BASE_URL = 'http://localhost:3000';

async function verifyAllPages() {
  console.log('='.repeat(70));
  console.log('🔍 Verifying All Pages');
  console.log('='.repeat(70));
  console.log();
  
  const results = [];
  
  // 1. Check Phase 2.5 Dashboard
  console.log('1️⃣  Phase 2.5 Dashboard...');
  try {
    const response = await fetch(`${BASE_URL}/api/decisions?limit=5`);
    const data = await response.json();
    const count = data.pagination?.total || 0;
    
    if (count > 0) {
      console.log(`   ✅ ${count} decisions found`);
      console.log(`   Latest: ${data.data[0]?.signal?.instrument?.ticker} - ${data.data[0]?.decision}`);
      results.push({ page: 'Phase 2.5 Dashboard', status: 'OK', count });
    } else {
      console.log('   ⚠️  No decisions (run: node send-10-test-signals.js)');
      results.push({ page: 'Phase 2.5 Dashboard', status: 'EMPTY', count: 0 });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.push({ page: 'Phase 2.5 Dashboard', status: 'ERROR' });
  }
  
  console.log();
  
  // 2. Check Webhook Receipts Page
  console.log('2️⃣  Webhook Receipts Page...');
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/recent?limit=5`);
    const data = await response.json();
    const count = data.entries?.length || 0;
    
    if (count > 0) {
      console.log(`   ✅ ${count} webhook receipts found`);
      console.log(`   Latest: ${data.entries[0]?.kind} - ${data.entries[0]?.ticker || 'N/A'}`);
      results.push({ page: 'Webhook Receipts', status: 'OK', count });
    } else {
      console.log('   ⚠️  No webhooks (run: node send-10-test-signals.js)');
      results.push({ page: 'Webhook Receipts', status: 'EMPTY', count: 0 });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.push({ page: 'Webhook Receipts', status: 'ERROR' });
  }
  
  console.log();
  
  // 3. Check Webhook Stats
  console.log('3️⃣  Webhook Stats...');
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/stats`);
    const data = await response.json();
    
    if (data.summary) {
      console.log(`   ✅ Stats available`);
      console.log(`   Total: ${data.summary.total}, Success: ${data.summary.successful}`);
      results.push({ page: 'Webhook Stats', status: 'OK' });
    } else {
      console.log('   ⚠️  No stats yet');
      results.push({ page: 'Webhook Stats', status: 'EMPTY' });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.push({ page: 'Webhook Stats', status: 'ERROR' });
  }
  
  console.log();
  
  // 4. Check Phase 2.5 Health
  console.log('4️⃣  Phase 2.5 Health...');
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/health`);
    const data = await response.json();
    
    if (data.engine) {
      console.log(`   ✅ ${data.engine} v${data.version}`);
      console.log(`   Uptime: ${(data.uptime / 3600).toFixed(1)} hours`);
      results.push({ page: 'Phase 2.5 Health', status: 'OK' });
    } else {
      console.log('   ⚠️  Health check returned unexpected data');
      results.push({ page: 'Phase 2.5 Health', status: 'WARNING' });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.push({ page: 'Phase 2.5 Health', status: 'ERROR' });
  }
  
  console.log();
  
  // 5. Check Main Dashboard
  console.log('5️⃣  Main Dashboard Page...');
  try {
    const response = await fetch(`${BASE_URL}/`);
    
    if (response.ok) {
      console.log(`   ✅ Dashboard accessible (HTTP ${response.status})`);
      results.push({ page: 'Main Dashboard', status: 'OK' });
    } else {
      console.log(`   ⚠️  HTTP ${response.status}`);
      results.push({ page: 'Main Dashboard', status: 'WARNING' });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.push({ page: 'Main Dashboard', status: 'ERROR' });
  }
  
  // Summary
  console.log();
  console.log('='.repeat(70));
  console.log('📊 Summary');
  console.log('='.repeat(70));
  console.log();
  
  const ok = results.filter(r => r.status === 'OK').length;
  const empty = results.filter(r => r.status === 'EMPTY').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Working: ${ok}`);
  console.log(`⚠️  Empty: ${empty}`);
  console.log(`❌ Errors: ${errors}`);
  console.log();
  
  if (errors === 0) {
    console.log('🎉 All pages are functional!');
    console.log();
    console.log('Pages to view:');
    console.log(`  1. Main Dashboard: ${BASE_URL}`);
    console.log(`  2. Phase 2.5 Tab: ${BASE_URL} (click "Phase 2.5")`);
    console.log(`  3. Webhooks Tab: ${BASE_URL} (click "Webhooks" → "Receipts")`);
    console.log(`  4. Stats: ${BASE_URL} (click "Webhooks" → "Stats")`);
    console.log();
  } else {
    console.log('⚠️  Some pages have errors. Check the details above.');
    console.log();
  }
  
  console.log('='.repeat(70));
}

verifyAllPages().catch(console.error);
