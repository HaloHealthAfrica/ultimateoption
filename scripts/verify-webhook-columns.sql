-- Verify and add webhook_receipts columns if needed
-- This script is safe to run multiple times (uses IF NOT EXISTS)

-- Check if columns exist
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'webhook_receipts'
ORDER BY ordinal_position;

-- Add columns if they don't exist (safe to run multiple times)
ALTER TABLE webhook_receipts 
ADD COLUMN IF NOT EXISTS raw_payload TEXT;

ALTER TABLE webhook_receipts 
ADD COLUMN IF NOT EXISTS headers JSONB;

-- Verify columns were added
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'webhook_receipts'
  AND column_name IN ('raw_payload', 'headers');

-- Show sample of recent webhooks with new fields
SELECT 
  id,
  received_at,
  kind,
  ok,
  status,
  CASE 
    WHEN raw_payload IS NULL THEN 'NULL'
    WHEN LENGTH(raw_payload) = 0 THEN 'EMPTY'
    ELSE 'HAS DATA (' || LENGTH(raw_payload) || ' chars)'
  END as raw_payload_status,
  CASE 
    WHEN headers IS NULL THEN 'NULL'
    WHEN headers::text = '{}' THEN 'EMPTY'
    ELSE 'HAS DATA (' || jsonb_object_keys(headers) || ')'
  END as headers_status
FROM webhook_receipts
ORDER BY received_at DESC
LIMIT 5;
