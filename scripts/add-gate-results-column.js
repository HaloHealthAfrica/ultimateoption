/* eslint-disable no-console */
/**
 * Migration: Add gate_results column to ledger_entries
 * 
 * This adds the gate_results JSONB column that stores Phase 2.5 gate scores
 * Safe to run multiple times - uses IF NOT EXISTS
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - skipping migration');
  process.exit(0);
}

async function main() {
  console.log('🔄 Adding gate_results column to ledger_entries...');
  
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
      console.log('✅ gate_results column already exists - skipping');
      return;
    }
    
    // Add the column
    await client.query(`
      ALTER TABLE ledger_entries 
      ADD COLUMN gate_results JSONB
    `);
    
    console.log('✅ gate_results column added successfully');
    
    // Create index for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_gate_results_gin 
      ON ledger_entries USING GIN (gate_results)
    `);
    
    console.log('✅ Index created on gate_results column');
    
  } catch (err) {
    console.error('❌ Migration failed');
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Migration error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
