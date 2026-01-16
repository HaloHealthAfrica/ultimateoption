/**
 * Admin API: Fix created_at Type
 * 
 * POST /api/admin/fix-created-at-type
 * 
 * Changes created_at from TIMESTAMP to BIGINT
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function POST() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    return NextResponse.json({
      success: false,
      error: 'DATABASE_URL not configured',
    }, { status: 500 });
  }

  const pool = new Pool({ connectionString });
  
  try {
    console.log('Checking created_at column type...');
    
    // Check current type
    const checkResult = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ledger_entries' 
      AND column_name = 'created_at'
    `);
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'created_at column not found',
      }, { status: 500 });
    }
    
    const currentType = checkResult.rows[0].data_type;
    console.log('Current type:', currentType);
    
    if (currentType === 'bigint') {
      return NextResponse.json({
        success: true,
        message: 'created_at is already BIGINT, no action needed',
        action: 'none',
      });
    }
    
    // Change the type
    console.log('Converting created_at to BIGINT...');
    
    // First, convert any existing timestamp data to milliseconds
    await pool.query(`
      ALTER TABLE ledger_entries 
      ALTER COLUMN created_at TYPE BIGINT 
      USING (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT
    `);
    
    console.log('✅ Column type changed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'created_at column converted from TIMESTAMP to BIGINT',
      action: 'converted',
      previousType: currentType,
      newType: 'bigint',
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to fix the created_at column type',
    description: 'Converts created_at from TIMESTAMP to BIGINT',
  });
}
