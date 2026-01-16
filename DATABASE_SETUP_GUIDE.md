# Database Setup Guide - Phase 2.5 Persistence

**Problem:** In-memory ledger loses data on serverless restarts  
**Solution:** PostgreSQL database for persistent storage

---

## Quick Setup (5 minutes)

### Step 1: Create Neon Database (Free)

1. Go to https://neon.tech
2. Sign up / Log in
3. Click "Create Project"
4. Name: `ultimateoption-ledger`
5. Region: Choose closest to you
6. Click "Create Project"

### Step 2: Get Connection String

After project creation, you'll see:
```
postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Copy this connection string.

### Step 3: Add to Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your `ultimateoption` project
3. Go to Settings → Environment Variables
4. Add new variable:
   - **Name:** `DATABASE_URL`
   - **Value:** (paste your connection string)
   - **Environment:** Production, Preview, Development
5. Click "Save"

### Step 4: Redeploy

```bash
cd optionstrat
git commit --allow-empty -m "trigger redeploy"
git push origin main
```

Vercel will auto-deploy with the new DATABASE_URL.

---

## What Happens Next

Once DATABASE_URL is set:

1. ✅ Decisions stored in PostgreSQL (persistent)
2. ✅ Dashboard shows all decisions (survives restarts)
3. ✅ History preserved across deployments
4. ✅ Can query by date, ticker, confidence, etc.

---

## Alternative: Supabase (Also Free)

If you prefer Supabase:

1. Go to https://supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy "Connection string" (Transaction mode)
5. Add to Vercel as `DATABASE_URL`

---

## For Now: Local Testing

To see the dashboard working locally:

```bash
# Terminal 1: Start dev server
cd optionstrat
npm run dev

# Terminal 2: Send test webhooks
node send-test-webhook-production.js

# Terminal 3: Check decisions
curl http://localhost:3000/api/decisions?limit=5
```

Local dev server keeps memory between requests, so you'll see data.

---

## Why This Happens

**Vercel Serverless:**
- Each API call = new container
- No shared memory between calls
- In-memory data = lost after response

**With Database:**
- Data persists in PostgreSQL
- All serverless functions read from same DB
- Dashboard always shows latest data

---

## Next Steps

1. **Today:** Set up Neon/Supabase database (5 min)
2. **Today:** Add DATABASE_URL to Vercel (2 min)
3. **Today:** Redeploy and test (5 min)
4. **Tomorrow:** Send real webhooks from TradingView
5. **This Week:** Build paper executor (Phase 2.6.2)

---

## Need Help?

If you want me to set this up, I can:
1. Create the database schema
2. Update the code to use PostgreSQL
3. Add migration scripts
4. Test the integration

Just let me know!
