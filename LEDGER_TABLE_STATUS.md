# Ledger Table Status

**Date:** January 19, 2026  
**Status:** ✅ READY FOR DEPLOYMENT

---

## Summary

The ledger table (`ledger_entries`) is properly configured and will be created automatically on deployment.

---

## How It Works

### 1. Automatic Migration on Build

The build script runs the migration automatically:

```json
"build": "npm run db:migrate && next build"
```

### 2. Migration Script

`scripts/db-migrate.js` runs the SQL schema from `src/ledger/schema.neon.sql`

### 3. Schema Creates Table

The schema uses `CREATE TABLE IF NOT EXISTS` so it's safe to run multiple times:

```sql
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engine_version VARCHAR(20) NOT NULL,
  signal JSONB NOT NULL,
  phase_context JSONB,
  decision VARCHAR(10) NOT NULL,
  decision_reason TEXT NOT NULL,
  decision_breakdown JSONB NOT NULL,
  confluence_score DECIMAL(5,2) NOT NULL,
  gate_results JSONB,
  execution JSONB,
  exit JSONB,  -- Fixed: was exit_data
  regime JSONB NOT NULL,
  hypothetical JSONB,
  ...
);
```

---

## Recent Fix

### Issue
Schema had `exit_data` column but code expected `exit` column.

### Solution
Updated `src/ledger/schema.neon.sql` to use `exit` instead of `exit_data`.

### Impact
- ✅ New deployments will create table with correct column name
- ✅ Existing tables can be fixed with migration (if needed)
- ✅ Code already uses `exit` everywhere

---

## Vercel Environment

### Database Variables (Already Set)
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `POSTGRES_URL` - Neon connection URL
- ✅ `POSTGRES_PRISMA_URL` - Prisma-compatible URL
- ✅ All other Postgres variables

### Migration Behavior
1. **On every deployment:** Migration runs during build
2. **If table exists:** `CREATE TABLE IF NOT EXISTS` skips creation
3. **If table missing:** Creates table with all columns and indexes
4. **Safe to run multiple times:** No data loss

---

## Local Development

### Without DATABASE_URL
- Uses in-memory ledger (resets on restart)
- Good for quick testing
- No persistence

### With DATABASE_URL
- Uses PostgreSQL ledger (persistent)
- Run migration: `npm run db:migrate`
- Data persists across restarts

---

## Verification

### Check if table exists (Production):

```bash
# Via API
curl https://optionstrat.vercel.app/api/ledger?limit=1

# Should return:
# {"data":[],"pagination":{...},"filters":{...}}
```

### Check table schema:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ledger_entries'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (uuid)
- `created_at` (timestamp with time zone)
- `engine_version` (character varying)
- `signal` (jsonb)
- `phase_context` (jsonb)
- `decision` (character varying)
- `decision_reason` (text)
- `decision_breakdown` (jsonb)
- `confluence_score` (numeric)
- `gate_results` (jsonb)
- `execution` (jsonb)
- `exit` (jsonb) ← Fixed!
- `regime` (jsonb)
- `hypothetical` (jsonb)

---

## Seeding Paper Trades

Once the table exists in production, you can seed paper trades:

```bash
# Seed via API (creates decisions)
BASE_URL=https://optionstrat.vercel.app node seed-paper-trades-api.js

# This creates 82 trades over 30 days
# Trades will persist in the database
```

---

## Next Deployment

### What Will Happen:

1. ✅ Vercel starts build
2. ✅ `npm run db:migrate` runs
3. ✅ Migration connects to DATABASE_URL
4. ✅ Creates `ledger_entries` table (if not exists)
5. ✅ Creates indexes
6. ✅ Build completes
7. ✅ App uses PostgreSQL ledger (persistent)

### Expected Result:

- ✅ Paper trades persist across deployments
- ✅ Ledger API returns data
- ✅ Dashboard shows paper trades
- ✅ Metrics calculate correctly

---

## Troubleshooting

### If table doesn't exist after deployment:

1. Check build logs for migration errors
2. Verify DATABASE_URL is set in Vercel
3. Run migration manually:
   ```bash
   vercel env pull .env.production
   DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2) npm run db:migrate
   ```

### If column name is wrong:

Run the fix migration:
```bash
curl -X POST https://optionstrat.vercel.app/api/admin/fix-ledger-column
```

---

## Summary

✅ Schema fixed to use `exit` column  
✅ Migration runs automatically on build  
✅ DATABASE_URL already configured in Vercel  
✅ Table will be created on next deployment  
✅ Ready to seed paper trades  

**Next step:** Deploy and the table will be created automatically! 🚀
