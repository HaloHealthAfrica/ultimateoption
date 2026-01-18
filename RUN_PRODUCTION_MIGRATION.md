# Run Production Migration

## IMPORTANT: Run this ONCE on production database

This migration adds the `gate_results` column to the `ledger_entries` table.

## Steps

### 1. Get your DATABASE_URL from Vercel

1. Go to https://vercel.com/your-project/settings/environment-variables
2. Copy the `DATABASE_URL` value (starts with `postgresql://`)

### 2. Run the migration locally (connects to production DB)

```bash
# Windows PowerShell
$env:DATABASE_URL="your-neon-connection-string-here"
node scripts/add-gate-results-column.js

# Mac/Linux
export DATABASE_URL="your-neon-connection-string-here"
node scripts/add-gate-results-column.js
```

### 3. Expected Output

```
🔄 Adding gate_results column to ledger_entries...
✅ Connected to database
✅ gate_results column added successfully
✅ Index created on gate_results column
```

If the column already exists:
```
🔄 Adding gate_results column to ledger_entries...
✅ Connected to database
✅ gate_results column already exists - skipping
```

### 4. Verify the Migration

Connect to your database and run:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ledger_entries' 
AND column_name = 'gate_results';
```

Expected result:
```
 column_name  | data_type 
--------------+-----------
 gate_results | jsonb
```

### 5. Test the Dashboard

1. Visit https://ultimateoption.vercel.app/webhook-tester
2. Click "Send Staggered Test"
3. Wait for webhooks to complete
4. Go to Phase 2.5 tab
5. Verify gate results appear with scores

## Alternative: Run via Vercel CLI

If you have Vercel CLI installed:

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link to your project
vercel link

# Get environment variables
vercel env pull .env.local

# Run migration
node scripts/add-gate-results-column.js
```

## Troubleshooting

### "DATABASE_URL not set"
- Make sure you copied the full connection string
- Check for quotes around the URL
- Verify the environment variable is set: `echo $env:DATABASE_URL` (Windows) or `echo $DATABASE_URL` (Mac/Linux)

### "Connection refused"
- Check your IP is allowed in Neon dashboard
- Verify the connection string is correct
- Try connecting with `psql` to test: `psql "your-connection-string"`

### "Column already exists"
- This is fine! The migration is idempotent
- No action needed

## What This Migration Does

1. Checks if `gate_results` column exists
2. If not, adds `gate_results JSONB` column to `ledger_entries`
3. Creates a GIN index on the column for better query performance
4. Safe to run multiple times (idempotent)

## After Migration

- New decisions will include gate results with scores
- Old decisions will have `null` for gate_results (expected)
- Dashboard will display gate scores for new decisions
- Size multipliers will show correct values
