/**
 * Check the actual database schema
 */

const BASE_URL = 'https://optionstrat.vercel.app';

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');
  
  const response = await fetch(`${BASE_URL}/api/admin/check-schema`);
  const data = await response.json();
  
  if (data.success) {
    console.log('✅ Schema retrieved successfully:\n');
    console.log('Column Name'.padEnd(25), 'Data Type'.padEnd(20), 'Nullable');
    console.log('='.repeat(70));
    data.columns.forEach(col => {
      console.log(
        col.column_name.padEnd(25),
        col.data_type.padEnd(20),
        col.is_nullable
      );
    });
  } else {
    console.log('❌ Failed to retrieve schema');
    console.log('   Error:', data.error);
  }
}

checkSchema();
