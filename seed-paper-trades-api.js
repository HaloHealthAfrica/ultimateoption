/**
 * Seed Paper Trades via API
 * 
 * Creates realistic paper trade entries by sending webhooks to the Phase 2.5 API.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Helper to generate random number in range
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

// Helper to generate random integer in range
function randomInt(min, max) {
  return Math.floor(randomInRange(min, max));
}

// Helper to pick random item from array
function randomPick(array) {
  return array[randomInt(0, array.length)];
}

// Helper to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate a realistic signal webhook
function generateSignalWebhook(daysAgo, index) {
  const now = Date.now();
  const timestamp = now - (daysAgo * 24 * 60 * 60 * 1000) + (index * 60 * 60 * 1000);
  
  const symbols = ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD'];
  const symbol = randomPick(symbols);
  const basePrice = symbol === 'SPY' ? 580 : 
                   symbol === 'QQQ' ? 500 :
                   symbol === 'IWM' ? 220 :
                   symbol === 'AAPL' ? 230 :
                   symbol === 'MSFT' ? 440 :
                   symbol === 'NVDA' ? 140 :
                   symbol === 'TSLA' ? 380 : 180;
  
  const currentPrice = basePrice * randomInRange(0.98, 1.02);
  const atr = currentPrice * randomInRange(0.015, 0.03);
  
  const direction = randomPick(['LONG', 'SHORT']);
  const quality = randomPick(['HIGH', 'MEDIUM', 'LOW', 'EXTREME']);
  const aiScore = quality === 'EXTREME' ? randomInRange(9, 10) :
                 quality === 'HIGH' ? randomInRange(7, 9) :
                 quality === 'MEDIUM' ? randomInRange(5, 7) :
                 randomInRange(3, 5);
  
  const stopDistance = currentPrice * 0.02;
  const target1Distance = currentPrice * 0.015;
  const target2Distance = currentPrice * 0.03;
  
  return {
    signal: {
      type: direction,
      timeframe: randomPick(['5', '15', '30', '60']),
      quality,
      ai_score: aiScore,
      timestamp,
      bar_time: new Date(timestamp).toISOString(),
    },
    instrument: {
      ticker: symbol,
      exchange: 'NASDAQ',
      current_price: currentPrice,
    },
    entry: {
      price: currentPrice,
      stop_loss: direction === 'LONG' ? currentPrice - stopDistance : currentPrice + stopDistance,
      target_1: direction === 'LONG' ? currentPrice + target1Distance : currentPrice - target1Distance,
      target_2: direction === 'LONG' ? currentPrice + target2Distance : currentPrice - target2Distance,
      stop_reason: 'ATR_BASED',
    },
    risk: {
      amount: randomInRange(500, 2000),
      rr_ratio_t1: randomInRange(1.5, 2.5),
      rr_ratio_t2: randomInRange(2.5, 4.0),
      stop_distance_pct: 2.0,
      recommended_shares: 0,
      recommended_contracts: randomInt(1, 5),
      position_multiplier: randomInRange(0.8, 1.2),
      account_risk_pct: randomInRange(1, 3),
      max_loss_dollars: randomInRange(500, 2000),
    },
    market_context: {
      vwap: currentPrice * randomInRange(0.998, 1.002),
      pmh: currentPrice * 1.01,
      pml: currentPrice * 0.99,
      day_open: currentPrice * randomInRange(0.99, 1.01),
      day_change_pct: randomInRange(-1, 1),
      price_vs_vwap_pct: randomInRange(-0.5, 0.5),
      distance_to_pmh_pct: randomInRange(0.5, 2),
      distance_to_pml_pct: randomInRange(0.5, 2),
      atr,
      volume_vs_avg: randomInRange(0.8, 1.5),
      candle_direction: randomPick(['GREEN', 'RED']),
      candle_size_atr: randomInRange(0.3, 1.2),
    },
    trend: {
      ema_8: currentPrice * randomInRange(0.995, 1.005),
      ema_21: currentPrice * randomInRange(0.99, 1.01),
      ema_50: currentPrice * randomInRange(0.98, 1.02),
      alignment: randomPick(['BULLISH', 'BEARISH', 'NEUTRAL']),
      strength: randomInRange(40, 80),
      rsi: randomInRange(35, 65),
      macd_signal: randomPick(['BULLISH', 'BEARISH']),
    },
    mtf_context: {
      '4h_bias': randomPick(['LONG', 'SHORT']),
      '4h_rsi': randomInRange(40, 60),
      '1h_bias': randomPick(['LONG', 'SHORT']),
    },
    score_breakdown: {
      strat: randomInRange(0, 30),
      trend: randomInRange(0, 25),
      gamma: randomInRange(0, 15),
      vwap: randomInRange(0, 10),
      mtf: randomInRange(0, 10),
      golf: randomInRange(0, 10),
    },
    components: ['STRAT', 'TREND', 'GAMMA', 'VWAP', 'MTF'],
    time_context: {
      market_session: randomPick(['OPEN', 'MIDDAY', 'POWER_HOUR']),
      day_of_week: randomPick(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']),
    },
  };
}

async function sendSignal(signal) {
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signal),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ Failed: ${response.status} - ${text}`);
      return false;
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return false;
  }
}

async function seedPaperTrades() {
  console.log('🌱 Seeding paper trades via API...\n');
  console.log(`📡 Target: ${BASE_URL}\n`);
  
  const daysToSeed = 30;
  let successCount = 0;
  let failCount = 0;
  
  console.log(`📊 Generating trades for the last ${daysToSeed} days...\n`);
  
  for (let day = 0; day < daysToSeed; day++) {
    const numTrades = randomInt(2, 5); // 2-4 trades per day
    const daysAgo = daysToSeed - day;
    
    process.stdout.write(`Day ${day + 1}/${daysToSeed} (${daysAgo} days ago): `);
    
    for (let i = 0; i < numTrades; i++) {
      const signal = generateSignalWebhook(daysAgo, i);
      const success = await sendSignal(signal);
      
      if (success) {
        successCount++;
        process.stdout.write('✓');
      } else {
        failCount++;
        process.stdout.write('✗');
      }
      
      // Small delay to avoid overwhelming the API
      await sleep(100);
    }
    
    process.stdout.write(` (${numTrades} trades)\n`);
  }
  
  console.log(`\n✅ Seeding complete!`);
  console.log(`   Success: ${successCount} trades`);
  console.log(`   Failed: ${failCount} trades`);
  console.log(`   Total: ${successCount + failCount} trades\n`);
  
  console.log('🎯 Next steps:');
  console.log('   1. Visit the paper trades page');
  console.log('   2. View your seeded trades and metrics');
  console.log('   3. Check the dashboard for performance stats\n');
}

// Run the seeder
seedPaperTrades().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
