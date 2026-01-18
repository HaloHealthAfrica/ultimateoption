/**
 * Test Tradier Liquidity Integration
 * Verifies that Tradier can provide liquidity data
 */

const axios = require('axios');

async function testTradierLiquidity() {
  console.log('='.repeat(80));
  console.log('TRADIER LIQUIDITY TEST');
  console.log('='.repeat(80));
  console.log('');

  const symbol = 'SPY';
  
  // Test 1: Check if we can get quote data from Tradier
  console.log('Step 1: Testing Tradier Quote Endpoint...');
  console.log('-'.repeat(80));
  
  try {
    const response = await axios.post(
      'https://optionstrat.vercel.app/api/phase25/webhooks/signals',
      {
        signal: {
          type: 'LONG',
          timeframe: '15',
          ticker: symbol,
          price: 580.50,
          aiScore: 9.5,
          quality: 'EXTREME',
          timestamp: new Date().toISOString()
        }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const data = response.data;
    
    console.log('✓ Webhook processed successfully');
    console.log(`  Decision: ${data.decision.action}`);
    console.log(`  Confidence: ${data.decision.confidenceScore}%`);
    console.log('');
    
    // Check market snapshot
    const marketSnapshot = data.decision.marketSnapshot;
    
    if (marketSnapshot) {
      console.log('Step 2: Analyzing Market Data...');
      console.log('-'.repeat(80));
      console.log('');
      
      console.log(`Market Context Completeness: ${(marketSnapshot.completeness * 100).toFixed(1)}%`);
      console.log('');
      
      // Check Tradier Options
      if (marketSnapshot.options) {
        console.log('Tradier Options Data:');
        console.log(`  Put/Call Ratio: ${marketSnapshot.options.putCallRatio}`);
        console.log(`  IV Percentile: ${marketSnapshot.options.ivPercentile}%`);
        console.log(`  Gamma Bias: ${marketSnapshot.options.gammaBias}`);
        console.log(`  Status: ${marketSnapshot.options.putCallRatio === 1.0 ? '⚠️  Fallback' : '✓ Real Data'}`);
        console.log('');
      }
      
      // Check TwelveData Stats
      if (marketSnapshot.stats) {
        console.log('TwelveData Statistics:');
        console.log(`  ATR(14): ${marketSnapshot.stats.atr14}`);
        console.log(`  RSI: ${marketSnapshot.stats.rsi}`);
        console.log(`  Volume: ${marketSnapshot.stats.volume}`);
        console.log(`  Status: ${marketSnapshot.stats.atr14 === 2.0 ? '⚠️  Fallback' : '✓ Real Data'}`);
        console.log('');
      }
      
      // Check Liquidity (now from Tradier)
      if (marketSnapshot.liquidity) {
        console.log('Tradier Liquidity Data (NEW):');
        console.log(`  Spread (bps): ${marketSnapshot.liquidity.spreadBps.toFixed(2)}`);
        console.log(`  Depth Score: ${marketSnapshot.liquidity.depthScore.toFixed(1)}`);
        console.log(`  Trade Velocity: ${marketSnapshot.liquidity.tradeVelocity}`);
        console.log(`  Bid Size: ${marketSnapshot.liquidity.bidSize}`);
        console.log(`  Ask Size: ${marketSnapshot.liquidity.askSize}`);
        
        const isUsingFallback = 
          marketSnapshot.liquidity.spreadBps === 15.0 &&
          marketSnapshot.liquidity.depthScore === 50.0 &&
          marketSnapshot.liquidity.tradeVelocity === 'NORMAL' &&
          marketSnapshot.liquidity.bidSize === 100 &&
          marketSnapshot.liquidity.askSize === 100;
        
        console.log(`  Status: ${isUsingFallback ? '⚠️  Using Fallback' : '✓ Real Data from Tradier'}`);
        console.log('');
      } else {
        console.log('✗ No liquidity data in response');
        console.log('');
      }
      
      // Check for errors
      if (marketSnapshot.errors && marketSnapshot.errors.length > 0) {
        console.log('Errors:');
        marketSnapshot.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
        console.log('');
      } else {
        console.log('✓ No errors - all providers working!');
        console.log('');
      }
      
      // Summary
      console.log('='.repeat(80));
      console.log('SUMMARY');
      console.log('='.repeat(80));
      console.log('');
      
      if (marketSnapshot.completeness === 1.0) {
        console.log('✅ SUCCESS: 100% completeness - all data providers working!');
        console.log('');
        console.log('Data Sources:');
        console.log('  • Tradier: Options data + Liquidity data');
        console.log('  • TwelveData: Market statistics');
        console.log('');
        console.log('Benefits:');
        console.log('  ✓ No Alpaca subscription needed');
        console.log('  ✓ Using only 2 providers instead of 3');
        console.log('  ✓ No additional costs');
        console.log('  ✓ Simpler architecture');
      } else {
        console.log(`⚠️  Partial Success: ${(marketSnapshot.completeness * 100).toFixed(1)}% completeness`);
        console.log('');
        console.log('Some providers may be using fallback values.');
        console.log('Check the status messages above for details.');
      }
      
      console.log('');
      console.log('='.repeat(80));
      
    } else {
      console.log('✗ No market snapshot in response');
    }
    
  } catch (error) {
    console.log(`✗ Test failed: ${error.message}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run the test
testTradierLiquidity().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
