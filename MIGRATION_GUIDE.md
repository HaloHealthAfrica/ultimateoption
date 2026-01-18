# Database Migration Guide

## Overview

This guide will help you run the database migrations to create the necessary tables for Phase 2.5.

---

## Prerequisites

- PostgreSQL database (Neon, Vercel Postgres, or any PostgreSQL provider)
- Database connection URL
- Node.js installed

---

## Step 1: Get Your Database URL

### Option A: From Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project: `optionstrat`
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL` or `POSTGRES_URL`
5. Copy the value (it looks like: `postgresql://user:pass@host/db`)

### Option B: From Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
vercel link

# Pull environment variables
vercel env pull .env.local
```

This will create/update `.env.local` with your DATABASE_URL.

### Option C: From Neon Dashboard

If you're using Neon directly:

1. Go to https://console.neon.tech
2. Select your project
3. Go to **Dashboard** → **Connection Details**
4. Copy the connection string
5. Add it to `.env.local`

---

## Step 2: Add DATABASE_URL to .env.local

Edit `optionstrat/.env.local` and add:

```bash
DATABASE_URL="postgresql://user:password@host.region.neon.tech/dbname?sslmode=require"
```

**Important**: Replace with your actual database URL!

---

## Step 3: Run the Migration

### Option A: Using the Full Migration Script (Recommended)

```bash
cd optionstrat
node run-full-migration.js
```

This will:
- ✅ Create `ledger_entries` table
- ✅ Create `webhook_receipts` table
- ✅ Create all necessary indexes
- ✅ Verify the schema
- ✅ Show current data counts

### Option B: Using the Simple Migration Script

```bash
cd optionstrat
node run-migration.js
```

This creates only the `ledger_entries` table.

---

## Step 4: Verify the Migration

After running the migration, you should see:

```
✅ Migration completed successfully!

✅ Tables verified:
   - ledger_entries
   - webhook_receipts

📊 Table: ledger_entries
──────────────────────────────────────────────────────────────────────
Column Name              Type                Nullable  Default
──────────────────────────────────────────────────────────────────────
id                       uuid                NOT NULL  -
created_at               timestamp           NOT NULL  now()
engine_version           character varying   NOT NULL  -
signal                   jsonb               NOT NULL  -
phase_context            jsonb               NULL      -
decision                 character varying   NOT NULL  -
decision_reason          text                NOT NULL  -
decision_breakdown       jsonb               NOT NULL  -
confluence_score         numeric             NOT NULL  -
execution                jsonb               NULL      -
exit_data                jsonb               NULL      -
regime                   jsonb               NOT NULL  -
hypothetical             jsonb               NULL      -

🔍 Indexes on ledger_entries:
──────────────────────────────────────────────────────────────────────
   idx_ledger_created_at
   idx_ledger_decision
   idx_ledger_decision_timeframe
   idx_ledger_engine_version
   idx_ledger_regime_gin
   idx_ledger_signal_gin
   idx_ledger_timeframe

📈 Current Data:
──────────────────────────────────────────────────────────────────────
   ledger_entries: 0 rows
   webhook_receipts: 0 rows

🎉 Migration Complete! Your database is ready.
```

---

## Step 5: Test the Database

Run a test to verify everything works:

```bash
node test-complete-flow.js
```

This will:
1. Send a test webhook
2. Verify decision is made
3. Check database for the new entry
4. Confirm ledger storage

Expected output:
```
✅ SUCCESS! 1 new decision(s) added!

Latest decision:
- ID: [uuid]
- Symbol: TSLA
- Decision: EXECUTE
- Engine: 2.5.0
- Price: $250.75
- Created: [timestamp]
```

---

## Troubleshooting

### Error: "DATABASE_URL environment variable not found"

**Solution**: Make sure you've added DATABASE_URL to `.env.local`

```bash
# Check if .env.local exists
cat .env.local

# If not, create it
echo 'DATABASE_URL="your-database-url-here"' > .env.local
```

### Error: "connection refused" or "timeout"

**Solution**: Check your database URL and network connection

1. Verify the URL is correct
2. Check if your IP is whitelisted (for Neon)
3. Ensure SSL mode is correct (`?sslmode=require`)

### Error: "relation already exists"

**Solution**: This is normal! It means the tables already exist. The migration script will skip them.

### Error: "permission denied"

**Solution**: Your database user needs CREATE TABLE permissions

1. Check your database user has proper permissions
2. Contact your database administrator
3. Or use a superuser account for migrations

---

## What Gets Created

### Table: ledger_entries

Stores all trading decisions made by Phase 2.5:

- **id**: Unique identifier (UUID)
- **created_at**: Timestamp of decision
- **engine_version**: "2.5.0"
- **signal**: Complete signal data (JSONB)
- **phase_context**: SATY phase context (JSONB, optional)
- **decision**: EXECUTE, WAIT, or SKIP
- **decision_reason**: Why the decision was made
- **decision_breakdown**: Detailed scoring breakdown
- **confluence_score**: Overall confidence (0-100)
- **execution**: Execution details if EXECUTE
- **exit_data**: Exit details when trade closes
- **regime**: Market regime snapshot
- **hypothetical**: Tracking for skipped trades

### Table: webhook_receipts

Audit log of all webhook deliveries:

- **id**: Auto-incrementing ID
- **received_at**: When webhook was received
- **kind**: signals, trend, or saty-phase
- **ok**: Success/failure boolean
- **status**: HTTP status code
- **ip**: Client IP address
- **user_agent**: Client user agent
- **ticker**: Symbol from webhook
- **message**: Processing message
- **raw_payload**: Complete webhook payload
- **headers**: HTTP headers (JSONB)

---

## Schema Files

The migration uses:
- **Primary**: `src/ledger/schema.neon.sql` (Neon-compatible, no TimescaleDB)
- **Fallback**: `create-ledger-table.sql` (Simple version)

---

## After Migration

Once migration is complete:

1. ✅ **Test locally**: `node test-complete-flow.js`
2. ✅ **Deploy to production**: `git push origin main`
3. ✅ **Verify production**: Check Vercel deployment logs
4. ✅ **Test webhooks**: Send test webhooks from TradingView
5. ✅ **Check dashboard**: View decisions at your app URL

---

## Production Deployment

The migration only needs to run once. After that:

1. Your code is already deployed (we pushed the fixes)
2. Vercel will use the DATABASE_URL from environment variables
3. New webhooks will automatically store data
4. Dashboard will display decisions

---

## Need Help?

If you encounter issues:

1. Check the error message carefully
2. Verify DATABASE_URL is correct
3. Ensure database is accessible
4. Check Vercel logs for production issues
5. Review the migration output for clues

---

## Quick Commands Reference

```bash
# Pull environment variables from Vercel
vercel env pull .env.local

# Run full migration
node run-full-migration.js

# Test the system
node test-complete-flow.js

# Test all webhooks
node test-all-webhooks.js

# Check database schema
node check-schema.js

# Deploy to production
git push origin main
```

---

**Status**: Ready to run migration! 🚀
