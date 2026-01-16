-- Phase 2.5 Ledger Table
-- Creates the ledger_entries table in your Neon database

-- Create ledger_entries table
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY,
  created_at BIGINT NOT NULL,
  engine_version VARCHAR(20) NOT NULL,
  signal JSONB NOT NULL,
  phase_context JSONB,
  decision VARCHAR(10) NOT NULL,
  decision_reason TEXT NOT NULL,
  decision_breakdown JSONB NOT NULL,
  confluence_score DECIMAL(5,2) NOT NULL,
  execution JSONB,
  exit JSONB,
  regime JSONB NOT NULL,
  hypothetical JSONB
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_decision ON ledger_entries (decision);
CREATE INDEX IF NOT EXISTS idx_ledger_ticker ON ledger_entries ((signal->'instrument'->>'ticker'));
CREATE INDEX IF NOT EXISTS idx_ledger_timeframe ON ledger_entries ((signal->'signal'->>'timeframe'));
CREATE INDEX IF NOT EXISTS idx_ledger_quality ON ledger_entries ((signal->'signal'->>'quality'));

-- Verify table was created
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'ledger_entries'
ORDER BY ordinal_position;
