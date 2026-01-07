/**
 * Admin migration endpoint (Vercel-safe)
 *
 * Creates the `webhook_receipts` table if it doesn't exist.
 *
 * Security:
 * - Requires ADMIN_MIGRATION_TOKEN env var
 * - Token must be provided as ?token=... or x-admin-token header
 *
 * NOTE: Use once, then remove/disable if desired.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const runtime = 'nodejs';

function getToken(request: NextRequest): string {
  const { searchParams } = new URL(request.url);
  return (
    request.headers.get('x-admin-token') ||
    searchParams.get('token') ||
    ''
  );
}

export async function POST(request: NextRequest) {
  const requiredToken = process.env.ADMIN_MIGRATION_TOKEN;
  if (!requiredToken) {
    return NextResponse.json(
      { error: 'ADMIN_MIGRATION_TOKEN is not set on the server.' },
      { status: 500 }
    );
  }

  const token = getToken(request);
  if (token !== requiredToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cs = process.env.DATABASE_URL;
  if (!cs) {
    return NextResponse.json(
      { error: 'DATABASE_URL is not set on the server.' },
      { status: 500 }
    );
  }

  const client = new Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
  });

  const sql = `
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
      message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_receipts_received_at ON webhook_receipts (received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_webhook_receipts_kind ON webhook_receipts (kind);
  `;

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    return NextResponse.json({ success: true, migrated_at: Date.now() });
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    return NextResponse.json(
      { error: 'Migration failed', message: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}


