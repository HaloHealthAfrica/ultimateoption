/**
 * Test script for flexible signal adapter
 * 
 * Tests various incomplete signal payloads to verify the adapter
 * can construct valid signals from partial data.
 */

const { adaptFlexibleSignal } = require('./src/webhooks/signalAdapter.ts');

console.log('Testing Flexible Signal Adapter\n');
console.log('='.repeat(60));

// Test Case 1: Missing signal wrapper (most common failure)
console.log('\n1. Missing signal wrapper:');
const test1 = {
  ticker: 'SPY',
  trend: 'BULLISH',
  score: 8.5,
  price: 450.25
};
console.log('Input:', JSON.stringify(test1, null, 2));
const result1 = adaptFlexibleSignal(test1);
console.log('Result:', result1.success ? '✅ SUCCESS' : '❌ FAILED');
if (result1.success) {
  console.log('Adapted:', JSON.stringify(result1.data, null, 2));
  console.log('Adaptations:', result1.adaptations);
} else {
  console.log('Error:', result1.error);
}

// Test Case 2: Signal with missing fields
console.log('\n' + '='.repeat(60));
console.log('\n2. Signal with missing ai_score:');
const test2 = {
  signal: {
    type: 'LONG'
    // Missing ai_score, quality, timeframe
  },
  instrument: {
    ticker: 'AAPL'
  },
  confidence: 7.5
};
console.log('Input:', JSON.stringify(test2, null, 2));
const result2 = adaptFlexibleSignal(test2);
console.log('Result:', result2.success ? '✅ SUCCESS' : '❌ FAILED');
if (result2.success) {
  console.log('Adapted:', JSON.stringify(result2.data, null, 2));
  console.log('Adaptations:', result2.adaptations);
} else {
  console.log('Error:', result2.error);
}

// Test Case 3: Direction instead of type
console.log('\n' + '='.repeat(60));
console.log('\n3. Direction instead of type:');
const test3 = {
  symbol: 'TSLA',
  direction: 'BEARISH',
  ai_score: 9.2,
  quality: 'EXTREME'
};
console.log('Input:', JSON.stringify(test3, null, 2));
const result3 = adaptFlexibleSignal(test3);
console.log('Result:', result3.success ? '✅ SUCCESS' : '❌ FAILED');
if (result3.success) {
  console.log('Adapted:', JSON.stringify(result3.data, null, 2));
  console.log('Adaptations:', result3.adaptations);
} else {
  console.log('Error:', result3.error);
}

// Test Case 4: Minimal payload
console.log('\n' + '='.repeat(60));
console.log('\n4. Minimal payload (ticker + trend only):');
const test4 = {
  ticker: 'QQQ',
  trend: 'LONG'
};
console.log('Input:', JSON.stringify(test4, null, 2));
const result4 = adaptFlexibleSignal(test4);
console.log('Result:', result4.success ? '✅ SUCCESS' : '❌ FAILED');
if (result4.success) {
  console.log('Adapted:', JSON.stringify(result4.data, null, 2));
  console.log('Adaptations:', result4.adaptations);
} else {
  console.log('Error:', result4.error);
}

// Test Case 5: Complete signal (should pass through)
console.log('\n' + '='.repeat(60));
console.log('\n5. Complete signal (should pass through):');
const test5 = {
  signal: {
    type: 'SHORT',
    quality: 'HIGH',
    ai_score: 8.0,
    timeframe: '15',
    timestamp: Date.now()
  },
  instrument: {
    ticker: 'SPY',
    exchange: 'NASDAQ',
    current_price: 450.25
  }
};
console.log('Input:', JSON.stringify(test5, null, 2));
const result5 = adaptFlexibleSignal(test5);
console.log('Result:', result5.success ? '✅ SUCCESS' : '❌ FAILED');
if (result5.success) {
  console.log('Adapted:', JSON.stringify(result5.data, null, 2));
  console.log('Adaptations:', result5.adaptations);
} else {
  console.log('Error:', result5.error);
}

// Test Case 6: Invalid payload (should fail)
console.log('\n' + '='.repeat(60));
console.log('\n6. Invalid payload (no ticker or trend):');
const test6 = {
  price: 100.50,
  volume: 1000000
};
console.log('Input:', JSON.stringify(test6, null, 2));
const result6 = adaptFlexibleSignal(test6);
console.log('Result:', result6.success ? '✅ SUCCESS' : '❌ FAILED');
if (result6.success) {
  console.log('Adapted:', JSON.stringify(result6.data, null, 2));
  console.log('Adaptations:', result6.adaptations);
} else {
  console.log('Error:', result6.error);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\nSummary:');
const results = [result1, result2, result3, result4, result5, result6];
const successCount = results.filter(r => r.success).length;
console.log(`✅ Passed: ${successCount}/6`);
console.log(`❌ Failed: ${6 - successCount}/6`);
console.log('\nExpected: 5 passed, 1 failed (test 6 should fail)');
