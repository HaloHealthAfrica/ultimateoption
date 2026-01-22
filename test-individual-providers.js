/**
 * Test Individual Market Data Providers
 */

async function testProvider(name, url) {
  console.log(`\n--- Testing ${name} ---`);
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2).substring(0, 500));
    return { name, status: response.status, success: response.ok, data };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { name, status: 'error', success: false, error: error.message };
  }
}

async function testAllProviders() {
  console.log('\n=== TESTING INDIVIDUAL DATA PROVIDERS ===\n');
  
  const results = [];
  
  // Test MarketData.app
  results.push(await testProvider(
    'MarketData.app (Quote)',
    'https://api.marketdata.app/v1/stocks/quotes/SPY/'
  ));
  
  results.push(await testProvider(
    'MarketData.app (Options)',
    'https://api.marketdata.app/v1/options/quotes/SPY/'
  ));
  
  // Test Tradier
  results.push(await testProvider(
    'Tradier (Quote)',
    'https://api.tradier.com/v1/markets/quotes?symbols=SPY'
  ));
  
  // Test TwelveData
  results.push(await testProvider(
    'TwelveData (Quote)',
    'https://api.twelvedata.com/quote?symbol=SPY&apikey=demo'
  ));
  
  console.log('\n\n=== SUMMARY ===\n');
  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    console.log(`${status} ${r.name}: ${r.status}`);
  });
  
  console.log('\n=== RECOMMENDATIONS ===\n');
  
  const working = results.filter(r => r.success);
  const failing = results.filter(r => !r.success);
  
  console.log(`Working: ${working.length}/${results.length}`);
  console.log(`Failing: ${failing.length}/${results.length}`);
  
  if (failing.length > 0) {
    console.log('\nFailing providers:');
    failing.forEach(r => {
      console.log(`  - ${r.name}`);
      if (r.data?.error) console.log(`    Error: ${r.data.error}`);
      if (r.data?.s === 'error') console.log(`    Message: ${r.data.errmsg}`);
    });
  }
}

testAllProviders();
