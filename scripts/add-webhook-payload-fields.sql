-- Migration: Add raw_payload and headers fields to webhook_receipts table
-- Run this against your database to add the new fields for complete webhook storage

-- Add raw_payload column to store complete webhook payloads
ALTER TABLE webhook_receipts 
ADD COLUMN IF NOT EXISTS raw_payload TEXT;

-- Add headers column to store request headers as JSON
ALTER TABLE webhook_receipts 
ADD COLUMN IF NOT EXISTS headers JSONB;

-- Add comment for documentation
COMMENT ON COLUMN webhook_receipts.raw_payload IS 'Complete webhook payload (no longer truncated)';
COMMENT ON COLUMN webhook_receipts.headers IS 'HTTP request headers as JSON object';