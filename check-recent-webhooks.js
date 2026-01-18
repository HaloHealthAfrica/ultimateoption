/**
 * Check Recent Webhook Receipts
 * Shows the last 50 webhooks with success/failure breakdown
 */

const { sql } = require('@vercel/postgres');

async function checkRecentWebhooks() {
  try {
    console.log('Fetching recent webhook receipts...\n');
    
    // Get recent webhooks
    const result = await sql`
      SELECT 
        kind,
        ok,
        ticker,
        symbol,
        timeframe,
        message,
        created_at,
        raw_payload
      FROM webhook_receipts 
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    
    if (result.rows.length === 0) {
      console.log('No webhook receipts found.');
      return;
    }
    
    console.log(`Found ${result.rows.length} recent webhooks:\n`);
    
    // Group by kind and status
    const stats = {
      'signals': { success: 0, failed: 0 },
      'saty-phase': { success: 0, failed: 0 },
      'trend': { success: 0, failed: 0 }
    };
    
    // Show each webhook
    result.rows.forEach((row, idx) => {
      const status = row.ok ? '✅' : '❌';
      const time = new Date(row.created_at).toLocaleString();
      const ticker = row.ticker || row.symbol || 'N/A';
      const tf = row.timeframe || '';
      
      console.log(`${idx + 1}. ${status} [${row.kind}] ${ticker} ${tf}`);
      console.log(`   Time: ${time}`);
      console.log(`   Message: ${row.message}`);
      
      // Show payload preview for failed webhooks
      if (!row.ok && row.raw_payload) {
        const preview = row.raw_payload.substring(0, 200);
        console.log(`   Payload: ${preview}${row.raw_payload.length > 200 ? '...' : ''}`);
      }
      
      console.log('');
      
      // Update stats
      if (stats[row.kind]) {
        if (row.ok) {
          stats[row.kind].success++;
        } else {
          stats[row.kind].failed++;
        }
      }
    });
    
    // Show summary
    console.log('\n=== SUMMARY (Last 50 Webhooks) ===\n');
    
    Object.entries(stats).forEach(([kind, counts]) => {
      const total = counts.success + counts.failed;
      if (total > 0) {
        const successRate = ((counts.success / total) * 100).toFixed(1);
        console.log(`${kind}:`);
        console.log(`  ✅ Success: ${counts.success}`);
        console.log(`  ❌ Failed: ${counts.failed}`);
        console.log(`  📊 Success Rate: ${successRate}%`);
        console.log('');
      }
    });
    
    // Show time range
    const oldest = new Date(result.rows[result.rows.length - 1].created_at);
    const newest = new Date(result.rows[0].created_at);
    console.log(`Time Range: ${oldest.toLocaleString()} to ${newest.toLocaleString()}`);
    
  } catch (error) {
    console.error('Error fetching webhook receipts:', error);
    throw error;
  }
}

checkRecentWebhooks()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
