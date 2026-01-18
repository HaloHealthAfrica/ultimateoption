/**
 * Comprehensive Webhook Testing Script
 * 
 * Tests all three webhook endpoints:
 * - /api/webhooks/signals
 * - /api/webhooks/saty-phase
 * - /api/webhooks/trend
 * 
 * Run with: node test-all-webhooks.js
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

function logTest(name) {
  log(`\n▶ ${name}`, 'blue');
}

function logSuccess(message) {
  log(`  ✅ ${message}`, 'green');
}

function logError(message) {
  log(`  ❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`  ⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`  ℹ️  ${message}`, 'cyan');
}

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

/**
 * Load test payload from file
 */
function loadPayload(filename) {
  const filePath = path.join(__dirname, 'test-payloads', filename);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Make HTTP request
 */
async function makeRequest(endpoint, payload) {
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Webhook-Test-Client/1.0'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
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
 * Test a webhook endpoint
 */
async function testWebhook(name, endpoint, payloadFile) {
  logTest(name);
  
  try {
    // Load payload
    const payload = loadPayload(payloadFile);
    logInfo(`Loaded payload from: ${payloadFile}`);
    
    // Send request
    const response = await makeRequest(endpoint, payload);
    
    // Check for errors
    if (response.error) {
      logError(`Request failed: ${response.error}`);
      results.failed++;
      results.tests.push({ name, status: 'FAILED', error: response.error });
      return;
    }
    
    // Check status code
    if (response.status !== 200) {
      logError(`HTTP ${response.status}: ${response.data.error || 'Unknown error'}`);
      if (response.data.details) {
        logInfo(`Details: ${JSON.stringify(response.data.details, null, 2)}`);
      }
      results.failed++;
      results.tests.push({ 
        name, 
        status: 'FAILED', 
        error: `HTTP ${response.status}`,
        details: response.data
      });
      return;
    }
    
    // Success
    logSuccess(`HTTP ${response.status} - Webhook processed successfully`);
    
    // Log response details
    if (response.data.decision) {
      logInfo(`Decision: ${response.data.decision}`);
    }
    if (response.data.message) {
      logInfo(`Message: ${response.data.message}`);
    }
    if (response.data.engineVersion) {
      logInfo(`Engine Version: ${response.data.engineVersion}`);
    }
    if (response.data.requestId) {
      logInfo(`Request ID: ${response.data.requestId}`);
    }
    
    // Check for ledger storage
    if (response.data.details) {
      if (response.data.details.ledgerStored === true) {
        logSuccess('Ledger stored: true');
      } else if (response.data.details.ledgerStored === false) {
        logWarning('Ledger stored: false');
        if (response.data.details.ledgerError) {
          logWarning(`Ledger error: ${response.data.details.ledgerError}`);
        }
        results.warnings++;
      }
    }
    
    // Check for gates (Phase 2)
    if (response.data.gates) {
      const passed = response.data.gates.passed?.length || 0;
      const failed = response.data.gates.failed?.length || 0;
      logInfo(`Gates: ${passed} passed, ${failed} failed`);
    }
    
    results.passed++;
    results.tests.push({ 
      name, 
      status: 'PASSED',
      response: response.data
    });
    
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'FAILED', error: error.message });
  }
}

/**
 * Test health endpoints
 */
async function testHealthEndpoints() {
  logSection('Health Check Endpoints');
  
  const endpoints = [
    '/api/webhooks/status',
    '/api/phase25/webhooks/health',
    '/api/phase25/webhooks/metrics'
  ];
  
  for (const endpoint of endpoints) {
    logTest(`GET ${endpoint}`);
    
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      const data = await response.json();
      
      if (response.status === 200 || response.status === 503) {
        logSuccess(`HTTP ${response.status}`);
        if (data.engine) {
          logInfo(`Engine: ${data.engine}`);
        }
        if (data.version) {
          logInfo(`Version: ${data.version}`);
        }
        if (data.uptime !== undefined) {
          logInfo(`Uptime: ${data.uptime}s`);
        }
      } else {
        logWarning(`HTTP ${response.status}`);
      }
    } catch (error) {
      logError(`Failed: ${error.message}`);
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(70));
  log('Comprehensive Webhook Testing Suite', 'magenta');
  console.log('='.repeat(70));
  log(`Base URL: ${BASE_URL}`, 'cyan');
  log(`Timestamp: ${new Date().toISOString()}`, 'cyan');
  
  // Test health endpoints first
  await testHealthEndpoints();
  
  // Test SATY Phase webhooks
  logSection('SATY Phase Webhooks');
  await testWebhook(
    'SATY Phase - Accumulation Entry',
    '/api/webhooks/saty-phase',
    'saty-phase-1.json'
  );
  
  await testWebhook(
    'SATY Phase - Distribution Phase',
    '/api/webhooks/saty-phase',
    'saty-phase-2.json'
  );
  
  // Test Trend webhooks
  logSection('Trend Webhooks');
  await testWebhook(
    'Trend - Bullish (SPY)',
    '/api/webhooks/trend',
    'trend-bullish.json'
  );
  
  await testWebhook(
    'Trend - Bearish (AAPL)',
    '/api/webhooks/trend',
    'trend-bearish.json'
  );
  
  // Test Signals webhooks
  logSection('Signals Webhooks');
  await testWebhook(
    'Signals - Buy Signal',
    '/api/webhooks/signals',
    'signals-buy.json'
  );
  
  await testWebhook(
    'Signals - Sell Signal',
    '/api/webhooks/signals',
    'signals-sell.json'
  );
  
  // Print summary
  logSection('Test Summary');
  log(`Total Tests: ${results.passed + results.failed}`, 'cyan');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');
  log(`⚠️  Warnings: ${results.warnings}`, 'yellow');
  
  // Print detailed results
  console.log('\n' + '='.repeat(70));
  log('Detailed Results', 'cyan');
  console.log('='.repeat(70));
  
  results.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`\n${icon} ${test.name}: ${test.status}`);
    
    if (test.error) {
      log(`   Error: ${test.error}`, 'red');
    }
    
    if (test.details) {
      log(`   Details: ${JSON.stringify(test.details, null, 2)}`, 'yellow');
    }
  });
  
  // Exit with appropriate code
  console.log('\n' + '='.repeat(70));
  if (results.failed === 0) {
    log('✅ All tests passed!', 'green');
    process.exit(0);
  } else {
    log(`❌ ${results.failed} test(s) failed`, 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
