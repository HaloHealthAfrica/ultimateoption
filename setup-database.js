/**
 * Setup Database - Create Ledger Table
 * 
 * Calls the admin API to create the ledger table in Neon
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function setupDatabase() {
  console.log('🚀 Setting up ledger table in Neon database...\n');
  console.log('Target:', BASE_URL);
  console.log();
  
  try {
    console.log('📤 Calling admin API to create table...');
    
    const response = await fetch(`${BASE_URL}/api/admin/create-ledger-table`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log('   Message:', data.message);
      console.log('   Table:', data.table);
      console.log();
      console.log('🎉 Database is ready!');
      console.log();
      console.log('Next steps:');
      console.log('  1. Send test webhook: node send-test-webhook-production.js');
      console.log('  2. Check dashboard: https://optionstrat.vercel.app');
      console.log('  3. Click "Phase 2.5" tab to see decisions');
      console.log();
    } else {
      console.log('❌ Failed:', data.error);
      if (data.details) {
        console.log('   Details:', data.details);
      }
      console.log();
      
      if (data.error === 'DATABASE_URL not configured') {
        console.log('⚠️  DATABASE_URL is not set in Vercel');
        console.log();
        console.log('To fix:');
        console.log('  1. Go to Vercel Dashboard → Your Project');
        console.log('  2. Settings → Environment Variables');
        console.log('  3. Check if DATABASE_URL exists');
        console.log('  4. If not, add it from your Neon dashboard');
        console.log();
      }
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    console.log();
    console.log('Possible reasons:');
    console.log('  - Deployment not finished yet (wait 2-3 minutes)');
    console.log('  - Network issue');
    console.log('  - API endpoint not deployed');
    console.log();
  }
}

setupDatabase();
