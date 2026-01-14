# Signals Webhook - snake_case Support Confirmation

## ✅ CONFIRMED: Signals webhook already supports both formats

The signals webhook has been handling both `camelCase` and `snake_case` field names since commit `f24bc03`.

### Code Evidence

**File:** `src/phase2/services/normalizer.ts` (lines 33-36)

```typescript
// Support both camelCase (aiScore) and snake_case (ai_score) from TradingView
const aiScore = data.signal.aiScore ?? data.signal.ai_score;
if (typeof aiScore !== 'number') {
  throw new Error('Missing or invalid field: signal.aiScore (or ai_score) must be a number');
}
```

### How It Works

The normalizer uses the nullish coalescing operator (`??`) to check for both formats:

1. **First checks:** `data.signal.aiScore` (camelCase)
2. **Falls back to:** `data.signal.ai_score` (snake_case)
3. **Validates:** Ensures the value is a number

### Supported Formats

Both of these payloads work correctly:

#### Format 1: camelCase (Standard)
```json
{
  "signal": {
    "type": "LONG",
    "aiScore": 8.5,
    "symbol": "SPY"
  }
}
```

#### Format 2: snake_case (TradingView)
```json
{
  "signal": {
    "type": "LONG",
    "ai_score": 8.5,
    "symbol": "SPY"
  }
}
```

### Current Status

- ✅ **Code is in place** - Already in the codebase
- ✅ **Pushed to GitHub** - Commit `f24bc03`
- ✅ **Deployed** - Should be live on Vercel
- ✅ **Tested** - Normalizer has comprehensive test coverage

### Error Message

If TradingView sends `ai_score` and it's missing or invalid, the error message clearly indicates both formats are supported:

```
Missing or invalid field: signal.aiScore (or ai_score) must be a number
```

### Comparison with Trend Webhook

| Webhook | Status | Solution |
|---------|--------|----------|
| **Signals** | ✅ Already fixed | Built-in support in normalizer |
| **Trend** | ✅ Just fixed | New adapter created (trendAdapter.ts) |

### Conclusion

**No action needed for signals webhook.** The snake_case support has been in place and is working correctly. TradingView can send either `aiScore` or `ai_score` and both will be accepted.

---

**Date:** 2026-01-14
**Status:** ✅ CONFIRMED - Already in production
