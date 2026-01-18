/**
 * Staggered Webhook Test
 * 
 * Fires all 3 webhook types with realistic timing:
 * - 3min: SATY Phase webhook (regime context)
 * - 5min: Trend/MTF webhook (alignment context)
 * - 15min: TradingView Signal webhook (triggers decision)
 * 
 * This simulates real-world webhook arrival patterns.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

async function sendWebhook(url, payload, name, timeframe) {
  const startTime = Date.now();
  
  try {
    log(`\n[${new Date().toLocaleTimeString()}] Sending ${name} (${timeframe})...`, 'cyan');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (response.ok) {
      log(`✅ ${name} SUCCESS (${duration}ms)`, 'green');
      log(`   Status: ${response.status}`, 'green');
      log(`   Message: ${data.message || 'No message'}`, 'green');
      
      if (data.decision) {
        log(`   Decision: ${data.decision.action} (confidence: ${data.decision.confidenceScore}%)`, 'yellow');
      }
      
      if (data.ledgerStored !== undefined) {
        log(`   Ledger: ${data.ledgerStored ? 'Stored ✅' : 'Not stored ❌'}`, data.ledgerStored ? 'green' : 'red');
      }
    } else {
      log(`❌ ${name} FAILED (${duration}ms)`, 'red');
      log(`   Status: ${response.status}`, 'red');
      log(`   Error: ${data.error || 'Unknown error'}`, 'red');
      if (data.message) {
        log(`   Message: ${data.message}`, 'yellow');
      }
    }

    return { success: response.ok, data, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    log(`❌ ${name} ERROR (${duration}ms)`, 'red');
    log(`   ${error.message}`, 'red');
    return { success: false, error: error.message, duration };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkContextStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/phase25/context/status?symbol=SPY&_t=${Date.now()}`);
    const data = await response.json();
    
    logSection('CONTEXT STATUS');
    
    if (data.snapshot?.context) {
      const lastUpdated = data.snapshot.context.lastUpdated || {};
      const now = Date.now();
      
      log('Webhook Sources:', 'bright');
      Object.entries(lastUpdated).forEach(([source, timestamp]) => {
        const ageSeconds = Math.floor((now - timestamp) / 1000);
        log(`  ${source}: ${ageSeconds}s ago`, 'cyan');
      });
      
      log(`\nCompleteness: ${Math.round((data.status?.completeness || 0) * 100)}%`, 'yellow');
    } else {
      log('No context snapshot found yet', 'yellow');
    }
  } catch (error) {
    log(`Error checking context: ${error.message}`, 'red');
  }
}

async function checkDecisions() {
  try {
    const response = await fetch(`${BASE_URL}/api/decisions?limit=3&_t=${Date.now()}`);
    const data = await response.json();
    
    logSection('RECENT DECISIONS');
    
    if (data.data && data.data.length > 0) {
      data.data.forEach((decision, i) => {
        const age = Math.floor((Date.now() - decision.created_at) / 1000);
        log(`\n${i + 1}. ${decision.signal?.instrument?.ticker || 'UNKNOWN'} - ${decision.decision}`, 'bright');
        log(`   Confidence: ${decision.confluence_score}%`, 'cyan');
        log(`   Age: ${age}s ago`, 'cyan');
        log(`   Engine: ${decision.engine_version}`, 'cyan');
        
        if (decision.gate_results) {
          log(`   Gates:`, 'yellow');
          log(`     Regime: ${decision.gate_results.regime.passed ? '✅' : '❌'} (${decision.gate_results.regime.score || 0}%)`, 'yellow');
          log(`     Structural: ${decision.gate_results.structural.passed ? '✅' : '❌'} (${decision.gate_results.structural.score || 0}%)`, 'yellow');
          log(`     Market: ${decision.gate_results.market.passed ? '✅' : '❌'} (${decision.gate_results.market.score || 0}%)`, 'yellow');
        }
      });
    } else {
      log('No decisions found yet', 'yellow');
    }
  } catch (error) {
    log(`Error checking decisions: ${error.message}`, 'red');
  }
}

async function runStaggeredTest() {
  logSection('STAGGERED WEBHOOK TEST - REAL-WORLD SIMULATION');
  log(`Target: ${BASE_URL}`, 'cyan');
  log(`Ticker: SPY`, 'cyan');
  log(`Timing: 3min SATY → 5min Trend → 15min Signal`, 'cyan');
  
  const ticker = 'SPY';
  const currentPrice = 450.25;
  const timestamp = Date.now();
  
  // ============================================================================
  // WEBHOOK 1: SATY PHASE (3-minute timeframe)
  // ============================================================================
  
  await sleep(1000); // Small delay to ensure clean start
  
  logSection('STEP 1: SATY PHASE WEBHOOK (3-minute timeframe)');
  log('This provides regime context (phase, bias, confidence)', 'yellow');
  
  const satyPayload = {
    text: JSON.stringify({
      meta: {
        engine: 'SATY_PO',
        engine_version: '1.0.0',
        event_id: `test_${timestamp}_saty`,
        event_type: 'REGIME_PHASE_ENTRY',
        generated_at: new Date(timestamp).toISOString(),
      },
      instrument: {
        symbol: ticker,
        exchange: 'NASDAQ',
        asset_class: 'EQUITY',
        session: 'REGULAR',
      },
      timeframe: {
        chart_tf: '3',
        event_tf: '3',
        tf_role: 'REGIME',
        bar_close_time: new Date(timestamp).toISOString(),
      },
      event: {
        name: 'ENTER_ACCUMULATION',
        description: 'Entering accumulation phase',
        directional_implication: 'UPSIDE_POTENTIAL',
        event_priority: 8,
      },
      oscillator_state: {
        value: -45.5,
        previous_value: -52.3,
        zone_from: 'ACCUMULATION',
        zone_to: 'ACCUMULATION',
        distance_from_zero: 45.5,
        distance_from_extreme: 34.5,
        velocity: 'INCREASING',
      },
      regime_context: {
        local_bias: 'BULLISH',
        htf_bias: {
          tf: '15',
          bias: 'BULLISH',
          osc_value: -35.2,
        },
        macro_bias: {
          tf: '60',
          bias: 'BULLISH',
        },
      },
      market_structure: {
        mean_reversion_phase: 'OVERSOLD_BOUNCE',
        trend_phase: 'EARLY_UPTREND',
        is_counter_trend: false,
        compression_state: 'EXPANDING',
      },
      confidence: {
        raw_strength: 78.5,
        htf_alignment: true,
        confidence_score: 82,
        confidence_tier: 'HIGH',
      },
      execution_guidance: {
        trade_allowed: true,
        allowed_directions: ['LONG'],
        recommended_execution_tf: ['5', '15'],
        requires_confirmation: ['SIGNAL_QUALITY', 'VOLUME'],
      },
      risk_hints: {
        avoid_if: ['EXTREME_VOLATILITY', 'LOW_LIQUIDITY'],
        time_decay_minutes: 180,
        cooldown_tf: '3',
      },
      audit: {
        source: 'TRADINGVIEW_ALERT',
        alert_frequency: 'ONCE_PER_BAR_CLOSE',
        deduplication_key: `saty_3m_${ticker}_${timestamp}`,
      },
    })
  };

  const satyResult = await sendWebhook(
    `${BASE_URL}/api/phase25/webhooks/saty-phase`,
    satyPayload,
    'SATY Phase',
    '3min'
  );

  await sleep(2000);
  await checkContextStatus();

  // ============================================================================
  // WEBHOOK 2: TREND/MTF (5-minute timeframe)
  // ============================================================================
  
  await sleep(3000); // Wait 3 seconds between webhooks
  
  logSection('STEP 2: TREND WEBHOOK (5-minute timeframe)');
  log('This provides multi-timeframe alignment context', 'yellow');
  
  const trendPayload = {
    ticker: ticker,
    exchange: 'NASDAQ',
    price: currentPrice,
    timestamp: timestamp + 3000,
    timeframes: {
      tf3min: { trend: 'BULLISH', strength: 75, rsi: 58 },
      tf5min: { trend: 'BULLISH', strength: 80, rsi: 62 },
      tf15min: { trend: 'BULLISH', strength: 70, rsi: 55 },
      tf30min: { trend: 'NEUTRAL', strength: 50, rsi: 50 },
      tf1h: { trend: 'BULLISH', strength: 65, rsi: 58 },
    },
  };

  const trendResult = await sendWebhook(
    `${BASE_URL}/api/webhooks/trend`,
    trendPayload,
    'Trend/MTF',
    '5min'
  );

  await sleep(2000);
  await checkContextStatus();

  // ============================================================================
  // WEBHOOK 3: TRADINGVIEW SIGNAL (15-minute timeframe)
  // ============================================================================
  
  await sleep(3000); // Wait 3 seconds between webhooks
  
  logSection('STEP 3: TRADINGVIEW SIGNAL (15-minute timeframe)');
  log('This triggers the decision engine with all context', 'yellow');
  
  const signalPayload = {
    signal: {
      type: 'LONG',
      timeframe: '15',
      quality: 'HIGH',
      ai_score: 8.5,
      timestamp: timestamp + 6000,
      bar_time: new Date(timestamp + 6000).toISOString(),
    },
    instrument: {
      exchange: 'NASDAQ',
      ticker: ticker,
      current_price: currentPrice,
    },
    entry: {
      price: currentPrice,
      stop_loss: currentPrice * 0.98,
      target_1: currentPrice * 1.02,
      target_2: currentPrice * 1.04,
      stop_reason: 'ATR_BASED',
    },
    risk: {
      amount: 1000,
      rr_ratio_t1: 2.0,
      rr_ratio_t2: 4.0,
      stop_distance_pct: 2.0,
      recommended_shares: 100,
      recommended_contracts: 2,
      position_multiplier: 1.0,
      account_risk_pct: 1.0,
      max_loss_dollars: 1000,
    },
    market_context: {
      vwap: currentPrice,
      pmh: currentPrice * 1.01,
      pml: currentPrice * 0.99,
      day_open: currentPrice * 0.995,
      day_change_pct: 0.5,
      price_vs_vwap_pct: 0.1,
      distance_to_pmh_pct: 1.0,
      distance_to_pml_pct: 1.0,
      atr: 3.45,
      volume_vs_avg: 1.2,
      candle_direction: 'GREEN',
      candle_size_atr: 0.8,
    },
    trend: {
      ema_8: currentPrice * 1.001,
      ema_21: currentPrice * 0.999,
      ema_50: currentPrice * 0.997,
      alignment: 'BULLISH',
      strength: 75,
      rsi: 58,
      macd_signal: 'BULLISH',
    },
    mtf_context: {
      '4h_bias': 'LONG',
      '4h_rsi': 58,
      '1h_bias': 'LONG',
    },
    score_breakdown: {
      strat: 85,
      trend: 80,
      gamma: 75,
      vwap: 70,
      mtf: 80,
      golf: 78,
    },
    components: ['STRAT_2U', 'TREND_ALIGNED', 'VWAP_ABOVE'],
    time_context: {
      market_session: 'OPEN',
      day_of_week: 'MONDAY',
    },
  };

  const signalResult = await sendWebhook(
    `${BASE_URL}/api/phase25/webhooks/signals`,
    signalPayload,
    'TradingView Signal',
    '15min'
  );

  // ============================================================================
  // FINAL STATUS CHECK
  // ============================================================================
  
  await sleep(2000);
  
  logSection('FINAL STATUS CHECK');
  await checkContextStatus();
  await checkDecisions();

  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  logSection('TEST SUMMARY');
  
  const results = [
    { name: 'SATY Phase (3min)', result: satyResult },
    { name: 'Trend/MTF (5min)', result: trendResult },
    { name: 'Signal (15min)', result: signalResult },
  ];

  results.forEach(({ name, result }) => {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    const color = result.success ? 'green' : 'red';
    log(`${name}: ${status} (${result.duration}ms)`, color);
  });

  const allSuccess = results.every(r => r.success);
  
  if (allSuccess) {
    log('\n🎉 All webhooks processed successfully!', 'green');
    log('Check the dashboard at: ' + BASE_URL, 'cyan');
    log('  - Phase 2.5 tab should show the decision', 'cyan');
    log('  - Context Status should show all 3 sources', 'cyan');
    log('  - Webhooks tab should show all 3 receipts', 'cyan');
  } else {
    log('\n⚠️  Some webhooks failed - check logs above', 'yellow');
  }

  log('\nNext steps:', 'bright');
  log('1. Open dashboard: ' + BASE_URL, 'cyan');
  log('2. Go to Phase 2.5 tab', 'cyan');
  log('3. Check Context Status panel (should show 60% complete)', 'cyan');
  log('4. Check Current Decision panel (should show EXECUTE/WAIT/SKIP)', 'cyan');
  log('5. Go to Webhooks tab to see all receipts', 'cyan');
}

// Run the test
runStaggeredTest().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
