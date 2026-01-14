/**
 * Webhook Statistics API
 * 
 * GET /api/webhooks/stats
 * 
 * Returns statistics about webhook receipts
 */

import { NextResponse } from 'next/server';
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

export async function GET() {
  const pool = getPool();
  
  if (!pool) {
    return NextResponse.json({
      error: 'Database not configured',
    }, { status: 500 });
  }

  try {
    // Get overall stats
    const statsQuery = `
      SELECT 
        kind,
        ok,
        COUNT(*) as count,
        MAX(received_at) as last_received
      FROM webhook_receipts
      GROUP BY kind, ok
      ORDER BY kind, ok DESC
    `;
    
    const statsResult = await pool.query(statsQuery);

    // Get recent successful webhooks
    const successQuery = `
      SELECT 
        id,
        received_at,
        kind,
        status,
        message,
        ticker,
        symbol,
        timeframe
      FROM webhook_receipts
      WHERE ok = true
      ORDER BY received_at DESC
      LIMIT 10
    `;
    
    const successResult = await pool.query(successQuery);

    // Get recent failed webhooks
    const failedQuery = `
      SELECT 
        id,
        received_at,
        kind,
        status,
        message,
        ticker,
        symbol,
        timeframe
      FROM webhook_receipts
      WHERE ok = false
      ORDER BY received_at DESC
      LIMIT 10
    `;
    
    const failedResult = await pool.query(failedQuery);

    // Get total counts
    const totalQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ok = true THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN ok = false THEN 1 ELSE 0 END) as failed
      FROM webhook_receipts
    `;
    
    const totalResult = await pool.query(totalQuery);

    return NextResponse.json({
      success: true,
      totals: totalResult.rows[0],
      by_kind_and_status: statsResult.rows,
      recent_successful: successResult.rows,
      recent_failed: failedResult.rows,
    });

  } catch (error) {
    console.error('Stats query error:', error);
    return NextResponse.json({
      error: 'Database query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
