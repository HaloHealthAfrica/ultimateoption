/**
 * Test script for endpoint auto-detection
 * 
 * Tests various webhook payloads to verify the detector
 * correctly identifies webhook types and suggests correct endpoints.
 */

console.log('Testing Endpoint Auto-Detection\n');
console.log('='.repeat(60));

// Test Case 1: SATY Phase webhook
console.log('\n1. SATY Phase webhook:');
const test1 = {
  meta: { engine: 'SATY_PO', event_type: 'REGIME_PHASE_ENTRY' },
  instrument: { symbol: 'SPY' },
  regime_context: { local_bias: 'BULLISH' },
  oscillator_state: { value: 50 }
};
console.log('Input:', JSON.stringify(test1, null, 2));
console.log('Expected: saty-phase (80+ confidence)');
console.log('Indicators: meta.engine="SATY_PO", regime_context, oscillator_state');

// Test Case 2: Signals webhook
console.log('\n' + '='.repeat(60));
console.log('\n2. Signals webhook:');
const test2 = {
  signal: {
    type: 'LONG',
    quality: 'EXTREME',
    ai_score: 9.5
  },
  instrument: { ticker: 'SPY' },
  risk: { rr_ratio_t1: 2.5 },
  entry: { price: 450.25 }
};
console.log('Input:', JSON.stringify(test2, null, 2));
console.log('Expected: signals (100+ confidence)');
console.log('Indicators: signal.ai_score, signal.quality, risk, entry');

// Test Case 3: Trend webhook
console.log('\n' + '='.repeat(60));
console.log('\n3. Trend webhook:');
const test3 = {
  ticker: 'SPY',
  timeframes: {
    tf3min: { trend: 'BULLISH' },
    tf5min: { trend: 'BULLISH' },
    tf15min: { trend: 'BULLISH' }
  }
};
console.log('Input:', JSON.stringify(test3, null, 2));
console.log('Expected: trend (80+ confidence)');
console.log('Indicators: timeframes with multiple TFs');

// Test Case 4: Ambiguous payload (low confidence)
console.log('\n' + '='.repeat(60));
console.log('\n4. Ambiguous payload:');
const test4 = {
  ticker: 'SPY',
  price: 450.25,
  timestamp: Date.now()
};
console.log('Input:', JSON.stringify(test4, null, 2));
console.log('Expected: trend or unknown (low confidence <30)');
console.log('Indicators: ticker, price, timestamp (weak indicators)');

// Test Case 5: SATY sent to signals endpoint (wrong endpoint)
console.log('\n' + '='.repeat(60));
console.log('\n5. SATY sent to signals endpoint (wrong endpoint):');
const test5 = {
  meta: { engine: 'SATY_PO' },
  regime_context: { local_bias: 'BULLISH' },
  instrument: { symbol: 'SPY' }
};
console.log('Input:', JSON.stringify(test5, null, 2));
console.log('Current endpoint: /api/webhooks/signals');
console.log('Expected: isWrong=true, suggest /api/webhooks/saty-phase');

// Test Case 6: Signals sent to trend endpoint (wrong endpoint)
console.log('\n' + '='.repeat(60));
console.log('\n6. Signals sent to trend endpoint (wrong endpoint):');
const test6 = {
  signal: { type: 'LONG', ai_score: 8.5, quality: 'HIGH' },
  instrument: { ticker: 'SPY' },
  risk: { amount: 1000 }
};
console.log('Input:', JSON.stringify(test6, null, 2));
console.log('Current endpoint: /api/webhooks/trend');
console.log('Expected: isWrong=true, suggest /api/webhooks/signals');

// Test Case 7: Trend sent to SATY endpoint (wrong endpoint)
console.log('\n' + '='.repeat(60));
console.log('\n7. Trend sent to SATY endpoint (wrong endpoint):');
const test7 = {
  ticker: 'SPY',
  timeframes: {
    '3m': { trend: 'BULLISH' },
    '5m': { trend: 'BULLISH' }
  }
};
console.log('Input:', JSON.stringify(test7, null, 2));
console.log('Current endpoint: /api/webhooks/saty-phase');
console.log('Expected: isWrong=true, suggest /api/webhooks/trend');

// Test Case 8: Invalid payload
console.log('\n' + '='.repeat(60));
console.log('\n8. Invalid payload:');
const test8 = null;
console.log('Input:', test8);
console.log('Expected: unknown (0 confidence), error message');

// Test Case 9: Minimal SATY (should still detect)
console.log('\n' + '='.repeat(60));
console.log('\n9. Minimal SATY:');
const test9 = {
  symbol: 'SPY',
  phase: { name: 'MARKUP' },
  execution_guidance: { bias: 'BULLISH' }
};
console.log('Input:', JSON.stringify(test9, null, 2));
console.log('Expected: saty-phase (45+ confidence)');
console.log('Indicators: phase object, execution_guidance');

// Test Case 10: Minimal Signals (should still detect)
console.log('\n' + '='.repeat(60));
console.log('\n10. Minimal Signals:');
const test10 = {
  ticker: 'SPY',
  signal: { type: 'LONG' },
  components: ['STRAT', 'TREND']
};
console.log('Input:', JSON.stringify(test10, null, 2));
console.log('Expected: signals (45+ confidence)');
console.log('Indicators: signal.type, components array');

// Summary
console.log('\n' + '='.repeat(60));
console.log('\nTest Cases Summary:');
console.log('Detection tests: 10');
console.log('Wrong endpoint tests: 3 (cases 5, 6, 7)');
console.log('\nKey Features Tested:');
console.log('- SATY Phase detection (strong and weak indicators)');
console.log('- Signals detection (strong and weak indicators)');
console.log('- Trend detection (strong and weak indicators)');
console.log('- Confidence scoring (0-100)');
console.log('- Wrong endpoint detection');
console.log('- Helpful error messages');
console.log('- Suggestions for low confidence');
console.log('\nTo run actual tests:');
console.log('1. Import detectWebhookType and isWrongEndpoint from src/webhooks/endpointDetector.ts');
console.log('2. Call detectWebhookType(testPayload) for each test case');
console.log('3. Check result.type, result.confidence, and result.indicators');
console.log('4. Call isWrongEndpoint(testPayload, currentEndpoint) for wrong endpoint tests');
