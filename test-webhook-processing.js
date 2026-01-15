/**
 * Webhook Processing Validation Script
 * 
 * Tests that webhooks are processed correctly through all subsequent steps.
 * Run with: node test-webhook-processing.js
 */

const BASE_URL = process.env.BASE_URL || 'https://optionstrat.vercel.app';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Send a signals webhook and verify processing
async function testSignalsProcessing() {
  logTest('Test 1: Signals Webhook Processing');
  
  const payload = {
    signal: {
      type: 'LONG',
      aiScore: 8.5,
      symbol: 'SPY',
      timestamp: Date.now()
    },
    satyPhase: {
      phase: 75.0
    },
    marketSession: 'OPEN'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      logError(`HTTP ${response.status}: ${response.statusText}`);
      const error = await response.text();
      console.log('  Error:', error);
      return false;
    }
    
    const result = await response.json();
    
    // Validate response structure
    if (!result.decision) {
      logError('Missing decision field');
      return false;
    }
    logSuccess(`Decision: ${result.decision}`);
    
    if (!result.engine_version) {
      logError('Missing engine_version field');
      return false;
    }
    logSuccess(`Engine version: ${result.engine_version}`);
    
    if (!result.gates) {
      logError('Missing gates field');
      return false;
    }
    logSuccess(`Gates evaluated: ${result.gates.passed.length + result.gates.failed.length}`);
    
    // Check all 5 gates were evaluated
    const totalGates = result.gates.passed.length + result.gates.failed.length;
    if (totalGates !== 5) {
 