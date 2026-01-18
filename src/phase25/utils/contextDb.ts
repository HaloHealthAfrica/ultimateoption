/**
 * Phase 2.5 Context Persistence (Neon/Postgres)
 *
 * Stores the latest context snapshot per symbol for debugging and visibility.
 */

import { Pool } from 'pg';
import type { StoredContext } from '../types';

declare global {
  // eslint-disable-next-line no-var
  var __phase25ContextPool: Pool | undefined;
}

function getPool(): Pool | null {
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;
  if (!global.__phase25ContextPool) {
    global.__phase25ContextPool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
  }
  return global.__phase25ContextPool;
}

async function ensureTable(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS phase25_context_snapshots (
       symbol TEXT PRIMARY KEY,
       updated_at BIGINT NOT NULL,
       context JSONB NOT NULL
     )`
  );
}

export async function upsertPhase25ContextSnapshot(
  symbol: string,
  context: StoredContext
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await ensureTable(pool);
    const updatedAt = Date.now();
    await pool.query(
      `INSERT INTO phase25_context_snapshots (symbol, updated_at, context)
       VALUES ($1, $2, $3)
       ON CONFLICT (symbol)
       DO UPDATE SET updated_at = $2, context = $3`,
      [symbol, updatedAt, JSON.stringify(context)]
    );
  } catch (error) {
    console.warn('Failed to upsert phase25 context snapshot:', error);
  }
}

export type Phase25ContextSnapshot = {
  symbol: string;
  updated_at: number;
  context: StoredContext;
};

export async function getLatestPhase25ContextSnapshot(
  symbol?: string
): Promise<Phase25ContextSnapshot | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    await ensureTable(pool);
    const res = symbol
      ? await pool.query(
          `SELECT symbol, updated_at, context
           FROM phase25_context_snapshots
           WHERE symbol = $1`,
          [symbol]
        )
      : await pool.query(
          `SELECT symbol, updated_at, context
           FROM phase25_context_snapshots
           ORDER BY updated_at DESC
           LIMIT 1`
        );

    if (res.rows.length === 0) return null;
    const row = res.rows[0] as {
      symbol: string;
      updated_at: number;
      context: StoredContext;
    };
    return {
      symbol: row.symbol,
      updated_at: Number(row.updated_at),
      context: row.context,
    };
  } catch (error) {
    console.warn('Failed to read phase25 context snapshot:', error);
    return null;
  }
}
