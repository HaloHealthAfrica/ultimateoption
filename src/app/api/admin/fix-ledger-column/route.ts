/**
 * Admin API: Fix Ledger Column
 * 
 * POST /api/admin/fix-ledger-column
 * 
 * Renames exit_data column to exit in ledger_entries table
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
    console.log('Checking if exit_data column exists...');
    
    // Check if exit_data column exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ledger_entries' 
      AND column_name IN ('exit', 'exit_data')
    `);
    
    const columns = checkResult.rows.map(r => r.column_name);
    console.log('Found columns:', columns);
    
    if (columns.includes('exit_data') && !columns.includes('exit')) {
      console.log('Renaming exit_data to exit...');
      await pool.query('ALTER TABLE ledger_entries RENAME COLUMN exit_data TO exit');
      
      return NextResponse.json({
        success: true,
        message: 'Column exit_data renamed to exit successfully',
        action: 'renamed',
      });
    } else if (columns.includes('exit')) {
      return NextResponse.json({
        success: true,
        message: 'Column exit already exists, no action needed',
        action: 'none',
      });
    } else if (columns.includes('exit_data')) {
      // Both exist? This shouldn't happen
      return NextResponse.json({
        success: false,
        error: 'Both exit and exit_data columns exist',
        columns,
      }, { status: 500 });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Neither exit nor exit_data column found',
        columns,
      }, { status: 500 });
    }
    
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
    message: 'POST to this endpoint to fix the ledger column name',
    description: 'Renames exit_data to exit in ledger_entries table',
  });
}
