-- Fix ledger_entries table column name
-- Rename exit_data to exit

-- Check if exit_data column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'ledger_entries' 
    AND column_name = 'exit_data'
  ) THEN
    -- Rename exit_data to exit
    ALTER TABLE ledger_entries RENAME COLUMN exit_data TO exit;
    RAISE NOTICE 'Column exit_data renamed to exit';
  ELSE
    RAISE NOTICE 'Column exit_data does not exist, no action needed';
  END IF;
END $$;

-- Verify the fix
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'ledger_entries'
AND column_name IN ('exit', 'exit_data')
ORDER BY column_name;
