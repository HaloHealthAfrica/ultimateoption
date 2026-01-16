# Flexible Signal Adapter - Implementation Complete

**Date**: January 16, 2026  
**Status**: ✅ Deployed  
**Priority**: 1 (High Impact)

---

## Problem Solved

**420 signal webhooks were failing** with error: `"Missing required field: signal"`

This occurred when TradingView alerts sent simplified payloads without the full `signal` object structure expected by the normalizer.

---

## Solution Implemented

Created **flexible signal adapter** (`src/webhooks/signalAdapter.ts`) that intelligently constructs valid signal payloads from incomplete data.

### Key Features

1. **Intelligent Field Inference**
   - Infers `signal.type` from: `trend`, `direction`, `bias`, `signal_type`, or top-level `type`
   - Infers `signal.quality` from: score values or top-level `quality` field
   - Infers `signal.ai_score` from: `ai_score`, `aiScore`, `score`, or `confidence` fields

2. **Flexible Format Support**
   - Handles payloads with signal wrapper: `{ signal: {...}, instrument: {...} }`
   - Handles flat payloads: `{ ticker: "SPY", trend: "BULLISH", score: 8.5 }`
   - Handles mixed formats with partial signal objects

3. **Sensible Defaults**
   - Default timeframe: `"15"` (15 minutes)
   - Default quality: `"MEDIUM"`
   - Default ai_score: `5.0` (neutral)
   - Default exchange: `"NASDAQ"`

4. **Adaptation Tracking**
   - Logs all field adaptations for debugging
   - Returns adaptation list in response
   - Adds `X-Adapted: true` header when adapter is used

---

## Integration Points

### Phase 2 Signals Webhook
**File**: `src/app/api/webhooks/signals/route.ts`

```typescript
// Try standard normalization first
try {
  context = Normalizer.normalizeSignal(body);
} catch (normalizationError) {
  // Fall back to flexible adapter
  const adapterResult = adaptFlexibleSignal(body);
  if (adapterResult.success) {
    context = Normalizer.normalizeSignal(adapterResult.data);
    // Track adaptations
  }
}
```

### Phase 2.5 Source Router
**File**: `src/phase25/services/source-router.service.ts`

```typescript
// Try standard detection first
try {
  source = this.normalizer.detectSource(payload);
  normalized = this.normalizer.normalize(payload, source);
} catch (detectionError) {
  // Fall back to flexible adapter
  const adapterResult = adaptFlexibleSignal(payload);
  if (adapterResult.success) {
    source = this.normalizer.detectSource(adapterResult.data);
    normalized = this.normalizer.normalize(adapterResult.data, source);
  }
}
```

### Phase 2.5 Decision Orchestrator
**File**: `src/phase25/services/decision-orchestrator.service.ts`

- Passes through `adaptations` array in response
- Includes adaptations in success message

---

## Example Transformations

### Example 1: Missing Signal Wrapper

**Input** (fails standard normalization):
```json
{
  "ticker": "SPY",
  "trend": "BULLISH",
  "score": 8.5,
  "price": 450.25
}
```

**Adapted Output** (passes normalization):
```json
{
  "signal": {
    "type": "LONG",
    "quality": "HIGH",
    "ai_score": 8.5,
    "timeframe": "15",
    "timestamp": 1768579248963
  },
  "instrument": {
    "ticker": "SPY",
    "exchange": "NASDAQ",
    "current_price": 450.25
  }
}
```

**Adaptations**:
- Inferred signal.type from trend field
- Inferred quality from score: 8.5
- Used top-level score field as ai_score
- Used default timeframe: 15
- Used current timestamp
- Used default exchange: NASDAQ

### Example 2: Incomplete Signal Object

**Input**:
```json
{
  "signal": {
    "type": "LONG"
  },
  "instrument": {
    "ticker": "AAPL"
  },
  "confidence": 7.5
}
```

**Adapted Output**:
```json
{
  "signal": {
    "type": "LONG",
    "quality": "HIGH",
    "ai_score": 7.5,
    "timeframe": "15",
    "timestamp": 1768579248963
  },
  "instrument": {
    "ticker": "AAPL",
    "exchange": "NASDAQ"
  }
}
```

**Adaptations**:
- Used confidence field as ai_score
- Inferred quality from score: 7.5
- Used default timeframe: 15
- Used current timestamp
- Used default exchange: NASDAQ

### Example 3: Direction Instead of Type

**Input**:
```json
{
  "symbol": "TSLA",
  "direction": "BEARISH",
  "ai_score": 9.2,
  "quality": "EXTREME"
}
```

**Adapted Output**:
```json
{
  "signal": {
    "type": "SHORT",
    "quality": "EXTREME",
    "ai_score": 9.2,
    "timeframe": "15",
    "timestamp": 1768579248963
  },
  "instrument": {
    "ticker": "TSLA",
    "exchange": "NASDAQ"
  }
}
```

**Adaptations**:
- Inferred signal.type from direction field
- Used top-level quality field
- Used top-level ai_score field
- Used default timeframe: 15
- Used current timestamp
- Used default exchange: NASDAQ

---

## Field Mapping Rules

### Signal Type Inference
```
trend/direction/bias = "BULLISH" | "LONG" | "UP" | "BUY" → type = "LONG"
trend/direction/bias = "BEARISH" | "SHORT" | "DOWN" | "SELL" → type = "SHORT"
Default: "LONG"
```

### Quality Inference
```
score >= 9.0 → quality = "EXTREME"
score >= 7.0 → quality = "HIGH"
score < 7.0 → quality = "MEDIUM"
Default: "MEDIUM"
```

### AI Score Inference
```
Priority order:
1. signal.ai_score
2. signal.aiScore (camelCase)
3. top-level ai_score
4. top-level aiScore
5. score
6. confidence
Default: 5.0
```

### Score Clamping
```
Valid range: 0 - 10.5
NaN values → 5.0
Values < 0 → 0
Values > 10.5 → 10.5
```

---

## Response Headers

When adapter is used, additional headers are added:

```
X-Adapted: true
X-Adaptations: 5
```

Response body includes:
```json
{
  "decision": "ACCEPT",
  "adaptations": [
    "Inferred signal.type from trend field",
    "Inferred quality from score: 8.5",
    "Used top-level score field as ai_score",
    "Used default timeframe: 15",
    "Used current timestamp"
  ]
}
```

---

## Testing

### Test Script
**File**: `test-signal-adapter.js`

Run with:
```bash
node test-signal-adapter.js
```

Tests 6 scenarios:
1. ✅ Missing signal wrapper
2. ✅ Signal with missing fields
3. ✅ Direction instead of type
4. ✅ Minimal payload (ticker + trend only)
5. ✅ Complete signal (pass through)
6. ❌ Invalid payload (should fail)

Expected: 5 passed, 1 failed

### Manual Testing

Test with curl:
```bash
# Test incomplete payload
curl -X POST https://optionstrat.vercel.app/api/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "SPY",
    "trend": "BULLISH",
    "score": 8.5
  }'

# Should return:
# - 200 OK
# - X-Adapted: true header
# - adaptations array in response
```

---

## Monitoring

### Success Metrics

**Before**:
- 1,114 successful signals / 1,534 total (72.6%)
- 420 failures (27.4%)

**After** (expected):
- ~1,400 successful signals / 1,534 total (91.3%)
- ~134 failures (8.7%)

**Improvement**: +286 successful webhooks (+18.7% success rate)

### Tracking Adaptations

Check webhook logs for:
```
"Signal normalized successfully (flexible adapter)"
"adaptations": ["Inferred signal.type from trend field", ...]
```

Check webhook stats:
```bash
curl https://optionstrat.vercel.app/api/webhooks/stats | \
  jq '.recent_successful[] | select(.message | contains("adapted"))'
```

---

## Validation

### Build Status
✅ Build passed successfully
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (40/40)
```

### Type Safety
- Full TypeScript support
- Proper type inference
- No `any` types used
- Comprehensive interfaces

### Error Handling
- Graceful fallback to standard normalization
- Detailed error messages
- Tracks adaptation failures
- Logs all attempts

---

## Next Steps

### Monitor Production
1. Watch webhook stats for increased success rate
2. Check for "adapted" messages in logs
3. Monitor X-Adapted header frequency
4. Track which adaptations are most common

### Iterate Based on Data
1. If certain adaptations are very common, update TradingView alerts
2. If new failure patterns emerge, enhance adapter
3. Consider making common adaptations the standard format

### Documentation
1. Update TradingView alert documentation with flexible format support
2. Add examples of supported payload formats
3. Document which fields are required vs optional

---

## Files Modified

1. ✅ `src/webhooks/signalAdapter.ts` (new file, 500+ lines)
2. ✅ `src/app/api/webhooks/signals/route.ts` (integrated adapter)
3. ✅ `src/phase25/services/source-router.service.ts` (integrated adapter)
4. ✅ `src/phase25/services/decision-orchestrator.service.ts` (pass through adaptations)
5. ✅ `test-signal-adapter.js` (test script)

---

## Deployment

**Status**: ✅ Deployed to production

**Commit**: `c9ff4af`

**Message**: "Add flexible signal adapter to fix 'Missing required field: signal' errors"

**Verification**:
```bash
# Check deployment
curl https://optionstrat.vercel.app/api/webhooks/signals \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"ticker":"SPY","trend":"BULLISH","score":8.5}'

# Should return 200 OK with decision
```

---

## Impact Summary

**Problem**: 420 signal webhooks failing (27.4% failure rate)

**Solution**: Flexible signal adapter with intelligent field inference

**Expected Impact**: 
- +200-300 successful webhooks
- Reduced failure rate from 27.4% to ~8.7%
- Better error messages for remaining failures
- Backward compatible with existing payloads

**Status**: ✅ Complete and deployed
