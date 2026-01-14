/**
 * Recent Webhooks by Kind API
 * 
 * GET /api/webhooks/recent-by-kind?kind=signals&limit=5
 * 
 * Returns recent webhooks filtered by kind
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

function getPool(): Pool | null {
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;
  return new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') || 'signals';
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const pool = getPool();
  
  if (!pool) {
    return NextResponse.json({
      error: 'Database not configured',
    }, { status: 500 });
  }

  try {
    const query = `
      SELECT 
        id,
        received_at,
        kind,
        ok,
        status,
        message,
        ticker,
        symbol,
        timeframe,
        raw_payload,
        headers,
        LENGTH(raw_payload) as payload_length
      FROM webhook_receipts
      WHERE kind = $1
      ORDER BY received_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [kind, limit]);

    return NextResponse.json({
      success: true,
      kind,
      count: result.rows.length,
      webhooks: result.rows,
    });

  } catch (error) {
    console.error('Query error:', error);
    return NextResponse.json({
      error: 'Database query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
