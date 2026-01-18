# Market Feeds Quick Fix Guide

## Test Results Summary

✅ **API Keys:** All 4 configured in Vercel
✅ **System:** Working (83.2% confidence, EXECUTE decisions)
⚠️ **Data Quality:** 66.7% (2 of 3 providers working)

---

## Issues Found

### 1. Tradier ⚠️ - Using Fallback Values
**Problem:** API key configured but returning fallback data
**Impact:** Missing real options flow data (put/call ratio, IV)

### 2. TwelveData ⚠️ - Returning Zeros
**Problem:** API called but returns zero values
**Impact:** Missing volatility metrics (ATR, realized vol)

### 3. Alpaca ❌ - 404 Error
**Problem:** API call failing with 404 Not Found
**Impact:** No liquidity data (using 15bps fallback spread)

---

## Quick Fixes

### Fix Tradier (Priority: HIGH)

**Test the key:**
```bash
curl -H "Authorization: Bearer YOUR_TRADIER_KEY" \
  "https://api.tradier.com/v1/markets/quotes?symbols=SPY"
```

**If it fails:**
1. Go to https://developer.tradier.com
2. Check if key is active
3. Make sure you're using **Access Token** (not Account Number)
4. Regenerate key if needed
5. Update in Vercel → Redeploy

---

### Fix TwelveData (Priority: MEDIUM)

**Test the key:**
```bash
curl "https://api.twelvedata.com/time_series?symbol=SPY&interval=1day&outputsize=1&apikey=YOUR_KEY"
```

**If it fails:**
1. Go to https://twelvedata.com/dashboard
2. Check API usage (free tier: 800 calls/day)
3. Verify key is active
4. Try different symbol format (SPY vs SPY:US)
5. Update in Vercel if needed → Redeploy

---

### Fix Alpaca (Priority: HIGH)

**Test the keys:**
```bash
curl -H "APCA-API-KEY-ID: YOUR_KEY" \
     -H "APCA-API-SECRET-KEY: YOUR_SECRET" \
     "https://data.alpaca.markets/v2/stocks/SPY/quotes/latest"
```

**If it fails:**
1. Go to https://alpaca.markets
2. Check if using **paper trading** keys (need data subscription)
3. Verify endpoint is `https://data.alpaca.markets`
4. Check account has market data subscription
5. Update keys in Vercel → Redeploy

**Common Issue:** Paper trading accounts need separate data subscription

---

## Verification Steps

### After fixing each provider:

1. **Update Vercel:**
   - Go to Vercel Dashboard
   - Settings → Environment Variables
   - Update the key
   - Save

2. **Redeploy:**
   - Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"

3. **Test:**
   ```bash
   node test-market-feeds-detailed.js
   ```

4. **Check for real data:**
   - Tradier: Put/Call ratio should NOT be 1.0
   - TwelveData: ATR should NOT be 0 or 2.0
   - Alpaca: Should have liquidity data (no 404 error)

---

## Expected Results (When Working)

**Tradier (Real Data):**
```json
{
  "putCallRatio": 0.87,      // Not 1.0
  "ivPercentile": 62,        // Not 50
  "gammaBias": "POSITIVE",   // Not always NEUTRAL
  "optionVolume": 1250000,   // Not 0
  "maxPain": 580             // Not 0
}
```

**TwelveData (Real Data):**
```json
{
  "atr14": 8.45,            // Not 0 or 2.0
  "rv20": 18.5,             // Not 0 or 20.0
  "trendSlope": 0.15,       // Not 0
  "rsi": 58.3,              // Not always 50
  "volume": 45000000,       // Not 0
  "volumeRatio": 1.2        // Not 1.0
}
```

**Alpaca (Real Data):**
```json
{
  "spreadBps": 2.5,         // Not 15.0
  "depthScore": 85.0,       // Not 50.0
  "tradeVelocity": "FAST",  // Not always NORMAL
  "bidSize": 500,           // Not 100
  "askSize": 450            // Not 100
}
```

---

## Quick Test Command

```bash
# Run this after each fix
node test-market-feeds-detailed.js
```

Look for:
- ✓ Real Data (good)
- ⚠️ Using Fallback Values (needs fix)
- ✗ No data returned (needs fix)

---

## Most Likely Issues

### Tradier
- Using Account Number instead of Access Token
- Sandbox key instead of production key
- Key expired or revoked

### TwelveData
- Rate limit exceeded (800 calls/day on free tier)
- Wrong symbol format
- API key inactive

### Alpaca
- Paper trading account without data subscription
- Wrong endpoint URL
- Keys don't have market data permissions

---

## Contact Support

If issues persist:

**Tradier:** support@tradier.com
**TwelveData:** support@twelvedata.com
**Alpaca:** support@alpaca.markets

Mention you're getting:
- Tradier: Fallback values instead of real data
- TwelveData: Zero values in API responses
- Alpaca: 404 errors on quote endpoints

---

## System Status

**Current:** System works with fallback values (safe but generic)
**Goal:** System works with real market data (accurate and dynamic)
**Blocker:** None - system is operational
**Priority:** Medium - improves decision quality but not critical

---

## Files Created

- `test-market-feeds-detailed.js` - Detailed test script
- `MARKET_FEEDS_TEST_REPORT.md` - Full test report
- `MARKET_FEEDS_QUICK_FIX.md` - This guide
- `API_KEYS_SETUP.md` - Complete setup guide
- `MARKET_FEEDS_VALIDATION.md` - Integration validation

---

**Last Updated:** January 18, 2026, 11:10 PM
