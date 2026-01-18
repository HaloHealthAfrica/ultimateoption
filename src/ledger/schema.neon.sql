-- Ledger Database Schema (Neon-compatible)
-- Plain PostgreSQL (no TimescaleDB dependency)
--
-- Notes:
-- - Neon does NOT provide TimescaleDB by default.
-- - This schema avoids `timescaledb` + hypertables.

-- Main ledger entries table
CREATE TABLE IF NOT EXISTS ledger_entries (
  -- Identity
  -- Note: we avoid extension-based UUID generators for maximum compatibility.
  -- The application already generates UUIDs before INSERT.
  id UUID PRIMARY KEY,
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
  
  -- Gate results (Phase 2.5)
  gate_results JSONB,

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

-- Webhook receipts (durable audit log)
-- Used to confirm TradingView delivery in serverless environments (Vercel)
CREATE TABLE IF NOT EXISTS webhook_receipts (
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

CREATE INDEX IF NOT EXISTS idx_webhook_receipts_received_at ON webhook_receipts (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_receipts_kind ON webhook_receipts (kind);


