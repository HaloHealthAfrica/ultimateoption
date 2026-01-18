/**
 * Check Dashboard Data
 */

const BASE_URL = 'http://localhost:3000';

async function checkDashboard() {
  console.log('='.repeat(70));
  console.log('📊 Phase 2.5 Dashboard Status');
  console.log('='.repeat(70));
  console.log();
  
  // Check decisions
  const response = await fetch(`${BASE_URL}/api/decisions?limit=10`);
  const data = await response.json();
  
  console.log(`Total Decisions: ${data.pagination.total}`);
  console.log();
  
  if (data.data.length === 0) {
    console.log('⚠️  No decisions found in database');
    console.log('   Run: node send-10-test-signals.js');
    return;
  }
  
  console.log('Recent Decisions:');
  console.log('─'.repeat(70));
  console.log('Symbol'.padEnd(10) + 'Decision'.padEnd(12) + 'Confidence'.padEnd(12) + 'Engine'.padEnd(10) + 'Time');
  console.log('─'.repeat(70));
  
  data.data.forEach(dec => {
    const symbol = dec.signal?.instrument?.ticker || 'N/A';
    const decision = dec.decision;
    const confidence = dec.confluence_score?.toFixed(1) || 'N/A';
    const engine = dec.engine_version;
    const time = new Date(dec.created_at).toLocaleTimeString();
    
    console.log(
      symbol.padEnd(10) + 
      decision.padEnd(12) + 
      confidence.padEnd(12) + 
      engine.padEnd(10) + 
      time
    );
  });
  
  console.log();
  console.log('='.repeat(70));
  console.log('✅ Dashboard is ready!');
  console.log('='.repeat(70));
  console.log();
  console.log('View at: http://localhost:3000');
  console.log('Click the "Phase 2.5" tab to see all decisions');
  console.log();
}

checkDashboard().catch(console.error);
