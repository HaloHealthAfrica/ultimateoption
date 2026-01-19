/**
 * Comprehensive Market Feeds Diagnostic Tool
 * Tests each provider individually to identify specific issues
 */

const axios = require('axios');

// Test configuration
const PRODUCTION_URL = 'https://optionstrat.vercel.app';
const TEST_SYMBOL = 'SPY';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAPIKeys() {
  log('cyan', '\n' + '='.repeat(80));
  log('cyan', 'STEP 1: API KEY CONFIGURATION TEST');
  log('cyan', '='.repeat(80));
  
  try {
    const response = await axios.get(`${PRODUCTION_URL}/api/admin/test-market-feeds`);
    const data = response.data;
    
    console.log('\nAPI Keys Status:');
    console.log(`  TRADIER_API_KEY: ${data.environment.TRADIER_API_KEY} (${data.keyLengths.TRADIER_API_KEY} chars)`);
    console.log(`  TWELVE_DATA_API_KEY: ${data.environment.TWELVE_DATA_API_KEY} (${data.keyLengths.TWELVE_DATA_API_KEY} chars)`);
    console.log(`  ALPACA_API_KEY: ${data.environment.ALPACA_API_KEY} (${data.keyLengths.ALPACA_API_KEY} chars)`);
    console.log(`  ALPACA_SECRET_KEY: ${data.environment.ALPACA_SECRET_KEY} (${data.keyLengths.ALPACA_SECRET_KEY} chars)`);
    
    console.log('\nKey Previews:');
    console.log(`  TRADIER: ${data.keyPreviews.TRADIER_API_KEY}`);
    console.log(`  TWELVE_DATA: ${data.keyPreviews.TWELVE_DATA_API_KEY}`);
    
    if (data.allConfigured) {
      log('green', '\n✓ All API keys are configured');
    } else {
      log('red', '\n✗ Some API keys are missing');
    }
    
    return data;
  } catch (error) {
    log('red', `\n✗ Failed to check API keys: ${error.message}`);
    return null;
  }
}

async function testTradierDirect(apiKey) {
  log('cyan', '\n' + '='.repeat(80));
  log('cyan', 'STEP 2: TRADIER API DIRECT TEST');
  log('cyan', '='.repeat(80));
  
  console.log('\nTesting Tradier API directly...');
  console.log(`Symbol: ${TEST_SYMBOL}`);
  console.log(`API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
  
  // Test 1: Quote endpoint
  console.log('\n--- Test 1: Quote Endpoint ---');
  try {
    const response = await axios.get(
      `https://api.tradier.com/v1/markets/quotes?symbols=${TEST_SYMBOL}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      }
    );
    
    console.log('Status:', response.status);
    console.log('Response structure:', JSON.stringify(response.data, null, 2).substring(0, 500));
    
    const quote = response.data.quotes?.quote;
    if (quote) {
      log('green', '✓ Quote data received');
      console.log('  Symbol:', quote.symbol);
      console.log('  Last:', quote.last);
      console.log('  Bid:', quote.bid);
      console.log('  Ask:', quote.ask);
      console.log('  Volume:', quote.volume);
      
      if (quote.bid && quote.ask && quote.volume) {
        log('green', '✓ Tradier API is working correctly');
        return { working: true, data: quote };
      } else {
        log('yellow', '⚠ Quote data is incomplete');
        return { working: false, reason: 'Incomplete quote data', data: quote };
      }
    } else {
      log('red', '✗ No quote data in response');
      return { working: false, reason: 'No quote data', data: response.data };
    }
  } catch (error) {
    log('red', `✗ Tradier API error: ${error.message}`);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        return { working: false, reason: 'Authentication failed - invalid API key' };
      } else if (error.response.status === 429) {
        return { working: false, reason: 'Rate limit exceeded' };
      }
    }
    return { working: false, reason: error.message };
  }
}

async function testTwelveDataDirect(apiKey) {
  log('cyan', '\n' + '='.repeat(80));
  log('cyan', 'STEP 3: TWELVEDATA API DIRECT TEST');
  log('cyan', '='.repeat(80));
  
  console.log('\nTesting TwelveData API directly...');
  console.log(`Symbol: ${TEST_SYMBOL}`);
  console.log(`API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
  
  const results = {
    quote: null,
    atr: null,
    rsi: null,
    timeSeries: null
  };
  
  // Test 1: Quote endpoint
  console.log('\n--- Test 1: Quote Endpoint ---');
  try {
    const response = await axios.get(
      `https://api.twelvedata.com/quote?symbol=${TEST_SYMBOL}&apikey=${apiKey}`,
      { timeout: 5000 }
    );
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.code === 429) {
      log('red', '✗ Rate limit exceeded');
      results.quote = { working: false, reason: 'Rate limit' };
    } else if (response.data.symbol) {
      log('green', '✓ Quote data received');
      console.log('  Symbol:', response.data.symbol);
      console.log('  Close:', response.data.close);
      console.log('  Bid:', response.data.bid);
      console.log('  Ask:', response.data.ask);
      console.log('  Volume:', response.data.volume);
      results.quote = { working: true, data: response.data };
    } else {
      log('red', '✗ Unexpected response format');
      results.quote = { working: false, reason: 'Invalid format', data: response.data };
    }
  } catch (error) {
    log('red', `✗ Quote endpoint error: ${error.message}`);
    results.quote = { working: false, reason: error.message };
  }
  
  // Test 2: ATR endpoint
  console.log('\n--- Test 2: ATR Endpoint ---');
  try {
    const response = await axios.get(
      `https://api.twelvedata.com/atr?symbol=${TEST_SYMBOL}&interval=1day&outputsize=1&apikey=${apiKey}`,
      { timeout: 5000 }
    );
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.code === 429) {
      log('red', '✗ Rate limit exceeded');
      results.atr = { working: false, reason: 'Rate limit' };
    } else if (response.data.values && response.data.values.length > 0) {
      log('green', '✓ ATR data received');
      console.log('  ATR:', response.data.values[0].atr);
      results.atr = { working: true, data: response.data };
    } else {
      log('red', '✗ No ATR data in response');
      results.atr = { working: false, reason: 'No data', data: response.data };
    }
  } catch (error) {
    log('red', `✗ ATR endpoint error: ${error.message}`);
    results.atr = { working: false, reason: error.message };
  }
  
  // Test 3: RSI endpoint
  console.log('\n--- Test 3: RSI Endpoint ---');
  try {
    const response = await axios.get(
      `https://api.twelvedata.com/rsi?symbol=${TEST_SYMBOL}&interval=1day&outputsize=1&apikey=${apiKey}`,
      { timeout: 5000 }
    );
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.code === 429) {
      log('red', '✗ Rate limit exceeded');
      results.rsi = { working: false, reason: 'Rate limit' };
    } else if (response.data.values && response.data.values.length > 0) {
      log('green', '✓ RSI data received');
      console.log('  RSI:', response.data.values[0].rsi);
      results.rsi = { working: true, data: response.data };
    } else {
      log('red', '✗ No RSI data in response');
      results.rsi = { working: false, reason: 'No data', data: response.data };
    }
  } catch (error) {
    log('red', `✗ RSI endpoint error: ${error.message}`);
    results.rsi = { working: false, reason: error.message };
  }
  
  // Test 4: Time Series endpoint
  console.log('\n--- Test 4: Time Series Endpoint ---');
  try {
    const response = await axios.get(
      `https://api.twelvedata.com/time_series?symbol=${TEST_SYMBOL}&interval=1day&outputsize=5&apikey=${apiKey}`,
      { timeout: 5000 }
    );
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 500));
    
    if (response.data.code === 429) {
      log('red', '✗ Rate limit exceeded');
      results.timeSeries = { working: false, reason: 'Rate limit' };
    } else if (response.data.values && response.data.values.length > 0) {
      log('green', '✓ Time series data received');
      console.log('  Data points:', response.data.values.length);
      console.log('  Latest close:', response.data.values[0].close);
      console.log('  Latest volume:', response.data.values[0].volume);
      results.timeSeries = { working: true, data: response.data };
    } else {
      log('red', '✗ No time series data in response');
      results.timeSeries = { working: false, reason: 'No data', data: response.data };
    }
  } catch (error) {
    log('red', `✗ Time series endpoint error: ${error.message}`);
    results.timeSeries = { working: false, reason: error.message };
  }
  
  return results;
}

async function testWebhookIntegration() {
  log('cyan', '\n' + '='.repeat(80));
  log('cyan', 'STEP 4: WEBHOOK INTEGRATION TEST');
  log('cyan', '='.repeat(80));
  
  console.log('\nSending test webhook...');
  
  try {
    const response = await axios.post(
      `${PRODUCTION_URL}/api/phase25/webhooks/signals`,
      {
        signal: {
          type: 'LONG',
          timeframe: '15',
          ticker: TEST_SYMBOL,
          price: 580.50,
          aiScore: 9.5,
          quality: 'EXTREME',
          timestamp: new Date().toISOString()
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    
    const data = response.data;
    const marketSnapshot = data.decision.marketSnapshot;
    
    console.log('\nWebhook Response:');
    console.log('  Success:', data.success);
    console.log('  Decision:', data.decision.action);
    console.log('  Confidence:', data.decision.confidenceScore + '%');
    console.log('  Processing Time:', data.processingTime + 'ms');
    console.log('  Completeness:', (marketSnapshot.completeness * 100).toFixed(1) + '%');
    
    console.log('\nMarket Data Analysis:');
    
    // Tradier Options
    if (marketSnapshot.options) {
      console.log('\n  Tradier Options:');
      console.log('    Put/Call:', marketSnapshot.options.putCallRatio);
      console.log('    IV:', marketSnapshot.options.ivPercentile + '%');
      console.log('    Gamma:', marketSnapshot.options.gammaBias);
      
      const isFallback = 
        marketSnapshot.options.putCallRatio === 1.0 &&
        marketSnapshot.options.ivPercentile === 50 &&
        marketSnapshot.options.gammaBias === 'NEUTRAL';
      
      if (isFallback) {
        log('red', '    Status: ✗ USING FALLBACK VALUES');
      } else {
        log('green', '    Status: ✓ REAL DATA');
      }
    }
    
    // TwelveData Stats
    if (marketSnapshot.stats) {
      console.log('\n  TwelveData Stats:');
      console.log('    ATR:', marketSnapshot.stats.atr14);
      console.log('    RSI:', marketSnapshot.stats.rsi);
      console.log('    Volume:', marketSnapshot.stats.volume);
      console.log('    Volume Ratio:', marketSnapshot.stats.volumeRatio);
      
      const isFallback = 
        marketSnapshot.stats.atr14 === 0 ||
        marketSnapshot.stats.atr14 === 2.0;
      
      if (isFallback) {
        log('red', '    Status: ✗ USING FALLBACK VALUES');
      } else {
        log('green', '    Status: ✓ REAL DATA');
      }
    }
    
    // TwelveData Liquidity
    if (marketSnapshot.liquidity) {
      console.log('\n  TwelveData Liquidity:');
      console.log('    Spread:', marketSnapshot.liquidity.spreadBps.toFixed(2), 'bps');
      console.log('    Depth:', marketSnapshot.liquidity.depthScore.toFixed(1));
      console.log('    Velocity:', marketSnapshot.liquidity.tradeVelocity);
      
      const isFallback = 
        marketSnapshot.liquidity.spreadBps === 15.0 &&
        marketSnapshot.liquidity.depthScore === 50.0;
      
      if (isFallback) {
        log('red', '    Status: ✗ USING FALLBACK VALUES');
      } else {
        log('green', '    Status: ✓ REAL DATA');
      }
    }
    
    // Errors
    if (marketSnapshot.errors && marketSnapshot.errors.length > 0) {
      console.log('\n  Errors:');
      marketSnapshot.errors.forEach(err => {
        log('red', `    • ${err}`);
      });
    }
    
    return { success: true, data: marketSnapshot };
  } catch (error) {
    log('red', `\n✗ Webhook test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function generateDiagnosticReport(keyData, tradierTest, twelveDataTest, webhookTest) {
  log('cyan', '\n' + '='.repeat(80));
  log('cyan', 'DIAGNOSTIC REPORT');
  log('cyan', '='.repeat(80));
  
  console.log('\n## API Key Configuration');
  console.log('  Tradier:', keyData.environment.TRADIER_API_KEY);
  console.log('  TwelveData:', keyData.environment.TWELVE_DATA_API_KEY);
  
  console.log('\n## Tradier Diagnosis');
  if (tradierTest.working) {
    log('green', '  ✓ Tradier API is working correctly');
    console.log('  Issue: Code parsing problem in market-context.service.ts');
    console.log('  Fix: Update response parsing logic');
  } else {
    log('red', '  ✗ Tradier API is NOT working');
    console.log('  Reason:', tradierTest.reason);
    if (tradierTest.reason.includes('Authentication')) {
      console.log('  Fix: Verify API key is valid and has correct permissions');
      console.log('  Action: Check if using sandbox vs production key');
    }
  }
  
  console.log('\n## TwelveData Diagnosis');
  const workingEndpoints = Object.values(twelveDataTest).filter(t => t && t.working).length;
  const totalEndpoints = Object.keys(twelveDataTest).length;
  
  console.log(`  Working endpoints: ${workingEndpoints}/${totalEndpoints}`);
  
  Object.entries(twelveDataTest).forEach(([endpoint, result]) => {
    if (result) {
      if (result.working) {
        log('green', `  ✓ ${endpoint}: Working`);
      } else {
        log('red', `  ✗ ${endpoint}: ${result.reason}`);
      }
    }
  });
  
  if (workingEndpoints === 0) {
    console.log('\n  Issue: All endpoints failing');
    console.log('  Likely cause: Rate limit exceeded or invalid API key');
    console.log('  Fix: Check rate limits, wait and retry, or upgrade plan');
  } else if (workingEndpoints < totalEndpoints) {
    console.log('\n  Issue: Some endpoints failing');
    console.log('  Likely cause: Rate limiting on specific endpoints');
    console.log('  Fix: Implement caching and request throttling');
  }
  
  console.log('\n## Webhook Integration');
  if (webhookTest.success) {
    log('green', '  ✓ Webhook processing working');
    console.log('  Completeness:', (webhookTest.data.completeness * 100).toFixed(1) + '%');
  } else {
    log('red', '  ✗ Webhook processing failed');
    console.log('  Error:', webhookTest.error);
  }
  
  console.log('\n## Recommended Actions');
  console.log('\n1. IMMEDIATE:');
  if (!tradierTest.working) {
    console.log('   • Verify Tradier API key validity');
    console.log('   • Check if using correct key type (sandbox vs production)');
  } else {
    console.log('   • Fix Tradier response parsing in market-context.service.ts');
  }
  
  if (workingEndpoints < totalEndpoints) {
    console.log('   • Implement request caching for TwelveData');
    console.log('   • Add rate limit tracking');
  }
  
  console.log('\n2. SHORT-TERM:');
  console.log('   • Add explicit fallback configuration');
  console.log('   • Implement retry logic with exponential backoff');
  console.log('   • Add monitoring for API failures');
  
  console.log('\n3. LONG-TERM:');
  console.log('   • Consider upgrading TwelveData plan if hitting limits');
  console.log('   • Implement request batching where possible');
  console.log('   • Add circuit breaker pattern for failing providers');
  
  log('cyan', '\n' + '='.repeat(80));
}

async function runDiagnostics() {
  console.log('Starting comprehensive market feeds diagnostics...\n');
  
  // Step 1: Check API keys
  const keyData = await testAPIKeys();
  if (!keyData) {
    log('red', '\nCannot proceed without API key data');
    return;
  }
  
  // Extract actual keys (we'll need to get them from environment)
  // For now, we'll use the previews to identify issues
  const tradierKey = process.env.TRADIER_API_KEY || 'demo';
  const twelveDataKey = process.env.TWELVE_DATA_API_KEY || 'demo';
  
  // Step 2: Test Tradier directly
  const tradierTest = await testTradierDirect(tradierKey);
  
  // Step 3: Test TwelveData directly
  const twelveDataTest = await testTwelveDataDirect(twelveDataKey);
  
  // Step 4: Test webhook integration
  const webhookTest = await testWebhookIntegration();
  
  // Step 5: Generate report
  await generateDiagnosticReport(keyData, tradierTest, twelveDataTest, webhookTest);
}

// Run diagnostics
runDiagnostics().catch(error => {
  log('red', `\nDiagnostic failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
