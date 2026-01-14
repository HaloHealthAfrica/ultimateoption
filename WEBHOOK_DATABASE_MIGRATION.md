# Webhook Database Migration Guide

## Issue
The webhook receipts page is not showing raw payload and headers for webhook entries.

## Root Cause
The `webhook_receipts` table in your Neon database may be missing the `raw_payload` and `headers` columns, or existing entries were created before these columns were added.

## Solution

### Step 1: Connect to Your Neon Database

1. Go to your Neon dashboard: https://console.neon.tech
2. Select your project
3. Click on "SQL Editor" or use the connection string with `psql`

### Step 2: Run the Migration

Copy and paste this SQL into your Neon SQL Editor:

```sql
-- Add columns if they don't exist (safe to run multiple times)
ALTER TABLE webhook_receipts 
ADD COLUMN IF NOT EXISTS raw_payload TEXT;

ALTER TABLE webhook_receipts 
ADD COLUMN IF NOT EXISTS headers JSONB;

-- Add comments for documentation
COMMENT ON COLUMN webhook_receipts.raw_payload IS 'Complete webhook payload (no longer truncated)';
COMMENT ON COLUMN webhook_receipts.headers IS 'HTTP request headers as JSON object';
```

### Step 3: Verify the Migration

Run this query to verify the columns exist:

```sql
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'webhook_receipts'
ORDER BY ordinal_position;
```

You should see `raw_payload` (TEXT) and `headers` (JSONB) in the results.

### Step 4: Test with New Webhooks

After running the migration:

1. Trigger a new webhook from TradingView (or use the test script)
2. Go to your webhook receipts page
3. Click on a webhook row to expand it
4. You should now see:
   - **Raw Payload** section with the complete JSON payload
   - **Headers** section with all HTTP headers

## Important Notes

- **Existing entries**: Webhooks that were received BEFORE the migration will have NULL values for `raw_payload` and `headers`
- **New entries**: All webhooks received AFTER the migration will have complete payload and header data
- **Safe to run**: The migration uses `IF NOT EXISTS` so it's safe to run multiple times
- **No downtime**: This migration adds columns with NULL defaults, so it won't affect existing functionality

## Verification Query

After the migration, check recent webhooks:

```sql
SELECT 
  id,
  received_at,
  kind,
  ok,
  status,
  message,
  CASE 
    WHEN raw_payload IS NULL THEN 'NULL (old entry)'
    WHEN LENGTH(raw_payload) = 0 THEN 'EMPTY'
    ELSE 'HAS DATA (' || LENGTH(raw_payload) || ' chars)'
  END as raw_payload_status,
  CASE 
    WHEN headers IS NULL THEN 'NULL (old entry)'
    WHEN headers::text = '{}' THEN 'EMPTY'
    ELSE 'HAS DATA'
  END as headers_status
FROM webhook_receipts
ORDER BY received_at DESC
LIMIT 10;
```

## Troubleshooting

### If you still don't see raw payload/headers after migration:

1. **Clear old entries**: The old entries won't have data. Trigger new webhooks to see the data.

2. **Check if columns exist**:
   ```sql
   \d webhook_receipts
   ```

3. **Manually insert a test entry**:
   ```sql
   INSERT INTO webhook_receipts 
     (kind, ok, status, message, raw_payload, headers)
   VALUES 
     ('signals', true, 200, 'Test entry', '{"test": "payload"}', '{"content-type": "application/json"}');
   ```

4. **Check the API response**: Visit `/api/webhooks/recent?limit=5` and verify the JSON includes `raw_payload` and `headers` fields.

## Alternative: Recreate the Table (DESTRUCTIVE)

⚠️ **WARNING**: This will delete all existing webhook receipts!

Only use this if you want to start fresh:

```sql
-- Backup existing data first!
CREATE TABLE webhook_receipts_backup AS SELECT * FROM webhook_receipts;

-- Drop and recreate
DROP TABLE webhook_receipts;

CREATE TABLE webhook_receipts (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL CHECK (kind IN ('signals', 'trend', 'saty-phase')),
  ok BOOLEAN NOT NULL,
  status INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  ticker TEXT,
  symbol TEXT,
  timeframe TEXT,
  message TEXT,
  raw_payload TEXT,
  headers JSONB
);

CREATE INDEX idx_webhook_receipts_received_at ON webhook_receipts (received_at DESC);
CREATE INDEX idx_webhook_receipts_kind ON webhook_receipts (kind);
```

## Next Steps

After running the migration and triggering new webhooks, you'll be able to:

1. Click on any webhook row to expand it
2. See the complete raw payload in the "Raw Payload" section
3. See all HTTP headers in the "Headers" section
4. Debug SATY phase parsing issues by examining the exact payload format TradingView is sending
