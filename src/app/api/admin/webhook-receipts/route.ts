/**
 * Admin webhook receipts query (Neon/Postgres)
 *
 * GET /api/admin/webhook-receipts?token=...&since=...&until=...&limit=...
 *
 * Defaults:
 * - since = start of current UTC day
 * - until = now
 * - limit = 100 (max 200)
 *
 * Security:
 * - Requires WEBHOOK_DEBUG_TOKEN env var and matching token query param
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const runtime = 'nodejs';

function startOfUtcDayMs(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const token = searchParams.get('token') || '';
  const requiredToken = process.env.WEBHOOK_DEBUG_TOKEN;
  if (!requiredToken) {
    return NextResponse.json({ error: 'WEBHOOK_DEBUG_TOKEN is not set on the server.' }, { status: 500 });
  }
  if (token !== requiredToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cs = process.env.DATABASE_URL;
  if (!cs) {
    return NextResponse.json({ error: 'DATABASE_URL is not set on the server.' }, { status: 500 });
  }

  const now = Date.now();
  const since = Number(searchParams.get('since') || startOfUtcDayMs(now));
  const until = Number(searchParams.get('until') || now);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 100)));

  const client = new Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const countRes = await client.query(
      `SELECT count(*)::int as count
       FROM webhook_receipts
       WHERE received_at >= to_timestamp($1/1000.0)
         AND received_at <= to_timestamp($2/1000.0)`,
      [since, until]
    );

    const rowsRes = await client.query(
      `SELECT
         id::text as id,
         extract(epoch from received_at) * 1000 as received_at,
         kind,
         ok,
         status,
         ip,
         user_agent,
         ticker,
         symbol,
         timeframe,
         message
       FROM webhook_receipts
       WHERE received_at >= to_timestamp($1/1000.0)
         AND received_at <= to_timestamp($2/1000.0)
       ORDER BY received_at DESC
       LIMIT $3`,
      [since, until, limit]
    );

    return NextResponse.json({
      success: true,
      range: { since, until, tz: 'UTC' },
      count: countRes.rows[0]?.count ?? 0,
      entries: rowsRes.rows,
      retrieved_at: now,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Query failed', message: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed. Use GET.' }, { status: 405 });
}


