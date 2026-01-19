# Deployment with Enhanced Ledger Migration

**Date:** January 19, 2026  
**Purpose:** Deploy enhanced ledger data capture with database migration

---

## What's Being Deployed

### 1. Enhanced Ledger System ✅
- New data types for replay and algorithm improvement
- Enhanced capture service
- Database schema with `enhanced_data` column
- Comprehensive documentation

### 2. Previous Fixes ✅
- Paper trades 503 fix
- PostgreSQL ledger persistence
- MarketData.app integration

---

## Pre-Deployment Checklist

### Verify Environment Variables (Vercel)
```bash
vercel env ls | grep DATABASE_URL
```

Should show:
- ✅ `DATABASE_URL` - PostgreSQL connection

### Verify Latest Code
```bash
git log --oneline -3
```

Should show:
- ✅ Enhanced ledger commits
- ✅ Schema updates
- ✅ Documentation

---

## Deployment Steps

### Step 1: Verify Build Locally (Optional)

```bash
cd optionstrat
npm run build
```

Expected:
- ✅ Migration runs successfully
- ✅ Build completes
- ✅ No errors

### Step 2: Commit and Push

```bash
git add -A
git commit -m "feat: deploy enhanced ledger with migration"
git push
```

### Step 3: Monitor Vercel Deployment

```bash
# Watch deployment
vercel ls

# Or visit Vercel dashboard
# https://vercel.com/dashboard
```

Expected build log:
```
🔄 Running database migrations...
✅ Connected to database
✅ Migration applied successfully
   - ledger_entries table exists
   - enhanced_data column added
   - Indexes created
✓ Compiled successfully
```

### Step 4: Verify Migration

```bash
# Check if enhanced_data column exists
curl https://optionstrat.vercel.app/api/admin/check-schema
```

Or query directly:
```bash
# Get a ledger entry
curl https://optionstrat.vercel.app/api/ledger?limit=1 | jq '.data[0] | keys'
```

Should include: `enhanced_data` in the keys

---

## Migration Details

### What the Migration Does

The migration script (`scripts/db-migrate.js`) runs `src/ledger/schema.neon.sql` which:

1. **Creates ledger_entries table** (if not exists)
   - Includes `enhanced_data JSONB` column
   
2. **Creates indexes:**
   - `idx_ledger_enhanced_data_gin` - GIN index for JSONB queries
   - `idx_ledger_replayable` - Index for replayable entries

3. **Safe to run multiple times:**
   - Uses `CREATE TABLE IF NOT EXISTS`
   - Uses `CREATE INDEX IF NOT EXISTS`
   - No data loss

### Schema Changes

```sql
-- New column (already in schema)
enhanced_data JSONB

-- New indexes
CREATE INDEX IF NOT EXISTS idx_ledger_enhanced_data_gin 
ON ledger_entries USING GIN (enhanced_data);

CREATE INDEX IF NOT EXISTS idx_ledger_replayable 
ON ledger_entries ((enhanced_data->'replay_metadata'->>'is_replayable'))
WHERE enhanced_data IS NOT NULL;
```

---

## Post-Deployment Verification

### Test 1: Check Endpoints

```bash
# Metrics endpoint (should be 200 OK)
curl https://optionstrat.vercel.app/api/phase25/webhooks/metrics

# Health endpoint
curl https://optionstrat.vercel.app/api/phase25/webhooks/health

# Ledger endpoint
curl https://optionstrat.vercel.app/api/ledger?limit=1
```

### Test 2: Verify Schema

```bash
# Check if enhanced_data column exists
curl https://optionstrat.vercel.app/api/ledger?limit=1 | jq '.data[0] | has("enhanced_data")'
```

Expected: `true` or `null` (if no data yet)

### Test 3: Send Test Signal

```bash
# Send a test signal to generate a decision with enhanced data
curl -X POST https://optionstrat.vercel.app/api/phase25/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "type": "LONG",
      "timeframe": "15",
      "quality": "HIGH",
      "ai_score": 8.5,
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

Then check if enhanced_data was captured:
```bash
curl https://optionstrat.vercel.app/api/ledger?limit=1 | jq '.data[0].enhanced_data'
```

Expected: `null` (enhanced capture not yet integrated) or enhanced data object

---

## Rollback Plan (If Needed)

### If Migration Fails

The migration is safe and won't break existing functionality:
- `enhanced_data` column is optional
- Existing code works without it
- No data loss

### If Deployment Fails

```bash
# Revert to previous commit
git revert HEAD
git push

# Or deploy specific commit
vercel --prod
```

---

## Timeline

| Time | Event |
|------|-------|
| Now | Push code ✅ |
| +2 min | Vercel detects push 🔄 |
| +3 min | Migration runs 🔄 |
| +5 min | Build completes 🔄 |
| +7 min | Production deployed 🔄 |
| +10 min | Fully propagated ⏳ |

---

## Expected Results

### Before Deployment:
- ✅ Paper trades 503 fixed
- ✅ PostgreSQL ledger working
- ❌ No enhanced_data column

### After Deployment:
- ✅ Paper trades 503 fixed
- ✅ PostgreSQL ledger working
- ✅ enhanced_data column exists
- ✅ Indexes created
- ⏳ Enhanced capture ready (needs integration)

---

## Next Steps After Deployment

### 1. Verify Migration Success
```bash
curl https://optionstrat.vercel.app/api/ledger?limit=1 | jq '.data[0] | keys'
```

### 2. Check Build Logs
```bash
vercel logs https://optionstrat.vercel.app --since 5m
```

Look for:
- ✅ "Migration applied successfully"
- ✅ "Build completed"

### 3. Monitor for Errors
Check Vercel dashboard for any runtime errors.

### 4. Plan Enhanced Capture Integration
The column is ready, but capture service needs to be integrated into the orchestrator (next phase).

---

## Summary

✅ **Schema updated** - enhanced_data column added  
✅ **Indexes created** - GIN and replayable indexes  
✅ **Migration safe** - No data loss, idempotent  
✅ **Backward compatible** - Existing code works  
✅ **Ready to deploy** - Push and Vercel handles the rest  

**Next action:** Push code and monitor deployment! 🚀
