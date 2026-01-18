# Database Migration Scripts

## Overview

This directory contains database migration scripts that run automatically during the build process.

---

## How It Works

### Automatic Migration

When you run `npm run build`, the migration runs automatically:

```bash
npm run build
# Runs: npm run db:migrate && next build
```

### Manual Migration

You can also run migrations manually:

```bash
npm run db:migrate
```

---

## Migration Script: `db-migrate.js`

### What It Does

1. Reads the schema from `src/ledger/schema.neon.sql`
2. Connects to the database using `DATABASE_URL`
3. Creates tables if they don't exist:
   - `ledger_entries` - Stores trading decisions
   - `webhook_receipts` - Audit log of webhooks
4. Creates indexes for performance
5. Safely handles existing tables (won't fail if already created)

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string

**Example:**
```bash
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"
```

### Safety Features

✅ **Idempotent** - Safe to run multiple times  
✅ **Non-destructive** - Uses `CREATE TABLE IF NOT EXISTS`  
✅ **Graceful failure** - Won't break build if DATABASE_URL is missing  
✅ **Transaction-based** - All-or-nothing execution  
✅ **Error handling** - Ignores "already exists" errors  

---

## Build Process

### Local Development

```bash
# Without database (skips migration)
npm run build

# With database
DATABASE_URL="postgresql://..." npm run build
```

### Vercel Deployment

Vercel automatically:
1. Pulls `DATABASE_URL` from environment variables
2. Runs `npm run build`
3. Executes migration before building
4. Deploys the application

**Setup in Vercel:**
1. Go to Project Settings → Environment Variables
2. Add `DATABASE_URL` with your database connection string
3. Deploy - migration runs automatically

---

## Troubleshooting

### "DATABASE_URL not set"

**Symptom:**
```
⚠️  DATABASE_URL not set - skipping migration
```

**Solution:**
This is OK for local development without a database. The build will continue successfully.

To run migrations, set DATABASE_URL:
```bash
export DATABASE_URL="postgresql://..."
npm run build
```

### "Migration failed"

**Symptom:**
```
❌ Migration failed
Error: connection refused
```

**Solutions:**
1. Check DATABASE_URL is correct
2. Verify database is accessible
3. Check network/firewall settings
4. Ensure SSL settings match your database

### "already exists" Warnings

**Symptom:**
```
ℹ️  Skipping existing object
```

**Solution:**
This is normal! It means tables already exist. The migration safely skips them.

---

## Schema File

**Location:** `src/ledger/schema.neon.sql`

This file contains:
- Table definitions
- Indexes
- Constraints
- Comments

**Neon-compatible:**
- No TimescaleDB extensions
- Standard PostgreSQL only
- Works with Vercel Postgres, Neon, and other providers

---

## Skip Migration

If you need to build without running migrations:

```bash
npm run build:skip-migrate
```

This runs `next build` directly without the migration step.

---

## Testing Migrations

### Test Locally

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://localhost/testdb"

# Run migration
npm run db:migrate

# Verify tables
psql $DATABASE_URL -c "\dt"
```

### Test on Vercel

```bash
# Pull environment variables
vercel env pull .env.local

# Run migration locally with production database
npm run db:migrate

# Or deploy and check logs
vercel deploy
vercel logs
```

---

## Migration Logs

During build, you'll see:

```
🔄 Running database migrations...
✅ Connected to database
   ℹ️  Skipping existing object (if tables exist)
✅ Migration applied successfully
```

---

## Best Practices

1. **Always use environment variables** - Never hardcode DATABASE_URL
2. **Test migrations locally first** - Before deploying to production
3. **Check Vercel logs** - After deployment to verify migration ran
4. **Keep schema.neon.sql updated** - When adding new tables/columns
5. **Use transactions** - The script already does this for safety

---

## Adding New Migrations

To add new tables or columns:

1. Edit `src/ledger/schema.neon.sql`
2. Add your SQL with `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE IF EXISTS`
3. Test locally: `npm run db:migrate`
4. Commit and push
5. Vercel will run migration on next deploy

**Example:**
```sql
-- Add new column (safe to run multiple times)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ledger_entries' 
    AND column_name = 'new_column'
  ) THEN
    ALTER TABLE ledger_entries ADD COLUMN new_column TEXT;
  END IF;
END $$;
```

---

## Related Files

- `package.json` - Build scripts configuration
- `src/ledger/schema.neon.sql` - Database schema
- `MIGRATION_GUIDE.md` - Detailed migration guide
- `run-full-migration.js` - Standalone migration tool

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify DATABASE_URL is set correctly
3. Test migration locally
4. Review error messages carefully
5. Check database permissions

---

**Status:** ✅ Migrations run automatically on every build
