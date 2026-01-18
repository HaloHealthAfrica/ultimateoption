# Webhook Decision Points: Ingestion to Dashboard

**Complete flow of a webhook from TradingView to Dashboard display**

---

## Overview

```
TradingView Alert → Webhook Endpoint → Validation → Routing → 
Context Store → Decision Engine → Ledger Storage → Dashboard Display
```

---

## Decision Point 1: WEBHOOK RECEIPT

**Location**: `/api/phase25/webhooks/signals/route.ts`

### Checks:
1. ✅ **HTTP Method** - Must be POST
2. ✅ **Content-Type** - Must be `application/json`
3. ✅ **JSON Validity** - Payload must be valid JSON
4. ✅ **Body Exists** - Request must have a body

### Outcomes:
- ✅ **PASS** → Continue to validation
- ❌ **FAIL** → Return HTTP 400, record in webhook_receipts

### Data Recorded:
```typescript
{
  kind: 'signals',
  ok: false,
  status: 400,
  message: 'Invalid JSON payload',
  raw_payload: rawBody,
  headers: {...}
}
```

---

## Decision Point 2: AUTHENTICATION (Optional)

**Location**: `src/webhooks/security.ts`

### Checks:
1. ✅ **Debug Token** - If `WEBHOOK_DEBUG_TOKEN` is set, validate it
2. ✅ **IP Whitelist** - Check if IP is allowed (if configured)

### Outcomes:
- ✅ **PASS** → Continue to routing
- ❌ **FAIL** → Return HTTP 401, record in webhook_receipts
- ⚠️ **SKIP** → If no auth configured, continue

---

## Decision Point 3: ENDPOINT DETECTION

**Location**: `src/webhooks/endpointDetector.ts`

### Checks:
1. ✅ **Payload Structure** - Analyze payload to detect webhook type
2. ✅ **Correct Endpoint** - Verify payload matches endpoint

### Detection Logic:
```typescript
// Signals webhook indicators
if (payload.signal && payload.instrument?.ticker) {
  detected = 'TRADINGVIEW_SIGNAL'
}

// SATY Phase indicators
if (payload.meta?.engine === 'SATY_PO') {
  detected = 'SATY_PHASE'
}

// Trend indicators
if (payload.timeframes && payload.ticker) {
  detected = 'TREND'
}
```

### Outcomes:
- ✅ **CORRECT** → Continue to normalization
- ❌ **WRONG ENDPOINT** → Return HTTP 400 with suggestion
- ❌ **UNKNOWN FORMAT** → Return HTTP 400

---

## Decision Point 4: SOURCE ROUTING

**Location**: `src/phase25/services/source-router.service.ts`

### Checks:
1. ✅ **Source Detection** - Identify webhook source type
2. ✅ **Route to Normalizer** - Send to appropriate normalizer

### Source Types:
- `TRADINGVIEW_SIGNAL` - Trading signals
- `SATY_PHASE` - SATY phase data
- `MTF_DOTS` - Multi-timeframe trend
- `ULTIMATE_OPTIONS` - Ultimate options signals
- `STRAT_EXEC` - Strategy execution

### Outcomes:
- ✅ **DETECTED** → Route to normalizer
- ❌ **UNKNOWN** → Return error

---

## Decision Point 5: PAYLOAD NORMALIZATION

**Location**: `src/phase25/services/normalizer.service.ts`

### Checks:
1. ✅ **Required Fields** - Validate required fields exist
2. ✅ **Data Types** - Validate field types
3. ✅ **Transform to Standard Format** - Convert to DecisionContext

### For TRADINGVIEW_SIGNAL:
```typescript
{
  instrument: { symbol, exchange, price },
  expert: { direction, aiScore, quality, rr1, rr2 }
}
```

### For SATY_PHASE:
```typescript
{
  instrument: { symbol, exchange },
  regime: { phase, phaseName, bias, confidence, volatility }
}
```

### Outcomes:
- ✅ **VALID** → Create partial context
- ❌ **INVALID** → Return HTTP 400 with validation errors

---

## Decision Point 6: CONTEXT STORE UPDATE

**Location**: `src/phase25/services/context-store.service.ts`

### Checks:
1. ✅ **Update Context** - Merge partial context
2. ✅ **Check Completeness** - Is context complete?

### Completeness Rules:
```typescript
// Required sources (from config)
requiredSources: ['TRADINGVIEW_SIGNAL']

// Must have expert data
hasRequiredExpert: !!context.expert

// Optional sources
optionalSources: ['SATY_PHASE', 'MTF_DOTS', ...]
```

### Outcomes:
- ✅ **COMPLETE** → Continue to decision engine
- ⚠️ **INCOMPLETE** → Return "waiting for complete context"

**This is where many webhooks stop!**

---

## Decision Point 7: CONTEXT BUILDING

**Location**: `src/phase25/services/context-store.service.ts`

### Checks:
1. ✅ **Build Complete Context** - Assemble all context pieces
2. ✅ **Validate Context** - Ensure all required fields present

### Context Structure:
```typescript
{
  instrument: { symbol, exchange, price },
  expert: { direction, aiScore, quality },
  regime?: { phase, bias, confidence },
  alignment?: { bullishPct, bearishPct },
  structure?: { support, resistance }
}
```

### Outcomes:
- ✅ **BUILT** → Continue to market context
- ❌ **FAILED** → Return error

---

## Decision Point 8: MARKET CONTEXT FETCH

**Location**: `src/phase25/services/market-context.service.ts`

### Checks:
1. ✅ **Fetch Market Data** - Get current market conditions
2. ✅ **Calculate Stats** - ATR, volatility, etc.

### Data Fetched:
```typescript
{
  price: currentPrice,
  stats: { atr14, volatility },
  session: 'REGULAR' | 'PRE' | 'POST',
  completeness: 0-100
}
```

### Outcomes:
- ✅ **SUCCESS** → Continue to decision engine
- ⚠️ **PARTIAL** → Use fallback values, continue
- ❌ **FAILED** → Use defaults, continue

---

## Decision Point 9: REGIME GATE

**Location**: `src/phase25/services/decision-engine.service.ts`

### Checks:
1. ✅ **Regime Data Exists** - Check if regime context available
2. ✅ **Phase Allows Direction** - Check if phase allows LONG/SHORT
3. ✅ **Confidence Threshold** - Regime confidence >= 60%
4. ✅ **Bias Alignment** - Regime bias matches direction

### Outcomes:
- ✅ **PASSED** → Continue to next gate
- ❌ **FAILED** → May still continue (gate failure doesn't always block)
- ⚠️ **NO REGIME** → Pass with warning (signal-only mode)

---

## Decision Point 10: STRUCTURAL GATE

**Location**: `src/phase25/services/decision-engine.service.ts`

### Checks:
1. ✅ **Structure Data Exists** - Check if structure context available
2. ✅ **Support/Resistance** - Check price levels
3. ✅ **Key Levels** - Validate against key levels

### Outcomes:
- ✅ **PASSED** → Continue
- ❌ **FAILED** → Continue (informational)
- ⚠️ **NO STRUCTURE** → Pass with warning

---

## Decision Point 11: MARKET GATES

**Location**: `src/phase25/services/decision-engine.service.ts`

### Checks:
1. ✅ **Spread Check** - Bid-ask spread < threshold
2. ✅ **Volatility Check** - ATR spike < threshold
3. ✅ **Session Check** - Not in restricted session
4. ✅ **Depth Check** - Market depth sufficient

### Outcomes:
- ✅ **ALL PASSED** → High market score
- ⚠️ **SOME FAILED** → Lower market score
- ❌ **CRITICAL FAILED** → May block decision

---

## Decision Point 12: CONFIDENCE CALCULATION

**Location**: `src/phase25/services/decision-engine.service.ts`

### Inputs:
1. **Regime Confidence** (30% weight) - If available
2. **Expert AI Score** (25% weight) - Always present
3. **Alignment Score** (20% weight) - If available
4. **Market Conditions** (15% weight) - Always present
5. **Risk/Reward** (10% weight) - Always present

### Calculation:
```typescript
confidence = (
  regime.confidence * 0.30 +
  expert.aiScore * 0.25 +
  alignment.score * 0.20 +
  market.score * 0.15 +
  riskReward.score * 0.10
) / totalWeight
```

### Outcomes:
- **>= 75%** → EXECUTE
- **60-74%** → WAIT
- **< 60%** → SKIP

---

## Decision Point 13: FINAL DECISION

**Location**: `src/phase25/services/decision-engine.service.ts`

### Decision Logic:
```typescript
if (confidence >= 75) {
  action = 'EXECUTE'
  direction = expert.direction
  sizeMultiplier = calculateSizing(context, confidence)
} else if (confidence >= 60) {
  action = 'WAIT'
} else {
  action = 'SKIP'
}
```

### Decision Packet Created:
```typescript
{
  action: 'EXECUTE' | 'WAIT' | 'SKIP',
  direction: 'LONG' | 'SHORT',
  confidenceScore: 75.5,
  finalSizeMultiplier: 1.2,
  reasons: ['High confidence execution (75.5)'],
  gateResults: { regime, structural, market },
  inputContext: {...},
  marketSnapshot: {...}
}
```

---

## Decision Point 14: LEDGER CONVERSION

**Location**: `src/phase25/utils/ledger-adapter.ts`

### Checks:
1. ✅ **Convert to Ledger Format** - Transform decision packet
2. ✅ **Validate Pricing** - Ensure all prices > 0
3. ✅ **Calculate Targets** - Stop loss, target 1, target 2

### Pricing Validation:
```typescript
// All must be positive
current_price > 0
stop_loss > 0
target_1 > 0
target_2 > 0
```

### Outcomes:
- ✅ **VALID** → Continue to storage
- ❌ **INVALID** → Use fallback prices ($100 default)

---

## Decision Point 15: LEDGER STORAGE

**Location**: `src/ledger/globalLedger.ts`

### Checks:
1. ✅ **Schema Validation** - Validate against Zod schema
2. ✅ **Database Connection** - Ensure DB is available
3. ✅ **Insert Record** - Write to ledger_entries table

### Schema Validation:
```typescript
InstrumentSchema.parse(signal.instrument)
EntrySchema.parse(signal.entry)
RegimeSchema.parse(regime)
```

### Outcomes:
- ✅ **STORED** → ledgerStored: true
- ❌ **FAILED** → ledgerStored: false, ledgerError: "..."

**This is where decisions may fail to appear on dashboard!**

---

## Decision Point 16: WEBHOOK RECEIPT RECORDING

**Location**: `src/webhooks/auditDb.ts`

### Checks:
1. ✅ **Record Receipt** - Write to webhook_receipts table
2. ✅ **Include Metadata** - Store payload, headers, result

### Data Stored:
```typescript
{
  kind: 'signals',
  ok: true,
  status: 200,
  ticker: 'SPY',
  message: 'Decision made: EXECUTE (confidence: 75.5)',
  raw_payload: '...',
  headers: {...}
}
```

---

## Decision Point 17: DASHBOARD QUERY

**Location**: `/api/decisions`

### Checks:
1. ✅ **Query Database** - SELECT from ledger_entries
2. ✅ **Apply Filters** - Limit, offset, filters
3. ✅ **Return Results** - Format for dashboard

### Query:
```sql
SELECT * FROM ledger_entries
WHERE engine_version = '2.5.0'
ORDER BY created_at DESC
LIMIT 10
```

### Outcomes:
- ✅ **FOUND** → Return decisions
- ⚠️ **EMPTY** → Return empty array

---

## Decision Point 18: DASHBOARD DISPLAY

**Location**: `src/components/dashboard/Phase25DecisionCard.tsx`

### Checks:
1. ✅ **Parse Decision** - Extract fields from API response
2. ✅ **Format Display** - Show action, symbol, confidence
3. ✅ **Render Gates** - Display gate results

### Display Logic:
```typescript
if (decision.action === 'EXECUTE') {
  color = 'green'
} else if (decision.action === 'WAIT') {
  color = 'yellow'
} else {
  color = 'red'
}
```

---

## Common Failure Points

### 1. Context Never Complete (Decision Point 6)
**Symptom**: "waiting for complete context"  
**Cause**: requiredSources mismatch  
**Fix**: Ensure config matches context store

### 2. Ledger Validation Fails (Decision Point 14)
**Symptom**: ledgerStored: false, "expected > 0"  
**Cause**: Price = 0 or negative  
**Fix**: Use fallback prices

### 3. Database Not Available (Decision Point 15)
**Symptom**: ledgerStored: false, "connection refused"  
**Cause**: DATABASE_URL not set  
**Fix**: Set DATABASE_URL in environment

### 4. No Decisions on Dashboard (Decision Point 17)
**Symptom**: Empty dashboard  
**Cause**: No records in ledger_entries table  
**Fix**: Check ledger storage is working

---

## Success Path Summary

```
✅ Webhook received (HTTP 200)
✅ JSON valid
✅ Endpoint correct
✅ Source detected: TRADINGVIEW_SIGNAL
✅ Payload normalized
✅ Context updated
✅ Context complete (has expert data)
✅ Context built successfully
✅ Market context fetched
✅ Regime gate: PASSED (or skipped)
✅ Structural gate: PASSED (or skipped)
✅ Market gates: PASSED
✅ Confidence calculated: 75.5%
✅ Decision: EXECUTE
✅ Ledger format valid
✅ Ledger stored: true
✅ Webhook receipt recorded
✅ Dashboard query returns decision
✅ Dashboard displays decision
```

---

## Monitoring Each Decision Point

### Check Webhook Receipt:
```bash
curl http://localhost:3000/api/webhooks/recent?limit=1
```

### Check Context Status:
```bash
curl http://localhost:3000/api/phase25/context/status
```

### Check Decisions:
```bash
curl http://localhost:3000/api/decisions?limit=1
```

### Check Ledger Storage:
```bash
# Look for ledgerStored: true in webhook response
```

---

## Total Decision Points: 18

**Critical Points** (failure blocks progress):
1. Webhook Receipt
2. JSON Validation
3. Context Completeness
4. Ledger Storage

**Informational Points** (failure doesn't block):
5. Authentication
6. Endpoint Detection
7. Gate Checks
8. Market Context

---

**Status**: This document maps all 18 decision points from webhook ingestion to dashboard display.
