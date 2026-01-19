/**
 * Test Production with Proper TradingView Webhook Format
 */

const https = require('https');

const PRODUCTION_URL = process.argv[2] || 'https://optionstrat.vercel.app';

// Proper TradingView Signal format
const testPayload = {
  ticker: 'SPY',
  action: 'buy',
  price: 585.50,
  time: new Date().toISOString(),
  strategy: {
    order_action: 'buy',
    order_contracts: 1,
    order_price: 585.50,
    order_id: 'test_' + Date.now()
  }
};

console.log('Testing:', PRODUCTION_URL);
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
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log();
    
    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));
      console.log();
      
      if (response.marketSnapshot) {
        const { completeness, errors, options, stats, liquidity } = response.marketSnapshot;
        
        console.log('='.repeat(80));
        console.log('MARKETDATA.APP STATUS');
        console.log('='.repeat(80));
        console.log(`Completeness: ${(completeness * 100).toFixed(1)}%`);
        console.log(`Errors: ${errors?.length || 0}`);
        
        if (errors?.length > 0) {
          console.log('\nErrors:');
          errors.forEach(err => console.log(`  - ${err}`));
        }
        
        console.log();
        
        // Check if using MarketData.app (real data) or fallbacks
        const hasRealOptions = options && options.optionVolume > 0;
        const hasRealLiquidity = liquidity && liquidity.bidSize > 100;
        const hasRealStats = stats && stats.volume > 0;
        
        if (completeness === 1.0 && hasRealOptions && hasRealLiquidity && hasRealStats) {
          console.log('✅ SUCCESS: MarketData.app is WORKING!');
          console.log();
          console.log('Options Data (from MarketData.app):');
          console.log(`  Put/Call Ratio: ${options.putCallRatio.toFixed(2)}`);
          console.log(`  IV Percentile: ${options.ivPercentile.toFixed(1)}%`);
          console.log(`  Gamma Bias: ${options.gammaBias}`);
          console.log(`  Option Volume: ${options.optionVolume.toLocaleString()}`);
          console.log();
          console.log('Liquidity Data (from MarketData.app):');
          console.log(`  Spread: ${liquidity.spreadBps.toFixed(2)} bps`);
          console.log(`  Bid Size: ${liquidity.bidSize.toLocaleString()}`);
          console.log(`  Ask Size: ${liquidity.askSize.toLocaleString()}`);
          console.log(`  Depth Score: ${liquidity.depthScore.toFixed(1)}/100`);
          console.log();
          console.log('Market Stats (from MarketData.app):');
          console.log(`  ATR(14): ${stats.atr14.toFixed(2)}`);
          console.log(`  RSI(14): ${stats.rsi.toFixed(1)}`);
          console.log(`  Volume: ${stats.volume.toLocaleString()}`);
          console.log(`  Volume Ratio: ${stats.volumeRatio.toFixed(2)}x`);
        } else if (completeness === 1.0) {
          console.log('⚠️  WARNING: 100% complete but using FALLBACK values');
          console.log();
          console.log('This means:');
          console.log('  - MARKETDATA_API_KEY is NOT set in Vercel');
          console.log('  - OR the API key is invalid');
          console.log('  - System is using legacy providers or fallbacks');
          console.log();
          console.log('Options Data (fallback):');
          if (options) {
            console.log(`  Put/Call Ratio: ${options.putCallRatio} (generic)`);
            console.log(`  IV Percentile: ${options.ivPercentile}% (generic)`);
            console.log(`  Option Volume: ${options.optionVolume} (zero)`);
          }
        } else {
          console.log('❌ ISSUE: Not at 100% completeness');
          console.log(`   Completeness: ${(completeness * 100).toFixed(1)}%`);
          console.log('   Some data sources are failing');
        }
        
        console.log();
        console.log('='.repeat(80));
        
      } else {
        console.log('No marketSnapshot in response');
      }
      
    } catch (error) {
      console.error('Failed to parse:', error.message);
      console.log('Raw:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
  process.exit(1);
});

req.write(postData);
req.end();
