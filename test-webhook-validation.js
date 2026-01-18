/**
 * Test Webhook Validation Endpoint
 * 
 * Tests the /api/webhooks/validate endpoint with various payloads
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test payloads
const testPayloads = {
  validSignal: {
    name: 'Valid Signal',
    payload: {
      ticker: 'SPY',
      trend: 'BULLISH',
      score: 8.5,
      timeframe: '15'
    }
  },
  
  validSignalComplete: {
    name: 'Valid Signal (Complete)',
    payload: {
      signal: {
        type: 'LONG',
        quality: 'EXTREME',
        ai_score: 9.5,
        timeframe: '15',
        timestamp: Date.now()
      },
      instrument: {
        ticker: 'SPY',
        exchange: 'NASDAQ',
        current_price: 450.25
      },
      risk: {
        amount: 1000,
        rr_ratio_t1: 2.5,
        rr_ratio_t2: 4.0
      }
    }
  },
  
  validSaty: {
    name: 'Valid SATY Phase (Minimal)',
    payload: {
      symbol: 'SPY',
      timeframe: '15',
      bias: 'BULLISH'
    }
  },
  
  validSatyComplete: {
    name: 'Valid SATY Phase (Complete)',
    payload: {
      meta: { engine: 'SATY_PO', event_type: 'REGIME_PHASE_ENTRY' },
      instrument: { symbol: 'SPY', exchange: 'AMEX' },
      timeframe: { chart_tf: '15', event_tf: '15' },
      event: { name: 'ENTER_ACCUMULATION' },
      oscillator_state: { value: 50 },
      regime_context: { local_bias: 'BULLISH' }
    }
  },
  
  validTrend: {
    name: 'Valid Trend',
    payload: {
      ticker: 'SPY',
      exchange: 'NASDAQ',
      price: 450.25,
      timeframes: {
        '3m': { dir: 'bullish', chg: true },
        '5m': { dir: 'bullish', chg: false },
        '15m': { dir: 'bullish', chg: false }
      }
    }
  },
  
  invalidMissingFields: {
    name: 'Invalid - Missing Fields',
    payload: {
      ticker: 'SPY'
      // Missing required fields
    }
  },
  
  invalidWrongType: {
    name: 'Invalid - Wrong Type',
    payload: {
      ticker: 'SPY',
      timeframes: {
        '3m': { dir: 'bullish', chg: true }
      }
      // Trend payload sent to signals endpoint (will be detected)
    }
  },
  
  invalidJSON: {
    name: 'Invalid - Malformed JSON',
    payload: 'not a json object',
    raw: true
  }
};

/**
 * Send validation request
 */
async function validateWebhook(name, payload, raw = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const body = raw ? payload : JSON.stringify(payload);
    
    const response = await fetch(`${BASE_URL}/api/webhooks/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body
    });
    
    const result = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`Valid: ${result.valid}`);
    
    if (result.detection) {
      console.log(`\nDetection:`);
      console.log(`  Type: ${result.detection.type}`);
      console.log(`  Confidence: ${result.detection.confidence}%`);
      console.log(`  Endpoint: ${result.detection.correct_endpoint}`);
      console.log(`  Summary: ${result.detection.summary}`);
    }
    
    if (result.validation) {
      console.log(`\nValidation:`);
      console.log(`  Adapter: ${result.validation.adapter}`);
      console.log(`  Success: ${result.validation.success}`);
      
      if (result.validation.adaptations) {
        console.log(`  Adaptations:`);
        result.validation.adaptations.forEach(a => console.log(`    - ${a}`));
      }
      
      if (result.validation.error) {
        console.log(`  Error: ${result.validation.error}`);
      }
    }
    
    if (result.next_steps) {
      console.log(`\nNext Steps:`);
      console.log(`  Endpoint: ${result.next_steps.endpoint}`);
      console.log(`  Method: ${result.next_steps.method}`);
    }
    
    if (result.help) {
      console.log(`\nHelp:`);
      console.log(`  Documentation: ${result.help.documentation}`);
      console.log(`  Hint: ${result.help.hint}`);
    }
    
    console.log(`\nProcessing Time: ${result.processing_time_ms}ms`);
    
    return result;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return null;
  }
}

/**
 * Test GET endpoint
 */
async function testGetEndpoint() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: GET /api/webhooks/validate`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/validate`, {
      method: 'GET'
    });
    
    const result = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`\nEndpoint Info:`);
    console.log(`  Endpoint: ${result.endpoint}`);
    console.log(`  Method: ${result.method}`);
    console.log(`  Description: ${result.description}`);
    console.log(`\nFeatures:`);
    result.features.forEach(f => console.log(`  - ${f}`));
    
    return result;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Webhook Validation Endpoint Tests');
  console.log('==================================\n');
  console.log(`Base URL: ${BASE_URL}`);
  
  // Test GET endpoint first
  await testGetEndpoint();
  
  // Test all payloads
  const results = {};
  
  for (const [key, test] of Object.entries(testPayloads)) {
    const result = await validateWebhook(test.name, test.payload, test.raw);
    results[key] = result;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test Summary');
  console.log(`${'='.repeat(60)}`);
  
  const validCount = Object.values(results).filter(r => r && r.valid).length;
  const invalidCount = Object.values(results).filter(r => r && !r.valid).length;
  const errorCount = Object.values(results).filter(r => !r).length;
  
  console.log(`Total Tests: ${Object.keys(testPayloads).length}`);
  console.log(`Valid: ${validCount}`);
  console.log(`Invalid: ${invalidCount}`);
  console.log(`Errors: ${errorCount}`);
  
  // Expected results
  console.log(`\nExpected Results:`);
  console.log(`  Valid: 5 (validSignal, validSignalComplete, validSaty, validSatyComplete, validTrend)`);
  console.log(`  Invalid: 3 (invalidMissingFields, invalidWrongType, invalidJSON)`);
  
  const passed = validCount === 5 && invalidCount === 3 && errorCount === 0;
  console.log(`\nOverall: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
}

// Run tests
runTests().catch(console.error);
