# Trend Webhook Validation Fix

## Problem
Trend webhooks from TradingView were failing with "Invalid trend payload" errors (HTTP 400).

### Root Cause
The webhook handler expected a specific canonical format that didn't match TradingView's output:

**TradingView sends:**
```json
{
  "event": "trend_change",
  "trigger_timeframe": "5m",
  "ticker": "SPY",
  "exchange": "AMEX",
  "price": 686.44,
  "timeframes": {
    "3m": {"dir": "neutral", "chg": false},
    "5m": {"dir": "bearish", "chg": true},
    ...
  }
}
```

**System expected:**
```json
{
  "ticker": "SPY",
  "exchange": "AMEX",
  "timestamp": "2026-01-14T...",  // REQUIRED but not sent by TradingView
  "price": 686.44,
  "timeframes": {
    "tf3min": {"direction": "bullish", "open": 450, "close": 450},  // Different format!
    "tf5min": {"direction": "bullish", "open": 450, "close": 450},
    ...
  }
}
```

### Specific Mismatches
1. **Missing `timestamp`** - TradingView doesn't send it
2. **Timeframe key format** - TradingView: `"3m"`, System: `"tf3min"`
3. **Timeframe data structure** - TradingView: `{dir, chg}`, System: `{direction, open, close}`
4. **Extra fields** - TradingView sends `event` and `trigger_timeframe` not in schema

## Solution
Created a flexible adapter (`trendAdapter.ts`) that:

1. **Accepts TradingView format** with keys like `"3m"`, `"5m"`, `"1h"`, `"4h"`, `"1w"`, `"1M"`
2. **Converts to canonical format** with keys like `"tf3min"`, `"tf5min"`, `"tf60min"`, etc.
3. **Auto-generates timestamp** if not provided
4. **Normalizes direction strings** - accepts "bull", "bear", "long", "short", etc.
5. **Uses current price for open/close** when not provided (acceptable since we only use direction)
6. **Handles missing timeframes** - defaults to "neutral"

## Files Changed

### New Files
- `optionstrat/src/webhooks/trendAdapter.ts` - Flexible trend webhook adapter
- `optionstrat/src/webhooks/trendAdapter.test.ts` - Comprehensive test suite (9 tests, all passing)

### Modified Files
- `optionstrat/src/app/api/webhooks/trend/route.ts` - Updated to use adapter
- `optionstrat/WEBHOOK_FORMATS.md` - Updated documentation with TradingView format

## Testing

### Unit Tests
```bash
npm test -- trendAdapter.test.ts
```

**Results:** ✅ 9/9 tests passing

### Test Coverage
- ✅ TradingView format adaptation
- ✅ Multiple trigger timeframes
- ✅ Direction string normalization
- ✅ Price defaults for open/close
- ✅ Timestamp auto-generation
- ✅ Invalid payload rejection
- ✅ Missing timeframe handling
- ✅ Schema validation

### Manual Test
Tested with actual TradingView payload from error logs:
```bash
npx tsx test-trend-adapter.js
```

**Result:** ✅ Successfully adapted to canonical format

## Deployment Status
- ✅ Code changes complete
- ✅ Tests passing
- ✅ Documentation updated
- ⏳ Ready for deployment

## Expected Outcome
After deployment, TradingView trend webhooks will:
1. ✅ Accept without validation errors
2. ✅ Convert to canonical format automatically
3. ✅ Store in TrendStore with 1-hour TTL
4. ✅ Calculate alignment metrics correctly
5. ✅ Return success response with alignment data

## Backward Compatibility
The adapter maintains backward compatibility:
- ✅ Legacy wrapper format (`{"text": "..."}`) still works
- ✅ Canonical format still works
- ✅ TradingView format now works (NEW)

All three formats are supported simultaneously.

## Example Success Response
```json
{
  "success": true,
  "trend": {
    "ticker": "SPY",
    "exchange": "AMEX",
    "price": 686.44,
    "timestamp": "2026-01-14T16:57:40.188Z"
  },
  "alignment": {
    "score": 75.0,
    "strength": "STRONG",
    "dominant_trend": "bearish",
    "bullish_count": 1,
    "bearish_count": 6,
    "neutral_count": 1,
    "htf_bias": "bearish",
    "ltf_bias": "neutral"
  },
  "storage": {
    "ttl_minutes": 60,
    "expires_at": 1768413460188
  },
  "authentication": {
    "method": "no-auth-configured",
    "authenticated": true
  },
  "received_at": 1768409860188
}
```

## Next Steps
1. Deploy to production
2. Monitor webhook receipts for successful processing
3. Verify TradingView alerts are being accepted
4. Check alignment calculations are correct

---

**Status:** ✅ FIXED - Ready for deployment
**Date:** 2026-01-14
**Impact:** All trend webhooks from TradingView will now be accepted and processed correctly
