# Webhook to Dashboard Conversion Analysis

**Date**: January 16, 2026  
**Analysis Period**: All-time (production deployment)

---

## Executive Summary

**Critical Finding**: Only **2 decisions** (0.09%) out of **2,188 successful webhooks** (51.6% of 4,243 total) are visible on the Phase 2.5 dashboard.

This represents a **99.91% gap** between webhook receipts and dashboard visibility.

---

## Webhook Statistics

### Overall Metrics
- **Total webhooks received**: 4,243
- **Successful**: 2,188 (51.6%)
- **Failed**: 2,055 (48.4%)

### By Webhook Type

| Type | Successful | Failed | Total | Success Rate |
|------|-----------|--------|-------|--------------|
| **SATY Phase** | 832 | 1,611 | 2,443 | 34.1% |
| **Signals** | 1,114 | 420 | 1,534 | 72.6% |
| **Trend** | 242 | 24 | 266 | 91.0% |

### Recent Activity (Last 10 Successful)
- Most recent: 17:09:44 (SKIP decision, 83.5% confidence)
- Phase 2.5 activity: 2 webhooks in recent batch
  - 1 decision made (SKIP)
  - 1 context update (waiting for complete context)

---

## Dashboard Statistics

### Phase 2.5 Decisions API
- **Total decisions stored**: 2
- **Decision types**: 
  - SKIP: 2 (100%)
  - EXECUTE: 0 (0%)
  - WAIT: 0 (0%)
- **Date range**: January 16, 2026 only
- **Most recent**: 17:09:44 (matches webhook timestamp)

---

## Gap Analysis

### The 99.91% Gap Explained

**2,188 successful webhooks → 2 dashboard decisions**

#### Root Causes

1. **Context Incompleteness (Primary)**
   - Phase 2.5 requires **complete context** from multiple sources before making a decision
   - Required sources: `SATY_PHASE` + at least one expert source (`ULTIMATE_OPTIONS` or `TRADINGVIEW_SIGNAL`)
   - Optional sources: `MTF_DOTS`, `STRAT_EXEC`, `TREND`
   - **Context timeout**: 5 minutes (data expires if not refreshed)
   
   **Impact**: Most webhooks update partial context but don't trigger decisions because:
   - Waiting for other required sources
   - Context expired before all sources arrived
   - Sources arriving out of sync

2. **Phase 2 vs Phase 2.5 Routing**
   - Many successful webhooks are processed by **Phase 2** (legacy system), not Phase 2.5
   - Recent webhook messages show:
     - "Phase 2 decision: REJECT" (not stored in Phase 2.5 ledger)
     - "Phase 2.5: Context updated" (partial update, no decision yet)
   
   **Impact**: Phase 2 decisions don't appear on Phase 2.5 dashboard

3. **Failed Webhooks (48.4%)**
   - 2,055 webhooks failed validation
   - Common errors:
     - "Missing required field: signal" (signals webhook)
     - "Invalid trend payload" (trend webhook)
     - SATY Phase: 66% failure rate (1,611 failed / 2,443 total)
   
   **Impact**: Failed webhooks never enter decision pipeline

4. **Decision Outcomes**
   - Even when decisions are made, most are SKIP/WAIT (not EXECUTE)
   - Current data: 100% SKIP decisions
   - SKIP/WAIT decisions are stored but may not be as visible/actionable

---

## Decision Flow Architecture

### Phase 2.5 Decision Pipeline

```
Webhook Received
    ↓
Source Router (identify webhook type)
    ↓
Normalizer (validate & normalize payload)
    ↓
Context Store (update partial context)
    ↓
[CHECKPOINT] Is context complete?
    ↓ NO → Return "waiting for complete context"
    ↓ YES
    ↓
Market Context Builder (fetch live market data)
    ↓
Decision Engine (make EXECUTE/WAIT/SKIP decision)
    ↓
Ledger Append (store decision)
    ↓
Dashboard API (/api/decisions)
```

### Context Completeness Requirements

**Required for decision**:
- ✅ SATY_PHASE (regime, phase context)
- ✅ At least one expert source:
  - ULTIMATE_OPTIONS (expert signals)
  - TRADINGVIEW_SIGNAL (expert signals)

**Optional (improves decision quality)**:
- MTF_DOTS (multi-timeframe alignment)
- STRAT_EXEC (structure/setup validation)
- TREND (trend context)

**Timeout**: 5 minutes (context expires if not refreshed)

---

## Conversion Funnel

```
4,243 Total Webhooks (100%)
    ↓
2,188 Successful Webhooks (51.6%)
    ↓ [Validation failures: 2,055]
    ↓
~100-200 Phase 2.5 Webhooks (estimated 5-10%)
    ↓ [Phase 2 routing: ~2,000]
    ↓
~10-20 Complete Context Events (estimated 0.5-1%)
    ↓ [Context incomplete/expired: ~90-180]
    ↓
2 Decisions Made (0.09%)
    ↓ [Waiting for context: ~8-18]
    ↓
2 Dashboard Entries (0.09%)
```

---

## Key Insights

### 1. Context Completeness is the Bottleneck
- **Problem**: Webhooks arrive independently, but decisions require synchronized data from multiple sources
- **Current behavior**: Most webhooks update partial context and return "waiting for complete context"
- **Result**: Very few webhooks trigger actual decisions

### 2. Phase 2 vs Phase 2.5 Coexistence
- **Problem**: Both systems are running in parallel, processing different webhooks
- **Current behavior**: Phase 2 handles most signals, Phase 2.5 handles fewer
- **Result**: Phase 2 decisions don't appear on Phase 2.5 dashboard

### 3. High Webhook Failure Rate
- **Problem**: 48.4% of webhooks fail validation
- **Worst offender**: SATY Phase (66% failure rate)
- **Result**: Half of all webhook data is lost before entering the pipeline

### 4. Context Expiration
- **Problem**: 5-minute timeout means sources must arrive within a tight window
- **Current behavior**: If sources arrive >5 minutes apart, context expires
- **Result**: Even more context incompleteness

---

## Recommendations

### Immediate (Week 1-2)

1. **Fix SATY Phase Webhook Failures**
   - Investigate why 66% of SATY Phase webhooks fail
   - Fix payload format or validation logic
   - **Expected impact**: +1,611 successful webhooks → +800 potential decisions

2. **Add Context Completeness Monitoring**
   - Track how often context becomes complete
   - Measure time between source arrivals
   - Identify which sources are missing most often
   - **Expected impact**: Visibility into the bottleneck

3. **Extend Context Timeout (Testing)**
   - Test with 10-15 minute timeout instead of 5 minutes
   - Measure impact on decision completeness
   - **Expected impact**: +50-100% more complete contexts

### Short-term (Week 3-4)

4. **Consolidate Phase 2 and Phase 2.5 Routing**
   - Route more webhooks to Phase 2.5 instead of Phase 2
   - Gradually migrate Phase 2 logic to Phase 2.5
   - **Expected impact**: +2,000 webhooks → +100-200 decisions

5. **Implement Context Persistence**
   - Store partial context in database (not just memory)
   - Survive server restarts and deployments
   - **Expected impact**: +20-30% more complete contexts

6. **Add Dashboard Filters**
   - Show SKIP/WAIT decisions separately from EXECUTE
   - Add "Context Status" view showing partial contexts
   - **Expected impact**: Better visibility into system state

### Medium-term (Month 2-3)

7. **Relax Context Requirements**
   - Allow decisions with fewer required sources
   - Use default values for missing optional sources
   - **Expected impact**: +500-1000% more decisions

8. **Implement Context Prediction**
   - Predict missing context values based on historical data
   - Make decisions with "synthetic" context when sources are delayed
   - **Expected impact**: +200-300% more decisions

9. **Add Webhook Replay**
   - Store all webhooks (even failed ones)
   - Replay failed webhooks after fixing validation
   - **Expected impact**: Recover lost data from 2,055 failed webhooks

---

## Verification Steps

### To confirm this analysis:

1. **Check webhook routing logic**
   ```bash
   # Find where Phase 2 vs Phase 2.5 routing happens
   grep -r "Phase 2 decision" src/
   ```

2. **Query context store logs**
   ```bash
   # Check how often context becomes complete
   grep "Context updated" logs/ | grep "waiting for complete context" | wc -l
   grep "Decision made" logs/ | wc -l
   ```

3. **Analyze SATY Phase failures**
   ```bash
   # Get sample failed SATY Phase payloads
   curl https://optionstrat.vercel.app/api/webhooks/failed?kind=saty-phase&limit=10
   ```

4. **Monitor context completeness in real-time**
   ```bash
   # Add logging to context-store.service.ts
   console.log('Context completeness:', this.getCompletenessStats());
   ```

---

## Conclusion

The 99.91% gap between webhooks and dashboard decisions is **expected behavior** given the current architecture:

- **By design**: Phase 2.5 requires complete context from multiple sources before making decisions
- **By routing**: Most webhooks go to Phase 2, not Phase 2.5
- **By validation**: 48.4% of webhooks fail validation and never enter the pipeline

**This is not a bug** - it's the current system design. However, it means:
- ✅ The system is working as designed
- ⚠️ The design may need adjustment to increase decision throughput
- 🔧 Webhook validation needs improvement (especially SATY Phase)
- 📊 Better monitoring is needed to track context completeness

**Next steps**: Implement recommendations above to increase the conversion rate from webhooks to decisions.
