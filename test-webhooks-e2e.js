/**
 * End-to-End Webhook Testing Script
 * 
 * Tests all three webhook endpoints with multiple payloads
 * and verifies the complete flow.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const DELAY_MS = 500; // Delay between requests

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to send webhook
async function sendWebhook(endpoint, payload, testName) {
  results.total++;
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`   Endpoint: POST ${endpoint}`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    const result = {
      name: testName,
      endpoint,
      status: response.status,
      success: response.ok,
      response: data,
      timestamp: new Date().toISOString()
    };
    
    if (response.ok) {
      console.log(`   ✅ PASSED - Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      results.passed++;
    } else {
      console.log(`   ❌ FAILED - Status: ${response.status}`);
      console.log(`   Error:`, JSON.stringify(data, null, 2));
      results.failed++;
    }
    
    results.tests.push(result);
    return result;
    
  } catch (error) {
    console.log(`   ❌ FAILED - Error: ${error.message}`);
    results.failed++;
    
    const result = {
      name: testName,
      endpoint,
      status: 0,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    results.tests.push(result);
    return result;
  }
}

// Helper function to check webhook receipts
async function checkWebhookReceipts() {
  console.log(`\n📋 Checking webhook receipts...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/recent?limit=20`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Retrieved ${data.entries?.length || 0} webhook receipts`);
      console.log(`   Auth required: ${data.auth_required}`);
      
      // Group by kind
      const byKind = {};
      (data.entries || []).forEach(entry => {
        byKind[entry.kind] = (byKind[entry.kind] || 0) + 1;
      });
      
      console.log(`   Breakdown:`, byKind);
      
      return data;
    } else {
      console.log(`   ❌ Failed to retrieve receipts: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Error checking receipts: ${error.message}`);
    return null;
  }
}

// Helper function to delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test execution
async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 Starting Webhook End-to-End Tests');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════');
  
  // Load test payloads
  const payloadsDir = path.join(__dirname, 'test-payloads');
  
  const satyPhase1 = JSON.parse(fs.readFileSync(path.join(payloadsDir, 'saty-phase-1.json'), 'utf8'));
  const satyPhase2 = JSON.parse(fs.readFileSync(path.join(payloadsDir, 'saty-phase-2.json'), 'utf8'));
  const signalsBuy = JSON.parse(fs.readFileSync(path.join(payloadsDir, 'signals-buy.json'), 'utf8'));
  const signalsSell = JSON.parse(fs.readFileSync(path.join(payloadsDir, 'signals-sell.json'), 'utf8'));
  const trendBullish = JSON.parse(fs.readFileSync(path.join(payloadsDir, 'trend-bullish.json'), 'utf8'));
  const trendBearish = JSON.parse(fs.readFileSync(path.join(payloadsDir, 'trend-bearish.json'), 'utf8'));
  
  // Test Scenario 1: SATY Phase Webhooks
  console.log('\n\n📦 SCENARIO 1: SATY Phase Webhooks');
  console.log('───────────────────────────────────────────────────────');
  
  await sendWebhook('/api/webhooks/saty-phase', satyPhase1, 'SATY Phase #1 (Text-wrapped, SPY, BULLISH)');
  await delay(DELAY_MS);
  
  await sendWebhook('/api/webhooks/saty-phase', satyPhase2, 'SATY Phase #2 (Direct, AAPL, BEARISH)');
  await delay(DELAY_MS);
  
  // Test Scenario 2: Signals Webhooks
  console.log('\n\n📡 SCENARIO 2: Signals Webhooks');
  console.log('───────────────────────────────────────────────────────');
  
  await sendWebhook('/api/webhooks/signals', signalsBuy, 'Signal #1 (BUY SPY)');
  await delay(DELAY_MS);
  
  await sendWebhook('/api/webhooks/signals', signalsSell, 'Signal #2 (SELL AAPL)');
  await delay(DELAY_MS);
  
  // Test Scenario 3: Trend Webhooks
  console.log('\n\n📈 SCENARIO 3: Trend Webhooks');
  console.log('───────────────────────────────────────────────────────');
  
  await sendWebhook('/api/webhooks/trend', trendBullish, 'Trend #1 (BULLISH SPY)');
  await delay(DELAY_MS);
  
  await sendWebhook('/api/webhooks/trend', trendBearish, 'Trend #2 (BEARISH AAPL)');
  await delay(DELAY_MS);
  
  // Test Scenario 4: Mixed Sequence
  console.log('\n\n🔄 SCENARIO 4: Mixed Webhook Sequence');
  console.log('───────────────────────────────────────────────────────');
  
  await sendWebhook('/api/webhooks/saty-phase', satyPhase1, 'Mixed #1 (SATY)');
  await delay(DELAY_MS);
  
  await sendWebhook('/api/webhooks/signals', signalsBuy, 'Mixed #2 (Signal)');
  await delay(DELAY_MS);
  
  await sendWebhook('/api/webhooks/trend', trendBullish, 'Mixed #3 (Trend)');
  await delay(DELAY_MS);
  
  // Check webhook receipts
  console.log('\n\n📊 VERIFICATION: Webhook Receipts');
  console.log('───────────────────────────────────────────────────────');
  
  await delay(1000); // Wait for processing
  const receipts = await checkWebhookReceipts();
  
  // Print summary
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   Total Tests: ${results.total}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (receipts) {
    console.log(`\n   Webhook Receipts: ${receipts.entries?.length || 0}`);
    console.log(`   Authentication: ${receipts.auth_required ? 'Required' : 'Optional'}`);
  }
  
  // Save results to file
  const resultsFile = path.join(__dirname, 'test-results-e2e.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n   Results saved to: ${resultsFile}`);
  
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
