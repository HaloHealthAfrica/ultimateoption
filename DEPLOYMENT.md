## Vercel deployment (with Neon)

### 1) Create the Neon database
- Create a Neon project + database.
- Copy the **pooled** connection string (recommended for serverless).

### 2) Set Vercel environment variables
In Vercel → Project → Settings → Environment Variables:
- **`DATABASE_URL`**: paste the Neon connection string

Notes:
- Ensure your connection string includes **`sslmode=require`**.
- If you use separate pooled vs non-pooled URLs in Neon, prefer **pooled** for runtime on Vercel.

### 3) Build & deploy
Vercel will run `npm run build` automatically.

### 4) Database schema
This repo includes:
- `src/ledger/schema.sql`: a TimescaleDB-oriented schema (requires Timescale extension)
- `src/ledger/schema.neon.sql`: a Neon-compatible schema (plain Postgres)

Use `schema.neon.sql` with Neon unless you specifically need TimescaleDB features.


