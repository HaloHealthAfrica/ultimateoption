/**
 * Verify Production Deployment
 * Checks if the latest code is deployed to production
 */

const https = require('https');

// Replace with your production URL
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://your-domain.vercel.app';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function verifyDeployment() {
  console.log('🔍 Verifying Production Deployment\n');
  console.log('=' .repeat(80));
  console.log('\n');
  
  try {
    // Check Phase 2.5 health endpoint
    console.log('📝 Checking Phase 2.5 health endpoint...');
    console.log(`   URL: ${PRODUCTION_URL}/api/phase25/webhooks/health/detailed`);
    
    const healthResult = await makeRequest(`${PRODUCTION_URL}/api/phase25/webhooks/health/detailed`);
    console.log(`   Status: ${healthResult.statusCode}`);
    
    if (healthResult.statusCode === 200) {
      console.log('   ✅ Phase 2.5 endpoints are deployed');
      
      if (healthResult.response.version) {
        console.log(`   📊 Engine Version: ${healthResult.response.version}`);
      }
      
      if (healthResult.response.timestamp) {
        const deployTime = new Date(healthResult.response.timestamp);
        console.log(`   📅 Last Health Check: ${deployTime.toLocaleString()}`);
      }
    } else {
      console.log('   ❌ Phase 2.5 endpoints not found');
      console.log('   ⚠️  Deployment may not be complete');
    }
    
    console.log('');
    
    // Check context status endpoint
    console.log('📝 Checking context status endpoint...');
    console.log(`   URL: ${PRODUCTION_URL}/api/phase25/context/status`);
    
    const contextResult = await makeRequest(`${PRODUCTION_URL}/api/phase25/context/status`);
    console.log(`   Status: ${contextResult.statusCode}`);
    
    if (contextResult.statusCode === 200) {
      console.log('   ✅ Context status endpoint is deployed');
    } else {
      console.log('   ❌ Context status endpoint not found');
      console.log('   ⚠️  New code may not be deployed yet');
    }
    
    console.log('');
    
    // Check validation endpoint
    console.log('📝 Checking validation endpoint...');
    console.log(`   URL: ${PRODUCTION_URL}/api/webhooks/validate`);
    
    const validateResult = await makeRequest(`${PRODUCTION_URL}/api/webhooks/validate`);
    console.log(`   Status: ${validateResult.statusCode}`);
    
    if (validateResult.statusCode === 200 || validateResult.statusCode === 405) {
      console.log('   ✅ Validation endpoint is deployed');
    } else {
      console.log('   ❌ Validation endpoint not found');
    }
    
    console.log('');
    console.log('=' .repeat(80));
    console.log('\n📊 DEPLOYMENT STATUS\n');
    
    const allEndpointsDeployed = 
      healthResult.statusCode === 200 &&
      contextResult.statusCode === 200 &&
      (validateResult.statusCode === 200 || validateResult.statusCode === 405);
    
    if (allEndpointsDeployed) {
      console.log('   ✅ All new endpoints are deployed');
      console.log('   ✅ Latest code is live in production');
      console.log('   ✅ Ready to test Phase 2.5 webhooks');
    } else {
      console.log('   ❌ Some endpoints are missing');
      console.log('   ⚠️  Deployment may not be complete');
      console.log('\n   Next steps:');
      console.log('   1. Check Vercel/hosting dashboard for deployment status');
      console.log('   2. Trigger a new deployment if needed');
      console.log('   3. Wait for build to complete');
      console.log('   4. Rerun this verification script');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.log('\n   Possible issues:');
    console.log('   - Production URL not set (use PRODUCTION_URL env var)');
    console.log('   - Network connectivity issues');
    console.log('   - Deployment not complete');
  }
}

// Run verification
verifyDeployment()
  .then(() => {
    console.log('✅ Verification complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
