# Root Cause: Why Phase 2.5 Only Has 2 Decisions

**Date**: January 16, 2026  
**Status**: 🔴 IDENTIFIED

---

## The Problem

Despite receiving 4,243 webhooks today and implementing improvements (Priorities 1-6), Phase 2.5 dashboard still only shows **2 decisions**.

---

## Root Cause

### **Webhooks are going to Phase 2 endpoints, NOT Phase 2.5 endpoints!**

There are TWO separate sets of webhook endpoints:

```
Phase 2 Endpoints (receiving 99.9% of traffic):
  ✓ /api/webhooks/signals
  ✓ /api/webhooks/saty-phase  
  ✓ /api/webhooks/trend

Phase 2.5 Endpoints (receiving 0.1% of traffic):
  ✗ /api/phase25/webhooks/signals
  ✗ /api/phase25/webhooks/saty-phase
```

**TradingView alerts are configured to send to Phase 2 endpoints**, so Phase 2.5 never receives the webhooks!

---

## Why Our Improvements Didn't Help

Priorities 1-6 improved **Phase 2 webhook endpoints**:
- ✅ Better signal adapter
- ✅ Better SATY adapter
- ✅ Endpoint detection
- ✅ Longer timeout
- ✅ Better error messages
- ✅ Validation endpoint

But Phase 2.5 has **separate endpoints** that aren't receiving traffic!

---

## The Fix

### Option 1: Update TradingView Alert URLs (Clean)

Change webhook URLs in TradingView:
```
OLD: https://yourdomain.com/api/webhooks/signals
NEW: https://yourdomain.com/api/phase25/webhooks/signals
```

**Impact**: Phase 2.5 will receive all webhooks

---

### Option 2: Dual-Write (Quick Fix)

Modify Phase 2 endpoints to also send to Phase 2.5:

```typescript
// In /api/webhooks/signals/route.ts
// After Phase 2 processing, also send to Phase 2.5
const orchestrator = factory.getOrchestrator();
await orchestrator.processWebhook(body);
```

**Impact**: Both systems receive webhooks without config changes

---

### Recommended: Hybrid Approach

1. **Now**: Implement dual-write (Option 2) - 1 hour
2. **Later**: Update TradingView alerts (Option 1) - 30 min
3. **Finally**: Remove dual-write once migration complete

---

## Expected Results

**Before Fix**:
- Phase 2.5 decisions: 2
- Webhooks to Phase 2.5: ~0.1%

**After Fix**:
- Phase 2.5 decisions: 1,000+
- Webhooks to Phase 2.5: 100%

---

## Next Steps

1. Run diagnostic: `node diagnose-phase25-routing.js`
2. Confirm routing issue
3. Implement dual-write fix
4. Monitor Phase 2.5 dashboard
5. Update TradingView alerts
6. Remove dual-write

---

## Files to Check

- `src/app/api/webhooks/signals/route.ts` - Phase 2 signals
- `src/app/api/phase25/webhooks/signals/route.ts` - Phase 2.5 signals
- `src/app/api/webhooks/saty-phase/route.ts` - Phase 2 SATY
- `src/app/api/phase25/webhooks/saty-phase/route.ts` - Phase 2.5 SATY

See `PHASE25_ROUTING_ISSUE_ANALYSIS.md` for full details.
