# API Keys Setup Guide

## Required Environment Variables

You need to set these **4 environment variables** in Vercel:

### 1. Tradier (Options Data)
```
TRADIER_API_KEY=your_tradier_api_key_here
```

### 2. TwelveData (Market Statistics)
```
TWELVE_DATA_API_KEY=your_twelvedata_api_key_here
```

### 3. Alpaca (Liquidity Data) - Requires 2 keys
```
ALPACA_API_KEY=your_alpaca_api_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_key_here
```

---

## Exact Variable Names (Copy These)

**IMPORTANT:** The variable names must match exactly (case-sensitive):

```
TRADIER_API_KEY
TWELVE_DATA_API_KEY
ALPACA_API_KEY
ALPACA_SECRET_KEY
```

---

## How to Add to Vercel

### Step 1: Go to Vercel Dashboard
1. Visit https://vercel.com/dashboard
2. Click on your project: `optionstrat`
3. Click **Settings** tab
4. Click **Environment Variables** in left sidebar

### Step 2: Add Each Variable

For each of the 4 variables:

1. **Key:** Enter the exact variable name (e.g., `TRADIER_API_KEY`)
2. **Value:** Paste your API key
3. **Environments:** Select all three:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **Save**

### Step 3: Redeploy

After adding all 4 variables:
1. Go to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete (~2 minutes)

---

## Where to Get API Keys

### Tradier
1. Sign up at https://developer.tradier.com
2. Create an account (free sandbox available)
3. Go to **API Access** or **Settings** section
4. You'll see:
   - **Account Number** (e.g., ABC12345) - Don't use this
   - **Access Token** (long string) - **Use this one**
5. Copy the **Access Token** (NOT the account number)
6. Use this as `TRADIER_API_KEY`

**IMPORTANT:** Use the Access Token, not the Account Number!

**Note:** Tradier has a free sandbox for testing

### TwelveData
1. Sign up at https://twelvedata.com
2. Go to **Dashboard**
3. Click **API Key** section
4. Copy your API key
5. Use this as `TWELVE_DATA_API_KEY`

**Note:** Free tier includes 800 API calls/day

### Alpaca
1. Sign up at https://alpaca.markets
2. Go to **Paper Trading** (for testing) or **Live Trading**
3. Click **Generate API Keys**
4. Copy both:
   - **API Key ID** → Use as `ALPACA_API_KEY`
   - **Secret Key** → Use as `ALPACA_SECRET_KEY`

**Note:** Paper trading is free and recommended for testing

---

## Verification

### After Adding Keys and Redeploying:

1. **Test the endpoint:**
   ```bash
   curl https://optionstrat.vercel.app/api/admin/test-market-feeds
   ```

2. **Expected response:**
   ```json
   {
     "environment": {
       "TRADIER_API_KEY": "✓ Set",
       "TWELVE_DATA_API_KEY": "✓ Set",
       "ALPACA_API_KEY": "✓ Set",
       "ALPACA_SECRET_KEY": "✓ Set"
     },
     "allConfigured": true
   }
   ```

3. **Send test webhook:**
   - Go to https://optionstrat.vercel.app/webhook-tester
   - Click "🔥 Perfect Setup"
   - Click "Send Staggered Test"
   - Check decision for real market data

---

## What Each Provider Does

### Tradier (Options Data)
**Used for:**
- Put/Call ratio
- IV (Implied Volatility) percentile
- Gamma bias
- Options volume
- Max pain level

**Impact on decisions:**
- Helps identify market sentiment
- Detects unusual options activity
- Influences confidence scores

### TwelveData (Market Statistics)
**Used for:**
- ATR (Average True Range) - volatility measure
- RSI (Relative Strength Index) - momentum
- Realized volatility
- Trend slope
- Volume analysis

**Impact on decisions:**
- Volatility affects position sizing
- RSI influences entry timing
- Trend strength affects confidence

### Alpaca (Liquidity Data)
**Used for:**
- Bid/Ask spread
- Market depth score
- Trade velocity
- Order book analysis

**Impact on decisions:**
- Wide spreads reduce confidence
- Low liquidity triggers warnings
- Affects execution quality assessment

---

## Current Status (Without Keys)

If keys are not set, the system uses **fallback values**:

- **Tradier:** Put/Call = 1.0 (neutral), IV = 50%
- **TwelveData:** ATR = 2.0, RSI = 50 (neutral)
- **Alpaca:** Spread = 15 bps, Depth = 50

**Result:** System works but decisions are based on generic data, not real market conditions.

---

## Troubleshooting

### Tradier Specific Issues

**"Which Tradier value do I use?"**
- ✅ **Use:** Access Token (long alphanumeric string)
- ❌ **Don't use:** Account Number (short, like ABC12345)

**Where to find Access Token:**
1. Log into https://developer.tradier.com
2. Click **API Access** or **Settings**
3. Look for **Access Token** or **API Token**
4. Copy the long string (usually 30+ characters)

**Sandbox vs Production:**
- Sandbox: Free, for testing, limited data
- Production: Requires funded account, real data
- Both have separate Access Tokens

### "Keys not showing as set"
- Check variable names match exactly (case-sensitive)
- Verify you selected all environments
- Try redeploying after adding keys

### "Still using fallback values"
- Wait 2-3 minutes after redeployment
- Clear browser cache
- Send new test webhooks (old ones won't retry)
- Check API key validity with providers

### "API errors in logs"
- Verify API keys are valid
- Check API rate limits
- Ensure keys have correct permissions
- For Alpaca: Make sure using paper trading keys if testing

---

## Summary

**Required Variables (4 total):**
1. `TRADIER_API_KEY`
2. `TWELVE_DATA_API_KEY`
3. `ALPACA_API_KEY`
4. `ALPACA_SECRET_KEY`

**Where to add:** Vercel Dashboard → Settings → Environment Variables

**After adding:** Redeploy and test

**Verification:** Visit `/api/admin/test-market-feeds` to confirm all keys are set
