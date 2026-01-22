# Webhook URLs Reference

**Production Base URL:** `https://optionstrat.vercel.app`

---

## 🎯 Primary Webhook Endpoints (Phase 2.5)

### 1. Trading Signals Webhook
**URL:** `https://optionstrat.vercel.app/api/phase25/webhooks/signals`

**Purpose:** Receives trading signals from TradingView indicators  
**Method:** POST  
**Authentication:** None required  
**Content-Type:** application/json

**Use for:**
- Multi-timeframe trading signals
- Entry/exit signals
- Signal quality indicators
- Risk/reward calculations

---

### 2. SATY Phase Webhook
**URL:** `https://optionstrat.vercel.app/api/phase25/webhooks/saty-phase`

**Purpose:** Receives SATY phase regime data  
**Method:** POST  
**Authentication:** None required  
**Content-Type:** application/json

**Use for:**
- Market regime detection
- Phase transitions
- Volatility regime
- Bias signals

---

## 🔄 Legacy Webhook Endpoints (Phase 2 - Still Active)

### 3. Signals (Legacy)
**URL:** `https://optionstrat.vercel.app/api/webhooks/signals`

**Purpose:** Legacy signals endpoint (dual-write enabled)  
**Method:** POST  
**Authentication:** None required  
**Status:** Active (forwards to Phase 2.5)

---

### 4. SATY Phase (Legacy)
**URL:** `https://optionstrat.vercel.app/api/webhooks/saty-phase`

**Purpose:** Legacy SATY phase endpoint  
**Method:** POST  
**Authentication:** None required  
**Status:** Active (forwards to Phase 2.5)

---

### 5. Trend Change
**URL:** `https://optionstrat.vercel.app/api/webhooks/trend`

**Purpose:** Trend change notifications  
**Method:** POST  
**Authentication:** None required  
**Content-Type:** application/json

**Use for:**
- Trend direction changes
- Trend strength updates
- Multi-timeframe trend alignment

---

## 🔍 Testing & Debug Endpoints

### 6. Webhook Validation
**URL:** `https://optionstrat.vercel.app/api/webhooks/validate`

**Purpose:** Test webhook payloads without authentication  
**Method:** POST  
**Authentication:** None (testing only)  
**Content-Type:** application/json

**Use for:**
- Testing payload format
- Validating JSON structure
- Debugging webhook issues

---

### 7. Debug Webhook
**URL:** `https://optionstrat.vercel.app/api/webhooks/debug`

**Purpose:** View raw webhook data  
**Method:** POST  
**Authentication:** None  
**Returns:** Raw request details

---

### 8. Debug Authentication
**URL:** `https://optionstrat.vercel.app/api/webhooks/debug-auth?type=signals`

**Purpose:** Test authentication methods  
**Method:** POST  
**Query Params:** `type` (signals, saty-phase, or trend)  
**Returns:** Authentication validation results

---

## 📊 Monitoring & Status Endpoints

### 9. Webhook Status
**URL:** `https://optionstrat.vercel.app/api/webhooks/status`

**Method:** GET  
**Returns:** Overall webhook system status

---

### 10. Webhook Stats
**URL:** `https://optionstrat.vercel.app/api/webhooks/stats`

**Method:** GET  
**Returns:** Webhook delivery statistics

---

### 11. Recent Webhooks
**URL:** `https://optionstrat.vercel.app/api/webhooks/recent?limit=10`

**Method:** GET  
**Query Params:** `limit` (default: 10)  
**Returns:** Recent webhook receipts

---

### 12. Webhook Receipts
**URL:** `https://optionstrat.vercel.app/api/webhooks/receipts?limit=50`

**Method:** GET  
**Query Params:** `limit`, `kind`, `status`  
**Returns:** Detailed webhook receipt history

---

## 🏥 Health Check Endpoints

### 13. Phase 2.5 Health
**URL:** `https://optionstrat.vercel.app/api/phase25/webhooks/health`

**Method:** GET  
**Returns:** Phase 2.5 system health status

---

### 14. Phase 2.5 Detailed Health
**URL:** `https://optionstrat.vercel.app/api/phase25/webhooks/health/detailed`

**Method:** GET  
**Returns:** Detailed health check with all services

---

### 15. Phase 2.5 Metrics
**URL:** `https://optionstrat.vercel.app/api/phase25/webhooks/metrics`

**Method:** GET  
**Returns:** Paper trading performance metrics

---

## 🔑 Environment Variables Required

Set these in Vercel Project Settings → Environment Variables:

```bash
# Database (Required)
DATABASE_URL="postgresql://..."

# Market Data (Optional)
MARKETDATA_API_KEY="your-marketdata-api-key"
TRADIER_API_KEY="your-tradier-api-key"
TWELVEDATA_API_KEY="your-twelvedata-api-key"
```

**Note:** Webhook authentication is optional. If webhook secrets are not configured, endpoints work without authentication.

---

## 📝 TradingView Alert Setup

### For Trading Signals:
**Webhook URL:**
```
https://optionstrat.vercel.app/api/phase25/webhooks/signals
```

**Message Body:** (Your indicator's JSON payload)

---

### For SATY Phase:
**Webhook URL:**
```
https://optionstrat.vercel.app/api/phase25/webhooks/saty-phase
```

**Message Body:** (Your SATY indicator's JSON payload)

---

### For Trend Changes:
**Webhook URL:**
```
https://optionstrat.vercel.app/api/webhooks/trend
```

**Message Body:** (Your trend indicator's JSON payload)

---

## 🧪 Testing with curl

### Test Signals Webhook:
```bash
curl -X POST "https://optionstrat.vercel.app/api/phase25/webhooks/signals" \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "type": "LONG",
      "timeframe": "15",
      "quality": "HIGH",
      "ai_score": 8.5
    },
    "instrument": {
      "ticker": "SPY",
      "price": 580.25
    }
  }'
```

### Test Validation (No Auth):
```bash
curl -X POST "https://optionstrat.vercel.app/api/webhooks/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "type": "LONG",
      "timeframe": "15"
    }
  }'
```

### Check Health:
```bash
curl "https://optionstrat.vercel.app/api/phase25/webhooks/health"
```

### View Recent Webhooks:
```bash
curl "https://optionstrat.vercel.app/api/webhooks/recent?limit=5"
```

---

## 📊 Dashboard Access

**Main Dashboard:** https://optionstrat.vercel.app

**Tabs:**
- **Overview** - Signals and confluence
- **Phase 2.5** - Decision engine status
- **Trades** - Paper trading performance
- **Learning** - Metrics and insights
- **Webhooks** - Delivery monitoring

---

## 🚨 Common Issues

### 404 Not Found
- Verify the webhook URL is correct
- Check for typos in the endpoint path
- Ensure you're using POST method

### 400 Bad Request
- Validate your JSON payload format
- Check required fields are present
- Use `/api/webhooks/validate` to test

### 503 Service Unavailable
- Check system health: `/api/phase25/webhooks/health`
- Verify database connection
- Check Vercel deployment status

---

## 📚 Additional Resources

- **Webhook Security:** See `WEBHOOK_SECURITY.md`
- **Payload Formats:** See `WEBHOOK_FORMATS.md`
- **Testing Guide:** See `WEBHOOK_TESTER_GUIDE.md`
- **Status Report:** See `WEBHOOK_STATUS_REPORT.md`

---

## 🎯 Quick Reference

| Endpoint | Purpose | Auth Required | Method |
|----------|---------|---------------|--------|
| `/api/phase25/webhooks/signals` | Trading signals | ❌ | POST |
| `/api/phase25/webhooks/saty-phase` | SATY phase data | ❌ | POST |
| `/api/webhooks/trend` | Trend changes | ❌ | POST |
| `/api/webhooks/validate` | Test payloads | ❌ | POST |
| `/api/webhooks/debug` | Debug requests | ❌ | POST |
| `/api/phase25/webhooks/health` | Health check | ❌ | GET |
| `/api/phase25/webhooks/metrics` | Performance metrics | ❌ | GET |
| `/api/webhooks/recent` | Recent webhooks | ❌ | GET |

---

**Last Updated:** January 19, 2026  
**Production URL:** https://optionstrat.vercel.app  
**Status:** ✅ All systems operational
