/**
 * Fix created_at column type
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function fixType() {
  console.log('🔧 Fixing created_at column type...\n');
  
  const response = await fetch(`${BASE_URL}/api/admin/fix-created-at-type`, {
    method: 'POST',
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✅ SUCCESS!');
    console.log('   Message:', data.message);
    console.log('   Action:', data.action);
    if (data.previousType) {
      console.log('   Previous type:', data.previousType);
      console.log('   New type:', data.newType);
    }
  } else {
    console.log('❌ FAILED!');
    console.log('   Error:', data.error);
  }
}

fixType();
