/**
 * Phase 2.5 Webhook Integration Test
 * 
 * Tests the Phase 2.5 webhook endpoints to ensure proper integration.
 * Run with: node test-phase25-webhooks.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test payloads
const SIGNAL_PAYLOAD = {
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

const SATY_PHASE_PAYLOAD = {
  meta: {
    engine: 'SATY_PO',
    version: '1.0'
  },
  instrument: {
    symbol: 'SPY',
    exchange: 'NASDAQ'
  },
  phase: {
    current_phase: 2,
    phase_name: 'MARKUP',
    volatility_regime: 'NORMAL'
  },
  confidence: {
    confidence_score: 85,
    signal_strength: 'STRONG'
  },
  execution_guidance: {
    trade_allowed: true,
    bias: 'LONG',
    size_multiplier: 1.5
  }
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Make HTTP request
 */
async function makeRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Phase25-Test-Client/1.0'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
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
 * Test helper
 */
function test(name, fn) {
  return async () => {
    console.log(`\n🧪 Testing: ${name}`);
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASSED' });
      console.log(`✅ PASSED: ${name}`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'FAILED', error: error.message });
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
    }
  };
}

/**
 * Assertion helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Test Suite

const testHealthCheck = test('Health Check', async () => {
  const response = await makeRequest('GET', '/api/phase25/webhooks/health');
  
  assert(response.status === 200 || response.status === 503, 
    `Expected status 200 or 503, got ${response.status}`);
  assert(response.data.engine === 'Phase 2.5 Decision Engine', 
    'Expected Phase 2.5 engine identifier');
  assert(response.data.version === '2.5.0', 
    'Expected version 2.5.0');
  assert(typeof response.data.uptime === 'number', 
    'Expected uptime to be a number');
});

const testDetailedHealth = test('Detailed Health Check', async () => {
  const response = await makeRequest('GET', '/api/phase25/webhooks/health/detailed');
  
  assert(response.status === 200 || response.status === 503, 
    `Expected status 200 or 503, got ${response.status}`);
  assert(response.data.details !== undefined, 
    'Expected details object');
  assert(response.data.engine === 'Phase 2.5 Decision Engine', 
    'Expected Phase 2.5 engine identifier');
});

const testMetrics = test('Metrics Endpoint', async () => {
  const response = await makeRequest('GET', '/api/phase25/webhooks/metrics');
  
  assert(response.status === 200 || response.status === 503, 
    `Expected status 200 or 503, got ${response.status}`);
  assert(response.data.engine === 'Phase 2.5 Decision Engine', 
    'Expected Phase 2.5 engine identifier');
  assert(response.data.version === '2.5.0', 
    'Expected version 2.5.0');
});

const testSignalWebhook = test('Signal Webhook Processing', async () => {
  const response = await makeRequest('POST', '/api/phase25/webhooks/signals', SIGNAL_PAYLOAD);
  
  assert(response.status === 200 || response.status === 400, 
    `Expected status 200 or 400, got ${response.status}`);
  assert(response.data.engineVersion === '2.5.0', 
    'Expected engine version 2.5.0');
  assert(response.data.requestId !== undefined, 
    'Expected requestId in response');
  assert(response.data.processingTime !== undefined, 
    'Expected processingTime in response');
  
  // Check security headers
  assert(response.headers['x-engine-version'] === '2.5.0', 
    'Expected X-Engine-Version header');
  assert(response.headers['x-service'] === 'Phase25-Decision-Engine', 
    'Expected X-Service header');
});

const testSatyPhaseWebhook = test('SATY Phase Webhook Processing', async () => {
  const response = await makeRequest('POST', '/api/phase25/webhooks/saty-phase', SATY_PHASE_PAYLOAD);
  
  assert(response.status === 200 || response.status === 400, 
    `Expected status 200 or 400, got ${response.status}`);
  assert(response.data.engineVersion === '2.5.0', 
    'Expected engine version 2.5.0');
  assert(response.data.requestId !== undefined, 
    'Expected requestId in response');
  assert(response.data.message !== undefined, 
    'Expected message in response');
  
  // Check security headers
  assert(response.headers['x-engine-version'] === '2.5.0', 
    'Expected X-Engine-Version header');
  assert(response.headers['x-service'] === 'Phase25-Decision-Engine', 
    'Expected X-Service header');
});

const testInvalidJSON = test('Invalid JSON Handling', async () => {
  const url = `${BASE_URL}/api/phase25/webhooks/signals`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: 'invalid json{'
  });
  
  const data = await response.json();
  
  assert(response.status === 400, 
    `Expected status 400, got ${response.status}`);
  assert(data.error === 'Invalid JSON payload', 
    'Expected invalid JSON error message');
});

const testInvalidContentType = test('Invalid Content-Type Handling', async () => {
  const url = `${BASE_URL}/api/phase25/webhooks/signals`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: JSON.stringify(SIGNAL_PAYLOAD)
  });
  
  const data = await response.json();
  
  assert(response.status === 400, 
    `Expected status 400, got ${response.status}`);
  assert(data.error === 'Content-Type must be application/json', 
    'Expected content-type error message');
});

const testMethodNotAllowed = test('Method Not Allowed', async () => {
  const response = await makeRequest('GET', '/api/phase25/webhooks/signals');
  
  assert(response.status === 405, 
    `Expected status 405, got ${response.status}`);
  assert(response.data.error.includes('Method not allowed'), 
    'Expected method not allowed error');
});

const testMultiSourceFlow = test('Multi-Source Context Flow', async () => {
  // Send SATY phase first
  const satyResponse = await makeRequest('POST', '/api/phase25/webhooks/saty-phase', SATY_PHASE_PAYLOAD);
  assert(satyResponse.status === 200, 
    `SATY phase webhook failed with status ${satyResponse.status}`);
  
  // Then send signal
  const signalResponse = await makeRequest('POST', '/api/phase25/webhooks/signals', SIGNAL_PAYLOAD);
  assert(signalResponse.status === 200 || signalResponse.status === 400, 
    `Signal webhook failed with status ${signalResponse.status}`);
  
  // Check if decision was made or context is being built
  assert(signalResponse.data.message !== undefined, 
    'Expected message about decision or context status');
});

// Run all tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('Phase 2.5 Webhook Integration Test Suite');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  
  // Run tests sequentially
  await testHealthCheck();
  await testDetailedHealth();
  await testMetrics();
  await testSignalWebhook();
  await testSatyPhaseWebhook();
  await testInvalidJSON();
  await testInvalidContentType();
  await testMethodNotAllowed();
  await testMultiSourceFlow();
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(60));
  
  // Print detailed results
  console.log('\nDetailed Results:');
  results.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   ${test.error}`);
    }
  });
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
