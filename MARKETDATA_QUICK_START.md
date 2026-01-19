# MarketData.app Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Add Your API Key

Open `.env.local` and add:

```bash
MARKETDATA_API_KEY=your_actual_api_key_here
MARKETDATA_BASE_URL=https://api.marketdata.app
```

### Step 2: Test the Integration

```bash
node test-marketdata-integration.js
```

You should see:
```
✅ Options data test PASSED
✅ Liquidity data test PASSED
✅ Market stats test PASSED
🎉 ALL TESTS PASSED!
```

### Step 3: Restart Your Server

The system will automatically detect the API key and switch to MarketData.app.

Check logs for:
```
[MarketContext] Using MarketData.app as primary provider
```

---

## ✅ What You Get

### Before (With Issues)
- Tradier: ⚠️ Using fallback values (API key issues)
- TwelveData: ⚠️ Returning zeros (rate limits)
- Completeness: 66-100% (inconsistent)

### After (With MarketData.app)
- MarketData.app: ✅ Real options data with Greeks
- MarketData.app: ✅ Real liquidity with actual bid/ask sizes
- MarketData.app: ✅ Calculated stats (ATR, RSI, volume)
- Completeness: 100% (consistent)

---

## 📊 Data Improvements

### Options Data
- **Put/Call Ratio**: Real volume-based calculation
- **IV Percentile**: Volume-weighted from chain
- **Gamma Bias**: Calculated from actual gamma values
- **Greeks**: Delta, Gamma, Theta, Vega included
- **Max Pain**: From open interest data

### Liquidity Data
- **Spread**: Accurate from real bid/ask
- **Bid/Ask Sizes**: Real sizes (not estimated)
- **Depth Score**: From actual market depth
- **Trade Velocity**: From volume comparison

### Market Stats
- **ATR(14)**: Calculated from 30-day candles
- **RSI(14)**: Calculated from price changes
- **RV(20)**: 20-day realized volatility
- **Trend Slope**: Linear regression on prices
- **Volume Ratio**: Current vs 20-day average

---

## 🔧 How It Works

### Automatic Provider Selection

The system checks for `MARKETDATA_API_KEY`:

```typescript
// If key exists
✅ Use MarketData.app for all data

// If key missing
⚠️ Fall back to legacy providers (Tradier + TwelveData)
```

### No Code Changes Required

Just add the API key and restart. The integration is automatic.

---

## 🧪 Testing

### Quick Test
```bash
node test-marketdata-integration.js
```

### Test Specific Symbol
Edit the test file and change:
```javascript
const TEST_SYMBOL = 'AAPL'; // or any symbol
```

### Production Test
```bash
# Send a test webhook
node send-test-webhook-production.js

# Check the response for 100% completeness
```

---

## 📈 Monitoring

### Check Logs

Look for these messages:

**Success:**
```
[MarketContext] Using MarketData.app as primary provider
Completeness: 100.0% ✅
```

**Issues:**
```
[MarketData] Options fetch error: ...
[MarketData] Rate limit reached, using fallback
```

### Check Completeness

In webhook responses, look for:
```json
{
  "marketSnapshot": {
    "completeness": 1.0,  // Should be 1.0 (100%)
    "errors": []          // Should be empty
  }
}
```

---

## 💰 Cost

**MarketData.app Subscription:**
- ~$30-50/month (check their pricing)
- Includes: Stocks, options, ETFs, mutual funds
- No per-call charges for most endpoints
- Higher rate limits than free tiers

**What You Save:**
- No more Alpaca subscription ($9/month)
- No more troubleshooting multiple APIs
- No more fallback values
- Better decision quality

---

## ❓ Troubleshooting

### "Authentication failed"
→ Check API key is correct in `.env.local`

### "Rate limit exceeded"
→ Check your subscription plan limits

### Still using legacy providers
→ Ensure `MARKETDATA_API_KEY` is set and restart server

### Test script fails
→ Check API key, internet connection, and symbol availability

---

## 📚 Documentation

- **Full Integration Guide**: `MARKETDATA_INTEGRATION.md`
- **Service Code**: `src/phase25/services/marketdata.service.ts`
- **Test Script**: `test-marketdata-integration.js`
- **MarketData.app Docs**: https://docs.marketdata.app

---

## ✨ Summary

1. Add `MARKETDATA_API_KEY` to `.env.local`
2. Run `node test-marketdata-integration.js`
3. Restart server
4. Enjoy 100% completeness with real data!

**That's it! You're ready to go.** 🎉
