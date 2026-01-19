-- Migration: Add enhanced_data column to ledger_entries
-- Date: 2026-01-19
-- Purpose: Add replay and learning data capture

-- Add enhanced_data column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'ledger_entries' 
    AND column_name = 'enhanced_data'
  ) THEN
    ALTER TABLE ledger_entries ADD COLUMN enhanced_data JSONB;
    RAISE NOTICE 'Column enhanced_data added successfully';
  ELSE
    RAISE NOTICE 'Column enhanced_data already exists';
  END IF;
END $$;

-- Create GIN index for enhanced_data queries
CREATE INDEX IF NOT EXISTS idx_ledger_enhanced_data_gin 
ON ledger_entries USING GIN (enhanced_data);

-- Create index for replay queries
CREATE INDEX IF NOT EXISTS idx_ledger_replayable 
ON ledger_entries ((enhanced_data->'replay_metadata'->>'is_replayable'))
WHERE enhanced_data IS NOT NULL;

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ledger_entries'
AND column_name = 'enhanced_data';
