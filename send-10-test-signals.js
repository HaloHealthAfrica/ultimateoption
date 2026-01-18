/**
 * Send 10 Test Signals to Phase 2.5
 * 
 * Populates the dashboard with test decisions
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const symbols = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'MSFT', 'NVDA', 'AMD', 'GOOGL', 'AMZN', 'META'];
const directions = ['LONG', 'SHORT'];
const qualities = ['EXTREME', 'HIGH', 'MEDIUM'];

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomPrice(base) {
  return +(base + (Math.random() - 0.5) * 10).toFixed(2);
}

async function sendSignal(symbol, index) {
  const direction = randomChoice(directions);
  const quality = randomChoice(qualities);
  const basePrice = 100 + index * 50;
  const price = randomPrice(basePrice);
  const aiScore = +(7 + Math.random() * 3).toFixed(1);
  
  const payload = {
    signal: {
      type: direction,
      timeframe: '15',
      quality: quality,
      ai_score: aiScore
    },
    instrument: {
      ticker: symbol,
      exchange: 'NASDAQ',
      current_price: price
    },
    risk: {
      rr_ratio_t1: +(2 + Math.random() * 2).toFixed(1),
      rr_ratio_t2: +(4 + Math.random() * 2).toFixed(1)
    },
    entry: {
      price: price,
      stop_loss: direction === 'LONG' ? price * 0.97 : price * 1.03,
      target_1: direction === 'LONG' ? price * 1.02 : price * 0.98,
      target_2: direction === 'LONG' ? price * 1.04 : price * 0.96
    }
  };
  
  console.log(`\n${index + 1}. Sending ${direction} signal for ${symbol} @ $${price}...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`   ✅ ${result.message}`);
      if (result.decision) {
        console.log(`   Decision: ${result.decision.action} (confidence: ${result.decision.confidenceScore})`);
      }
      if (result.details?.ledgerStored) {
        console.log(`   ✅ Stored in database`);
      }
    } else {
      console.log(`   ❌ Failed: ${result.message}`);
    }
    
    return result;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('📊 Sending 10 Test Signals to Phase 2.5');
  console.log('='.repeat(70));
  console.log(`Target: ${BASE_URL}`);
  
  const results = [];
  
  for (let i = 0; i < symbols.length; i++) {
    const result = await sendSignal(symbols[i], i);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📈 Summary');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r?.success).length;
  const stored = results.filter(r => r?.details?.ledgerStored).length;
  
  console.log(`Total signals sent: ${symbols.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Stored in database: ${stored}`);
  
  console.log('\n📊 View dashboard at:');
  console.log(`   ${BASE_URL}`);
  console.log('   Click "Phase 2.5" tab to see decisions\n');
  
  console.log('🔔 View webhooks at:');
  console.log(`   ${BASE_URL}/api/webhooks/recent`);
  console.log(`   ${BASE_URL}/api/webhooks/stats\n`);
}

main().catch(console.error);
