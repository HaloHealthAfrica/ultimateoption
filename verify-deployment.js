/**
 * Post-Deployment Verification Script
 * Run this after deploying Week 1 stabilization fixes
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function verifyDeployment() {
  console.log('🔍 Post-Deployment Verification\n');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Dashboard API
  console.log('\n1️⃣  Testing /api/decisions endpoint...');
  try {
    const res = await fetch(`${BASE_URL}/api/decisions?limit=1&_t=${Date.now()}`);
    const data = await res.json();
    
    if (res.ok && data.data && data.data.length > 0) {
      const entry = data.data[0];
      console.log('   ✅ API responds');
      console.log(`   ✅ Has data: ${entry.decision} decision`);
      
      // Check UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(entry.id)) {
        console.log(`   ✅ UUID format valid: ${entry.id}`);
        passed++;
      } else {
        console.log(`   ❌ UUID format invalid: ${entry.id}`);
        failed++;
      }
      
      // Check decision_breakdown exists
      if (entry.decision_breakdown && typeof entry.decision_breakdown === 'object') {
        console.log('   ✅ decision_breakdown present');
        passed++;
      } else {
        console.log('   ❌ decision_breakdown missing or invalid');
        failed++;
      }
    } else {
      console.log('   ⚠️  No data available (may be expected if no webhooks sent yet)');
    }
  } catch (e) {
    console.log(`   ❌ API error: ${e.message}`);
    failed++;
  }
  
  // Test 2: Health endpoint
  console.log('\n2️⃣  Testing /api/phase25/webhooks/health...');
  try {
    const res = await fetch(`${BASE_URL}/api/phase25/webhooks/health`);
    const data = await res.json();
    
    if (res.ok) {
      console.log(`   ✅ Health check: ${data.status}`);
      console.log(`   ✅ Orchestrator: ${data.details?.orchestrator ? 'ready' : 'not ready'}`);
      passed++;
    } else {
      console.log(`   ❌ Health check failed: ${res.status}`);
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Health check error: ${e.message}`);
    failed++;
  }
  
  // Test 3: Metrics endpoint
  console.log('\n3️⃣  Testing /api/phase25/webhooks/metrics...');
  try {
    const res = await fetch(`${BASE_URL}/api/phase25/webhooks/metrics`);
    const data = await res.json();
    
    if (res.ok) {
      console.log('   ✅ Metrics endpoint responds');
      console.log(`   ✅ Total requests: ${data.system?.totalRequests || 0}`);
      passed++;
    } else {
      console.log(`   ❌ Metrics failed: ${res.status}`);
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Metrics error: ${e.message}`);
    failed++;
  }
  
  // Test 4: Check multiple UUIDs for uniqueness
  console.log('\n4️⃣  Testing UUID uniqueness...');
  try {
    const res = await fetch(`${BASE_URL}/api/decisions?limit=10&_t=${Date.now()}`);
    const data = await res.json();
    
    if (res.ok && data.data && data.data.length > 0) {
      const ids = data.data.map(e => e.id);
      const uniqueIds = new Set(ids);
      
      if (ids.length === uniqueIds.size) {
        console.log(`   ✅ All ${ids.length} UUIDs are unique`);
        passed++;
      } else {
        console.log(`   ❌ Duplicate UUIDs found!`);
        failed++;
      }
      
      // Check all are valid v4 UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const allValid = ids.every(id => uuidRegex.test(id));
      
      if (allValid) {
        console.log('   ✅ All UUIDs are valid v4 format');
        passed++;
      } else {
        console.log('   ❌ Some UUIDs have invalid format');
        failed++;
      }
    } else {
      console.log('   ⚠️  Not enough data to test uniqueness');
    }
  } catch (e) {
    console.log(`   ❌ UUID test error: ${e.message}`);
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Verification Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All checks passed! Deployment successful.');
    console.log('\n📝 Next steps:');
    console.log('   1. Open dashboard: https://optionstrat.vercel.app');
    console.log('   2. Navigate to Phase 2.5 tab');
    console.log('   3. Hard refresh (Ctrl+Shift+R) multiple times');
    console.log('   4. Check browser console for errors');
    console.log('   5. Run: node test-with-both-webhooks.js');
  } else {
    console.log('\n⚠️  Some checks failed. Review errors above.');
    console.log('\n📝 Troubleshooting:');
    console.log('   1. Check Vercel deployment logs');
    console.log('   2. Verify environment variables');
    console.log('   3. Check database connection');
    console.log('   4. Review browser console errors');
  }
  
  console.log('\n');
}

verifyDeployment().catch(console.error);
