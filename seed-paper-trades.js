/**
 * Seed Paper Trades Script
 * 
 * Creates realistic paper trade entries in the ledger for testing the dashboard.
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { getGlobalLedger } = require('./.next/server/chunks/786.js');

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

// Generate a realistic paper trade
function generatePaperTrade(daysAgo, index) {
  const now = Date.now();
  const timestamp = now - (daysAgo * 24 * 60 * 60 * 1000) + (index * 60 * 60 * 1000);
  
  // Random parameters
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
  const quality = randomPick(['HIGH', 'MEDIUM', 'LOW']);
  const decision = randomPick(['EXECUTE', 'EXECUTE', 'EXECUTE', 'WAIT', 'SKIP']); // More executes
  
  const dte = randomInt(7, 45);
  const strike = direction === 'LONG' ? 
    currentPrice * randomInRange(0.98, 1.02) : 
    currentPrice * randomInRange(0.98, 1.02);
  
  const optionPrice = currentPrice * randomInRange(0.02, 0.05);
  const contracts = randomInt(1, 5);
  
  // Calculate P&L for executed trades
  let execution = undefined;
  let exit = undefined;
  
  if (decision === 'EXECUTE') {
    const hasExited = Math.random() > 0.3; // 70% have exited
    
    execution = {
      timestamp: timestamp + 60000,
      symbol,
      option_symbol: `${symbol}${new Date(timestamp + dte * 24 * 60 * 60 * 1000).toISOString().slice(2,10).replace(/-/g, '')}${direction === 'LONG' ? 'C' : 'P'}${Math.round(strike * 1000)}`,
      option_type: direction === 'LONG' ? 'CALL' : 'PUT',
      strike,
      expiration: new Date(timestamp + dte * 24 * 60 * 60 * 1000).toISOString(),
      dte,
      quantity: contracts,
      entry_price: optionPrice,
      entry_iv: randomInRange(0.2, 0.5),
      entry_delta: direction === 'LONG' ? randomInRange(0.3, 0.7) : randomInRange(-0.7, -0.3),
      underlying_at_entry: currentPrice,
      total_cost: optionPrice * contracts * 100,
      commission: 0.65 * contracts,
      spread_cost: optionPrice * 0.02 * contracts * 100,
      slippage: optionPrice * 0.01 * contracts * 100,
      broker: 'PAPER',
      order_id: `PAPER-${timestamp}-${index}`,
      status: hasExited ? 'CLOSED' : 'OPEN',
    };
    
    if (hasExited) {
      const exitReason = randomPick(['TARGET_1', 'TARGET_1', 'TARGET_2', 'STOP_LOSS', 'THETA_DECAY']);
      const holdDays = randomInt(1, Math.min(dte - 1, 10));
      const exitTime = timestamp + holdDays * 24 * 60 * 60 * 1000;
      
      let pnlMultiplier;
      if (exitReason === 'TARGET_1') pnlMultiplier = randomInRange(1.5, 2.0);
      else if (exitReason === 'TARGET_2') pnlMultiplier = randomInRange(2.0, 3.0);
      else if (exitReason === 'STOP_LOSS') pnlMultiplier = randomInRange(0.3, 0.7);
      else pnlMultiplier = randomInRange(0.8, 1.2);
      
      const exitPrice = optionPrice * pnlMultiplier;
      const pnlGross = (exitPrice - optionPrice) * contracts * 100;
      const totalCommission = 0.65 * contracts * 2; // Entry + exit
      const totalSpreadCost = (optionPrice * 0.02 + exitPrice * 0.02) * contracts * 100;
      const totalSlippage = (optionPrice * 0.01 + exitPrice * 0.01) * contracts * 100;
      const pnlNet = pnlGross - totalCommission - totalSpreadCost - totalSlippage;
      
      execution.status = 'CLOSED';
      
      exit = {
        exit_time: exitTime,
        exit_price: exitPrice,
        exit_iv: randomInRange(0.2, 0.5),
        exit_delta: direction === 'LONG' ? randomInRange(0.2, 0.8) : randomInRange(-0.8, -0.2),
        underlying_at_exit: currentPrice * randomInRange(0.97, 1.03),
        pnl_gross: pnlGross,
        pnl_net: pnlNet,
        hold_time_seconds: holdDays * 24 * 60 * 60,
        exit_reason: exitReason,
        pnl_from_delta: pnlGross * randomInRange(0.6, 0.8),
        pnl_from_iv: pnlGross * randomInRange(0.1, 0.2),
        pnl_from_theta: pnlGross * randomInRange(-0.1, 0.1),
        pnl_from_gamma: pnlGross * randomInRange(0.05, 0.15),
        total_commission: totalCommission,
        total_spread_cost: totalSpreadCost,
        total_slippage: totalSlippage,
      };
    }
  }
  
  // Build the ledger entry
  const entry = {
    created_at: timestamp,
    engine_version: '2.5.0',
    signal: {
      signal: {
        type: direction,
        timeframe: '5m',
        quality,
        ai_score: randomInRange(60, 95),
        timestamp,
        bar_time: new Date(timestamp).toISOString(),
      },
      instrument: {
        exchange: 'NASDAQ',
        ticker: symbol,
        current_price: currentPrice,
      },
      entry: {
        price: currentPrice,
        stop_loss: direction === 'LONG' ? currentPrice * 0.98 : currentPrice * 1.02,
        target_1: direction === 'LONG' ? currentPrice * 1.015 : currentPrice * 0.985,
        target_2: direction === 'LONG' ? currentPrice * 1.03 : currentPrice * 0.97,
        stop_reason: 'ATR_BASED',
      },
      risk: {
        amount: optionPrice * contracts * 100,
        rr_ratio_t1: randomInRange(1.5, 2.5),
        rr_ratio_t2: randomInRange(2.5, 4.0),
        stop_distance_pct: 2.0,
        recommended_shares: 0,
        recommended_contracts: contracts,
        position_multiplier: randomInRange(0.8, 1.2),
        account_risk_pct: randomInRange(1, 3),
        max_loss_dollars: optionPrice * contracts * 100,
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
      components: [],
      time_context: {
        market_session: randomPick(['OPEN', 'MIDDAY', 'POWER_HOUR']),
        day_of_week: randomPick(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']),
      },
    },
    decision,
    decision_reason: decision === 'EXECUTE' ? 'High confidence setup with good risk/reward' :
                    decision === 'WAIT' ? 'Waiting for better entry' :
                    'Market conditions not favorable',
    decision_breakdown: {
      confluence_multiplier: randomInRange(0.9, 1.1),
      quality_multiplier: quality === 'HIGH' ? 1.2 : quality === 'MEDIUM' ? 1.0 : 0.8,
      htf_alignment_multiplier: randomInRange(0.9, 1.1),
      rr_multiplier: randomInRange(0.95, 1.05),
      volume_multiplier: randomInRange(0.9, 1.1),
      trend_multiplier: randomInRange(0.9, 1.1),
      session_multiplier: randomInRange(0.95, 1.05),
      day_multiplier: randomInRange(0.95, 1.05),
      phase_confidence_boost: randomInRange(0, 5),
      phase_position_boost: randomInRange(0, 5),
      trend_alignment_boost: randomInRange(0, 5),
      final_multiplier: randomInRange(0.8, 1.2),
    },
    confluence_score: randomInRange(60, 95),
    regime: {
      volatility: randomPick(['LOW', 'NORMAL', 'HIGH']),
      trend: randomPick(['BULL', 'NEUTRAL', 'BEAR']),
      liquidity: randomPick(['HIGH', 'NORMAL']),
      iv_rank: randomInRange(20, 70),
    },
    gate_results: {
      regime: {
        passed: true,
        score: randomInRange(70, 100),
      },
      structural: {
        passed: true,
        score: randomInRange(70, 100),
      },
      market: {
        passed: decision !== 'SKIP',
        score: randomInRange(decision === 'SKIP' ? 40 : 70, decision === 'SKIP' ? 60 : 100),
        reason: decision === 'SKIP' ? 'Spread too wide (16 bps > 12 bps threshold)' : undefined,
      },
    },
  };
  
  if (execution) {
    entry.execution = execution;
  }
  
  if (exit) {
    entry.exit = exit;
  }
  
  return entry;
}

async function seedPaperTrades() {
  console.log('🌱 Seeding paper trades...\n');
  
  try {
    const ledger = await getGlobalLedger();
    
    // Generate trades for the last 30 days
    const trades = [];
    const daysToSeed = 30;
    const tradesPerDay = 3; // Average 3 trades per day
    
    for (let day = 0; day < daysToSeed; day++) {
      const numTrades = randomInt(1, 5); // 1-4 trades per day
      for (let i = 0; i < numTrades; i++) {
        trades.push(generatePaperTrade(daysToSeed - day, i));
      }
    }
    
    console.log(`📊 Generated ${trades.length} paper trades`);
    console.log(`📅 Date range: ${new Date(trades[0].created_at).toLocaleDateString()} to ${new Date(trades[trades.length - 1].created_at).toLocaleDateString()}\n`);
    
    // Calculate statistics
    const executed = trades.filter(t => t.decision === 'EXECUTE');
    const withExits = executed.filter(t => t.exit);
    const winners = withExits.filter(t => t.exit.pnl_net > 0);
    const losers = withExits.filter(t => t.exit.pnl_net < 0);
    
    const totalPnl = withExits.reduce((sum, t) => sum + t.exit.pnl_net, 0);
    const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.exit.pnl_net, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((sum, t) => sum + t.exit.pnl_net, 0) / losers.length : 0;
    const winRate = withExits.length > 0 ? (winners.length / withExits.length * 100) : 0;
    
    console.log('📈 Trade Statistics:');
    console.log(`   Total trades: ${trades.length}`);
    console.log(`   Executed: ${executed.length} (${(executed.length / trades.length * 100).toFixed(1)}%)`);
    console.log(`   Closed: ${withExits.length}`);
    console.log(`   Open: ${executed.length - withExits.length}`);
    console.log(`   Winners: ${winners.length} (${winRate.toFixed(1)}% win rate)`);
    console.log(`   Losers: ${losers.length}`);
    console.log(`   Total P&L: $${totalPnl.toFixed(2)}`);
    console.log(`   Avg Win: $${avgWin.toFixed(2)}`);
    console.log(`   Avg Loss: $${avgLoss.toFixed(2)}`);
    console.log(`   Profit Factor: ${losers.length > 0 ? (avgWin * winners.length / Math.abs(avgLoss * losers.length)).toFixed(2) : 'N/A'}\n`);
    
    // Append to ledger
    console.log('💾 Writing to ledger...');
    for (const trade of trades) {
      await ledger.append(trade);
    }
    
    console.log('✅ Successfully seeded paper trades!\n');
    console.log('🎯 Next steps:');
    console.log('   1. Deploy to Vercel (if not already done)');
    console.log('   2. Visit the paper trades page');
    console.log('   3. View your seeded trades and metrics\n');
    
  } catch (error) {
    console.error('❌ Error seeding paper trades:', error);
    process.exit(1);
  }
}

// Run the seeder
seedPaperTrades();
