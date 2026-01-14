/**
 * Debug Payload API
 * 
 * GET /api/webhooks/debug-payload?id=123
 * 
 * Returns the raw payload and headers for a specific webhook receipt
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
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({
      error: 'Missing id parameter',
      usage: 'GET /api/webhooks/debug-payload?id=123',
    }, { status: 400 });
  }

  const pool = getPool();
  
  if (!pool) {
    return NextResponse.json({
      error: 'Database not configured',
    }, { status: 500 });
  }

  try {
    const result = await pool.query(
      `SELECT 
        id,
        received_at,
        kind,
        ok,
        status,
        message,
        raw_payload,
        headers,
        LENGTH(raw_payload) as payload_length,
        CASE 
          WHEN raw_payload IS NULL THEN 'NULL'
          WHEN LENGTH(raw_payload) = 0 THEN 'EMPTY STRING'
          ELSE 'HAS DATA'
        END as payload_status,
        CASE 
          WHEN headers IS NULL THEN 'NULL'
          WHEN headers::text = '{}' THEN 'EMPTY OBJECT'
          ELSE 'HAS DATA'
        END as headers_status
       FROM webhook_receipts
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        error: 'Webhook not found',
        id,
      }, { status: 404 });
    }

    const row = result.rows[0];

    return NextResponse.json({
      success: true,
      webhook: {
        id: row.id,
        received_at: row.received_at,
        kind: row.kind,
        ok: row.ok,
        status: row.status,
        message: row.message,
        payload_status: row.payload_status,
        payload_length: row.payload_length,
        headers_status: row.headers_status,
        raw_payload: row.raw_payload,
        headers: row.headers,
      },
    });

  } catch (error) {
    console.error('Debug payload error:', error);
    return NextResponse.json({
      error: 'Database query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
