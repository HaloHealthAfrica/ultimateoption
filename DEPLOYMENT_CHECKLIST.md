# Deployment Checklist

**Date:** January 19, 2026  
**Status:** ✅ READY TO DEPLOY

---

## What's Being Deployed

### 1. Paper Trades 503 Fix ✅
- Fixed lazy initialization in metrics endpoint
- Added error handling for ledger queries
- Applied to health endpoints

### 2. Ledger Schema Fix ✅
- Corrected column name from `exit_data` to `exit`
- Migration runs automatically on build
- Table will be created if it doesn't exist

### 3. MarketData.app Integration ✅
- Primary data provider for options data
- Full Greeks support (delta, gamma, theta, vega)
- Automatic fallback to Tradier/TwelveData

---

## Commits Ready to Deploy

```
6f1a492 - fix: correct ledger schema to use exit column instead of exit_data
05bb286 - chore: trigger deployment for metrics fix
6430866 - fix: add better error handling for paper metrics ledger queries
a113c79 - fix: resolve 503 error on paper trades metrics endpoint
9f805b5 - fix: resolve build errors in MarketData.app integration
c5272e5 - feat: integrate MarketData.app as primary data provider
```

---

## What Will Happen on Deployment

### Build Process:
1. ✅ Vercel pulls latest code
2. ✅ Runs `npm run db:migrate`
3. ✅ Creates/updates `ledger_entries` table
4. ✅ Builds Next.js app
5. ✅ Deploys to production

### Runtime Behavior:
1. ✅ Metrics endpoint returns 200 OK (no more 503)
2. ✅ Paper trades page loads without errors
3. ✅ Ledger persists to PostgreSQL (not in-memory)
4. ✅ MarketData.app provides enhanced options data

---

## Environment Variables (Already Set in Vercel)

### Database:
- ✅ `DATABASE_URL` - PostgreSQL connection
- ✅ `POSTGRES_URL` - Neon URL
- ✅ All Postgres variables

### API Keys:
- ✅ `TRADIER_API_KEY`
- ✅ `TWELVEDATA_API_KEY`
- ✅ `MARKETDATA_API_KEY` (if you added it)
- ✅ `ALPACA_API_KEY`
- ✅ `ALPACA_SECRET_KEY`

### Webhooks:
- ✅ `WEBHOOK_SECRET_SIGNALS`
- ✅ `WEBHOOK_SECRET_TREND`
- ✅ `WEBHOOK_SECRET_SATY_PHASE`

---

## Post-Deployment Verification

### 1. Check Metrics Endpoint
```bash
curl https://optionstrat.vercel.app/api/phase25/webhooks/metrics
```
**Expected:** 200 OK with metrics data

### 2. Check Paper Trades Page
Visit: https://optionstrat.vercel.app
- Click "Trades" tab
- **Expected:** No API warning banner
- **Expected:** Empty state (no trades yet)

### 3. Check Ledger API
```bash
curl https://optionstrat.vercel.app/api/ledger?limit=1
```
**Expected:** 200 OK with empty data array

### 4. Verify Table Exists
Check Vercel build logs for:
```
✅ Connected to database
✅ Migration applied successfully
```

---

## Seeding Paper Trades (After Deployment)

Once deployed, seed some test trades:

```bash
BASE_URL=https://optionstrat.vercel.app node seed-paper-trades-api.js
```

This will:
- Create 82 paper trades over 30 days
- Store them in the PostgreSQL database
- Make them visible on the dashboard

---

## Expected Results

### Before Deployment:
- ❌ Paper trades page shows 503 error
- ❌ In-memory ledger (no persistence)
- ⚠️ MarketData.app not used

### After Deployment:
- ✅ Paper trades page loads cleanly
- ✅ PostgreSQL ledger (persistent)
- ✅ MarketData.app provides enhanced data
- ✅ Ready to seed trades

---

## Rollback Plan (If Needed)

If something goes wrong:

```bash
# Revert to previous commit
git revert HEAD~6..HEAD
git push

# Or deploy specific commit
vercel --prod --force
```

---

## Timeline

| Time | Event |
|------|-------|
| Now | Code ready in GitHub ✅ |
| +2 min | Vercel detects push 🔄 |
| +3 min | Migration runs 🔄 |
| +5 min | Build completes 🔄 |
| +7 min | Production deployed 🔄 |
| +10 min | Fully propagated ⏳ |

---

## Summary

✅ All fixes committed and pushed  
✅ Migration will create ledger table  
✅ 503 error will be resolved  
✅ MarketData.app integration ready  
✅ Ready to deploy!  

**Next step:** Vercel will auto-deploy, or run `vercel --prod` to deploy manually! 🚀
