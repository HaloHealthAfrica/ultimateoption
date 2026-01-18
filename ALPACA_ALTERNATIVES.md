# Alpaca Liquidity Data - Alternatives & Solutions

## What Alpaca Provides

Currently using Alpaca for **liquidity data**:

```typescript
{
  spreadBps: number,      // Bid-ask spread in basis points
  depthScore: number,     // Market depth score (0-100)
  tradeVelocity: string,  // 'SLOW' | 'NORMAL' | 'FAST'
  bidSize: number,        // Bid size
  askSize: number         // Ask size
}
```

### How It's Used in Decisions

**Spread Gate:**
- Threshold: 12 basis points (0.12%)
- If spread > 12bps → Reduces confidence score
- Wide spreads = poor execution quality

**Depth Gate:**
- Threshold: 30 (minimum depth score)
- Low depth = thin market = higher risk
- Affects position sizing

---

## Problem with Alpaca

**Error:** 404 Not Found on `/v2/stocks/SPY/quotes/latest`

**Possible Causes:**
1. Paper trading account needs separate data subscription ($9/month)
2. Using wrong endpoint (data.alpaca.markets vs paper-api.alpaca.markets)
3. API keys don't have market data permissions

---

## Solution Options

### Option 1: Fix Alpaca (Recommended) ⭐

**Cost:** $9/month for market data subscription

**Steps:**
1. Go to https://alpaca.markets
2. Subscribe to market data feed
3. Verify endpoint is `https://data.alpaca.markets`
4. Test: `curl -H "APCA-API-KEY-ID: YOUR_KEY" https://data.alpaca.markets/v2/stocks/SPY/quotes/latest`

**Pros:**
- Already integrated
- Real-time data
- Reliable service
- Good documentation

**Cons:**
- Costs $9/month
- Requires subscription

---

### Option 2: Use Polygon.io (Alternative Provider)

**Cost:** Free tier available (5 API calls/minute)

**What Polygon Provides:**
- Real-time quotes with bid/ask
- Trade data
- Market depth
- Same data as Alpaca

**Integration:**
```typescript
// Add to market-feeds.config.ts
polygon: {
  enabled: true,
  timeout: 600,
  retries: 2,
  apiKey: process.env.POLYGON_API_KEY || '',
  baseUrl: 'https://api.polygon.io',
  fallbackValues: { /* same as Alpaca */ }
}
```

**API Endpoint:**
```bash
# Get quote with bid/ask
GET https://api.polygon.io/v2/last/nbbo/{ticker}?apiKey=YOUR_KEY

# Response includes:
{
  "results": {
    "P": 580.50,      // Price
    "p": 580.48,      // Bid
    "P": 580.52,      // Ask
    "s": 500,         // Bid size
    "S": 450          // Ask size
  }
}
```

**Pros:**
- Free tier available
- Real-time data
- Well documented
- Easy to integrate

**Cons:**
- Rate limited (5 calls/min on free tier)
- Need to write integration code

---

### Option 3: Use TwelveData (Already Integrated!)

**Cost:** Already have API key, included in free tier

**What TwelveData Provides:**
- Real-time quotes with bid/ask
- Volume data
- Already integrated for other data

**Modify Existing Integration:**
```typescript
// TwelveData already provides quote data
GET https://api.twelvedata.com/quote?symbol=SPY&apikey=YOUR_KEY

// Response includes:
{
  "symbol": "SPY",
  "bid": 580.48,
  "ask": 580.52,
  "volume": 45000000
}
```

**Implementation:**
- Add liquidity calculation to existing TwelveData service
- Calculate spread from bid/ask in quote response
- Estimate depth from volume data

**Pros:**
- ✅ Already have API key
- ✅ No additional cost
- ✅ Already integrated
- ✅ Simple modification

**Cons:**
- Less detailed than Alpaca
- No direct depth score
- Need to estimate some values

---

### Option 4: Use Tradier (Already Integrated!)

**Cost:** Already have API key

**What Tradier Provides:**
- Real-time quotes with bid/ask
- Volume data
- Options data (already using)

**API Endpoint:**
```bash
GET https://api.tradier.com/v1/markets/quotes?symbols=SPY

# Response includes:
{
  "quotes": {
    "quote": {
      "symbol": "SPY",
      "bid": 580.48,
      "ask": 580.52,
      "bidsize": 500,
      "asksize": 450,
      "volume": 45000000
    }
  }
}
```

**Implementation:**
- Modify Tradier service to also fetch quote data
- Calculate spread and depth from quote
- Reuse existing API key

**Pros:**
- ✅ Already have API key
- ✅ No additional cost
- ✅ Already integrated
- ✅ Includes bid/ask sizes

**Cons:**
- Need to modify existing service
- May hit rate limits faster

---

## Recommended Solution

### Quick Win: Use Tradier for Liquidity Data ⭐⭐⭐

**Why:**
1. Already have API key configured
2. Already integrated and working
3. Provides all needed data (bid, ask, sizes)
4. No additional cost
5. Can implement in 5 minutes

**Implementation:**

```typescript
// In market-context.service.ts
async getTradierLiquidity(symbol: string): Promise<MarketContext['liquidity']> {
  try {
    const response = await this.tradierClient.get(
      `/v1/markets/quotes?symbols=${symbol}`
    );
    
    const quote = response.data.quotes.quote;
    
    // Calculate spread
    const bid = quote.bid || 0;
    const ask = quote.ask || 0;
    const midPrice = (bid + ask) / 2;
    const spreadBps = midPrice > 0 ? ((ask - bid) / midPrice) * 10000 : 0;
    
    // Get sizes
    const bidSize = quote.bidsize || 0;
    const askSize = quote.asksize || 0;
    
    // Calculate depth score
    const depthScore = Math.min(100, Math.sqrt(bidSize + askSize) * 10);
    
    // Estimate velocity from volume
    const volume = quote.volume || 0;
    const avgVolume = quote.average_volume || 1000000;
    const volumeRatio = volume / avgVolume;
    const tradeVelocity = volumeRatio > 1.5 ? 'FAST' : 
                         volumeRatio < 0.5 ? 'SLOW' : 'NORMAL';
    
    return {
      spreadBps,
      depthScore,
      tradeVelocity,
      bidSize,
      askSize
    };
  } catch (error) {
    throw this.handleApiError('tradier', error);
  }
}
```

**Changes Needed:**
1. Add `getTradierLiquidity()` method
2. Replace Alpaca call with Tradier call in `buildContext()`
3. Update config to disable Alpaca, use Tradier for liquidity

---

## Comparison Table

| Provider | Cost | Already Integrated | Data Quality | Effort |
|----------|------|-------------------|--------------|--------|
| **Tradier** | ✅ Free (have key) | ✅ Yes | ⭐⭐⭐⭐ Good | 🟢 5 min |
| **TwelveData** | ✅ Free (have key) | ✅ Yes | ⭐⭐⭐ Good | 🟢 10 min |
| **Fix Alpaca** | 💰 $9/month | ✅ Yes | ⭐⭐⭐⭐⭐ Best | 🟡 Subscribe |
| **Polygon.io** | ✅ Free tier | ❌ No | ⭐⭐⭐⭐ Good | 🔴 30 min |

---

## My Recommendation

### Use Tradier for Liquidity Data

**Reasons:**
1. ✅ Already have working API key
2. ✅ Already integrated and tested
3. ✅ Provides all needed data (bid, ask, sizes, volume)
4. ✅ No additional cost
5. ✅ Quick to implement (5 minutes)
6. ✅ One less provider to manage

**Implementation Steps:**
1. Add `getTradierLiquidity()` method to market-context.service.ts
2. Update `buildContext()` to call Tradier instead of Alpaca
3. Update config to disable Alpaca
4. Test with `node test-market-feeds-detailed.js`

**Result:**
- 100% completeness (3/3 providers working)
- All data from 2 providers instead of 3
- Simpler architecture
- No additional costs

---

## Alternative: Keep Alpaca, Fix the Issue

If you prefer to keep Alpaca:

**Option A: Subscribe to Market Data**
- Cost: $9/month
- Go to Alpaca dashboard
- Subscribe to market data feed
- Redeploy

**Option B: Use Live Trading Keys**
- If you have a funded account
- Live trading keys include market data
- Update keys in Vercel
- Redeploy

---

## Next Steps

**Recommended Path:**

1. **Implement Tradier liquidity** (5 minutes)
   - Add method to fetch quote data
   - Calculate spread and depth
   - Replace Alpaca call

2. **Test** (2 minutes)
   - Run `node test-market-feeds-detailed.js`
   - Verify 100% completeness
   - Check spread values are realistic

3. **Deploy** (2 minutes)
   - Commit changes
   - Push to GitHub
   - Vercel auto-deploys

**Total Time:** ~10 minutes
**Cost:** $0 (using existing Tradier key)
**Result:** 100% working market data

---

## Code Changes Required

I can implement the Tradier liquidity solution right now if you want. It's a simple change:

1. Add one method to `market-context.service.ts`
2. Update one line in `buildContext()`
3. Update config to disable Alpaca

Would you like me to implement this now?

---

**Summary:**
- **Problem:** Alpaca 404 error (needs subscription)
- **Solution:** Use Tradier for liquidity data (already have key)
- **Benefit:** 100% completeness, no additional cost
- **Time:** 5-10 minutes to implement
