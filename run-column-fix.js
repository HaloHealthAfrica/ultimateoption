/**
 * Run the column fix migration
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function runFix() {
  console.log('🔧 Running column fix migration...\n');
  
  const response = await fetch(`${BASE_URL}/api/admin/fix-ledger-column`, {
    method: 'POST',
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✅ SUCCESS!');
    console.log('   Message:', data.message);
    console.log('   Action:', data.action);
  } else {
    console.log('❌ FAILED!');
    console.log('   Error:', data.error);
    if (data.columns) {
      console.log('   Columns found:', data.columns);
    }
  }
}

runFix();
