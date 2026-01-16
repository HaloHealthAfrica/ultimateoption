/**
 * Admin API: Create Ledger Table
 * 
 * POST /api/admin/create-ledger-table
 * 
 * Creates the ledger_entries table in the database.
 * This is a one-time setup endpoint.
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function POST() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      return NextResponse.json(
        { error: 'DATABASE_URL not configured' },
        { status: 500 }
      );
    }
    
    const pool = new Pool({ connectionString: databaseUrl });
    
    // Create table SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id UUID PRIMARY KEY,
        created_at BIGINT NOT NULL,
        engine_version VARCHAR(20) NOT NULL,
        signal JSONB NOT NULL,
        phase_context JSONB,
        decision VARCHAR(10) NOT NULL,
        decision_reason TEXT NOT NULL,
        decision_breakdown JSONB NOT NULL,
        confluence_score DECIMAL(5,2) NOT NULL,
        execution JSONB,
        exit JSONB,
        regime JSONB NOT NULL,
        hypothetical JSONB
      );
      
      CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ledger_decision ON ledger_entries (decision);
      CREATE INDEX IF NOT EXISTS idx_ledger_ticker ON ledger_entries ((signal->'instrument'->>'ticker'));
      CREATE INDEX IF NOT EXISTS idx_ledger_timeframe ON ledger_entries ((signal->'signal'->>'timeframe'));
      CREATE INDEX IF NOT EXISTS idx_ledger_quality ON ledger_entries ((signal->'signal'->>'quality'));
    `;
    
    await pool.query(createTableSQL);
    
    // Verify table exists
    const verifyResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'ledger_entries'
    `);
    
    await pool.end();
    
    if (verifyResult.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Ledger table created successfully',
        table: 'ledger_entries'
      });
    } else {
      return NextResponse.json(
        { error: 'Table creation failed' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Create table error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use POST to create the table' },
    { status: 405 }
  );
}
