/**
 * Run Full Database Migration
 * 
 * Creates all necessary tables (ledger_entries and webhook_receipts)
 * Uses the comprehensive Neon-compatible schema
 * 
 * Usage: node run-full-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('='.repeat(70));
  console.log('🚀 Phase 2.5 Database Migration');
  console.log('='.repeat(70));
  console.log();
  
  // Get DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable not found\n');
    console.error('Please set DATABASE_URL in one of the following ways:\n');
    console.error('1. In your .env.local file:');
    console.error('   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"\n');
    console.error('2. As an environment variable:');
    console.error('   export DATABASE_URL="postgresql://user:pass@host/db"\n');
    console.error('3. Inline with the command:');
    console.error('   DATABASE_URL="postgresql://..." node run-full-migration.js\n');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL found');
  console.log('📍 Connecting to database...\n');
  
  const pool = new Pool({ 
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    const testResult = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connection successful');
    console.log(`   Time: ${testResult.rows[0].current_time}`);
    console.log(`   PostgreSQL: ${testResult.rows[0].pg_version.split(',')[0]}\n`);
    
    // Read comprehensive schema file
    const schemaPath = path.join(__dirname, 'src', 'ledger', 'schema.neon.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error(`❌ ERROR: Schema file not found at ${schemaPath}`);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📝 Running migration SQL...');
    console.log('   Schema: src/ledger/schema.neon.sql\n');
    
    // Execute migration (split by semicolons and run each statement)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await pool.query(statement);
          console.log(`   ✓ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          // Ignore "already exists" errors
          if (error.message.includes('already exists')) {
            console.log(`   ⚠ Statement ${i + 1}/${statements.length} skipped (already exists)`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!\n');
    
    // Verify tables exist
    console.log('🔍 Verifying tables...\n');
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND table_name IN ('ledger_entries', 'webhook_receipts')
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      console.error('❌ ERROR: No tables were created');
      process.exit(1);
    }
    
    console.log('✅ Tables verified:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    console.log();
    
    // Show ledger_entries structure
    console.log('📊 Table: ledger_entries');
    console.log('─'.repeat(70));
    
    const ledgerColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ledger_entries'
      ORDER BY ordinal_position
    `);
    
    console.log('Column Name'.padEnd(25) + 'Type'.padEnd(20) + 'Nullable'.padEnd(10) + 'Default');
    console.log('─'.repeat(70));
    ledgerColumns.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = row.column_default ? row.column_default.substring(0, 15) : '-';
      console.log(
        row.column_name.padEnd(25) + 
        row.data_type.padEnd(20) + 
        nullable.padEnd(10) + 
        defaultVal
      );
    });
    console.log();
    
    // Show ledger_entries indexes
    const ledgerIndexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'ledger_entries'
      ORDER BY indexname
    `);
    
    console.log('🔍 Indexes on ledger_entries:');
    console.log('─'.repeat(70));
    ledgerIndexes.rows.forEach(row => {
      console.log(`   ${row.indexname}`);
    });
    console.log();
    
    // Show webhook_receipts structure
    console.log('📊 Table: webhook_receipts');
    console.log('─'.repeat(70));
    
    const webhookColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'webhook_receipts'
      ORDER BY ordinal_position
    `);
    
    console.log('Column Name'.padEnd(25) + 'Type'.padEnd(20) + 'Nullable');
    console.log('─'.repeat(70));
    webhookColumns.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(
        row.column_name.padEnd(25) + 
        row.data_type.padEnd(20) + 
        nullable
      );
    });
    console.log();
    
    // Show webhook_receipts indexes
    const webhookIndexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'webhook_receipts'
      ORDER BY indexname
    `);
    
    console.log('🔍 Indexes on webhook_receipts:');
    console.log('─'.repeat(70));
    webhookIndexes.rows.forEach(row => {
      console.log(`   ${row.indexname}`);
    });
    console.log();
    
    // Check for existing data
    const ledgerCount = await pool.query('SELECT COUNT(*) as count FROM ledger_entries');
    const webhookCount = await pool.query('SELECT COUNT(*) as count FROM webhook_receipts');
    
    console.log('📈 Current Data:');
    console.log('─'.repeat(70));
    console.log(`   ledger_entries: ${ledgerCount.rows[0].count} rows`);
    console.log(`   webhook_receipts: ${webhookCount.rows[0].count} rows`);
    console.log();
    
    console.log('='.repeat(70));
    console.log('🎉 Migration Complete! Your database is ready.');
    console.log('='.repeat(70));
    console.log();
    console.log('Next steps:');
    console.log('  1. Test locally: node test-complete-flow.js');
    console.log('  2. Deploy to production: git push origin main');
    console.log('  3. Test webhooks: node send-test-webhook-production.js');
    console.log('  4. Check dashboard: http://localhost:3000 (or your production URL)');
    console.log();
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
