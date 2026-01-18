/**
 * Check Webhook Receipts
 */

const BASE_URL = 'http://localhost:3000';

async function checkWebhooks() {
  console.log('='.repeat(70));
  console.log('🔔 Webhook Receipts Status');
  console.log('='.repeat(70));
  console.log();
  
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/recent?limit=10`);
    const data = await response.json();
    
    if (!data.success) {
      console.log('❌ Failed to fetch webhooks');
      console.log('   Error:', data.error || 'Unknown error');
      return;
    }
    
    console.log(`Total Receipts: ${data.entries.length}`);
    console.log();
    
    if (data.entries.length === 0) {
      console.log('⚠️  No webhook receipts found');
      console.log('   Run: node send-10-test-signals.js');
      console.log('   Then check again');
      return;
    }
    
    console.log('Recent Webhooks:');
    console.log('─'.repeat(70));
    console.log('Time'.padEnd(20) + 'Kind'.padEnd(15) + 'Status'.padEnd(10) + 'Ticker');
    console.log('─'.repeat(70));
    
    data.entries.forEach(entry => {
      const time = new Date(entry.received_at).toLocaleTimeString();
      const kind = entry.kind;
      const status = entry.ok ? '✅ OK' : '❌ FAIL';
      const ticker = entry.ticker || entry.symbol || 'N/A';
      
      console.log(
        time.padEnd(20) +
        kind.padEnd(15) +
        status.padEnd(10) +
        ticker
      );
    });
    
    console.log();
    console.log('='.repeat(70));
    console.log('✅ Webhook page is ready!');
    console.log('='.repeat(70));
    console.log();
    console.log('View at: http://localhost:3000');
    console.log('Click "Webhooks" → "Receipts" tab');
    console.log();
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

checkWebhooks().catch(console.error);
