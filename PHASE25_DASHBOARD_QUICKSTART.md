# Phase 2.5 Dashboard - Quick Start Guide

## What Was Fixed

The Phase 2.5 dashboard was showing incomplete data because the `gate_results` column was missing from the database. This has been fixed.

## Deploy the Fix

### 1. Run Migration (Production)
```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="your-neon-connection-string"

# Run the migration
node scripts/add-gate-results-column.js
```

### 2. Deploy to Vercel
```bash
git add .
git commit -m "fix: Add gate_results column to ledger - complete Phase 2.5 dashboard"
git push origin main
```

### 3. Verify Deployment
1. Visit https://ultimateoption.vercel.app
2. Go to Phase 2.5 tab
3. Send test webhooks via https://ultimateoption.vercel.app/webhook-tester
4. Check that gate results appear with scores (e.g., Regime: 82%)

## What You'll See After Fix

### Phase 2.5 Dashboard Features:

**Current Decision Card**:
- Action: EXECUTE/WAIT/SKIP
- Ticker, Direction, Timeframe, Quality
- Confidence score with progress bar
- **Gate Results** (NOW WORKING):
  - ✓ Regime: 82% (passed)
  - ✓ Structural: 78% (passed)
  - ✓ Market: 100% (passed)
- Detailed context panels:
  - Regime Context (Phase, Bias, Volatility)
  - Expert Analysis (AI Score, Quality, R:R ratios)
  - Market Conditions (Price, ATR, Spread)
  - Position Sizing (Multiplier, Confidence)

**Decision Breakdown Panel**:
- Confidence components (Regime 30%, Expert 25%, Alignment 20%, Market 15%, Structure 10%)
- Position sizing multipliers (Confluence, Quality, HTF, R:R, Volume, Trend, Session, Day)
- Phase boosts (Confidence, Position)
- Final multiplier (0.5x - 3.0x)

**Context Status Panel**:
- Webhook coverage percentage
- Required sources: TRADINGVIEW_SIGNAL
- Optional sources: SATY_PHASE, MTF_DOTS, ULTIMATE_OPTIONS, STRAT_EXEC
- Freshness indicators (e.g., "OK (3m)")

**Decision History Table**:
- Filterable by decision type and engine version
- Columns: Time, Ticker, Decision, Direction, TF, Quality, Engine, Confidence, **Size**
- Size column now shows actual multipliers (e.g., 1.50x instead of 0.00x)

## Testing the Fix

### Send Test Webhooks

1. Go to https://ultimateoption.vercel.app/webhook-tester
2. Click "Send Staggered Test" to send all 3 webhook types
3. Wait for completion (about 15 minutes)
4. Go to Phase 2.5 tab
5. Verify:
   - ✅ Decision appears with gate scores
   - ✅ Size multiplier shows correct value
   - ✅ Context status shows webhook coverage
   - ✅ History table displays all fields

### Manual Webhook Test

```bash
# SATY Phase webhook
curl -X POST https://ultimateoption.vercel.app/api/webhooks/saty-phase \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "SPY",
    "phase": 2,
    "phase_name": "Accumulation",
    "bias": "LONG",
    "confidence": 85,
    "volatility": "NORMAL"
  }'

# Trend webhook
curl -X POST https://ultimateoption.vercel.app/api/webhooks/trend \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "SPY",
    "bullish_pct": 75,
    "bearish_pct": 25
  }'

# Signal webhook
curl -X POST https://ultimateoption.vercel.app/api/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "SPY",
    "action": "BUY",
    "contracts": 1,
    "strategy": "CALL",
    "price": 450.50,
    "ai_score": 8.5,
    "quality": "HIGH",
    "timeframe": "15"
  }'
```

## Files Changed

1. **src/ledger/schema.neon.sql** - Added `gate_results JSONB` column
2. **src/ledger/ledger.ts** - Updated INSERT and SELECT to include gate_results
3. **scripts/add-gate-results-column.js** - Migration script to add column

## No Changes Needed

All dashboard components were already built and working:
- Phase25DecisionCard.tsx ✅
- Phase25BreakdownPanel.tsx ✅
- Phase25ContextStatus.tsx ✅
- Phase25HistoryTable.tsx ✅
- page.tsx (Phase 2.5 tab) ✅

## Troubleshooting

### Migration fails
- Check DATABASE_URL is set correctly
- Verify database connection
- Check if column already exists (migration is idempotent)

### Gate results still not showing
- Clear browser cache
- Wait for Vercel deployment to complete
- Send new test webhooks (old data won't have gate_results)

### Size shows 0.00x
- This is expected for old decisions (before fix)
- New decisions will show correct multipliers
- Send new test webhooks to verify

## Next Steps

After deploying this fix:
1. ✅ Phase 2.5 dashboard is complete
2. ✅ All decision data is persisted
3. ✅ Gate scores are displayed
4. ✅ Size multipliers are correct
5. Ready for production use

## Support

If you see any issues after deployment:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify webhooks are being received (Webhooks tab)
4. Check database has gate_results column
