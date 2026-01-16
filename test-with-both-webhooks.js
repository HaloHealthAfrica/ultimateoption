/**
 * Test with both webhooks to trigger decision
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function test() {
  console.log('🚀 Testing complete webhook flow...\n');
  
  // Send SATY Phase first
  console.log('1️⃣  Sending SATY Phase webhook...');
  const phase = await fetch(`${BASE_URL}/api/phase25/webhooks/saty-phase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "text": JSON.stringify({
        "meta": { "engine": "SATY_PO", "engine_version": "1.0.0", "event_id": `test_${Date.now()}`, "event_type": "REGIME_PHASE_ENTRY", "generated_at": new Date().toISOString() },
        "instrument": { "symbol": "SPY", "exchange": "NASDAQ", "asset_class": "ETF", "session": "REGULAR" },
        "timeframe": { "chart_tf": "15", "event_tf": "15M", "tf_role": "SETUP_FORMATION", "bar_close_time": new Date().toISOString() },
        "event": { "name": "ENTER_ACCUMULATION", "description": "Test", "directional_implication": "UPSIDE_POTENTIAL", "event_priority": 8 },
        "oscillator_state": { "value": 85.0, "previous_value": 78.2, "zone_from": "ACCUMULATION", "zone_to": "ACCUMULATION", "distance_from_zero": 85.0, "distance_from_extreme": 15.0, "velocity": "INCREASING" },
        "regime_context": { "local_bias": "BULLISH", "htf_bias": { "tf": "60", "bias": "BULLISH", "osc_value": 82.3 }, "macro_bias": { "tf": "240", "bias": "BULLISH" } },
        "confidence": { "raw_strength": 0.95, "htf_alignment": true, "confidence_score": 95, "confidence_tier": "EXTREME" },
        "execution_guidance": { "trade_allowed": true, "allowed_directions": ["LONG"], "recommended_execution_tf": ["5", "15"], "requires_confirmation": [] },
        "risk_hints": { "avoid_if": [], "time_decay_minutes": 30, "cooldown_tf": "15" }
      })
    })
  });
  const phaseData = await phase.json();
  console.log('   Response:', phaseData.message || phaseData.error);
  if (phaseData.error) {
    console.log('   ❌ Error details:', phaseData.details);
    return;
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Send Signal
  console.log('\n2️⃣  Sending Signal webhook...');
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
  const signalData = await signal.json();
  console.log('   Response:', signalData.message || signalData.error);
  if (signalData.error) {
    console.log('   ❌ Error details:', signalData.details);
    return;
  }
  if (signalData.decision) {
    console.log('   ✅ Decision:', signalData.decision.action, `(${signalData.decision.confidenceScore}%)`);
  }
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Check database
  console.log('\n3️⃣  Checking database...');
  const check = await fetch(`${BASE_URL}/api/decisions?limit=5&_t=${Date.now()}`);
  const checkData = await check.json();
  console.log('   Total decisions:', checkData.data?.length || 0);
  if (checkData.data?.length > 0) {
    console.log('   ✅ SUCCESS! Data is persisting!');
    checkData.data.forEach((d, i) => {
      console.log(`   ${i+1}. ${d.decision} - ${d.signal?.instrument?.ticker} (${Math.round(d.confluence_score)}%)`);
    });
  } else {
    console.log('   ❌ Still no data in database');
  }
}

test();
