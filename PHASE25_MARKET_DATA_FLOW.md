# Phase 2.5 Market Data Flow
**Where Tradier, TwelveData, and Alpaca Data is Used**

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. WEBHOOK RECEIVED                                             │
│    /api/phase25/webhooks/signals                                │
│    /api/phase25/webhooks/saty-phase                            │
│    /api/phase25/webhooks/trend                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. DECISION ORCHESTRATOR                                        │
│    src/phase25/services/decision-orchestrator.service.ts        │
│                                                                 │
│    processWebhook(payload)                                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ├──► Step 1: Normalize webhook data
                 ├──► Step 2: Store in context store
                 ├──► Step 3: Check completeness
                 ├──► Step 4: Build decision context
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. MARKET CONTEXT BUILDER ⭐ (THIS IS WHERE IT HAPPENS)        │
│    src/phase25/services/market-context.service.ts               │
│                                                                 │
│    marketContextBuilder.buildContext(symbol)                    │
│                                                                 │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │ PARALLEL API CALLS (Promise.allSettled)                 │ │
│    │                                                          │ │
│    │  ┌──────────────────────────────────────────┐          │ │
│    │  │ TRADIER (Options Data)                   │          │ │
│    │  │ getTradierOptions(symbol)                │          │ │
│    │  │                                           │          │ │
│    │  │ Endpoint:                                 │          │ │
│    │  │ /v1/markets/options/chains                │          │ │
│    │  │ /v1/markets/quotes                        │          │ │
│    │  │                                           │          │ │
│    │  │ Returns:                                  │          │ │
│    │  │ • putCallRatio                            │          │ │
│    │  │ • ivPercentile                            │          │ │
│    │  │ • gammaBias                               │          │ │
│    │  │ • optionVolume                            │          │ │
│    │  │ • maxPain                                 │          │ │
│    │  └──────────────────────────────────────────┘          │ │
│    │                                                          │ │
│    │  ┌──────────────────────────────────────────┐          │ │
│    │  │ TWELVEDATA (Market Stats)                │          │ │
│    │  │ getTwelveDataStats(symbol)               │          │ │
│    │  │                                           │          │ │
│    │  │ Endpoints:                                │          │ │
│    │  │ /atr?symbol={symbol}                      │          │ │
│    │  │ /rsi?symbol={symbol}                      │          │ │
│    │  │ /time_series?symbol={symbol}              │          │ │
│    │  │                                           │          │ │
│    │  │ Returns:                                  │          │ │
│    │  │ • atr14 (volatility)                      │          │ │
│    │  │ • rv20 (realized volatility)              │          │ │
│    │  │ • trendSlope                              │          │ │
│    │  │ • rsi                                     │          │ │
│    │  │ • volume                                  │          │ │
│    │  │ • volumeRatio                             │          │ │
│    │  └──────────────────────────────────────────┘          │ │
│    │                                                          │ │
│    │  ┌──────────────────────────────────────────┐          │ │
│    │  │ TWELVEDATA (Liquidity Data) ⭐ NEW       │          │ │
│    │  │ getTwelveDataLiquidity(symbol)           │          │ │
│    │  │                                           │          │ │
│    │  │ Endpoint:                                 │          │ │
│    │  │ /quote?symbol={symbol}                    │          │ │
│    │  │                                           │          │ │
│    │  │ Returns:                                  │          │ │
│    │  │ • spreadBps (bid-ask spread)              │          │ │
│    │  │ • depthScore (market depth)               │          │ │
│    │  │ • tradeVelocity (FAST/NORMAL/SLOW)        │          │ │
│    │  │ • bidSize                                 │          │ │
│    │  │ • askSize                                 │          │ │
│    │  └──────────────────────────────────────────┘          │ │
│    │                                                          │ │
│    │  ⚠️  DEPRECATED (Not Used Anymore):                     │ │
│    │  ┌──────────────────────────────────────────┐          │ │
│    │  │ ALPACA (Liquidity Data) - REMOVED        │          │ │
│    │  │ Reason: Required $9/month subscription    │          │ │
│    │  └──────────────────────────────────────────┘          │ │
│    │                                                          │ │
│    └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│    Returns: MarketContext {                                    │
│      options: {...},      // From Tradier                      │
│      stats: {...},        // From TwelveData                   │
│      liquidity: {...},    // From TwelveData                   │
│      completeness: 1.0,   // 3/3 providers                     │
│      errors: []                                                │
│    }                                                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. DECISION ENGINE                                              │
│    src/phase25/services/decision-engine.service.ts              │
│                                                                 │
│    makeDecision(decisionContext, marketContext)                 │
│                                                                 │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │ MARKET GATES (Uses Market Data) ⭐                      │ │
│    │                                                          │ │
│    │ runMarketGates(marketContext):                          │ │
│    │                                                          │ │
│    │ 1. SPREAD GATE                                          │ │
│    │    Uses: marketContext.liquidity.spreadBps              │ │
│    │    From: TwelveData (quote endpoint)                    │ │
│    │    Check: spreadBps < 12 bps                            │ │
│    │    Impact: Wide spreads = poor execution quality        │ │
│    │                                                          │ │
│    │ 2. VOLATILITY GATE                                      │ │
│    │    Uses: marketContext.stats.atr14                      │ │
│    │    From: TwelveData (ATR endpoint)                      │ │
│    │    Check: atr14 < 50                                    │ │
│    │    Impact: High volatility = higher risk                │ │
│    │                                                          │ │
│    │ 3. DEPTH GATE                                           │ │
│    │    Uses: marketContext.liquidity.depthScore             │ │
│    │    From: TwelveData (quote endpoint, calculated)        │ │
│    │    Check: depthScore > 30                               │ │
│    │    Impact: Low depth = thin market                      │ │
│    │                                                          │ │
│    │ 4. SESSION GATE                                         │ │
│    │    Uses: Current time                                   │ │
│    │    Check: Not in AFTERHOURS                             │ │
│    │    Impact: Restricted sessions = no trading             │ │
│    │                                                          │ │
│    └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │ CONFIDENCE CALCULATION (Uses Market Data) ⭐            │ │
│    │                                                          │ │
│    │ calculateConfidence(context, marketContext):            │ │
│    │                                                          │ │
│    │ Base Score: expert.aiScore * 10                         │ │
│    │                                                          │ │
│    │ Adjustments:                                            │ │
│    │ • Spread penalty: -5 if spread > 8bps                   │ │
│    │   From: marketContext.liquidity.spreadBps               │ │
│    │                                                          │ │
│    │ • Volatility bonus: +3 if ATR in sweet spot             │ │
│    │   From: marketContext.stats.atr14                       │ │
│    │                                                          │ │
│    │ • Volume bonus: +2 if high volume                       │ │
│    │   From: marketContext.stats.volumeRatio                 │ │
│    │                                                          │ │
│    │ • Options flow bonus: +5 if favorable put/call          │ │
│    │   From: marketContext.options.putCallRatio              │ │
│    │                                                          │ │
│    │ • IV bonus: +3 if IV percentile favorable               │ │
│    │   From: marketContext.options.ivPercentile              │ │
│    │                                                          │ │
│    └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│    Returns: DecisionPacket {                                   │
│      action: "EXECUTE" | "WAIT" | "SKIP",                      │
│      confidenceScore: 83.2,                                    │
│      gateResults: {                                            │
│        market: { passed: true, score: 100 }                    │
│      },                                                         │
│      marketSnapshot: marketContext  // Includes all data       │
│    }                                                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. LEDGER STORAGE                                               │
│    src/ledger/ledger.ts                                         │
│                                                                 │
│    Stores decision with marketSnapshot in database              │
│                                                                 │
│    ledger_entries table:                                        │
│    • decision (EXECUTE/WAIT/SKIP)                              │
│    • confidence_score (83.2)                                    │
│    • gate_results (regime, structural, market)                 │
│    • market_snapshot (full marketContext) ⭐                   │
│                                                                 │
│    The marketSnapshot includes ALL market data:                 │
│    • Tradier options data                                      │
│    • TwelveData stats                                          │
│    • TwelveData liquidity                                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. DASHBOARD DISPLAY                                            │
│    src/components/dashboard/Phase25DecisionCard.tsx            │
│                                                                 │
│    Displays decision with market data breakdown:                │
│                                                                 │
│    • Confidence Score: 83.2%                                    │
│    • Decision: EXECUTE                                          │
│    • Gate Results:                                              │
│      - Market Gate: ✓ Passed (100%)                            │
│        • Spread: 2.5 bps (from TwelveData)                     │
│        • ATR: 8.2 (from TwelveData)                            │
│        • Depth: 85 (from TwelveData)                           │
│      - Regime Gate: ✓ Passed (82%)                             │
│      - Structural Gate: ✓ Passed (78%)                         │
│                                                                 │
│    • Market Context Panel:                                      │
│      - Options Flow (from Tradier)                             │
│        • Put/Call: 0.87                                        │
│        • IV: 62%                                               │
│        • Gamma: POSITIVE                                       │
│      - Market Stats (from TwelveData)                          │
│        • ATR: 8.2                                              │
│        • RSI: 58                                               │
│        • Volume: 1.2x avg                                      │
│      - Liquidity (from TwelveData)                             │
│        • Spread: 2.5 bps                                       │
│        • Depth: 85                                             │
│        • Velocity: NORMAL                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Breakdown

### Step 3: Market Context Builder (THE KEY STEP)

**File:** `src/phase25/services/market-context.service.ts`

**Method:** `buildContext(symbol: string)`

**Line:** ~118 in decision-orchestrator.service.ts

```typescript
const marketContext = await this.marketContextBuilder.buildContext(
  decisionContext.instrument.symbol
);
```

**What Happens:**

1. **Parallel API Calls** (all at once, 600ms timeout each):
   ```typescript
   const [optionsResult, statsResult, liquidityResult] = await Promise.allSettled([
     this.getTradierOptions(symbol),      // Tradier
     this.getTwelveDataStats(symbol),     // TwelveData
     this.getTwelveDataLiquidity(symbol)  // TwelveData
   ]);
   ```

2. **Tradier Options Data:**
   - API: `https://api.tradier.com/v1/markets/options/chains`
   - API: `https://api.tradier.com/v1/markets/quotes`
   - Returns: Put/call ratio, IV percentile, gamma bias, option volume, max pain

3. **TwelveData Market Stats:**
   - API: `https://api.twelvedata.com/atr`
   - API: `https://api.twelvedata.com/rsi`
   - API: `https://api.twelvedata.com/time_series`
   - Returns: ATR, realized volatility, trend slope, RSI, volume

4. **TwelveData Liquidity:**
   - API: `https://api.twelvedata.com/quote`
   - Returns: Bid, ask, spread, depth score, trade velocity

---

### Step 4: Decision Engine Uses Market Data

**File:** `src/phase25/services/decision-engine.service.ts`

**Method:** `makeDecision(context, marketContext)`

**Line:** ~127 in decision-orchestrator.service.ts

```typescript
const decision = this.decisionEngine.makeDecision(decisionContext, marketContext);
```

**How Market Data is Used:**

#### A. Market Gates (`runMarketGates(marketContext)`)

**Line:** ~210 in decision-engine.service.ts

```typescript
const marketGate = this.runMarketGates(marketContext);
```

**Checks:**

1. **Spread Gate:**
   ```typescript
   if (marketContext.liquidity?.spreadBps > 12) {
     return { passed: false, reason: "Spread too wide" };
   }
   ```
   - Uses: `marketContext.liquidity.spreadBps`
   - From: TwelveData quote endpoint
   - Impact: Wide spreads reduce confidence or block trade

2. **Volatility Gate:**
   ```typescript
   if (marketContext.stats?.atr14 > 50) {
     return { passed: false, reason: "ATR spike too high" };
   }
   ```
   - Uses: `marketContext.stats.atr14`
   - From: TwelveData ATR endpoint
   - Impact: High volatility blocks trade

3. **Depth Gate:**
   ```typescript
   if (marketContext.liquidity?.depthScore < 30) {
     return { passed: false, reason: "Insufficient liquidity" };
   }
   ```
   - Uses: `marketContext.liquidity.depthScore`
   - From: TwelveData quote (calculated from volume)
   - Impact: Low depth blocks trade

#### B. Confidence Calculation (`calculateConfidence()`)

**Line:** ~300+ in decision-engine.service.ts

```typescript
const confidenceScore = this.calculateConfidence(context, marketContext);
```

**Adjustments Based on Market Data:**

```typescript
// Spread penalty
if (marketContext.liquidity?.spreadBps > 8) {
  confidence -= 5;
}

// Volatility bonus
if (marketContext.stats?.atr14 > 5 && marketContext.stats?.atr14 < 15) {
  confidence += 3;
}

// Volume bonus
if (marketContext.stats?.volumeRatio > 1.2) {
  confidence += 2;
}

// Options flow bonus
if (marketContext.options?.putCallRatio < 0.8) {
  confidence += 5; // Bullish options flow
}

// IV bonus
if (marketContext.options?.ivPercentile > 60) {
  confidence += 3; // High IV = more premium
}
```

---

## Summary: Where Each Provider's Data is Used

### Tradier (Options Data):

**Used In:**
- Confidence calculation (put/call ratio, IV percentile)
- Options flow analysis
- Gamma bias assessment

**Impact:**
- +5 confidence for favorable put/call ratio
- +3 confidence for high IV percentile
- Influences position sizing

**Current Status:** ⚠️ Using fallback values (API key issue)

---

### TwelveData (Market Stats):

**Used In:**
- Market gates (ATR volatility check)
- Confidence calculation (volume, trend)
- Risk assessment

**Impact:**
- Blocks trade if ATR > 50
- +3 confidence for optimal volatility
- +2 confidence for high volume

**Current Status:** ⚠️ Returning zeros (rate limits or format issue)

---

### TwelveData (Liquidity):

**Used In:**
- Market gates (spread check, depth check)
- Confidence calculation (spread penalty)
- Execution quality assessment

**Impact:**
- Blocks trade if spread > 12bps
- Blocks trade if depth < 30
- -5 confidence for wide spreads

**Current Status:** ✅ Working (100% completeness)

---

## Key Files

1. **Market Context Builder:**
   - `src/phase25/services/market-context.service.ts`
   - Lines: 75-120 (buildContext method)

2. **Decision Engine:**
   - `src/phase25/services/decision-engine.service.ts`
   - Lines: 35-100 (makeDecision method)
   - Lines: 210-280 (runMarketGates method)
   - Lines: 300+ (calculateConfidence method)

3. **Decision Orchestrator:**
   - `src/phase25/services/decision-orchestrator.service.ts`
   - Lines: 118-120 (calls buildContext)
   - Lines: 127 (calls makeDecision)

4. **Configuration:**
   - `src/phase25/config/market-feeds.config.ts`
   - Defines API endpoints, timeouts, fallback values

---

## Testing

**Test the flow:**
```bash
node test-tradier-simple.js
```

**Check completeness:**
- 100% = All 3 data sources working
- 67% = 2 of 3 working
- 33% = 1 of 3 working

**Verify data usage:**
- Send webhook
- Check decision confidence score
- Look at gate results
- Inspect marketSnapshot in response

---

**Last Updated:** January 18, 2026, 11:55 PM
