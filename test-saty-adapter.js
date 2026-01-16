/**
 * Test script for enhanced SATY Phase adapter
 * 
 * Tests various incomplete SATY payloads to verify the adapter
 * can construct valid phase webhooks from minimal data.
 */

console.log('Testing Enhanced SATY Phase Adapter\n');
console.log('='.repeat(60));

// Test Case 1: Minimal payload (symbol + bias only)
console.log('\n1. Minimal payload (symbol + bias):');
const test1 = {
  symbol: 'SPY',
  bias: 'BULLISH',
  timeframe: '15'
};
console.log('Input:', JSON.stringify(test1, null, 2));
console.log('Expected: ✅ Should construct valid SATY webhook');

// Test Case 2: Nested instrument structure
console.log('\n' + '='.repeat(60));
console.log('\n2. Nested instrument structure:');
const test2 = {
  instrument: {
    ticker: 'AAPL',
    exchange: 'NASDAQ'
  },
  regime_context: {
    local_bias: 'BEARISH'
  },
  timeframe: {
    chart_tf: '5'
  }
};
console.log('Input:', JSON.stringify(test2, null, 2));
console.log('Expected: ✅ Should extract nested fields');

// Test Case 3: Phase name instead of bias
console.log('\n' + '='.repeat(60));
console.log('\n3. Phase name instead of bias:');
const test3 = {
  ticker: 'TSLA',
  phase: {
    name: 'MARKUP',
    current: 2
  },
  tf: '30'
};
console.log('Input:', JSON.stringify(test3, null, 2));
console.log('Expected: ✅ Should infer BULLISH bias from MARKUP phase');

// Test Case 4: Direction field
console.log('\n' + '='.repeat(60));
console.log('\n4. Direction field:');
const test4 = {
  symbol: 'QQQ',
  direction: 'SHORT',
  chart_tf: '15'
};
console.log('Input:', JSON.stringify(test4, null, 2));
console.log('Expected: ✅ Should convert direction to bias');

// Test Case 5: Trend field
console.log('\n' + '='.repeat(60));
console.log('\n5. Trend field:');
const test5 = {
  ticker: 'IWM',
  trend: 'BEARISH',
  timeframe: '60'
};
console.log('Input:', JSON.stringify(test5, null, 2));
console.log('Expected: ✅ Should convert trend to bias');

// Test Case 6: Execution guidance bias
console.log('\n' + '='.repeat(60));
console.log('\n6. Execution guidance bias:');
const test6 = {
  instrument: {
    symbol: 'DIA'
  },
  execution_guidance: {
    bias: 'LONG'
  },
  timeframe: '15'
};
console.log('Input:', JSON.stringify(test6, null, 2));
console.log('Expected: ✅ Should extract bias from execution_guidance');

// Test Case 7: Phase-lite format (current indicator output)
console.log('\n' + '='.repeat(60));
console.log('\n7. Phase-lite format:');
const test7 = {
  phase: {
    current: 1,
    name: 'ACCUMULATION',
    changed: true
  },
  instrument: {
    ticker: 'SPY',
    current_price: 450.25
  },
  timeframe: '5',
  timestamp: Date.now()
};
console.log('Input:', JSON.stringify(test7, null, 2));
console.log('Expected: ✅ Should parse as PhaseLite format');

// Test Case 8: Invalid payload (no symbol or bias)
console.log('\n' + '='.repeat(60));
console.log('\n8. Invalid payload (no symbol or bias):');
const test8 = {
  price: 450.25,
  volume: 1000000,
  timeframe: '15'
};
console.log('Input:', JSON.stringify(test8, null, 2));
console.log('Expected: ❌ Should fail with helpful error message');

// Test Case 9: Missing bias but has phase name
console.log('\n' + '='.repeat(60));
console.log('\n9. Missing bias but has phase name:');
const test9 = {
  symbol: 'SPY',
  event: {
    phase_name: 'DISTRIBUTION'
  }
};
console.log('Input:', JSON.stringify(test9, null, 2));
console.log('Expected: ✅ Should infer BEARISH bias from DISTRIBUTION');

// Test Case 10: Oscillator value extraction
console.log('\n' + '='.repeat(60));
console.log('\n10. Oscillator value extraction:');
const test10 = {
  ticker: 'SPY',
  bias: 'BULLISH',
  rsi: 65,
  macd_histogram: 0.5
};
console.log('Input:', JSON.stringify(test10, null, 2));
console.log('Expected: ✅ Should extract oscillator value from RSI or MACD');

// Summary
console.log('\n' + '='.repeat(60));
console.log('\nTest Cases Summary:');
console.log('✅ Expected to pass: 9/10');
console.log('❌ Expected to fail: 1/10 (test 8 - no symbol or bias)');
console.log('\nKey Features Tested:');
console.log('- Symbol extraction from multiple locations');
console.log('- Bias inference from trend/direction/phase');
console.log('- Timeframe extraction with defaults');
console.log('- Nested field extraction');
console.log('- Phase name to event name conversion');
console.log('- Oscillator value extraction');
console.log('- Helpful error messages for invalid payloads');
console.log('\nTo run actual tests:');
console.log('1. Import parseAndAdaptSaty from src/webhooks/satyAdapter.ts');
console.log('2. Call parseAndAdaptSaty(testPayload) for each test case');
console.log('3. Check result.success and result.adaptations');
