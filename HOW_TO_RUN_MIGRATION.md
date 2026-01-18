# How to Run the Database Migration

## Why You Need This

Your webhooks are working and decisions are being made, but they're **NOT being saved** because the `gate_results` column doesn't exist in the database. This migration adds that column.

## Quick Start (3 Steps)

### Step 1: Get Your DATABASE_URL

1. Go to https://vercel.com/your-project/settings/environment-variables
2. Find `DATABASE_URL` in the list
3. Click the eye icon to reveal the value
4. Copy the entire connection string (starts with `postgresql://`)

It should look like:
```
postgresql://username:password@ep-something-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Step 2: Choose Your Method

#### Method A: PowerShell Script (Easiest)

1. Open `RUN_MIGRATION_NOW.ps1` in a text editor
2. Find this line:
   ```powershell
   $env:DATABASE_URL = "YOUR_DATABASE_URL_HERE"
   ```
3. Replace `YOUR_DATABASE_URL_HERE` with your actual connection string
4. Save the file
5. Run: `.\RUN_MIGRATION_NOW.ps1`

#### Method B: Command Line (Quick)

**PowerShell:**
```powershell
$env:DATABASE_URL="your-connection-string-here"
node scripts/add-gate-results-column.js
```

**Command Prompt:**
```cmd
set DATABASE_URL=your-connection-string-here
node scripts/add-gate-results-column.js
```

#### Method C: Edit .env.local (Persistent)

1. Open `.env.local` file
2. Uncomment and set DATABASE_URL:
   ```
   DATABASE_URL="postgresql://your-connection-string"
   ```
3. Save the file
4. Run: `node scripts/add-gate-results-column.js`

### Step 3: Verify It Worked

**Expected Output:**
```
🔄 Adding gate_results column to ledger_entries...
✅ Connected to database
✅ gate_results column added successfully
✅ Index created on gate_results column
```

**If column already exists:**
```
🔄 Adding gate_results column to ledger_entries...
✅ Connected to database
✅ gate_results column already exists - skipping
```

## Test After Migration

### 1. Send a Test Webhook

Go to https://optionstrat.vercel.app/webhook-tester and:
1. Click "🔥 Perfect Setup" preset
2. Click "Send Staggered Test"
3. Wait for completion

### 2. Check Webhook Receipts

Visit: https://optionstrat.vercel.app (Webhooks tab)

Look for messages like:
```
✅ "Phase 2.5: Decision made: EXECUTE (confidence: 87.5)"
   Details: {"ledgerStored": true}
```

**Before migration**: `"ledgerStored": false` with error
**After migration**: `"ledgerStored": true` ✅

### 3. Check Phase 2.5 Dashboard

Visit: https://optionstrat.vercel.app (Phase 2.5 tab)

You should see:
- ✅ Current Decision Card with gate results
- ✅ Gate scores (Regime: 82%, Structural: 78%, Market: 100%)
- ✅ Decision History Table with new entries
- ✅ Size multipliers showing correct values

## Troubleshooting

### "DATABASE_URL not set"
- Make sure you set the environment variable
- Check for typos in the connection string
- Ensure no extra spaces or quotes

### "Connection refused" or "Connection timeout"
- Check your IP is allowed in Neon dashboard
- Verify the connection string is correct
- Try connecting with `psql` to test:
  ```bash
  psql "your-connection-string"
  ```

### "Column already exists"
- This is fine! The migration is idempotent
- It means the column was already added
- No action needed

### Still seeing "ledgerStored: false"
1. Verify migration ran successfully
2. Check Vercel deployment is complete
3. Clear browser cache
4. Send new test webhooks (old ones won't retry)

### Decisions still not showing on dashboard
1. Check browser console for errors (F12)
2. Verify webhooks are being received (Webhooks tab)
3. Check API directly: https://optionstrat.vercel.app/api/decisions?limit=5
4. Ensure filter is set to "ALL" not "EXECUTE"

## What This Migration Does

1. **Checks** if `gate_results` column exists
2. **Adds** `gate_results JSONB` column if missing
3. **Creates** GIN index for query performance
4. **Safe** to run multiple times (idempotent)

## After Migration

Once complete:
- ✅ All new decisions will be stored
- ✅ Gate results will be saved with scores
- ✅ Dashboard will show new decisions immediately
- ✅ History table will populate
- ✅ No more "column does not exist" errors

## Need Help?

If you're still having issues:
1. Check `URGENT_MIGRATION_NEEDED.md` for more details
2. Verify your DATABASE_URL is correct
3. Check Neon dashboard for connection issues
4. Look at webhook receipts for error messages

## Summary

**Before Migration:**
- Webhooks received ✅
- Decisions calculated ✅
- Decisions stored ❌ (column missing)
- Dashboard shows old data ❌

**After Migration:**
- Webhooks received ✅
- Decisions calculated ✅
- Decisions stored ✅
- Dashboard shows new data ✅
