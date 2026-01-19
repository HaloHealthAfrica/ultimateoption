/**
 * Test Tradier API directly to see what response we get
 */

const axios = require('axios');

async function testTradierAPI() {
  console.log('Testing Tradier API directly...\n');
  
  // First, get the API key from environment
  const response = await axios.get('https://optionstrat.vercel.app/api/admin/test-market-feeds');
  const keyPreview = response.data.keyPreviews.TRADIER_API_KEY;
  
  console.log(`Tradier API Key: ${keyPreview}`);
  console.log('');
  
  // Now test a webhook and log the full error
  try {
    const webhookResponse = await axios.post(
      'https://optionstrat.vercel.app/api/phase25/webhooks/signals',
      {
        signal: {
          type: 'LONG',
          timeframe: '15',
          ticker: 'SPY',
          price: 580.50,
          aiScore: 9.5,
          quality: 'EXTREME',
          timestamp: new Date().toISOString()
        }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    const data = webhookResponse.data;
    const marketSnapshot = data.decision.marketSnapshot;
    
    console.log('Market Snapshot:');
    console.log(JSON.stringify(marketSnapshot, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testTradierAPI();
