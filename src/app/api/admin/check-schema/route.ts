/**
 * Admin API: Check Schema
 * 
 * GET /api/admin/check-schema
 * 
 * Shows the actual schema of the ledger_entries table
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    return NextResponse.json({
      success: false,
      error: 'DATABASE_URL not configured',
    }, { status: 500 });
  }

  const pool = new Pool({ connectionString });
  
  try {
    const result = await pool.query(`
      SELECT 
        column_name, 
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ledger_entries'
      ORDER BY ordinal_position
    `);
    
    return NextResponse.json({
      success: true,
      columns: result.rows,
    });
    
  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
