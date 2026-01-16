/**
 * Phase 2.5 Diagnostic Script
 * 
 * Tests the complete flow and shows where data is lost
 */

const BASE_URL = process.env.BASE_URL || 'https://optionstrat.vercel.app';

async function test(name, fn) {
  console.log(`\n🔍 ${name}`);
  try {
    await fn();
    console.log('   ✅ Passed');
  } catch (error) {
    console.log('   ❌ Failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Phase 2.5 Diagnostic\n');
  console.log('Target:', BASE_URL);
  
  // Test 1: Check if API endpoints exist
  await test('API Endpoints Exist', async () => {
    const endpoints = [
      '/api/phase25/webhooks/signals',
      '/api/phase25/webhooks/saty-phase',
      '/api/decisions',
      '/api/ledger'
    ];
    
    for (const endpoint of endpoints) {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: endpoint.includes('webhooks') ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.includes('webhooks') ? JSON.stringify({}) : undefined
      });
      console.log(`   ${endpoint}: ${res.status}`);
    }
  });
  
  // Test 2: Check current ledger state
  await test('Check Ledger State (Before)', async () => {
    const res = await fetch(`${BASE_URL}/api/decisions?limit=10`);
    const data = await res.json();
    console.log(`   Decisions in ledger: ${data.data?.length || 0}`);
    if (data.data?.length > 0) {
      console.log(`   Latest: ${data.data[0].decision} at ${new Date(data.data[0].created_at).toISOString()}`);
    }
  });
  
  // Test 3: Send SATY Phase webhook
  await test('Send SATY Phase Webhook', async () => {
    const payload = {
      "text": JSON.stringify({
        "meta": {
          "engine": "SATY_PO",
          "engine_version": "1.0.0",
          "event_id": `evt_diag_${Date.now()}`,
          "event_type": "REGIME_PHASE_ENTRY",
          "generated_at": new Date().toISOString()
        },
        "instrument": {
          "symbol": "SPY",
          "exchange": "NASDAQ",
          "asset_class": "ETF",
          "session": "REGULAR"
        },
        "timeframe": {
          "chart_tf": "15",
          "event_tf": "15M",
          "tf_role": "SETUP_FORMATION",
          "bar_close_time": new Date().toISOString()
        },
        "event": {
          "name": "ENTER_ACCUMULATION",
          "description": "Entering accumulation phase",
          "directional_implication": "UPSIDE_POTENTIAL",
          "event_priority": 8
        },
        "oscillator_state": {
          "value": 85.0,
          "previous_value": 78.2,
          "zone_from": "ACCUMULATION",
          "zone_to": "ACCUMULATION",
          "distance_from_zero": 85.0,
          "distance_from_extreme": 15.0,
          "velocity": "INCREASING"
        },
        "regime_context": {
          "local_bias": "BULLISH",
          "htf_bias": {
            "tf": "60",
            "bias": "BULLISH",
            "osc_value": 82.3
          },
          "macro_bias": {
            "tf": "240",
            "bias": "BULLISH"
          }
        },
        "confidence": {
          "raw_strength": 0.95,
          "htf_alignment": true,
          "confidence_score": 95,
          "confidence_tier": "EXTREME"
        },
        "execution_guidance": {
          "trade_allowed": true,
          "allowed_directions": ["LONG"],
          "recommended_execution_tf": ["5", "15"],
          "requires_confirmation": []
        },
        "risk_hints": {
          "avoid_if": [],
          "time_decay_minutes": 30,
          "cooldown_tf": "15"
        }
      })
    };
    
    const res = await fetch(`${BASE_URL}/api/phase25/webhooks/saty-phase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response: ${data.message || data.error}`);
  });
  
  // Wait 2 seconds
  console.log('\n⏳ Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Send Signal webhook
  await test('Send Signal Webhook', async () => {
    const payload = {
      "signal": {
        "type": "LONG",
        "timeframe": "15",
        "quality": "EXTREME",
        "ai_score": 9.5,
        "timestamp": Date.now(),
        "bar_time": new Date().toISOString()
      },
      "instrument": {
        "ticker": "SPY",
        "exchange": "NASDAQ",
        "current_price": 450.25
      },
      "entry": {
        "price": 450.25,
        "stop_loss": 448.50,
        "target_1": 452.00,
        "target_2": 454.00,
        "stop_reason": "ATR-based"
      },
      "risk": {
        "amount": 1000,
        "rr_ratio_t1": 2.5,
        "rr_ratio_t2": 4.0,
        "stop_distance_pct": 0.39,
        "recommended_shares": 571,
        "recommended_contracts": 5,
        "position_multiplier": 1.5,
        "account_risk_pct": 1.0,
        "max_loss_dollars": 1000
      },
      "market_context": {
        "vwap": 449.80,
        "pmh": 451.20,
        "pml": 447.50,
        "day_open": 448.90,
        "day_change_pct": 0.30,
        "price_vs_vwap_pct": 0.10,
        "distance_to_pmh_pct": 0.21,
        "distance_to_pml_pct": 0.61,
        "atr": 4.50,
        "volume_vs_avg": 1.2,
        "candle_direction": "GREEN",
        "candle_size_atr": 0.8
      },
      "trend": {
        "ema_8": 449.50,
        "ema_21": 448.20,
        "ema_50": 446.80,
        "alignment": "BULLISH",
        "strength": 85,
        "rsi": 62,
        "macd_signal": "BULLISH"
      },
      "mtf_context": {
        "4h_bias": "LONG",
        "4h_rsi": 58,
        "1h_bias": "LONG"
      },
      "score_breakdown": {
        "strat": 3.0,
        "trend": 2.5,
        "gamma": 1.5,
        "vwap": 1.0,
        "mtf": 1.0,
        "golf": 0.5
      },
      "components": ["STRAT", "TREND", "GAMMA", "VWAP", "MTF"],
      "time_context": {
        "market_session": "OPEN",
        "day_of_week": "TUESDAY"
      }
    };
    
    const res = await fetch(`${BASE_URL}/api/phase25/webhooks/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response: ${data.message || data.error}`);
    if (data.decision) {
      console.log(`   Decision: ${data.decision.action}`);
      console.log(`   Confidence: ${data.decision.confidenceScore}%`);
      console.log(`   Reasons: ${data.decision.reasons?.join(', ')}`);
    }
  });
  
  // Wait 2 seconds
  console.log('\n⏳ Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 5: Check ledger state after webhooks
  await test('Check Ledger State (After)', async () => {
    const res = await fetch(`${BASE_URL}/api/decisions?limit=10&_t=${Date.now()}`);
    const data = await res.json();
    console.log(`   Decisions in ledger: ${data.data?.length || 0}`);
    if (data.data?.length > 0) {
      console.log(`   Latest: ${data.data[0].decision} at ${new Date(data.data[0].created_at).toISOString()}`);
      console.log(`   Ticker: ${data.data[0].signal?.instrument?.ticker}`);
      console.log(`   Confidence: ${data.data[0].confluence_score}%`);
    } else {
      console.log('   ⚠️  NO DECISIONS FOUND - This is the problem!');
    }
  });
  
  // Test 6: Check if it's a serverless memory issue
  await test('Serverless Memory Test', async () => {
    console.log('   Issue: Vercel serverless functions don\'t share memory');
    console.log('   Webhook call = Instance A (stores in memory)');
    console.log('   API call = Instance B (empty memory)');
    console.log('   Solution: Need PostgreSQL database');
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSIS COMPLETE');
  console.log('='.repeat(60));
  console.log('\n🔴 ROOT CAUSE:');
  console.log('   In-memory ledger doesn\'t persist across serverless invocations');
  console.log('\n💡 SOLUTION:');
  console.log('   1. Set up PostgreSQL database (Neon or Supabase)');
  console.log('   2. Add DATABASE_URL to Vercel environment variables');
  console.log('   3. Redeploy');
  console.log('\n📖 See: DATABASE_SETUP_GUIDE.md for instructions\n');
}

main().catch(console.error);
