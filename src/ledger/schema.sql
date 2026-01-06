-- Ledger Database Schema
-- PostgreSQL with TimescaleDB for time-series optimization
-- 
-- Requirements: 4.7, 4.8, 4.9

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Main ledger entries table
CREATE TABLE IF NOT EXISTS ledger_entries (
  -- Identity
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engine_version VARCHAR(20) NOT NULL,
  
  -- Signal snapshot (frozen at decision time)
  signal JSONB NOT NULL,
  
  -- Phase context (if present)
  phase_context JSONB,
  
  -- Decision
  decision VARCHAR(10) NOT NULL CHECK (decision IN ('EXECUTE', 'WAIT', 'SKIP')),
  decision_reason TEXT NOT NULL,
  decision_breakdown JSONB NOT NULL,
  confluence_score DECIMAL(5,2) NOT NULL CHECK (confluence_score >= 0 AND confluence_score <= 100),
  
  -- Execution data (if executed)
  execution JSONB,
  
  -- Exit data (updated when closed)
  exit_data JSONB,
  
  -- Market regime snapshot
  regime JSONB NOT NULL,
  
  -- Hypothetical tracking (for skipped trades)
  hypothetical JSONB,
  
  -- Constraints
  CONSTRAINT valid_execution CHECK (
    (decision = 'EXECUTE' AND execution IS NOT NULL) OR
    (decision IN ('WAIT', 'SKIP') AND execution IS NULL)
  )
);

-- Convert to hypertable for time-series optimization
-- Partitioned by month for query performance (Requirement 4.9)
SELECT create_hypertable('ledger_entries', 'created_at', 
  chunk_time_interval => INTERVAL '1 month',
  if_not_exists => TRUE
);

-- Indexes (Requirement 4.8)
-- Index on created_at is automatic with hypertable
CREATE INDEX IF NOT EXISTS idx_ledger_decision ON ledger_entries (decision);
CREATE INDEX IF NOT EXISTS idx_ledger_option_type ON ledger_entries ((execution->>'option_type')) WHERE execution IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_dte ON ledger_entries (((execution->>'dte')::int)) WHERE execution IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_timeframe ON ledger_entries ((signal->'signal'->>'timeframe'));
CREATE INDEX IF NOT EXISTS idx_ledger_engine_version ON ledger_entries (engine_version);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_ledger_decision_timeframe ON ledger_entries (decision, (signal->'signal'->>'timeframe'));

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_ledger_signal_gin ON ledger_entries USING GIN (signal);
CREATE INDEX IF NOT EXISTS idx_ledger_regime_gin ON ledger_entries USING GIN (regime);

-- Comments for documentation
COMMENT ON TABLE ledger_entries IS 'Append-only audit ledger for all trading decisions and outcomes';
COMMENT ON COLUMN ledger_entries.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN ledger_entries.created_at IS 'Timestamp when entry was created';
COMMENT ON COLUMN ledger_entries.engine_version IS 'Version of decision engine that made the decision';
COMMENT ON COLUMN ledger_entries.signal IS 'Complete EnrichedSignal snapshot frozen at decision time';
COMMENT ON COLUMN ledger_entries.phase_context IS 'SATY phase context if present at decision time';
COMMENT ON COLUMN ledger_entries.decision IS 'Decision outcome: EXECUTE, WAIT, or SKIP';
COMMENT ON COLUMN ledger_entries.decision_reason IS 'Human-readable reason for the decision';
COMMENT ON COLUMN ledger_entries.decision_breakdown IS 'Full breakdown of all multipliers used';
COMMENT ON COLUMN ledger_entries.confluence_score IS 'Weighted confluence score (0-100)';
COMMENT ON COLUMN ledger_entries.execution IS 'Execution details if trade was executed';
COMMENT ON COLUMN ledger_entries.exit_data IS 'Exit details when position is closed';
COMMENT ON COLUMN ledger_entries.regime IS 'Market regime snapshot at decision time';
COMMENT ON COLUMN ledger_entries.hypothetical IS 'Hypothetical outcome tracking for skipped trades';
