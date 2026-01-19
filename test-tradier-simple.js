/**
 * Simple Tradier API Test
 * Tests if we can get quote data from Tradier
 */

const https = require('https');

async function testTradier() {
  console.log('Testing Tradier API...\n');
  
  // Get the API key from Vercel
  const keyResponse = await fetch('https://optionstrat.vercel.app/api/admin/test-market-feeds');
  const keyData = await keyResponse.json();
  
  console.log(`API Key Status: ${keyData.environment.TRADIER_API_KEY}`);
  console.log(`Key Length: ${keyData.keyLengths.TRADIER_API_KEY} chars`);
  console.log(`Key Preview: ${keyData.keyPreviews.TRADIER_API_KEY}`);
  console.log('');
  
  // Now send a webhook and check the market data
  console.log('Sending test webhook...');
  
  const webhookResponse = await fetch('https://optionstrat.vercel.app/api/phase25/webhooks/signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal: {
        type: 'LONG',
        timeframe: '15',
        ticker: 'SPY',
        price: 580.50,
        aiScore: 9.5,
        quality: 'EXTREME',
        timestamp: new Date().toISOString()
      }
    })
  });
  
  const webhookData = await webhookResponse.json();
  
  console.log(`Decision: ${webhookData.decision.action}`);
  console.log(`Confidence: ${webhookData.decision.confidenceScore}%`);
  console.log('');
  
  const marketSnapshot = webhookData.decision.marketSnapshot;
  
  if (marketSnapshot) {
    console.log('='.repeat(60));
    console.log('MARKET DATA RESULTS');
    console.log('='.repeat(60));
    console.log('');
    
    console.log(`Completeness: ${(marketSnapshot.completeness * 100).toFixed(1)}%`);
    console.log('');
    
    // Tradier Options
    if (marketSnapshot.options) {
      console.log('Tradier Options:');
      console.log(`  Put/Call: ${marketSnapshot.options.putCallRatio}`);
      console.log(`  IV: ${marketSnapshot.options.ivPercentile}%`);
      console.log(`  Gamma: ${marketSnapshot.options.gammaBias}`);
      const isFallback = marketSnapshot.options.putCallRatio === 1.0 && 
                        marketSnapshot.options.ivPercentile === 50;
      console.log(`  Status: ${isFallback ? '⚠️  FALLBACK' : '✓ REAL DATA'}`);
      console.log('');
    }
    
    // TwelveData Stats
    if (marketSnapshot.stats) {
      console.log('TwelveData Stats:');
      console.log(`  ATR: ${marketSnapshot.stats.atr14}`);
      console.log(`  RSI: ${marketSnapshot.stats.rsi}`);
      console.log(`  Volume: ${marketSnapshot.stats.volume}`);
      const isFallback = marketSnapshot.stats.atr14 === 2.0 || marketSnapshot.stats.atr14 === 0;
      console.log(`  Status: ${isFallback ? '⚠️  FALLBACK' : '✓ REAL DATA'}`);
      console.log('');
    }
    
    // Tradier Liquidity
    if (marketSnapshot.liquidity) {
      console.log('Tradier Liquidity (NEW):');
      console.log(`  Spread: ${marketSnapshot.liquidity.spreadBps.toFixed(2)} bps`);
      console.log(`  Depth: ${marketSnapshot.liquidity.depthScore.toFixed(1)}`);
      console.log(`  Velocity: ${marketSnapshot.liquidity.tradeVelocity}`);
      console.log(`  Bid Size: ${marketSnapshot.liquidity.bidSize}`);
      console.log(`  Ask Size: ${marketSnapshot.liquidity.askSize}`);
      const isFallback = marketSnapshot.liquidity.spreadBps === 15.0 && 
                        marketSnapshot.liquidity.depthScore === 50.0 &&
                        marketSnapshot.liquidity.bidSize === 100;
      console.log(`  Status: ${isFallback ? '⚠️  FALLBACK' : '✓ REAL DATA'}`);
      console.log('');
    } else {
      console.log('Tradier Liquidity: ✗ NO DATA');
      console.log('');
    }
    
    // Errors
    if (marketSnapshot.errors && marketSnapshot.errors.length > 0) {
      console.log('ERRORS:');
      marketSnapshot.errors.forEach(err => console.log(`  • ${err}`));
      console.log('');
    }
    
    console.log('='.repeat(60));
    
    if (marketSnapshot.completeness === 1.0) {
      console.log('✅ SUCCESS - All providers working!');
    } else {
      console.log(`⚠️  PARTIAL - ${(marketSnapshot.completeness * 100).toFixed(0)}% working`);
    }
    console.log('='.repeat(60));
  }
}

testTradier().catch(console.error);
