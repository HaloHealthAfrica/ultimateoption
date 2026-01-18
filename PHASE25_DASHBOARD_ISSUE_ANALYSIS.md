# Phase 2.5 Dashboard Issue - Root Cause Analysis

**Date**: January 18, 2026  
**Status**: 🔴 CRITICAL BUG FOUND  
**Impact**: Phase 2.5 decisions are NOT being stored in database

---

## Problem Summary

Webhooks are being processed successfully by Phase 2.5, but:
- ❌ No decisions are being made
- ❌ No data is being stored in the database  
- ❌ Dashboard shows 0 decisions
- ⚠️  All webhooks return "waiting for complete context"

---

## Root Cause

**Configuration Mismatch in Context Store**

### The Bug

File: `src/phase25/services/context-store.service.ts` (Line 31)

```typescript
this.completenessRules = {
  requiredSources: ['SATY_PHASE'], // ❌ HARDCODED - WRONG!
  optionalSources: ['MTF_DOTS', 'STRAT_EXEC', 'ULTIMATE_OPTIONS', 'TRADINGVIEW_SIGNAL'],
  maxAge,
  ...completenessRules
};
```

### What It Should Be

File: `src/phase25/config/engine.config.ts` (Line 60)

```typescript
contextRules: {
  maxAge: 300000, // 5 minutes
  requiredSources: ['TRADINGVIEW_SIGNAL'] as WebhookSource[], // ✅ CORRECT
  optionalSources: ['SATY_PHASE', 'MTF_DOTS', 'ULTIMATE_OPTIONS', 'STRAT_EXEC']
}
```

### The Impact

1. **Context Store** expects `SATY_PHASE` to be required
2. **Engine Config** says `TRADINGVIEW_SIGNAL` is required
3. When we send a `TRADINGVIEW_SIGNAL` webhook:
   - It updates context successfully
   - But `isComplete()` returns `false` because it's waiting for `SATY_PHASE`
   - No decision is made
   - Nothing is stored in database

---

## Test Results

### Test 1: Send SATY Phase Webhook
```bash
POST /api/phase25/webhooks/saty-phase
```
**Result**: ✅ HTTP 200
**Message**: "Context updated from SATY_PHASE, waiting for complete context"

### Test 2: Send Signal Webhook  
```bash
POST /api/phase25/webhooks/signals
```
**Result**: ✅ HTTP 200
**Message**: "Context updated from TRADINGVIEW_SIGNAL, waiting for complete context"

### Test 3: Check Database
```bash
GET /api/decisions
```
**Result**: ❌ 0 decisions found

---

## Why This Happens

The `isComplete()` method checks:

```typescript
// Check if all required sources have provided data
for (const requiredSource of this.completenessRules.requiredSources) {
  const lastUpdate = this.context.lastUpdated[requiredSource];
  
  if (!lastUpdate) {
    return false; // ❌ Missing required source
  }
}
```

Since `requiredSources` is hardcoded to `['SATY_PHASE']`:
- Sending only `TRADINGVIEW_SIGNAL` → `isComplete()` returns `false`
- Sending only `SATY_PHASE` → `isComplete()` returns `false` (needs expert source)
- Need to send **BOTH** → Then it works

But the config says only `TRADINGVIEW_SIGNAL` is required!

---

## The Fix

### Option 1: Use Config (Recommended)

Update `context-store.service.ts` line 31:

```typescript
// BEFORE (WRONG)
this.completenessRules = {
  requiredSources: ['SATY_PHASE'],
  optionalSources: ['MTF_DOTS', 'STRAT_EXEC', 'ULTIMATE_OPTIONS', 'TRADINGVIEW_SIGNAL'],
  maxAge,
  ...completenessRules
};

// AFTER (CORRECT)
this.completenessRules = {
  requiredSources: completenessRules?.requiredSources || ['TRADINGVIEW_SIGNAL'],
  optionalSources: completenessRules?.optionalSources || ['SATY_PHASE', 'MTF_DOTS', 'ULTIMATE_OPTIONS', 'STRAT_EXEC'],
  maxAge,
};
```

### Option 2: Update Config

If SATY_PHASE really is required, update `engine.config.ts`:

```typescript
contextRules: {
  maxAge: 300000,
  requiredSources: ['SATY_PHASE', 'TRADINGVIEW_SIGNAL'], // Both required
  optionalSources: ['MTF_DOTS', 'ULTIMATE_OPTIONS', 'STRAT_EXEC']
}
```

---

## Additional Issues Found

### Issue 2: Expert Source Check

File: `src/phase25/services/context-store.service.ts` (Lines 147-151)

```typescript
// Check if we have at least one expert source
const expertSources: WebhookSource[] = ['ULTIMATE_OPTIONS', 'TRADINGVIEW_SIGNAL'];
const hasValidExpertSource = expertSources.some(source => {
  const lastUpdate = this.context.lastUpdated[source];
  return lastUpdate && (now - lastUpdate <= this.completenessRules.maxAge);
});
```

This is **ALSO** checking for expert sources, which is good, but it's redundant with the `requiredSources` check.

### Issue 3: Expert Field Check

Line 163:
```typescript
const hasRequiredExpert = !!this.context.expert;
```

This checks if `context.expert` exists, which is populated by `TRADINGVIEW_SIGNAL` or `ULTIMATE_OPTIONS`.

---

## Testing the Fix

### Before Fix
```bash
# Send signal webhook
curl -X POST http://localhost:3000/api/phase25/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{"signal":{"type":"LONG"},"instrument":{"ticker":"SPY"}}'

# Response: "waiting for complete context"
# Database: 0 decisions
```

### After Fix
```bash
# Send signal webhook
curl -X POST http://localhost:3000/api/phase25/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{"signal":{"type":"LONG"},"instrument":{"ticker":"SPY"}}'

# Response: "Decision made: EXECUTE (confidence: 85)"
# Database: 1 decision added
```

---

## Recommended Action

1. **Fix the hardcoded requiredSources** in `context-store.service.ts`
2. **Use the config values** from `engine.config.ts`
3. **Test with single webhook** (should work with just TRADINGVIEW_SIGNAL)
4. **Deploy to production**

---

## Files to Modify

1. `src/phase25/services/context-store.service.ts`
   - Line 31: Remove hardcoded requiredSources
   - Use completenessRules parameter instead

---

## Expected Behavior After Fix

✅ Send `TRADINGVIEW_SIGNAL` webhook → Decision made → Stored in database  
✅ Send `SATY_PHASE` + `TRADINGVIEW_SIGNAL` → Decision made with full context  
✅ Dashboard shows Phase 2.5 decisions  
✅ Ledger storage works correctly

---

## Current Workaround

Until the fix is deployed, you must send **BOTH** webhooks:

```bash
# 1. Send SATY Phase first
curl -X POST http://localhost:3000/api/phase25/webhooks/saty-phase \
  -H "Content-Type: application/json" \
  -d '{"meta":{"engine":"SATY_PO"},"instrument":{"symbol":"SPY"},...}'

# 2. Then send Signal (triggers decision)
curl -X POST http://localhost:3000/api/phase25/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{"signal":{"type":"LONG"},"instrument":{"ticker":"SPY"},...}'
```

---

## Priority

🔴 **CRITICAL** - This blocks all Phase 2.5 functionality

**Estimated Fix Time**: 5 minutes (change 1 line of code)  
**Testing Time**: 5 minutes  
**Total**: 10 minutes

---

## Status

- ✅ Root cause identified
- ✅ Fix documented
- ❌ Fix not yet applied
- ❌ Not yet tested
- ❌ Not yet deployed

**Next Step**: Apply the fix to `context-store.service.ts`
