/**
 * Test Production MarketData.app Integration
 * 
 * Tests the deployed production endpoint to verify MarketData.app is working
 */

const https = require('https');

// Your production URL - update this
const PRODUCTION_URL = process.argv[2] || 'https://your-app.vercel.app';
const TEST_SYMBOL = 'SPY';

console.log('='.repeat(80));
console.log('PRODUCTION MARKETDATA.APP TEST');
console.log('='.repeat(80));
console.log(`Production URL: ${PRODUCTION_URL}`);
console.log(`Test Symbol: ${TEST_SYMBOL}`);
console.log('='.repeat(80));
console.log();

// Test webhook endpoint
const testPayload = {
  symbol: TEST_SYMBOL,
  action: 'BUY',
  price: 585.50,
  timestamp: Date.now()
};

console.log('📤 Sending test webhook...');
console.log('Payload:', JSON.stringify(testPayload, null, 2));
console.log();

const url = new URL('/api/phase25/webhooks/signals', PRODUCTION_URL);

const postData = JSON.stringify(testPayload);

const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📥 Response received');
    console.log('Status:', res.statusCode);
    console.log();

    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));
      console.log();

      // Check for MarketData.app usage
      if (response.marketSnapshot) {
        const { completeness, errors, options, stats, liquidity } = response.marketSnapshot;
        
        console.log('='.repeat(80));
        console.log('MARKET DATA ANALYSIS');
        console.log('='.repeat(80));
        console.log(`Completeness: ${(completeness * 100).toFixed(1)}%`);
        console.log(`Errors: ${errors?.length || 0}`);
        
        if (errors?.length > 0) {
          console.log('\nErrors:');
          errors.forEach(err => console.log(`  - ${err}`));
        }
        
        console.log();
        console.log('Options Data:', options ? '✅ Present' : '❌ Missing');
        if (options) {
          console.log(`  Put/Call Ratio: ${options.putCallRatio?.toFixed(2) || 'N/A'}`);
          console.log(`  IV Percentile: ${options.ivPercentile?.toFixed(1) || 'N/A'}%`);
          console.log(`  Gamma Bias: ${options.gammaBias || 'N/A'}`);
          console.log(`  Option Volume: ${options.optionVolume?.toLocaleString() || 'N/A'}`);
        }
        
        console.log();
        console.log('Liquidity Data:', liquidity ? '✅ Present' : '❌ Missing');
        if (liquidity) {
          console.log(`  Spread: ${liquidity.spreadBps?.toFixed(2) || 'N/A'} bps`);
          console.log(`  Depth Score: ${liquidity.depthScore?.toFixed(1) || 'N/A'}/100`);
          console.log(`  Trade Velocity: ${liquidity.tradeVelocity || 'N/A'}`);
          console.log(`  Bid Size: ${liquidity.bidSize?.toLocaleString() || 'N/A'}`);
          console.log(`  Ask Size: ${liquidity.askSize?.toLocaleString() || 'N/A'}`);
        }
        
        console.log();
        console.log('Market Stats:', stats ? '✅ Present' : '❌ Missing');
        if (stats) {
          console.log(`  ATR(14): ${stats.atr14?.toFixed(2) || 'N/A'}`);
          console.log(`  RSI(14): ${stats.rsi?.toFixed(1) || 'N/A'}`);
          console.log(`  RV(20): ${stats.rv20?.toFixed(2) || 'N/A'}%`);
          console.log(`  Volume: ${stats.volume?.toLocaleString() || 'N/A'}`);
          console.log(`  Volume Ratio: ${stats.volumeRatio?.toFixed(2) || 'N/A'}x`);
        }
        
        console.log();
        console.log('='.repeat(80));
        
        // Determine if using MarketData.app
        const hasRealData = completeness === 1.0 && 
                           options?.optionVolume > 0 && 
                           liquidity?.bidSize > 100 &&
                           stats?.volume > 0;
        
        if (hasRealData) {
          console.log('✅ SUCCESS: MarketData.app is working!');
          console.log('   - 100% completeness');
          console.log('   - Real options data with volume');
          console.log('   - Real liquidity with bid/ask sizes');
          console.log('   - Real market stats');
        } else if (completeness === 1.0) {
          console.log('⚠️  WARNING: 100% complete but using fallback values');
          console.log('   - Check if MARKETDATA_API_KEY is set in Vercel');
          console.log('   - Verify API key is valid');
        } else {
          console.log('❌ ISSUE: Not at 100% completeness');
          console.log('   - Some data sources are failing');
          console.log('   - Check Vercel logs for errors');
        }
        
      } else {
        console.log('⚠️  No marketSnapshot in response');
        console.log('   This might be an error response');
      }
      
    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});

req.write(postData);
req.end();
