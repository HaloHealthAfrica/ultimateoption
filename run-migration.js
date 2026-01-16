/**
 * Run Ledger Table Migration
 * 
 * Creates the ledger_entries table in your Neon database
 * 
 * Usage: node run-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting ledger table migration...\n');
  
  // Get DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable not found');
    console.error('\nPlease set DATABASE_URL in your .env.local file or environment');
    console.error('Example: DATABASE_URL=postgresql://user:pass@host/db');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL found');
  console.log('📍 Connecting to database...\n');
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'create-ledger-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Running migration SQL...\n');
    
    // Execute migration
    const result = await pool.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify table exists
    const verifyResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'ledger_entries'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Table "ledger_entries" created and verified\n');
      
      // Show table structure
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'ledger_entries'
        ORDER BY ordinal_position
      `);
      
      console.log('📊 Table Structure:');
      console.log('─'.repeat(60));
      columnsResult.rows.forEach(row => {
        console.log(`  ${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      console.log('─'.repeat(60));
      console.log();
      
      // Show indexes
      const indexesResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'ledger_entries'
      `);
      
      console.log('🔍 Indexes Created:');
      console.log('─'.repeat(60));
      indexesResult.rows.forEach(row => {
        console.log(`  ${row.indexname}`);
      });
      console.log('─'.repeat(60));
      console.log();
      
    } else {
      console.error('❌ ERROR: Table was not created');
      process.exit(1);
    }
    
    console.log('🎉 Migration complete! Your database is ready.\n');
    console.log('Next steps:');
    console.log('  1. Deploy your code: git push origin main');
    console.log('  2. Test webhooks: node send-test-webhook-production.js');
    console.log('  3. Check dashboard: https://optionstrat.vercel.app\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
