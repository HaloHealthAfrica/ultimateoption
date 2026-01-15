# Webhook Processing Validation Plan

**Date:** January 14, 2026  
**Purpose:** Validate that webhooks are being processed correctly through all subsequent steps after receipt

---

## Overview

This document outlines the complete webhook processing pipeline and provides validation steps to ensure each webhook type is processed correctly from receipt through to final storage and decision-making.

---

## Processing Pipeline Summary

### 1. Signals Webhook (`/api/webhooks/signals`)

**Flow:**
```
TradingView → Webhook Receipt → Validation → Normalization → 
Market Context Building → Decision Engine → Audit Logging → Database Storage
```

**Key Components:**
- **Handler:** `src/app/api/webhooks/signals/route.ts`
- **Normalizer:** `src/phase2/services/normalizer.ts`
- **Decision Engine:** `src/phase2/engine/decision-engine.ts`
- **Market Context:** `src/phase2/services/market-context-builder.ts`
- **Audit:** `src/webhooks/auditLog.ts` + `src/webhooks/auditDb.ts`

**Processing Steps:**
1. ✅ Receive webhook (HTTP 200 response)
2. ✅ Parse and validate JSON payload
3. ✅ Normalize signal data (aiScore, symbol, type, satyPhase)
4. ✅ Build market context (fetch spread, volatility, gamma data)
5. ✅ Run through 5 decision gates:
   - SPREAD_GATE (≤12 bps)
   - VOLATILITY_GATE (put/call ratio ≤2.0)
   - GAMMA_GATE (bias alignment)
   - PHASE_GATE (confidence ≥65, direction alignment)
   - SESSION_GATE (not AFTERHOURS)
6. ✅ Generate decision (ACCEPT/REJECT)
7. ✅ Calculate confidence score (for ACCEPT only)
8. ✅ Log to audit system
9. ✅ Store in database

**Expected Output:**
```json
{
  "decision": "ACCEPT" | "REJECT",
  "symbol": "SPY",
  "engine_version": "2.0.0",
  "timestamp": "2026-01-14T...",
  "gates": {
    "passed": ["SPREAD_GATE", "VOLATILITY_GATE", ...],
    "failed": []
  },
  "reasons": [],
  "audit": {
    "timestamp": "...",
    "symbol": "SPY",
    "session": "OPEN",
    "context_snapshot": {...},
    "gate_results": [...],
    "processing_time_ms": 0.45
  }
}
```

---

### 2. SATY Phase Webhook (`/api/webhooks/saty-phase`)

**Flow:**
```
TradingView → Webhook Receipt → Validation → Parsing → 
Phase Store Update → Event Publishing → Audit Logging → Database Storage
```

**Key Components:**
- **Handler:** `src/app/api/webhooks/saty-phase/route.ts`
- **Adapter:** `src/webhooks/satyAdapter.ts`
- **Phase Store:** `src/saty/storage/phaseStore.ts`
- **Event Bus:** `src/events/eventBus.ts`
- **Audit:** `src/webhooks/auditLog.ts` + `src/webhooks/auditDb.ts`

**Processing Steps:**
1. ✅ Receive webhook (HTTP 200 response)
2. ✅ Parse and validate JSON payload (3 format attempts)
3. ✅ Detect wrong endpoint (trend webhooks sent here)
4. ✅ Calculate decay time based on timeframe
5. ✅ Store in PhaseStore with expiry
6. ✅ Publish event to learning modules
7. ✅ Log to audit system
8. ✅ Store in database

**Phase Store Features:**
- Stores phases by `symbol:timeframe` key
- Automatic expiry based on timeframe:
  - 3M → 6 minutes
  - 5M → 10 minutes
  - 15M → 30 minutes
  - 30M → 60 minutes
  - 1H → 120 minutes
  - 4H → 480 minutes
- Regime context aggregation (15M/1H/4H/1D)
- Alignment detection (2+ phases with same bias)

**Expected Output:**
```json
{
  "success": true,
  "phase": {
    "phase_type": "REGIME_PHASE_ENTRY",
    "timeframe": "15",
    "ticker": "SPY",
    "direction": "BULLISH"
  },
  "decay": {
    "minutes": 30,
    "expires_at": 1705336200000
  },
  "authentication": {
    "method": "no-auth-provided",
    "authenticated": true
  },
  "received_at": 1705334400000
}
```

---

### 3. Trend Webhook (`/api/webhooks/trend`)

**Flow:**
```
TradingView → Webhook Receipt → Validation → Parsing → 
Trend Store Update → Alignment Calculation → Audit Logging → Database Storage
```

**Key Components:**
- **Handler:** `src/app/api/webhooks/trend/route.ts`
- **Adapter:** `src/webhooks/trendAdapter.ts`
- **Trend Store:** `src/trend/storage/trendStore.ts`
- **Alignment:** `src/types/trend.ts` (calculateTrendAlignment)
- **Audit:** `src/webhooks/auditLog.ts` + `src/webhooks/auditDb.ts`

**Processing Steps:**
1. ✅ Receive webhook (HTTP 200 response)
2. ✅ Parse and validate JSON payload (3 format attempts)
3. ✅ Store in TrendStore with 1-hour TTL
4. ✅ Calculate alignment metrics:
   - Alignment score (0-100)
   - Strength (WEAK/MODERATE/STRONG)
   - Dominant trend (bullish/bearish/neutral)
   - Bullish/bearish/neutral counts
   - HTF bias (4H timeframe)
   - LTF bias (3M/5M average)
5. ✅ Log to audit system
6. ✅ Store in database

**Trend Store Features:**
- Stores trends by ticker
- 1-hour TTL for all trends
- Automatic expiry cleanup
- Alignment calculation across 8 timeframes
- HTF/LTF bias extraction

**Expected Output:**
```json
{
  "success": true,
  "trend": {
    "ticker": "SPY",
    "exchange": "AMEX",
    "price": 686.44,
    "timestamp": "2026-01-14T..."
  },
  "alignment": {
    "score": 87.5,
    "strength": "STRONG",
    "dominant_trend": "bullish",
    "bullish_count": 7,
    "bearish_count": 0,
    "neutral_count": 1,
    "htf_bias": "bullish",
    "ltf_bias": "bullish"
  },
  "storage": {
    "ttl_minutes": 60,
    "expires_at": 1705338000000
  },
  "authentication": {
    "method": "no-auth-provided",
    "authenticated": true
  },
  "received_at": 1705334400000
}
```

---

## Validation Steps

### Step 1: Verify Webhook Receipt ✅

**Status:** COMPLETE (from screenshot)
- All webhooks showing HTTP 200 status
- Different webhook types being received (trend, saty-phase, signals)
- Authentication working (via no-auth-provided)

### Step 2: Verify Database Storage

**Action:** Check that webhooks are being stored in the database

**Query the receipts endpoint:**
```bash
curl https://optionstrat.vercel.app/api/webhooks/receipts
```

**Expected:** Recent webhooks with:
- `kind`: "signals", "saty-phase", or "trend"
- `ok`: true
- `status`: 200
- `raw_payload`: Complete JSON payload
- `headers`: Request headers
- `ticker`/`symbol`: Symbol information
- `timeframe`: For saty-phase webhooks
- `message`: Processing details

**Validation Criteria:**
- ✅ All recent webhooks appear in receipts
- ✅ Payloads are complete and parseable
- ✅ Timestamps are accurate
- ✅ No missing fields

---

### Step 3: Verify Signals Processing

**Action:** Send a test signal and verify it goes through the decision engine

**Test Signal:**
```bash
curl -X POST https://optionstrat.vercel.app/api/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "type": "LONG",
      "aiScore": 8.5,
      "symbol": "SPY",
      "timestamp": '$(date +%s000)'
    },
    "satyPhase": {
      "phase": 75.0
    },
    "marketSession": "OPEN"
  }'
```

**Expected Response:**
```json
{
  "decision": "ACCEPT" | "REJECT",
  "symbol": "SPY",
  "engine_version": "2.0.0",
  "gates": {
    "passed": [...],
    "failed": [...]
  },
  "audit": {
    "gate_results": [
      {
        "gate": "SPREAD_GATE",
        "passed": true/false,
        "value": ...,
        "threshold": 12
      },
      ...
    ]
  }
}
```

**Validation Criteria:**
- ✅ Decision is either ACCEPT or REJECT
- ✅ All 5 gates are evaluated (SPREAD, VOLATILITY, GAMMA, PHASE, SESSION)
- ✅ Gate results show actual values vs thresholds
- ✅ Confidence score present for ACCEPT decisions
- ✅ Reasons present for REJECT decisions
- ✅ Processing time < 500ms
- ✅ Audit trail is complete

**Check Decision Logic:**
- If ALL gates pass → decision should be ACCEPT
- If ANY gate fails → decision should be REJECT
- Confidence = aiScore + boosts (capped at 10.0)

---

### Step 4: Verify SATY Phase Storage

**Action:** Send a test SATY phase and verify it's stored correctly

**Test Phase:**
```bash
curl -X POST https://optionstrat.vercel.app/api/webhooks/saty-phase \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {
      "engine": "SATY_PO",
      "engine_version": "1.0.0",
      "event_id": "test_001",
      "event_type": "REGIME_PHASE_ENTRY",
      "generated_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "instrument": {
      "symbol": "SPY",
      "exchange": "NASDAQ",
      "asset_class": "ETF",
      "session": "REGULAR"
    },
    "timeframe": {
      "chart_tf": "15",
      "event_tf": "15M",
      "tf_role": "SETUP_FORMATION",
      "bar_close_time": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "event": {
      "name": "ENTER_ACCUMULATION",
      "description": "Test phase",
      "directional_implication": "UPSIDE_POTENTIAL",
      "event_priority": 8
    },
    "oscillator_state": {
      "value": 75.0,
      "previous_value": 65.0,
      "zone_from": "NEUTRAL",
      "zone_to": "ACCUMULATION",
      "distance_from_zero": 75.0,
      "distance_from_extreme": 25.0,
      "velocity": "INCREASING"
    },
    "regime_context": {
      "local_bias": "BULLISH",
      "htf_bias": {
        "tf": "60",
        "bias": "BULLISH",
        "osc_value": 70.0
      },
      "macro_bias": {
        "tf": "240",
        "bias": "BULLISH"
      }
    },
    "market_structure": {
      "mean_reversion_phase": "EXPANSION",
      "trend_phase": "TRENDING",
      "is_counter_trend": false,
      "compression_state": "EXPANDING"
    },
    "confidence": {
      "raw_strength": 0.85,
      "htf_alignment": true,
      "confidence_score": 85,
      "confidence_tier": "HIGH"
    },
    "execution_guidance": {
      "trade_allowed": true,
      "allowed_directions": ["LONG"],
      "recommended_execution_tf": ["5", "15"],
      "requires_confirmation": ["PRICE_ACTION"]
    },
    "risk_hints": {
      "avoid_if": ["LOW_VOLUME"],
      "time_decay_minutes": 30,
      "cooldown_tf": "15"
    },
    "audit": {
      "source": "test",
      "alert_frequency": "once_per_bar",
      "deduplication_key": "test_001"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "phase": {
    "phase_type": "REGIME_PHASE_ENTRY",
    "timeframe": "15",
    "ticker": "SPY",
    "direction": "BULLISH"
  },
  "decay": {
    "minutes": 30,
    "expires_at": ...
  }
}
```

**Validation Criteria:**
- ✅ Phase is stored in PhaseStore
- ✅ Expiry time is calculated correctly (15M → 30 minutes)
- ✅ Phase can be retrieved: `PhaseStore.getInstance().getPhase("SPY", "15M")`
- ✅ Regime context is available: `PhaseStore.getInstance().getRegimeContext("SPY")`
- ✅ Event is published to learning modules
- ✅ Audit log contains the phase

**Check Phase Store:**
```typescript
// In a test or debug endpoint
const phaseStore = PhaseStore.getInstance();
const phase = phaseStore.getPhase("SPY", "15M");
const regimeContext = phaseStore.getRegimeContext("SPY");
const activeCount = phaseStore.getActiveCount();
```

---

### Step 5: Verify Trend Storage

**Action:** Send a test trend and verify it's stored correctly

**Test Trend:**
```bash
curl -X POST https://optionstrat.vercel.app/api/webhooks/trend \
  -H "Content-Type: application/json" \
  -d '{
    "event": "trend_change",
    "trigger_timeframe": "5m",
    "ticker": "SPY",
    "exchange": "AMEX",
    "price": 686.44,
    "timeframes": {
      "3m": {"dir": "bullish", "chg": false},
      "5m": {"dir": "bullish", "chg": true},
      "15m": {"dir": "bullish", "chg": false},
      "30m": {"dir": "bullish", "chg": false},
      "1h": {"dir": "bullish", "chg": false},
      "4h": {"dir": "bullish", "chg": false},
      "1w": {"dir": "bullish", "chg": false},
      "1M": {"dir": "bullish", "chg": false}
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "trend": {
    "ticker": "SPY",
    "exchange": "AMEX",
    "price": 686.44,
    "timestamp": "..."
  },
  "alignment": {
    "score": 100,
    "strength": "STRONG",
    "dominant_trend": "bullish",
    "bullish_count": 8,
    "bearish_count": 0,
    "neutral_count": 0,
    "htf_bias": "bullish",
    "ltf_bias": "bullish"
  },
  "storage": {
    "ttl_minutes": 60,
    "expires_at": ...
  }
}
```

**Validation Criteria:**
- ✅ Trend is stored in TrendStore
- ✅ TTL is 60 minutes
- ✅ Alignment score is calculated correctly
- ✅ HTF bias matches 4H timeframe
- ✅ LTF bias is average of 3M/5M
- ✅ Trend can be retrieved: `TrendStore.getInstance().getTrend("SPY")`
- ✅ Alignment can be retrieved: `TrendStore.getInstance().getAlignment("SPY")`
- ✅ Audit log contains the trend

**Check Trend Store:**
```typescript
// In a test or debug endpoint
const trendStore = TrendStore.getInstance();
const trend = trendStore.getTrend("SPY");
const alignment = trendStore.getAlignment("SPY");
const htfBias = trendStore.getHtfBias("SPY");
const ltfBias = trendStore.getLtfBias("SPY");
```

---

### Step 6: Verify Integration Between Components

**Action:** Verify that signals webhook uses stored SATY phase and trend data

**Test Scenario:**
1. Send SATY phase webhook for SPY (15M timeframe, BULLISH, phase=75)
2. Send trend webhook for SPY (all bullish)
3. Send signal webhook for SPY (LONG, aiScore=8.5)
4. Verify decision uses the stored phase and trend data

**Expected Behavior:**
- Signal processing should fetch phase from PhaseStore
- Signal processing should fetch trend from TrendStore
- PHASE_GATE should use the stored phase value (75)
- Decision should be influenced by stored context

**Validation:**
```bash
# 1. Send phase
curl -X POST https://optionstrat.vercel.app/api/webhooks/saty-phase \
  -H "Content-Type: application/json" \
  -d '{ ... phase payload ... }'

# 2. Send trend
curl -X POST https://optionstrat.vercel.app/api/webhooks/trend \
  -H "Content-Type: application/json" \
  -d '{ ... trend payload ... }'

# 3. Send signal (without satyPhase in payload - should use stored)
curl -X POST https://optionstrat.vercel.app/api/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "type": "LONG",
      "aiScore": 8.5,
      "symbol": "SPY"
    },
    "marketSession": "OPEN"
  }'

# 4. Check audit trail shows stored phase was used
```

---

### Step 7: Verify Expiry and Cleanup

**Action:** Verify that expired data is cleaned up correctly

**Test Scenario:**
1. Send SATY phase with 3M timeframe (6-minute expiry)
2. Wait 7 minutes
3. Try to retrieve the phase
4. Verify it's marked as inactive

**Validation:**
```typescript
// Send phase
const phaseStore = PhaseStore.getInstance();

// Immediately after sending
const phase1 = phaseStore.getPhase("SPY", "3M");
// Should return the phase

// After 7 minutes
const phase2 = phaseStore.getPhase("SPY", "3M");
// Should return null (expired)

// Check active count
const activeCount = phaseStore.getActiveCount();
// Should not include expired phase
```

**Same for Trend:**
```typescript
const trendStore = TrendStore.getInstance();

// Immediately after sending
const trend1 = trendStore.getTrend("SPY");
// Should return the trend

// After 61 minutes
const trend2 = trendStore.getTrend("SPY");
// Should return null (expired)
```

---

## Validation Checklist

### Signals Webhook
- [ ] Webhook receipt returns HTTP 200
- [ ] Payload is validated correctly
- [ ] Signal is normalized (aiScore, symbol, type)
- [ ] Market context is built (spread, volatility, gamma)
- [ ] All 5 gates are evaluated
- [ ] Decision is deterministic (same input → same output)
- [ ] Confidence is calculated for ACCEPT
- [ ] Reasons are provided for REJECT
- [ ] Audit trail is complete
- [ ] Database record is created

### SATY Phase Webhook
- [ ] Webhook receipt returns HTTP 200
- [ ] Payload is parsed (3 format attempts)
- [ ] Wrong endpoint detection works
- [ ] Phase is stored in PhaseStore
- [ ] Expiry time is calculated correctly
- [ ] Phase can be retrieved by symbol+timeframe
- [ ] Regime context is aggregated
- [ ] Event is published to learning modules
- [ ] Audit trail is complete
- [ ] Database record is created

### Trend Webhook
- [ ] Webhook receipt returns HTTP 200
- [ ] Payload is parsed (3 format attempts)
- [ ] Trend is stored in TrendStore
- [ ] TTL is 60 minutes
- [ ] Alignment score is calculated
- [ ] HTF/LTF biases are extracted
- [ ] Trend can be retrieved by ticker
- [ ] Alignment can be retrieved
- [ ] Audit trail is complete
- [ ] Database record is created

### Integration
- [ ] Signals use stored SATY phase data
- [ ] Signals use stored trend data
- [ ] Phase expiry works correctly
- [ ] Trend expiry works correctly
- [ ] Cleanup removes expired data
- [ ] Multiple webhooks don't interfere

---

## Debugging Tools

### 1. Webhook Receipts UI
**URL:** https://optionstrat.vercel.app (Webhooks tab)
- View all recent webhooks
- Filter by type (signals, saty-phase, trend)
- Expand to see full payload and headers
- Check status and error messages

### 2. API Endpoints

**Statistics:**
```bash
curl https://optionstrat.vercel.app/api/webhooks/stats
```

**Recent webhooks:**
```bash
curl https://optionstrat.vercel.app/api/webhooks/recent
```

**Filter by kind:**
```bash
curl https://optionstrat.vercel.app/api/webhooks/recent-by-kind?kind=signals
curl https://optionstrat.vercel.app/api/webhooks/recent-by-kind?kind=saty-phase
curl https://optionstrat.vercel.app/api/webhooks/recent-by-kind?kind=trend
```

**Debug specific webhook:**
```bash
curl https://optionstrat.vercel.app/api/webhooks/debug-payload?id=<ID>
```

### 3. Logs
Check server logs for:
- Decision engine processing
- Gate evaluation results
- Market context building
- Phase/trend storage operations
- Error messages

---

## Success Criteria

### Overall System Health
- ✅ Webhook success rate > 95%
- ✅ Processing time < 500ms per webhook
- ✅ All gates evaluated for every signal
- ✅ Phase/trend data stored and retrievable
- ✅ Expiry and cleanup working correctly
- ✅ Audit trails complete and accurate
- ✅ No data loss or corruption

### Per-Webhook Type
- **Signals:** Decision engine produces deterministic results
- **SATY Phase:** Phases stored with correct expiry times
- **Trend:** Alignment calculated correctly

---

## Next Steps

1. **Run validation tests** using the steps above
2. **Document any failures** with specific error messages
3. **Fix issues** identified during validation
4. **Re-run tests** to confirm fixes
5. **Monitor production** for ongoing health

---

**Validation Status:** 🟡 PENDING
**Last Updated:** January 14, 2026
**Next Review:** After running validation tests
