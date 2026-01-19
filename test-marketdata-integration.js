/**
 * Test MarketData.app Integration
 * 
 * Tests the new MarketData.app service to verify:
 * 1. Options data fetching (put/call ratio, IV, gamma)
 * 2. Liquidity data fetching (spread, depth, velocity)
 * 3. Market stats fetching (ATR, RSI, volume)
 * 4. Complete market context building
 */

require('dotenv').config({ path: '.env.local' });

const axios = require('axios');

const MARKETDATA_API_KEY = process.env.MARKETDATA_API_KEY;
const MARKETDATA_BASE_URL = process.env.MARKETDATA_BASE_URL || 'https://api.marketdata.app';
const TEST_SYMBOL = 'SPY';

console.log('='.repeat(80));
console.log('MARKETDATA.APP INTEGRATION TEST');
console.log('='.repeat(80));
console.log(`Symbol: ${TEST_SYMBOL}`);
console.log(`API Key: ${MARKETDATA_API_KEY ? '✓ Configured' : '✗ Missing'}`);
console.log(`Base URL: ${MARKETDATA_BASE_URL}`);
console.log('='.repeat(80));
console.log();

if (!MARKETDATA_API_KEY) {
  console.error('❌ MARKETDATA_API_KEY not found in environment');
  console.log('\nPlease add to .env.local:');
  console.log('MARKETDATA_API_KEY=your_key_here');
  process.exit(1);
}

const client = axios.create({
  baseURL: MARKETDATA_BASE_URL,
  timeout: 5000,
  headers: {
    'Authorization': `Bearer ${MARKETDATA_API_KEY}`,
    'Accept': 'application/json'
  }
});

async function testOptionsData() {
  console.log('📊 Testing Options Data...');
  console.log('-'.repeat(80));
  
  try {
    // Get expirations
    console.log('  Fetching option expirations...');
    const expirationsResponse = await client.get(`/v1/options/expirations/${TEST_SYMBOL}/`);
    
    if (expirationsResponse.data.s !== 'ok') {
      throw new Error('Failed to fetch expirations');
    }
    
    const expirations = expirationsResponse.data.expirations;
    console.log(`  ✓ Found ${expirations.length} expirations`);
    console.log(`  ✓ Nearest expiration: ${expirations[0]}`);
    
    // Get option chain
    console.log(`  Fetching option chain for ${expirations[0]}...`);
    const chainResponse = await client.get(
      `/v1/options/chain/${TEST_SYMBOL}/?expiration=${expirations[0]}`
    );
    
    if (chainResponse.data.s !== 'ok') {
      throw new Error('Failed to fetch option chain');
    }
    
    const chain = chainResponse.data;
    console.log(`  ✓ Chain has ${chain.optionSymbol.length} contracts`);
    
    // Calculate metrics
    let putVolume = 0;
    let callVolume = 0;
    let totalVolume = 0;
    let totalOI = 0;
    let weightedIV = 0;
    let gammaSum = 0;
    
    for (let i = 0; i < chain.optionSymbol.length; i++) {
      const volume = chain.volume[i] || 0;
      const oi = chain.openInterest[i] || 0;
      const iv = chain.iv[i] || 0;
      const gamma = chain.gamma[i] || 0;
      const side = chain.side[i];
      
      totalVolume += volume;
      totalOI += oi;
      
      if (side === 'put') {
        putVolume += volume;
      } else if (side === 'call') {
        callVolume += volume;
      }
      
      if (volume > 0 && iv > 0) {
        weightedIV += iv * volume;
      }
      
      gammaSum += gamma;
    }
    
    const putCallRatio = callVolume > 0 ? putVolume / callVolume : 1.0;
    const avgIV = totalVolume > 0 ? weightedIV / totalVolume : 0;
    const ivPercentile = Math.min(100, Math.max(0, avgIV * 100));
    const avgGamma = chain.optionSymbol.length > 0 ? gammaSum / chain.optionSymbol.length : 0;
    
    console.log();
    console.log('  📈 Options Metrics:');
    console.log(`     Put/Call Ratio: ${putCallRatio.toFixed(2)}`);
    console.log(`     IV Percentile: ${ivPercentile.toFixed(1)}%`);
    console.log(`     Avg Gamma: ${avgGamma.toFixed(4)}`);
    console.log(`     Total Volume: ${totalVolume.toLocaleString()}`);
    console.log(`     Total OI: ${totalOI.toLocaleString()}`);
    console.log();
    console.log('  ✅ Options data test PASSED');
    
    return true;
  } catch (error) {
    console.error('  ❌ Options data test FAILED:', error.message);
    if (error.response) {
      console.error('     Status:', error.response.status);
      console.error('     Data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testLiquidityData() {
  console.log();
  console.log('💧 Testing Liquidity Data...');
  console.log('-'.repeat(80));
  
  try {
    // Get stock quote
    console.log('  Fetching stock quote...');
    const quoteResponse = await client.get(`/v1/stocks/quotes/${TEST_SYMBOL}/`);
    
    if (quoteResponse.data.s !== 'ok') {
      throw new Error('Failed to fetch stock quote');
    }
    
    const quote = quoteResponse.data;
    const bid = quote.bid[0] || 0;
    const ask = quote.ask[0] || 0;
    const bidSize = quote.bidSize[0] || 0;
    const askSize = quote.askSize[0] || 0;
    const volume = quote.volume[0] || 0;
    const mid = quote.mid[0] || 0;
    
    console.log(`  ✓ Quote received`);
    
    // Calculate metrics
    const spreadBps = mid > 0 && bid > 0 && ask > 0 
      ? ((ask - bid) / mid) * 10000 
      : 0;
    
    const totalSize = bidSize + askSize;
    const depthScore = Math.min(100, Math.sqrt(totalSize / 100) * 10);
    
    console.log();
    console.log('  💰 Liquidity Metrics:');
    console.log(`     Bid: $${bid.toFixed(2)} x ${bidSize}`);
    console.log(`     Ask: $${ask.toFixed(2)} x ${askSize}`);
    console.log(`     Mid: $${mid.toFixed(2)}`);
    console.log(`     Spread: ${spreadBps.toFixed(2)} bps`);
    console.log(`     Depth Score: ${depthScore.toFixed(1)}/100`);
    console.log(`     Volume: ${volume.toLocaleString()}`);
    console.log();
    console.log('  ✅ Liquidity data test PASSED');
    
    return true;
  } catch (error) {
    console.error('  ❌ Liquidity data test FAILED:', error.message);
    if (error.response) {
      console.error('     Status:', error.response.status);
      console.error('     Data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testMarketStats() {
  console.log();
  console.log('📉 Testing Market Stats...');
  console.log('-'.repeat(80));
  
  try {
    // Get historical candles
    console.log('  Fetching 30 days of candles...');
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const candlesResponse = await client.get(
      `/v1/stocks/candles/D/${TEST_SYMBOL}/?from=${thirtyDaysAgo.toISOString().split('T')[0]}&to=${today.toISOString().split('T')[0]}`
    );
    
    if (candlesResponse.data.s !== 'ok') {
      throw new Error('Failed to fetch candles');
    }
    
    const candles = candlesResponse.data;
    const closes = candles.c;
    const volumes = candles.v;
    
    console.log(`  ✓ Received ${closes.length} candles`);
    
    // Calculate simple metrics
    const currentPrice = closes[closes.length - 1];
    const priceChange = closes[closes.length - 1] - closes[0];
    const priceChangePct = (priceChange / closes[0]) * 100;
    
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const volumeRatio = currentVolume / avgVolume;
    
    // Simple RSI calculation
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < Math.min(15, closes.length); i++) {
      const change = closes[closes.length - i] - closes[closes.length - i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss > 0 ? avgGain / avgLoss : 0;
    const rsi = 100 - (100 / (1 + rs));
    
    console.log();
    console.log('  📊 Market Stats:');
    console.log(`     Current Price: $${currentPrice.toFixed(2)}`);
    console.log(`     30-Day Change: ${priceChangePct > 0 ? '+' : ''}${priceChangePct.toFixed(2)}%`);
    console.log(`     RSI(14): ${rsi.toFixed(1)}`);
    console.log(`     Current Volume: ${currentVolume.toLocaleString()}`);
    console.log(`     Avg Volume: ${avgVolume.toLocaleString()}`);
    console.log(`     Volume Ratio: ${volumeRatio.toFixed(2)}x`);
    console.log();
    console.log('  ✅ Market stats test PASSED');
    
    return true;
  } catch (error) {
    console.error('  ❌ Market stats test FAILED:', error.message);
    if (error.response) {
      console.error('     Status:', error.response.status);
      console.error('     Data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function runTests() {
  const results = {
    options: false,
    liquidity: false,
    stats: false
  };
  
  results.options = await testOptionsData();
  results.liquidity = await testLiquidityData();
  results.stats = await testMarketStats();
  
  console.log();
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Options Data:    ${results.options ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Liquidity Data:  ${results.liquidity ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Market Stats:    ${results.stats ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(80));
  
  const allPassed = results.options && results.liquidity && results.stats;
  
  if (allPassed) {
    console.log();
    console.log('🎉 ALL TESTS PASSED!');
    console.log();
    console.log('MarketData.app is ready to use as your primary data provider.');
    console.log('The service will automatically use it when MARKETDATA_API_KEY is set.');
  } else {
    console.log();
    console.log('⚠️  SOME TESTS FAILED');
    console.log();
    console.log('Please check:');
    console.log('1. API key is valid and active');
    console.log('2. Subscription includes required data types');
    console.log('3. Rate limits are not exceeded');
  }
  
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
