# Seed Paper Trades Guide

## Overview

To see paper trades on the dashboard, you need entries in the ledger with `execution` data. There are two approaches depending on your environment.

---

## Option 1: Use Production Database (Recommended)

If you have `DATABASE_URL` configured (PostgreSQL/Neon), the ledger will persist data.

### Steps:

1. **Ensure DATABASE_URL is set:**
   ```bash
   # Check your .env.local or Vercel environment variables
   echo $env:DATABASE_URL  # Windows PowerShell
   ```

2. **Run the seeder script:**
   ```bash
   node seed-paper-trades-api.js
   ```

3. **Verify in database:**
   The trades will be stored in the `ledger_entries` table.

---

## Option 2: Development (In-Memory Ledger)

Without `DATABASE_URL`, the app uses an in-memory ledger that resets on restart.

### Current Limitation:

The in-memory ledger doesn't persist between server restarts. To see paper trades in development:

### Workaround A: Send Live Signals

Send real webhook signals that will create decisions and executions:

```bash
# Send a high-quality signal
curl -X POST http://localhost:3000/api/phase25/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "type": "LONG",
      "timeframe": "15",
      "quality": "EXTREME",
      "ai_score": 9.5,
      "timestamp": '$(date +%s000)',
      "bar_time": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
    },
    "instrument": {
      "ticker": "SPY",
      "exchange": "NASDAQ",
      "current_price": 580.25
    },
    "entry": {
      "price": 580.25,
      "stop_loss": 578.50,
      "target_1": 582.00,
      "target_2": 584.00,
      "stop_reason": "ATR"
    },
    "risk": {
      "amount": 1000,
      "rr_ratio_t1": 2.5,
      "rr_ratio_t2": 4.0,
      "stop_distance_pct": 0.30,
      "recommended_shares": 0,
      "recommended_contracts": 3,
      "position_multiplier": 1.0,
      "account_risk_pct": 1.0,
      "max_loss_dollars": 1000
    },
    "market_context": {
      "vwap": 580.00,
      "pmh": 582.00,
      "pml": 578.00,
      "day_open": 579.50,
      "day_change_pct": 0.13,
      "price_vs_vwap_pct": 0.04,
      "distance_to_pmh_pct": 0.30,
      "distance_to_pml_pct": 0.39,
      "atr": 4.50,
      "volume_vs_avg": 1.2,
      "candle_direction": "GREEN",
      "candle_size_atr": 0.8
    },
    "trend": {
      "ema_8": 580.00,
      "ema_21": 579.00,
      "ema_50": 577.00,
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
      "strat": 30,
      "trend": 25,
      "gamma": 15,
      "vwap": 10,
      "mtf": 10,
      "golf": 5
    },
    "components": ["STRAT", "TREND", "GAMMA", "VWAP", "MTF"],
    "time_context": {
      "market_session": "OPEN",
      "day_of_week": "MONDAY"
    }
  }'
```

### Workaround B: Use Production Data

Deploy to Vercel with DATABASE_URL, seed there, then view the production dashboard.

---

## Option 3: Quick Test with Seeder Script

The `seed-paper-trades-api.js` script sends signals via API:

```bash
# Seed 82 trades over 30 days
node seed-paper-trades-api.js

# For production
BASE_URL=https://optionstrat.vercel.app node seed-paper-trades-api.js
```

**Note:** These create decisions but not executions. To see actual paper trades with P&L, you need the Phase 2.5 execution flow to run.

---

## Understanding the Data Flow

### 1. Signal Webhook → Decision
```
POST /api/phase25/webhooks/signals
  ↓
Decision Engine evaluates
  ↓
Creates ledger entry with decision (EXECUTE/WAIT/SKIP)
```

### 2. Decision → Execution (if EXECUTE)
```
Decision action = EXECUTE
  ↓
Paper trading executor creates execution
  ↓
Updates ledger entry with execution data
```

### 3. Execution → Exit (when closed)
```
Monitor checks positions
  ↓
Target/stop hit
  ↓
Updates ledger entry with exit data
```

---

## What You'll See on Paper Trades Page

### With Executions:
- ✅ Open positions with Greeks (delta, gamma, theta, IV)
- ✅ Closed positions with P&L
- ✅ Performance metrics
- ✅ Win rate, profit factor, etc.

### Without Executions:
- ❌ Empty paper trades page
- ✅ Decisions visible in ledger API
- ℹ️ Metrics show decision stats but no P&L

---

## Recommended Approach

### For Development:
1. Set up local PostgreSQL or use Neon free tier
2. Add `DATABASE_URL` to `.env.local`
3. Run migrations: `npm run db:migrate`
4. Seed trades: `node seed-paper-trades-api.js`
5. Trades persist across restarts

### For Production:
1. Ensure `DATABASE_URL` is in Vercel environment variables
2. Deploy latest code
3. Run seeder against production: `BASE_URL=https://optionstrat.vercel.app node seed-paper-trades-api.js`
4. View dashboard

---

## Checking Current State

### Check if database is configured:
```bash
# Local
echo $env:DATABASE_URL

# Vercel
vercel env ls
```

### Check ledger entries:
```bash
# Local
curl http://localhost:3000/api/ledger?limit=10

# Production
curl https://optionstrat.vercel.app/api/ledger?limit=10
```

### Check paper metrics:
```bash
# Local
curl http://localhost:3000/api/phase25/webhooks/metrics

# Production
curl https://optionstrat.vercel.app/api/phase25/webhooks/metrics
```

---

## Next Steps

1. **If you have DATABASE_URL:** Run the seeder and you're done!
2. **If you don't have DATABASE_URL:** Set up a database (Neon is free and easy)
3. **For quick testing:** Use production with DATABASE_URL already configured

The paper trades page will automatically populate once you have ledger entries with execution data.
