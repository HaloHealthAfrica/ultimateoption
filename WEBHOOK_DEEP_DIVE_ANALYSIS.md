# Webhook Deep Dive Analysis - Answering Key Questions

**Date**: January 16, 2026  
**Purpose**: Answer specific questions about webhook failures and routing

---

## Question 1: What data is missing or required? Are we getting data from Alpaca, Tradier, TwelveData?

### Context Completeness Requirements

Phase 2.5 requires **synchronized data from multiple webhook sources** before making a decision:

#### Required Sources (Must Have)
1. **SATY_PHASE** - Provides regime and phase context
   - Current status: 832 successful / 2,443 total (34.1% success rate)
   - **This is the primary bottleneck**

2. **At least ONE expert source**:
   - **ULTIMATE_OPTIONS** - Expert signal with AI score
   - **TRADINGVIEW_SIGNAL** - Expert signal with timeframe
   - Current status: 1,114 successful signals (72.6% success rate)

#### Optional Sources (Improve Quality)
3. **MTF_DOTS** - Multi-timeframe alignment
4. **STRAT_EXEC** - Structure/setup validation  
5. **TREND** - Trend context
   - Current status: 242 successful / 266 total (91.0% success rate)

### Market Data Providers (Alpaca, Tradier, TwelveData)

**YES, we ARE fetching data from all three providers**, but this happens **AFTER** context is complete:

```typescript
// From market-context.service.ts
async buildContext(symbol: string): Promise<MarketContext> {
  // Execute all API calls in parallel
  const [optionsResult, statsResult, liquidityResult] = await Promise.allSettled([
    this.getTradierOptions(symbol),      // ✅ Tradier: Options data
    this.getTwelveDataStats(symbol),     // ✅ TwelveData: Technical indicators
    this.getAlpacaLiquidity(symbol)      // ✅ Alpaca: Liquidity data
  ]);
}
```

#### What Each Provider Gives Us:

**Tradier API** (Options Data):
- Put/Call Ratio
- IV Percentile
- Gamma Bias (POSITIVE/NEGATIVE/NEUTRAL)
- Option Volume
- Max Pain Level

**TwelveData API** (Technical Stats):
- ATR(14) - Average True Range
- RSI - Relative Strength Index
- RV20 - 20-day Realized Volatility
- Trend Slope
- Volume & Volume Ratio

**Alpaca API** (Liquidity):
- Bid-Ask Spread (in basis points)
- Depth Score (0-100)
- Trade Velocity (SLOW/NORMAL/FAST)
- Bid/Ask Sizes

### The Problem: Context Completeness Bottleneck

**Market data is NOT the issue.** The issue is:

1. **Webhooks arrive independently** (SATY_PHASE at 17:09:42, Signals at 17:09:44)
2. **Phase 2.5 waits for complete context** (both SATY_PHASE + expert source)
3. **Context expires after 5 minutes** if not refreshed
4. **Most webhooks update partial context** and return "waiting for complete context"

**Example from recent logs:**
```
17:09:42 - SATY_PHASE webhook → "Context updated, waiting for complete context"
17:09:44 - Signals webhook → "Decision made: SKIP (confidence: 83.5)"
```

Only when BOTH arrive within 5 minutes does a decision get made.

---

## Question 2: Why are Phase 2 and Phase 2.5 decisions not aligned?

### They Are Separate Systems Running in Parallel

**Phase 2** and **Phase 2.5** are **completely different endpoints** processing **different webhooks**:

#### Phase 2 Endpoints (Legacy)
- `/api/webhooks/signals` → Phase 2 Decision Engine
- `/api/webhooks/saty-phase` → Phase 2 Storage (no decisions)
- `/api/webhooks/trend` → Phase 2 Storage (no decisions)

**Behavior**: Makes immediate decisions, returns "Phase 2 decision: REJECT/ACCEPT"

#### Phase 2.5 Endpoints (New)
- `/api/phase25/webhooks/signals` → Phase 2.5 Orchestrator
- `/api/phase25/webhooks/saty-phase` → Phase 2.5 Orchestrator

**Behavior**: Waits for complete context, returns "Phase 2.5: Decision made" or "waiting for complete context"

### Why They're Not Aligned

**1. Different URLs = Different Systems**

TradingView alerts are configured to send to specific URLs:
- If alert sends to `/api/webhooks/signals` → Goes to Phase 2
- If alert sends to `/api/phase25/webhooks/signals` → Goes to Phase 2.5

**2. Different Decision Logic**

**Phase 2**:
```typescript
// Immediate decision on each webhook
const context = Normalizer.normalizeSignal(body);
const marketContext = await marketContextBuilder.buildMarketContext(symbol);
const decision = decisionEngine.makeDecision(context);
// Returns: REJECT or ACCEPT immediately
```

**Phase 2.5**:
```typescript
// Wait for complete context from multiple sources
contextStore.update(partial, source);
if (!contextStore.isComplete()) {
  return "waiting for complete context";
}
const decision = decisionEngine.makeDecision(completeContext);
// Returns: EXECUTE/WAIT/SKIP only when context is complete
```

**3. Different Storage**

- **Phase 2**: Decisions are NOT stored in the Phase 2.5 ledger
- **Phase 2.5**: Decisions ARE stored in the ledger (visible on dashboard)

### Current Routing Reality

Based on webhook stats showing "Phase 2 decision: REJECT" messages:

**Most webhooks are still going to Phase 2**, not Phase 2.5.

This explains why:
- 2,188 successful webhooks
- Only 2 decisions on Phase 2.5 dashboard
- Most are being processed by Phase 2 (which doesn't store in Phase 2.5 ledger)

### How to Align Them

**Option 1: Migrate all webhooks to Phase 2.5**
- Update TradingView alert URLs from `/api/webhooks/*` to `/api/phase25/webhooks/*`
- All decisions will then go through Phase 2.5 orchestrator
- Will see more "waiting for complete context" responses

**Option 2: Consolidate into single endpoint**
- Create unified `/api/webhooks/*` that routes to Phase 2.5
- Deprecate Phase 2 endpoints
- Gradual migration

**Option 3: Keep both, but clarify purpose**
- Phase 2: Quick decisions for testing/validation
- Phase 2.5: Production decisions with full context
- Separate dashboards for each

---

## Question 3: What "Missing required field: signal" or "Invalid trend payload" needs to be fixed?

### Failure Analysis by Type

#### 1. Signals Webhook Failures (420 failed / 1,534 total = 27.4%)

**Error**: "Missing required field: signal"

**Root Cause**: Phase 2 normalizer expects specific structure:

```typescript
// From Phase 2 normalizer
const context = Normalizer.normalizeSignal(body);
// Expects: { signal: { type, quality, ai_score, ... }, instrument: { ticker }, ... }
```

**What's happening**:
- TradingView sends payload without `signal` field
- Or `signal` field is malformed/incomplete
- Validation fails before processing

**Example failing payload** (reconstructed):
```json
{
  "ticker": "SPY",
  "price": 450.25,
  "trend": "BULLISH"
  // ❌ Missing "signal" field with required structure
}
```

**Expected payload**:
```json
{
  "signal": {
    "type": "LONG",
    "quality": "EXTREME",
    "ai_score": 9.5,
    "timeframe": "15",
    "timestamp": 1768579248963
  },
  "instrument": {
    "ticker": "SPY",
    "exchange": "NASDAQ",
    "current_price": 450.25
  },
  "trend": { ... },
  "risk": { ... }
}
```

**Fix Required**:
1. **Check TradingView alert message format**
   - Ensure it includes `signal` object with all required fields
   - Validate JSON structure before sending

2. **Add fallback normalization**
   - If `signal` is missing, try to construct it from other fields
   - Add adapter layer like SATY Phase has (`parseAndAdaptSignal`)

3. **Improve error messages**
   - Return which specific fields are missing
   - Provide example of correct format

#### 2. SATY Phase Failures (1,611 failed / 2,443 total = 66.0%)

**Error**: "Invalid phase payload"

**Root Cause**: Multiple format mismatches:

**Problem 1: Text wrapper format**
```json
{
  "text": "{\"meta\":{\"engine\":\"SATY_PO\"},...}"
}
```
Phase 2.5 tries to parse this, but Phase 2 SATY endpoint expects it.

**Problem 2: Wrong endpoint routing**
- Trend webhooks sent to SATY endpoint
- SATY webhooks sent to Trend endpoint
- Detection: Checks for "Trend Change:" header or "timeframes" field

**Problem 3: Missing required fields**
```typescript
// Expected structure
{
  meta: { engine: "SATY_PO", event_type: "..." },
  instrument: { symbol: "SPY" },
  timeframe: { chart_tf: "3", event_tf: "..." },
  regime_context: { local_bias: "BULLISH" }
}
```

**Fix Required**:

1. **Consolidate format handling**
   ```typescript
   // Try multiple formats in order:
   // 1. Text wrapper: { text: "<json>" }
   // 2. Direct SATY format
   // 3. Flexible adapter (like trend has)
   ```

2. **Add better endpoint detection**
   - Check payload structure before validation
   - Auto-redirect to correct endpoint with helpful message

3. **Improve TradingView alert configuration**
   - Provide clear examples for each webhook type
   - Add validation tool to test payloads before sending

#### 3. Trend Webhook Failures (24 failed / 266 total = 9.0%)

**Error**: "Invalid trend payload"

**Root Cause**: Lowest failure rate, but still some issues:

**Problem**: Timeframe format mismatch
```json
// TradingView sends:
{
  "timeframes": {
    "3m": { "trend": "BULLISH", ... },
    "5m": { "trend": "BULLISH", ... }
  }
}

// Expected:
{
  "timeframes": {
    "tf3min": { "trend": "BULLISH", ... },
    "tf5min": { "trend": "BULLISH", ... }
  }
}
```

**Fix**: Already has adapter (`parseAndAdaptTrend`), but may need refinement.

---

## Summary of Fixes Needed

### Immediate (Week 1)

**1. Fix SATY Phase Validation (66% failure rate)**
```typescript
// Add flexible adapter like trend has
export function parseAndAdaptSatyPhase(payload: unknown) {
  // Try text wrapper
  // Try direct format
  // Try flexible format with field mapping
  // Return helpful error if all fail
}
```

**2. Fix Signals "Missing required field: signal" (27% failure rate)**
```typescript
// Add fallback construction
if (!payload.signal && payload.ticker && payload.trend) {
  payload.signal = {
    type: payload.trend === "BULLISH" ? "LONG" : "SHORT",
    quality: "MEDIUM", // default
    ai_score: 5.0, // default
    timeframe: "15", // default
    timestamp: Date.now()
  };
}
```

**3. Add Endpoint Detection & Auto-Routing**
```typescript
// Detect payload type and suggest correct endpoint
function detectWebhookType(payload: unknown): {
  type: 'saty' | 'signals' | 'trend';
  confidence: number;
  correctEndpoint: string;
} {
  // Check for SATY indicators
  // Check for Signals indicators
  // Check for Trend indicators
  // Return best match with confidence
}
```

### Short-term (Week 2-3)

**4. Consolidate Phase 2 and Phase 2.5 Routing**
- Create unified webhook handler
- Route to appropriate engine based on configuration
- Migrate TradingView alerts to Phase 2.5 endpoints

**5. Add Webhook Validation Tool**
- Create `/api/webhooks/validate` endpoint
- Test payload format before sending from TradingView
- Return detailed validation errors

**6. Improve Error Messages**
- Return specific missing fields
- Provide example of correct format
- Include link to documentation

---

## Verification Commands

### Check current webhook routing
```bash
# See which endpoints are receiving webhooks
curl https://optionstrat.vercel.app/api/webhooks/stats | jq '.recent_successful[] | {kind, message}'
```

### Test webhook validation
```bash
# Test signals payload
curl -X POST https://optionstrat.vercel.app/api/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{"ticker": "SPY"}' # Missing signal field

# Test SATY phase payload
curl -X POST https://optionstrat.vercel.app/api/webhooks/saty-phase \
  -H "Content-Type: application/json" \
  -d '{"text": "{\"meta\":{\"engine\":\"SATY_PO\"}}"}' # Incomplete
```

### Check Phase 2 vs 2.5 routing
```bash
# Count Phase 2 decisions
curl https://optionstrat.vercel.app/api/webhooks/recent | \
  grep "Phase 2 decision" | wc -l

# Count Phase 2.5 decisions
curl https://optionstrat.vercel.app/api/decisions | jq '.data | length'
```

---

## Recommended Action Plan

### Priority 1: Fix SATY Phase Failures (Biggest Impact)
- 1,611 failed webhooks → potential +800 decisions
- Add flexible adapter
- Improve validation error messages
- Test with sample payloads

### Priority 2: Consolidate Phase 2/2.5 Routing
- Most webhooks going to Phase 2 (not visible on Phase 2.5 dashboard)
- Update TradingView alert URLs
- Migrate to Phase 2.5 endpoints
- Expected impact: +2,000 webhooks → +100-200 decisions

### Priority 3: Fix Signals Validation
- 420 failed webhooks → potential +200 decisions
- Add fallback signal construction
- Improve error messages
- Validate TradingView alert format

### Priority 4: Add Monitoring & Validation Tools
- Real-time webhook validation
- Endpoint detection and auto-routing
- Better error reporting
- Webhook replay for failed attempts
