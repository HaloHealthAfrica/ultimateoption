/**
 * Admin API: Run Database Migration
 * 
 * POST /api/admin/run-migration
 * Runs the gate_results column migration
 */

import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    return NextResponse.json(
      {
        success: false,
        message: 'DATABASE_URL not configured',
        error: 'DATABASE_URL environment variable is not set in Vercel',
      },
      { status: 500 }
    );
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ledger_entries' 
      AND column_name = 'gate_results'
    `);

    if (checkResult.rows.length > 0) {
      await client.end();
      return NextResponse.json({
        success: true,
        message: 'Migration already completed',
        details: 'gate_results column already exists - no action needed',
        alreadyExists: true,
      });
    }

    // Add the column
    await client.query(`
      ALTER TABLE ledger_entries 
      ADD COLUMN gate_results JSONB
    `);
    console.log('✅ gate_results column added');

    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_gate_results_gin 
      ON ledger_entries USING GIN (gate_results)
    `);
    console.log('✅ Index created');

    await client.end();

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      details: 'Added gate_results JSONB column and created GIN index',
      steps: [
        '✓ Connected to database',
        '✓ Added gate_results column',
        '✓ Created GIN index',
        '✓ Migration complete',
      ],
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);

    try {
      await client.end();
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Block other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to run migration.' },
    { status: 405 }
  );
}
