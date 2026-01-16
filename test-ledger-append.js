/**
 * Test ledger append directly to see actual error
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function testAppend() {
  console.log('🔍 Testing ledger append with detailed error logging...\n');
  
  // Send a simple webhook that should trigger a decision
  console.log('1️⃣  Sending Signal webhook...');
  const signal = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "signal": { "type": "LONG", "timeframe": "15", "quality": "EXTREME", "ai_score": 9.5, "timestamp": Date.now(), "bar_time": new Date().toISOString() },
      "instrument": { "ticker": "SPY", "exchange": "NASDAQ", "current_price": 450.25 },
      "entry": { "price": 450.25, "stop_loss": 448.50, "target_1": 452.00, "target_2": 454.00, "stop_reason": "ATR" },
      "risk": { "amount": 1000, "rr_ratio_t1": 2.5, "rr_ratio_t2": 4.0, "stop_distance_pct": 0.39, "recommended_shares": 571, "recommended_contracts": 5, "position_multiplier": 1.5, "account_risk_pct": 1.0, "max_loss_dollars": 1000 },
      "market_context": { "vwap": 449.80, "pmh": 451.20, "pml": 447.50, "day_open": 448.90, "day_change_pct": 0.30, "price_vs_vwap_pct": 0.10, "distance_to_pmh_pct": 0.21, "distance_to_pml_pct": 0.61, "atr": 4.50, "volume_vs_avg": 1.2, "candle_direction": "GREEN", "candle_size_atr": 0.8 },
      "trend": { "ema_8": 449.50, "ema_21": 448.20, "ema_50": 446.80, "alignment": "BULLISH", "strength": 85, "rsi": 62, "macd_signal": "BULLISH" },
      "mtf_context": { "4h_bias": "LONG", "4h_rsi": 58, "1h_bias": "LONG" },
      "score_breakdown": { "strat": 3.0, "trend": 2.5, "gamma": 1.5, "vwap": 1.0, "mtf": 1.0, "golf": 0.5 },
      "components": ["STRAT", "TREND", "GAMMA", "VWAP", "MTF"],
      "time_context": { "market_session": "OPEN", "day_of_week": "TUESDAY" }
    })
  });
  
  const response = await signal.text();
  console.log('   Raw response:', response);
  
  try {
    const data = JSON.parse(response);
    console.log('   Parsed response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.log('\n❌ ERROR FOUND:');
      console.log('   Message:', data.error);
      if (data.details) {
        console.log('   Details:', data.details);
      }
      if (data.stack) {
        console.log('   Stack:', data.stack);
      }
    } else if (data.decision) {
      console.log('\n✅ Decision made:', data.decision.action);
      console.log('   Confidence:', data.decision.confidenceScore);
    }
  } catch (e) {
    console.log('   Failed to parse JSON:', e.message);
  }
  
  // Wait and check database
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n2️⃣  Checking database...');
  const check = await fetch(`${BASE_URL}/api/decisions?limit=1&_t=${Date.now()}`);
  const checkData = await check.json();
  console.log('   Total decisions:', checkData.data?.length || 0);
  
  if (checkData.data?.length > 0) {
    console.log('   ✅ Data persisted!');
  } else {
    console.log('   ❌ No data in database');
  }
}

testAppend();
