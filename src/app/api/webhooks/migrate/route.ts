/**
 * Database Migration API
 * 
 * POST /api/webhooks/migrate
 * 
 * Adds raw_payload and headers columns to webhook_receipts table if they don't exist.
 * Safe to run multiple times.
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

export async function POST(_request: NextRequest) {
  const pool = getPool();
  
  if (!pool) {
    return NextResponse.json({
      error: 'Database not configured',
      message: 'DATABASE_URL environment variable is not set',
    }, { status: 500 });
  }

  try {
    const results = [];
    
    // Step 1: Check current columns
    const checkQuery = `
      SELECT 
        column_name, 
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'webhook_receipts'
      ORDER BY ordinal_position
    `;
    
    const checkResult = await pool.query(checkQuery);
    const existingColumns = checkResult.rows.map(r => r.column_name);
    
    results.push({
      step: 'check_columns',
      existing_columns: existingColumns,
      has_raw_payload: existingColumns.includes('raw_payload'),
      has_headers: existingColumns.includes('headers'),
    });

    // Step 2: Add raw_payload column if it doesn't exist
    if (!existingColumns.includes('raw_payload')) {
      await pool.query(`
        ALTER TABLE webhook_receipts 
        ADD COLUMN raw_payload TEXT
      `);
      results.push({
        step: 'add_raw_payload',
        status: 'added',
        message: 'Added raw_payload column',
      });
    } else {
      results.push({
        step: 'add_raw_payload',
        status: 'skipped',
        message: 'raw_payload column already exists',
      });
    }

    // Step 3: Add headers column if it doesn't exist
    if (!existingColumns.includes('headers')) {
      await pool.query(`
        ALTER TABLE webhook_receipts 
        ADD COLUMN headers JSONB
      `);
      results.push({
        step: 'add_headers',
        status: 'added',
        message: 'Added headers column',
      });
    } else {
      results.push({
        step: 'add_headers',
        status: 'skipped',
        message: 'headers column already exists',
      });
    }

    // Step 4: Add comments
    await pool.query(`
      COMMENT ON COLUMN webhook_receipts.raw_payload IS 'Complete webhook payload (no longer truncated)'
    `);
    await pool.query(`
      COMMENT ON COLUMN webhook_receipts.headers IS 'HTTP request headers as JSON object'
    `);
    
    results.push({
      step: 'add_comments',
      status: 'success',
      message: 'Added column comments',
    });

    // Step 5: Verify final state
    const verifyResult = await pool.query(checkQuery);
    const finalColumns = verifyResult.rows.map(r => ({
      name: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable,
    }));
    
    results.push({
      step: 'verify',
      status: 'success',
      columns: finalColumns,
    });

    // Step 6: Check sample data
    const sampleQuery = `
      SELECT 
        id,
        received_at,
        kind,
        ok,
        status,
        CASE 
          WHEN raw_payload IS NULL THEN 'NULL'
          WHEN LENGTH(raw_payload) = 0 THEN 'EMPTY'
          ELSE 'HAS DATA (' || LENGTH(raw_payload) || ' chars)'
        END as raw_payload_status,
        CASE 
          WHEN headers IS NULL THEN 'NULL'
          WHEN headers::text = '{}' THEN 'EMPTY'
          ELSE 'HAS DATA'
        END as headers_status
      FROM webhook_receipts
      ORDER BY received_at DESC
      LIMIT 5
    `;
    
    const sampleResult = await pool.query(sampleQuery);
    
    results.push({
      step: 'sample_data',
      status: 'success',
      recent_webhooks: sampleResult.rows,
      note: 'Webhooks received before migration will have NULL values',
    });

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      results,
      next_steps: [
        'Trigger new webhooks from TradingView',
        'New webhooks will have complete payload and header data',
        'Visit /api/webhooks/recent to see the data',
        'Click on webhook rows in the UI to expand and view details',
      ],
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Database Migration Endpoint',
    usage: 'Send POST request to run migration',
    description: 'Adds raw_payload and headers columns to webhook_receipts table',
    safe: 'Yes - uses IF NOT EXISTS logic, safe to run multiple times',
  });
}
