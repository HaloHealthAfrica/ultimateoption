/**
 * Test Market Data Sources
 * Tests MarketData.app, Tradier, and TwelveData APIs
 */

const testPayload = {
  signal: {
    type: "LONG",
    timeframe: "15",
    quality: "HIGH",
    ai_score: 8.5,
    bar_time: new Date().toISOString(),
    timestamp: Date.now()
  },
  instrument: {
    ticker: "SPY",
    exchange: "NYSE",
    current_price: 580.25
  },
  entry: {
    price: 580.25,
    stop_loss: 575.00,
    target_1: 585.00,
    target_2: 590.00,
    stop_reason: "ATR_BASED"
  },
  risk: {
    amount: 1000,
    rr_ratio_t1: 2.5,
    rr_ratio_t2: 4.0,
    account_risk_pct: 1.0,
    max_loss_dollars: 1000,
    stop_distance_pct: 1.5,
    recommended_contracts: 2
  },
  trend: {
    alignment: "BULLISH",
    strength: 75,
    rsi: 62,
    ema_8: 579.50,
    ema_21: 578.00,
    ema_50: 575.00,
    macd_signal: "BULLISH"
  },
  market_context: {
    atr: 3.5,
    vwap: 580.00,
    volume_vs_avg: 1.2,
    day_change_pct: 0.5
  },
  components: ["STRAT", "TREND", "VWAP"],
  score_breakdown: {
    strat: 25,
    trend: 20,
    vwap: 15,
    gamma: 10,
    golf: 5,
    mtf: 10
  }
};

async function testMarketDataSources() {
  console.log('\n=== TESTING MARKET DATA SOURCES ===\n');
  
  const url = 'https://optionstrat.vercel.app/api/phase25/webhooks/signals';
  
  console.log('Sending test signal to Phase 2.5...');
  console.log(`URL: ${url}`);
  console.log(`Symbol: ${testPayload.instrument.ticker}`);
  console.log(`Signal: ${testPayload.signal.type} @ ${testPayload.instrument.current_price}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.json();
    
    console.log(`\nResponse Status: ${response.status}`);
    console.log(`Decision: ${data.decision || 'N/A'}`);
    console.log(`Confidence: ${data.confidence_score || 'N/A'}%`);
    
    if (data.gate_results) {
      console.log('\n--- Gate Results ---');
      for (const [gate, result] of Object.entries(data.gate_results)) {
        console.log(`\n${gate.toUpperCase()} Gate:`);
        console.log(`  Passed: ${result.passed ? '✓' : '✗'}`);
        console.log(`  Score: ${result.score}`);
        console.log(`  Reason: ${result.reason}`);
        
        if (result.details) {
          console.log(`  Details:`, JSON.stringify(result.details, null, 2));
        }
      }
    }
    
    if (data.market_snapshot) {
      console.log('\n--- Market Data Snapshot ---');
      const snapshot = data.market_snapshot;
      
      console.log('\nLiquidity:');
      console.log(`  Spread BPS: ${snapshot.liquidity?.spreadBps || 'N/A'}`);
      console.log(`  Depth Score: ${snapshot.liquidity?.depthScore || 'N/A'}`);
      console.log(`  Provider: ${snapshot.liquidity?.provider || 'N/A'}`);
      
      console.log('\nOptions:');
      console.log(`  IV Rank: ${snapshot.options?.ivRank || 'N/A'}`);
      console.log(`  Put/Call Ratio: ${snapshot.options?.putCallRatio || 'N/A'}`);
      console.log(`  Provider: ${snapshot.options?.provider || 'N/A'}`);
      
      console.log('\nStats:');
      console.log(`  RSI: ${snapshot.stats?.rsi || 'N/A'}`);
      console.log(`  Volume: ${snapshot.stats?.volume || 'N/A'}`);
      console.log(`  Provider: ${snapshot.stats?.provider || 'N/A'}`);
    }
    
    console.log('\n--- Full Response ---');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Run the test
testMarketDataSources();
