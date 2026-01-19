# Complete Decision Flow: Before Phase 2.5
**Date**: January 18, 2026  
**Purpose**: Document all decision logic that happens BEFORE Phase 2.5

---

## Overview

Your system has **TWO parallel decision engines**:
1. **Phase 2** - Original decision engine (gates-based, deterministic)
2. **Phase 2.5** - New decision engine (context-based, multi-source)

Both engines receive the SAME webhooks via **dual-write** pattern.

---

## Entry Point: Webhook Arrives

### Webhook URL
```
POST /api/webhooks/signals
```

### File Location
```
optionstrat/src/app/api/webhooks/signals/route.ts
```

### What Happens
1. Validates JSON payload
2. Validates Content-Type header
3. Creates request ID for tracking
4. Processes through **BOTH** Phase 2 and Phase 2.5

---

## Phase 2 Decision Flow (Original Engine)

### Step 1: Normalize Signal
**File**: `src/phase2/services/normalizer.ts`  
**Method**: `Normalizer.normalizeSignal(payload)`

**Input Example**:
```json
{
  "signal": {
    "type": "LONG",
    "ai_score": 9.2,
    "quality": "EXTREME",
    "timeframe": "15"
  },
  "instrument": {
    "ticker": "SPY",
    "exchange": "NASDAQ",
    "current_price": 450.25
  },
  "satyPhase": {
    "phase": 85
  }
}
```

**Output (DecisionContext)**:
```typescript
{
  indicator: {
    signalType: "LONG",      // Normalized from signal.type
    aiScore: 9.2,            // From signal.ai_score
    satyPhase: 85,           // From satyPhase.phase
    marketSession: "OPEN",   // Default if not provided
    symbol: "SPY",           // From instrument.ticker
    timestamp: 1768710414011
  }
}
```

**Validation Rules**:
- `signal.type` required → must be "LONG" or "SHORT"
- `signal.ai_score` required → must be number 0-10.5
- `symbol` required → from `signal.symbol` OR `instrument.ticker`
- `satyPhase` optional → defaults to 0 if missing
- `marketSession` optional → defaults to "OPEN"

---

### Step 2: Build Market Context
**File**: `src/phase2/services/market-context-builder.ts`  
**Method**: `buildMarketContext(symbol)`

**Fetches Data From**:
- **Tradier**: Options data (put/call ratio, IV percentile)
- **TwelveData**: Technical indicators (ATR, RSI, volume)
- **Alpaca**: Liquidity data (bid/ask spread, depth)

**Output (MarketContext)**:
```typescript
{
  optionsData: {
    putCallRatio: 1.2,
    ivPercentile: 65,
    gammaBias: "POSITIVE"
  },
  liquidityData: {
    spreadBps: 4.5,
    depthScore: 85,
    tradeVelocity: "FAST"
  },
  technicalData: {
    atr14: 8.2,
    rv20: 15.3,
    trendSlope: 0.45
  }
}
```

---

### Step 3: Create Complete Context
**File**: `src/app/api/webhooks/signals/route.ts` (Line 245)

```typescript
const completeContext = {
  ...context,        // From normalizer
  market: marketContext  // From market builder
};
```

**Complete Context Structure**:
```typescript
{
  indicator: {
    signalType: "LONG",
    aiScore: 9.2,
    satyPhase: 85,
    marketSession: "OPEN",
    symbol: "SPY",
    timestamp: 1768710414011
  },
  market: {
    optionsData: { ... },
    liquidityData: { ... },
    technicalData: { ... }
  }
}
```

---

### Step 4: Make Decision (Phase 2 Engine)
**File**: `src/phase2/engine/decision-engine.ts`  
**Method**: `makeDecision(completeContext)`

**Decision Logic**: Evaluates 5 risk gates sequentially

#### Gate 1: Spread Gate
**File**: `src/phase2/gates/spread-gate.ts`

```typescript
evaluate(context) {
  const spreadBps = context.market?.liquidityData.spreadBps ?? 999;
  const passed = spreadBps <= 8.0;  // Threshold: 8 bps
  
  return {
    gate: "spread",
    passed,
    value: spreadBps,
    threshold: 8.0,
    reason: passed ? undefined : `Spread too wide: ${spreadBps} bps > 8.0 bps`
  };
}
```

**Pass Criteria**: Bid-ask spread ≤ 8 basis points

---

#### Gate 2: Volatility Gate
**File**: `src/phase2/gates/volatility-gate.ts`

```typescript
evaluate(context) {
  const atr14 = context.market?.technicalData.atr14 ?? 0;
  const passed = atr14 >= 5.0 && atr14 <= 15.0;
  
  return {
    gate: "volatility",
    passed,
    value: atr14,
    threshold: { min: 5.0, max: 15.0 },
    reason: passed ? undefined : `ATR out of range: ${atr14}`
  };
}
```

**Pass Criteria**: ATR(14) between 5.0 and 15.0

---

#### Gate 3: Gamma Gate
**File**: `src/phase2/gates/gamma-gate.ts`

```typescript
evaluate(context) {
  const gammaBias = context.market?.optionsData.gammaBias ?? "NEUTRAL";
  const signalType = context.indicator.signalType;
  
  // LONG signals need POSITIVE or NEUTRAL gamma
  // SHORT signals need NEGATIVE or NEUTRAL gamma
  const passed = 
    (signalType === "LONG" && (gammaBias === "POSITIVE" || gammaBias === "NEUTRAL")) ||
    (signalType === "SHORT" && (gammaBias === "NEGATIVE" || gammaBias === "NEUTRAL"));
  
  return {
    gate: "gamma",
    passed,
    value: gammaBias,
    reason: passed ? undefined : `Gamma bias ${gammaBias} conflicts with ${signalType} signal`
  };
}
```

**Pass Criteria**: Gamma bias aligns with signal direction

---

#### Gate 4: Phase Gate
**File**: `src/phase2/gates/phase-gate.ts`

```typescript
evaluate(context) {
  const satyPhase = context.indicator.satyPhase;
  const signalType = context.indicator.signalType;
  
  // LONG signals need phase >= 50
  // SHORT signals need phase <= -50
  const passed = 
    (signalType === "LONG" && satyPhase >= 50) ||
    (signalType === "SHORT" && satyPhase <= -50);
  
  return {
    gate: "phase",
    passed,
    value: satyPhase,
    threshold: signalType === "LONG" ? 50 : -50,
    reason: passed ? undefined : `Phase ${satyPhase} too weak for ${signalType}`
  };
}
```

**Pass Criteria**: SATY phase strength matches signal direction

---

#### Gate 5: Session Gate
**File**: `src/phase2/gates/session-gate.ts`

```typescript
evaluate(context) {
  const session = context.indicator.marketSession;
  const passed = session === "OPEN";  // Only trade during market hours
  
  return {
    gate: "session",
    passed,
    value: session,
    reason: passed ? undefined : `Market session ${session} not allowed`
  };
}
```

**Pass Criteria**: Market session is "OPEN"

---

### Step 5: Calculate Confidence (If Approved)
**File**: `src/phase2/engine/decision-engine.ts` (Line 95)

```typescript
private calculateConfidence(context: DecisionContext): number {
  let confidence = context.indicator.aiScore;  // Start with AI score
  
  // Boost 1: Strong SATY phase (|phase| >= 80)
  if (Math.abs(context.indicator.satyPhase) >= 80) {
    confidence += 0.5;
  }
  
  // Boost 2: Tight spread (≤ 5 bps)
  const spreadBps = context.market?.liquidityData.spreadBps ?? 999;
  if (spreadBps <= 5) {
    confidence += 0.3;
  }
  
  // Cap at 10.0 maximum
  confidence = Math.min(10.0, confidence);
  
  return confidence;
}
```

**Example Calculation**:
```
Base: aiScore = 9.2
Boost 1: |satyPhase| = 85 >= 80 → +0.5
Boost 2: spreadBps = 4.5 <= 5 → +0.3
Total: 9.2 + 0.5 + 0.3 = 10.0 (capped)
```

---

### Step 6: Generate Decision Output
**File**: `src/phase2/engine/decision-engine.ts` (Line 70)

**Decision Logic**:
```typescript
const decision = failed.length === 0 ? 'APPROVE' : 'REJECT';
```

**Output Structure**:
```typescript
{
  decision: "APPROVE",           // or "REJECT"
  direction: "LONG",             // Only if APPROVE
  symbol: "SPY",
  confidence: 10.0,              // Only if APPROVE
  engine_version: "2.0.0",
  timestamp: "2026-01-18T10:30:14.011Z",
  gates: {
    passed: ["spread", "volatility", "gamma", "phase", "session"],
    failed: []
  },
  reasons: undefined,            // Only if REJECT
  audit: {
    timestamp: "2026-01-18T10:30:14.011Z",
    symbol: "SPY",
    session: "OPEN",
    context_snapshot: { ... },   // Full context
    gate_results: [ ... ],       // All gate results
    processing_time_ms: 12.45
  }
}
```

---

### Step 7: Log Decision
**File**: `src/phase2/services/logger.ts`  
**Method**: `logDecisionEvent(context, output, processingTime)`

Logs to console:
```
[Phase 2] Decision: APPROVE for SPY (LONG) - Confidence: 10.0
```

---

## Phase 2.5 Decision Flow (Dual-Write)

### Step 8: Dual-Write to Phase 2.5
**File**: `src/app/api/webhooks/signals/route.ts` (Line 255)

```typescript
// DUAL-WRITE: Also send to Phase 2.5 orchestrator
try {
  const factory = ServiceFactory.getInstance();
  const orchestrator = factory.getOrchestrator() || factory.createOrchestrator(false);
  
  // Send original body (not normalized) to Phase 2.5
  const phase25Result = await orchestrator.processWebhook(body);
  
  logger.info('Phase 2.5 dual-write completed', {
    success: phase25Result.success,
    message: phase25Result.message,
    hasDecision: !!phase25Result.decision
  });
} catch (phase25Error) {
  // Don't fail Phase 2 if Phase 2.5 fails
  logger.logError('Phase 2.5 dual-write failed (non-critical)', phase25Error);
}
```

**Key Points**:
- Phase 2.5 receives the **original payload** (not Phase 2's normalized version)
- Phase 2.5 runs **independently** - if it fails, Phase 2 still succeeds
- Phase 2.5 has its own normalization, context building, and decision logic

---

## Phase 2.5 Decision Flow (Separate Engine)

### Step 1: Route Webhook
**File**: `src/phase25/services/source-router.service.ts`  
**Method**: `routeWebhook(payload)`

Detects webhook type:
- `TRADINGVIEW_SIGNAL` - Signal webhooks
- `SATY_PHASE` - SATY phase webhooks
- `MTF_DOTS` - Multi-timeframe webhooks
- `ULTIMATE_OPTIONS` - Ultimate Options webhooks

---

### Step 2: Normalize to Phase 2.5 Format
**File**: `src/phase25/services/normalizer.service.ts`  
**Method**: `normalize(payload, source)`

**Different from Phase 2**:
- Creates **partial context** (not complete)
- Supports multiple webhook sources
- Builds context incrementally

**Output (Partial Context)**:
```typescript
{
  partial: {
    instrument: {
      symbol: "SPY",
      exchange: "NASDAQ",
      price: 450.25
    },
    expert: {
      direction: "LONG",
      aiScore: 9.2,
      quality: "EXTREME",
      rr1: 3.5,
      rr2: 5.0
    }
  },
  source: "TRADINGVIEW_SIGNAL"
}
```

---

### Step 3: Update Context Store
**File**: `src/phase25/services/context-store.service.ts`  
**Method**: `update(partial, source)`

**Context Store Tracks**:
```typescript
{
  context: {
    instrument: { ... },
    expert: { ... },
    regime: undefined,      // Waiting for SATY_PHASE webhook
    alignment: undefined,   // Waiting for MTF_DOTS webhook
    lastUpdated: {
      TRADINGVIEW_SIGNAL: 1768710414011
    }
  }
}
```

---

### Step 4: Check Completeness
**File**: `src/phase25/services/context-store.service.ts`  
**Method**: `isComplete()`

**Completeness Rules** (from config):
```typescript
{
  requiredSources: ['TRADINGVIEW_SIGNAL'],  // Only this is required
  optionalSources: ['SATY_PHASE', 'MTF_DOTS', 'ULTIMATE_OPTIONS'],
  maxAge: 300000  // 5 minutes
}
```

**Check Logic**:
1. All required sources present? ✅ (TRADINGVIEW_SIGNAL exists)
2. Expert source present and fresh? ✅ (TRADINGVIEW_SIGNAL < 5 min old)
3. Expert field exists? ✅ (context.expert is populated)

**Result**: `isComplete() = true` ✅

---

### Step 5: Build Complete Context
**File**: `src/phase25/services/context-store.service.ts`  
**Method**: `build()`

**Output (Complete DecisionContext)**:
```typescript
{
  instrument: {
    symbol: "SPY",
    exchange: "NASDAQ",
    price: 450.25
  },
  expert: {
    direction: "LONG",
    aiScore: 9.2,
    quality: "EXTREME",
    rr1: 3.5,
    rr2: 5.0
  },
  regime: undefined,      // Optional - not provided
  alignment: undefined,   // Optional - not provided
  timestamp: 1768710414011
}
```

---

### Step 6: Fetch Market Context
**File**: `src/phase25/services/market-context.service.ts`  
**Method**: `buildContext(symbol)`

**Same as Phase 2** - fetches from Tradier, TwelveData, Alpaca

---

### Step 7: Make Decision (Phase 2.5 Engine)
**File**: `src/phase25/services/decision-engine.service.ts`  
**Method**: `makeDecision(decisionContext, marketContext)`

**Different Decision Logic**:
- Uses **3 gate categories** (Regime, Structural, Market)
- Calculates **confidence score** (0-100)
- Returns **EXECUTE/WAIT/SKIP** (not APPROVE/REJECT)

#### Regime Gates (30 points max)
```typescript
{
  trendAlignment: 10,    // Trend matches direction
  phaseStrength: 10,     // SATY phase strength
  sessionTiming: 10      // Market session check
}
```

#### Structural Gates (40 points max)
```typescript
{
  riskReward: 15,        // RR ratio quality
  aiQuality: 15,         // AI score quality
  timeframeSync: 10      // Timeframe alignment
}
```

#### Market Gates (30 points max)
```typescript
{
  liquidity: 10,         // Spread and depth
  volatility: 10,        // ATR in range
  optionsFlow: 10        // Put/call ratio, IV
}
```

**Decision Thresholds**:
```typescript
if (confidence >= 70) return "EXECUTE";
if (confidence >= 50) return "WAIT";
return "SKIP";
```

---

### Step 8: Store in Ledger
**File**: `src/phase25/services/decision-orchestrator.service.ts` (Line 129)

```typescript
const ledger = await getGlobalLedger();
const ledgerEntry = convertDecisionToLedgerEntry(decision);
await ledger.append(ledgerEntry);
```

**Ledger Entry**:
```typescript
{
  id: "dec_1768710414011_abc123",
  timestamp: 1768710414011,
  symbol: "SPY",
  decision: "EXECUTE",
  direction: "LONG",
  confidence: 85,
  engine_version: "2.5.0",
  gate_results: {
    regime: { score: 28, max: 30 },
    structural: { score: 35, max: 40 },
    market: { score: 22, max: 30 }
  },
  reasons: ["High confidence", "Strong trend alignment"],
  context_snapshot: { ... }
}
```

---

## Summary: Phase 2 vs Phase 2.5

### Phase 2 (Original)
- **Input**: Single webhook with all data
- **Normalization**: Immediate, complete context
- **Gates**: 5 binary gates (pass/fail)
- **Decision**: APPROVE/REJECT
- **Confidence**: 0-10.0 scale
- **Storage**: Logs only (no database)

### Phase 2.5 (New)
- **Input**: Multiple webhooks over time
- **Normalization**: Incremental, partial contexts
- **Gates**: 3 categories with scoring (0-100)
- **Decision**: EXECUTE/WAIT/SKIP
- **Confidence**: 0-100 scale
- **Storage**: PostgreSQL ledger

### Dual-Write Pattern
```
Webhook arrives
    ↓
Phase 2 processes (immediate decision)
    ↓
Phase 2.5 processes (context building)
    ↓
Both store results independently
```

---

## Files to Review

### Phase 2 Decision Logic
1. **Entry Point**: `src/app/api/webhooks/signals/route.ts`
2. **Normalizer**: `src/phase2/services/normalizer.ts`
3. **Market Context**: `src/phase2/services/market-context-builder.ts`
4. **Decision Engine**: `src/phase2/engine/decision-engine.ts`
5. **Gates**: `src/phase2/gates/*.ts` (5 files)

### Phase 2.5 Decision Logic
1. **Orchestrator**: `src/phase25/services/decision-orchestrator.service.ts`
2. **Source Router**: `src/phase25/services/source-router.service.ts`
3. **Normalizer**: `src/phase25/services/normalizer.service.ts`
4. **Context Store**: `src/phase25/services/context-store.service.ts`
5. **Market Context**: `src/phase25/services/market-context.service.ts`
6. **Decision Engine**: `src/phase25/services/decision-engine.service.ts`

---

**Status**: Complete decision flow documented from webhook to both engines
