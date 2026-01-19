/* eslint-disable no-console */
/**
 * Simple SQL migration runner (Neon/Vercel friendly)
 *
 * Usage:
 *   - set DATABASE_URL in your environment (do NOT hardcode it)
 *   - npm run db:migrate
 * 
 * This script is safe to run multiple times - it uses CREATE TABLE IF NOT EXISTS
 */

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - skipping migration');
  console.warn('   This is OK for local development without a database');
  process.exit(0); // Exit successfully to not break build
}

const schemaPath = path.join(__dirname, '..', 'src', 'ledger', 'schema.neon.sql');

if (!fs.existsSync(schemaPath)) {
  console.error(`❌ Schema file not found: ${schemaPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(schemaPath, 'utf8');

// Add migration for enhanced_data column
const enhancedDataMigration = `
-- Add enhanced_data column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'ledger_entries' 
    AND column_name = 'enhanced_data'
  ) THEN
    ALTER TABLE ledger_entries ADD COLUMN enhanced_data JSONB;
    RAISE NOTICE 'Column enhanced_data added successfully';
  ELSE
    RAISE NOTICE 'Column enhanced_data already exists';
  END IF;
END $$;
`;

async function main() {
  console.log('🔄 Running database migrations...');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    await client.query('BEGIN');
    
    // First run the enhanced_data migration
    try {
      await client.query(enhancedDataMigration);
    } catch (err) {
      console.log('   ℹ️  Enhanced data migration skipped (may already exist)');
    }
    
    // Split SQL into statements and execute each one
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await client.query(statement);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message && err.message.includes('already exists')) {
          console.log('   ℹ️  Skipping existing object');
        } else {
          throw err;
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Migration applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
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




