/**
 * Seed Executed Paper Trades
 * 
 * Creates realistic paper trades with executions and exits directly in the database.
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

// Helper functions
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomInRange(min, max));
}

function randomPick(array) {
  return array[randomInt(0, array.length)];
}

function generateExecutedTrade(daysAgo, index) {
  const now = Date.now();
  const timestamp = now - (daysAgo * 24 * 60 * 60 * 1000) + (index * 60 * 60 * 1000);
  
  const symbols = ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'NVDA'];
  const symbol = randomPick(symbols);
  const basePrice = symbol === 'SPY' ? 580 : 
                   symbol === 'QQQ' ? 500 :
                   symbol === 'IWM' ? 220 :
                   symbol === 'AAPL' ? 230 :
                   symbol === 'MSFT' ? 440 : 140;
  
  const currentPrice = basePrice * randomInRange(0.98, 1.02);
  const direction = randomPick(['LONG', 'SHORT']);
  const quality = randomPick(['EXTREME', 'HIGH', 'MEDIUM']);
  const contracts = randomInt(2, 5);
  const dte = randomInt(7, 30);
  
  const strike = direction === 'LONG' ? 
    currentPrice * randomInRange(0.99, 1.01) : 
    currentPrice * randomInRange(0.99, 1.01);
  
  const optionPrice = currentPrice * randomInRange(0.03, 0.06);
  
  // Determine if trade has exited (70% have exited)
  const hasExited = Math.random() > 0.3;
  const exitReason = hasExited ? randomPick(['TARGET_1', 'TARGET_1', 'TARGET_2', 'STOP_LOSS', 'THETA_DECAY']) : null;
  
  let pnlMultiplier = 1;
  if (exitReason === 'TARGET_1') pnlMultiplier = randomInRange(1.5, 2.0);
  else if (exitReason === 'TARGET_2') pnlMultiplier = randomInRange(2.0, 3.0);
  else if (exitReason === 'STOP_LOSS') pnlMultiplier = randomInRange(0.3, 0.7);
  else if (exitReason === 'THETA_DECAY') pnlMultiplier = randomInRange(0.7, 1.1);
  
  const holdDays = hasExited ? randomInt(1, Math.min(dte - 1, 7)) : 0;
  const exitTime = hasExited ? timestamp + holdDays * 24 * 60 * 60 * 1000 : null;
  const exitPrice = hasExited ? optionPrice * pnlMultiplier : null;
  
  const pnlGross = hasExited ? (exitPrice - optionPrice) * contracts * 100 : null;
  const totalCommission = hasExited ? 0.65 * contracts * 2 : 0.65 * contracts;
  const totalSpreadCost = hasExited ? (optionPrice * 0.02 + exitPrice * 0.02) * contracts * 100 : optionPrice * 0.02 * contracts * 100;
  const totalSlippage = hasExited ? (optionPrice * 0.01 + exitPrice * 0.01) * contracts * 100 : optionPrice * 0.01 * contracts * 100;
  const pnlNet = hasExited ? pnlGross - totalCommission - totalSpreadCost - totalSlippage : null;
  
  const entry = {
    id: require('crypto').randomUUID(),
    created_at: timestamp, // Use timestamp directly, not ISO string
    engine_version: '2.5.0',
    signal: {
      signal: {
        type: direction,
        timeframe: randomPick(['5', '15', '30']),
        quality,
        ai_score: quality === 'EXTREME' ? randomInRange(9, 10) : quality === 'HIGH' ? randomInRange(7, 9) : randomInRange(5, 7),
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
        position_multiplier: randomInRange(0.9, 1.1),
        account_risk_pct: randomInRange(1, 2),
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
        atr: currentPrice * 0.02,
        volume_vs_avg: randomInRange(0.9, 1.3),
        candle_direction: randomPick(['GREEN', 'RED']),
        candle_size_atr: randomInRange(0.5, 1.2),
      },
      trend: {
        ema_8: currentPrice * randomInRange(0.998, 1.002),
        ema_21: currentPrice * randomInRange(0.995, 1.005),
        ema_50: currentPrice * randomInRange(0.99, 1.01),
        alignment: randomPick(['BULLISH', 'BEARISH', 'NEUTRAL']),
        strength: randomInRange(50, 85),
        rsi: randomInRange(40, 65),
        macd_signal: randomPick(['BULLISH', 'BEARISH']),
      },
      mtf_context: {
        '4h_bias': randomPick(['LONG', 'SHORT']),
        '4h_rsi': randomInRange(45, 60),
        '1h_bias': randomPick(['LONG', 'SHORT']),
      },
      score_breakdown: {
        strat: randomInRange(10, 30),
        trend: randomInRange(10, 25),
        gamma: randomInRange(5, 15),
        vwap: randomInRange(5, 10),
        mtf: randomInRange(5, 10),
        golf: randomInRange(0, 10),
      },
      components: ['STRAT', 'TREND', 'GAMMA', 'VWAP'],
      time_context: {
        market_session: randomPick(['OPEN', 'MIDDAY', 'POWER_HOUR']),
        day_of_week: randomPick(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']),
      },
    },
    decision: 'EXECUTE',
    decision_reason: 'High confidence setup with good risk/reward and tight spread',
    decision_breakdown: {
      confluence_multiplier: randomInRange(0.95, 1.05),
      quality_multiplier: quality === 'EXTREME' ? 1.2 : quality === 'HIGH' ? 1.1 : 1.0,
      htf_alignment_multiplier: randomInRange(0.95, 1.05),
      rr_multiplier: randomInRange(0.98, 1.02),
      volume_multiplier: randomInRange(0.95, 1.05),
      trend_multiplier: randomInRange(0.95, 1.05),
      session_multiplier: randomInRange(0.98, 1.02),
      day_multiplier: randomInRange(0.98, 1.02),
      phase_confidence_boost: randomInRange(0, 5),
      phase_position_boost: randomInRange(0, 5),
      trend_alignment_boost: randomInRange(0, 5),
      final_multiplier: randomInRange(0.95, 1.05),
    },
    confluence_score: randomInRange(75, 95),
    regime: {
      volatility: randomPick(['NORMAL', 'HIGH']),
      trend: randomPick(['BULL', 'NEUTRAL']),
      liquidity: 'NORMAL',
      iv_rank: randomInRange(30, 60),
    },
    gate_results: {
      regime: { passed: true, score: randomInRange(80, 100) },
      structural: { passed: true, score: randomInRange(80, 100) },
      market: { passed: true, score: randomInRange(80, 100) },
    },
    execution: {
      timestamp: timestamp + 60000,
      symbol,
      option_symbol: `${symbol}${new Date(timestamp + dte * 24 * 60 * 60 * 1000).toISOString().slice(2,10).replace(/-/g, '')}${direction === 'LONG' ? 'C' : 'P'}${Math.round(strike * 1000)}`,
      option_type: direction === 'LONG' ? 'CALL' : 'PUT',
      strike,
      expiration: new Date(timestamp + dte * 24 * 60 * 60 * 1000).toISOString(),
      dte,
      quantity: contracts,
      entry_price: optionPrice,
      entry_iv: randomInRange(0.25, 0.45),
      entry_delta: direction === 'LONG' ? randomInRange(0.4, 0.7) : randomInRange(-0.7, -0.4),
      entry_gamma: randomInRange(0.02, 0.05),
      entry_theta: randomInRange(-0.2, -0.1),
      entry_vega: randomInRange(0.15, 0.35),
      underlying_at_entry: currentPrice,
      total_cost: optionPrice * contracts * 100,
      commission: 0.65 * contracts,
      spread_cost: optionPrice * 0.02 * contracts * 100,
      slippage: optionPrice * 0.01 * contracts * 100,
      broker: 'PAPER',
      order_id: `PAPER-${timestamp}-${index}`,
      status: hasExited ? 'CLOSED' : 'OPEN',
    },
  };
  
  if (hasExited) {
    entry.exit = {
      exit_time: exitTime,
      exit_price: exitPrice,
      exit_iv: randomInRange(0.2, 0.4),
      exit_delta: direction === 'LONG' ? randomInRange(0.3, 0.8) : randomInRange(-0.8, -0.3),
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
  
  return entry;
}

async function seedExecutedTrades() {
  console.log('🌱 Seeding executed paper trades...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const trades = [];
    const daysToSeed = 30;
    
    for (let day = 0; day < daysToSeed; day++) {
      const numTrades = randomInt(2, 4); // 2-3 executed trades per day
      for (let i = 0; i < numTrades; i++) {
        trades.push(generateExecutedTrade(daysToSeed - day, i));
      }
    }
    
    console.log(`📊 Generated ${trades.length} executed paper trades`);
    console.log(`📅 Date range: ${new Date(trades[0].created_at).toLocaleDateString()} to ${new Date(trades[trades.length - 1].created_at).toLocaleDateString()}\n`);
    
    // Calculate statistics
    const withExits = trades.filter(t => t.exit);
    const winners = withExits.filter(t => t.exit.pnl_net > 0);
    const losers = withExits.filter(t => t.exit.pnl_net < 0);
    const openTrades = trades.filter(t => !t.exit);
    
    const totalPnl = withExits.reduce((sum, t) => sum + t.exit.pnl_net, 0);
    const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.exit.pnl_net, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((sum, t) => sum + t.exit.pnl_net, 0) / losers.length : 0;
    const winRate = withExits.length > 0 ? (winners.length / withExits.length * 100) : 0;
    
    console.log('📈 Trade Statistics:');
    console.log(`   Total trades: ${trades.length}`);
    console.log(`   Closed: ${withExits.length}`);
    console.log(`   Open: ${openTrades.length}`);
    console.log(`   Winners: ${winners.length} (${winRate.toFixed(1)}% win rate)`);
    console.log(`   Losers: ${losers.length}`);
    console.log(`   Total P&L: $${totalPnl.toFixed(2)}`);
    console.log(`   Avg Win: $${avgWin.toFixed(2)}`);
    console.log(`   Avg Loss: $${avgLoss.toFixed(2)}`);
    if (losers.length > 0) {
      console.log(`   Profit Factor: ${(avgWin * winners.length / Math.abs(avgLoss * losers.length)).toFixed(2)}`);
    }
    console.log();
    
    // Insert into database
    console.log('💾 Inserting into database...');
    let inserted = 0;
    
    for (const trade of trades) {
      try {
        await client.query(
          `INSERT INTO ledger_entries (
            id, created_at, engine_version, signal, decision, decision_reason,
            decision_breakdown, confluence_score, regime, gate_results, execution, exit
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            trade.id,
            trade.created_at,
            trade.engine_version,
            JSON.stringify(trade.signal),
            trade.decision,
            trade.decision_reason,
            JSON.stringify(trade.decision_breakdown),
            trade.confluence_score,
            JSON.stringify(trade.regime),
            JSON.stringify(trade.gate_results),
            JSON.stringify(trade.execution),
            trade.exit ? JSON.stringify(trade.exit) : null,
          ]
        );
        inserted++;
        if (inserted % 10 === 0) {
          process.stdout.write(`   ${inserted}/${trades.length}...\r`);
        }
      } catch (err) {
        console.error(`   ❌ Failed to insert trade: ${err.message}`);
      }
    }
    
    console.log(`   ${inserted}/${trades.length} trades inserted\n`);
    console.log('✅ Successfully seeded executed paper trades!\n');
    
    console.log('🎯 Next steps:');
    console.log('   1. Visit https://optionstrat.vercel.app');
    console.log('   2. Click the "Trades" tab');
    console.log('   3. View your paper trades with P&L\n');
    
  } catch (error) {
    console.error('❌ Error seeding trades:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedExecutedTrades();
