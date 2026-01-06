-- Ledger Database Schema (Neon-compatible)
-- Plain PostgreSQL (no TimescaleDB dependency)
--
-- Notes:
-- - Neon does NOT provide TimescaleDB by default.
-- - This schema avoids `timescaledb` + hypertables.

-- Enable required extensions (uuid generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_decision ON ledger_entries (decision);
CREATE INDEX IF NOT EXISTS idx_ledger_timeframe ON ledger_entries ((signal->'signal'->>'timeframe'));
CREATE INDEX IF NOT EXISTS idx_ledger_engine_version ON ledger_entries (engine_version);
CREATE INDEX IF NOT EXISTS idx_ledger_decision_timeframe ON ledger_entries (decision, (signal->'signal'->>'timeframe'));

-- JSONB GIN indexes for queries
CREATE INDEX IF NOT EXISTS idx_ledger_signal_gin ON ledger_entries USING GIN (signal);
CREATE INDEX IF NOT EXISTS idx_ledger_regime_gin ON ledger_entries USING GIN (regime);


