/**
 * Test Phase 2.5 Ledger Integration
 * Sends test webhooks and verifies ledger storage
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test payloads
const satyPayload = {
  symbol: 'SPY',
  timeframe: '15',
  bias: 'BULLISH'
};

const signalPayload = {
  ticker: 'SPY',
  trend: 'BULLISH',
  score: 8.5
};

function makeRequest(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            response
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            response: body
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

function makeGetRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            response
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            response: body
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

async function runTrace() {
  console.log('🧪 Phase 2.5 Ledger Integration Test\n');
  console.log('=' .repeat(80));
  console.log('\n');
  
  try {
    // Step 1: Send SATY webhook
    console.log('📝 Step 1: Sending SATY Phase webhook...');
    console.log(`   Payload: ${JSON.stringify(satyPayload)}`);
    
    const satyResult = await makeRequest('/api/webhooks/saty-phase', satyPayload);
    console.log(`   Status: ${satyResult.statusCode}`);
    console.log(`   Response: ${JSON.stringify(satyResult.response, null, 2)}`);
    
    if (satyResult.statusCode !== 200) {
      console.log('   ❌ SATY webhook failed\n');
      return;
    }
    console.log('   ✅ SATY webhook accepted\n');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Send Signal webhook
    console.log('📝 Step 2: Sending Signal webhook...');
    console.log(`   Payload: ${JSON.stringify(signalPayload)}`);
    
    const signalResult = await makeRequest('/api/webhooks/signals', signalPayload);
    console.log(`   Status: ${signalResult.statusCode}`);
    
    // Check for ledger storage info
    if (signalResult.response.details) {
      console.log(`   📊 Ledger Status:`);
      console.log(`      - Stored: ${signalResult.response.details.ledgerStored}`);
      if (signalResult.response.details.ledgerError) {
        console.log(`      - Error: ${signalResult.response.details.ledgerError}`);
      }
    }
    
    if (signalResult.response.adaptations) {
      console.log(`   📋 Adaptations:`);
      signalResult.response.adaptations.forEach(a => {
        console.log(`      - ${a}`);
      });
    }
    
    if (signalResult.statusCode !== 200) {
      console.log('   ❌ Signal webhook failed\n');
      return;
    }
    console.log('   ✅ Signal webhook accepted\n');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3: Check Phase 2.5 context status
    console.log('📝 Step 3: Checking Phase 2.5 context status...');
    
    const contextResult = await makeGetRequest('/api/phase25/context/status');
    console.log(`   Status: ${contextResult.statusCode}`);
    
    if (contextResult.statusCode === 200 && contextResult.response.status) {
      const status = contextResult.response.status;
      console.log(`   📊 Context Status:`);
      console.log(`      - Complete: ${status.isComplete}`);
      console.log(`      - Completeness: ${Math.round(status.completeness * 100)}%`);
      console.log(`      - Required Sources:`);
      status.requiredSources.forEach(s => {
        console.log(`         • ${s.source}: ${s.available ? 'Available' : 'Missing'}${s.age ? ` (${Math.round(s.age / 1000)}s ago)` : ''}`);
      });
    }
    console.log('');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Check decisions API
    console.log('📝 Step 4: Checking decisions API...');
    
    const decisionsResult = await makeGetRequest('/api/decisions?limit=5');
    console.log(`   Status: ${decisionsResult.statusCode}`);
    
    if (decisionsResult.statusCode === 200 && decisionsResult.response.data) {
      const decisions = decisionsResult.response.data;
      console.log(`   📊 Recent Decisions: ${decisions.length} found`);
      
      decisions.forEach((d, idx) => {
        const createdAt = new Date(d.created_at);
        console.log(`\n   ${idx + 1}. Decision:`);
        console.log(`      - ID: ${d.id}`);
        console.log(`      - Engine: ${d.engine_version}`);
        console.log(`      - Symbol: ${d.signal.instrument.ticker}`);
        console.log(`      - Decision: ${d.decision}`);
        console.log(`      - Reason: ${d.decision_reason}`);
        console.log(`      - Confidence: ${d.confluence_score}`);
        console.log(`      - Created: ${createdAt.toLocaleString()}`);
        console.log(`      - Price: $${d.signal.instrument.current_price}`);
      });
    } else {
      console.log(`   ⚠️  No decisions found or API error`);
    }
    console.log('');
    
    // Summary
    console.log('=' .repeat(80));
    console.log('\n📊 TEST SUMMARY\n');
    
    const satySuccess = satyResult.statusCode === 200;
    const signalSuccess = signalResult.statusCode === 200;
    const ledgerStored = signalResult.response?.details?.ledgerStored;
    const hasDecisions = decisionsResult.response?.data?.length > 0;
    
    console.log(`   ${satySuccess ? '✅' : '❌'} SATY webhook: ${satySuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ${signalSuccess ? '✅' : '❌'} Signal webhook: ${signalSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ${ledgerStored ? '✅' : '❌'} Ledger storage: ${ledgerStored ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ${hasDecisions ? '✅' : '❌'} Decisions API: ${hasDecisions ? 'HAS DATA' : 'NO DATA'}`);
    
    console.log('\n🔍 KEY FINDINGS:\n');
    
    if (ledgerStored) {
      console.log('   ✅ Ledger adapter fix is working!');
      console.log('   ✅ Phase 2.5 decisions are being stored');
      console.log('   ✅ Dashboard should show new entries');
    } else {
      console.log('   ❌ Ledger storage still failing');
      if (signalResult.response?.details?.ledgerError) {
        console.log(`   ❌ Error: ${signalResult.response.details.ledgerError}`);
      }
      console.log('   ⚠️  Check server logs for details');
    }
    
    if (hasDecisions) {
      const latestDecision = decisionsResult.response.data[0];
      const isPhase25 = latestDecision.engine_version.includes('2.5');
      console.log(`\n   Latest decision engine: ${latestDecision.engine_version}`);
      console.log(`   ${isPhase25 ? '✅' : '⚠️'} ${isPhase25 ? 'Phase 2.5 decision found!' : 'Still showing Phase 2 decisions'}`);
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the trace
runTrace()
  .then(() => {
    console.log('✅ Trace complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Trace failed:', error);
    process.exit(1);
  });
