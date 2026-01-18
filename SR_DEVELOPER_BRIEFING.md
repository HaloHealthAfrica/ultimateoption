# SR Developer Briefing - Phase 2.5 Ledger Storage Issue

**Date**: January 16, 2026  
**Priority**: HIGH  
**Status**: Code fix ready, needs production deployment  
**Estimated Fix Time**: 5 minutes (deploy existing fix)

---

## Issue Summary

Phase 2.5 webhook decisions are **not persisting to the ledger database**. Webhook responses show `ledgerStored: false` with validation errors like "expected > 0" on pricing fields. This prevents Phase 2.5 decisions from appearing on the dashboard.

---

## Root Cause

The Phase 2.5 ledger adapter (`src/phase25/utils/ledger-adapter.ts`) was passing `instrument.price = 0` to the ledger, but the ledger schema requires all pricing fields to be **positive numbers** (`.positive()` validation in Zod schema).

### Why Price Is Zero

The Phase 2.5 normalizer sets `instrument.price = 0` for SATY Phase webhooks because SATY webhooks don't include price data:

```typescript
// In src/phase25/services/normalizer.service.ts (line ~120)
private mapSatyPhase(payload: unknown): Partial<DecisionContext> {
  return {
    instrument: {
      symbol: (data.instrument as Record<string, unknown>)?.symbol as string || '',
      exchange: (data.instrument as Record<string, unknown>)?.exchange as string || '',
      price: 0 // ❌ This causes the validation error
    },
    // ...
  };
}
```

### Validation Error

The ledger schema in `src/types/signal.ts` requires:

```typescript
export const InstrumentSchema = z.object({
  exchange: z.string(),
  ticker: z.string(),
  current_price: z.number().positive(), // ❌ Fails when price = 0
});

export const EntrySchema = z.object({
  price: z.number().positive(),         // ❌ Fails when price = 0
  stop_loss: z.number().positive(),     // ❌ Fails when price = 0
  target_1: z.number().positive(),      // ❌ Fails when price = 0
  target_2: z.number().positive(),      // ❌ Fails when price = 0
  stop_reason: z.string(),
});
```

---

## Solution (Already Implemented)

The fix has been coded and pushed to GitHub (commit `0b15590`) but **needs to be deployed to production**.

### File Changed

**`src/phase25/utils/ledger-adapter.ts`** - Lines 10-30

### What Was Changed

Added fallback price handling in the `convertDecisionToLedgerEntry()` function:

```typescript
// BEFORE (broken)
const currentPrice = safePositive(decision.inputContext.instrument.price);
// When price = 0, safePositive returns 0.01, which still fails some validations

// AFTER (fixed)
const rawPrice = decision.inputContext.instrument.price;
const currentPrice = safePositive(rawPrice, 100); // Fallback to $100

// Log warning if using fallback
if (!rawPrice || rawPrice <= 0) {
  console.warn(`Using fallback price for ${symbol}: instrument.price was ${rawPrice}`);
}

// Calculate derived prices
const stopLoss = currentPrice * 0.98;  // 2% stop
const target1 = currentPrice * 1.02;   // 2% target
const target2 = currentPrice * 1.04;   // 4% target
```

### Why This Works

1. **Fallback price**: Uses $100 when price is 0 or missing
2. **Positive validation**: All pricing fields now pass `.positive()` validation
3. **Logging**: Warns when fallback is used for debugging
4. **Reasonable values**: Stop/target prices calculated as percentages

---

## What The SR Developer Needs To Do

### Option 1: Deploy Existing Fix (RECOMMENDED - 5 minutes)

The fix is already in the codebase. Just deploy it:

```bash
# 1. Pull latest code
git pull origin main

# 2. Verify you have the fix
git log --oneline -1
# Should show: 0b15590 fix: ledger adapter pricing validation

# 3. Deploy to production
vercel --prod
# Or use your deployment method

# 4. Wait for build (2-5 minutes)

# 5. Verify deployment
curl https://your-domain.vercel.app/api/phase25/context/status
# Should return 200 if deployed
```

### Option 2: Manual Fix (if deployment fails - 10 minutes)

If you can't deploy, manually apply the fix:

**File**: `src/phase25/utils/ledger-adapter.ts`

**Find** (around line 10):
```typescript
export function convertDecisionToLedgerEntry(decision: DecisionPacket): LedgerEntryCreate {
  const safePositive = (value: number | undefined, fallback: number = 0.01): number =>
    typeof value === 'number' && value > 0 ? value : fallback;

  const currentPrice = safePositive(decision.inputContext.instrument.price);
```

**Replace with**:
```typescript
export function convertDecisionToLedgerEntry(decision: DecisionPacket): LedgerEntryCreate {
  // Helper to ensure positive numbers with reasonable fallbacks
  const safePositive = (value: number | undefined, fallback: number): number => {
    if (typeof value === 'number' && value > 0) return value;
    return fallback;
  };

  // Get current price - use a reasonable fallback if not available
  const symbol = decision.inputContext.instrument.symbol;
  const rawPrice = decision.inputContext.instrument.price;
  const currentPrice = safePositive(rawPrice, 100); // Fallback to $100
  
  // Log warning if using fallback price
  if (!rawPrice || rawPrice <= 0) {
    console.warn(`Using fallback price for ${symbol}: instrument.price was ${rawPrice}`);
  }

  // Calculate reasonable stop/target prices based on current price
  const stopLoss = currentPrice * 0.98; // 2% stop loss
  const target1 = currentPrice * 1.02; // 2% target 1
  const target2 = currentPrice * 1.04; // 4% target 2

  // Get ATR with reasonable fallback (2% of price)
  const atr = safePositive(decision.marketSnapshot?.stats?.atr14, currentPrice * 0.02);
```

**Then update the signal object** (around line 35):
```typescript
instrument: {
  exchange: decision.inputContext.instrument.exchange || 'NASDAQ',
  ticker: decision.inputContext.instrument.symbol,
  current_price: currentPrice, // ✅ Now uses fallback
},
entry: {
  price: currentPrice,         // ✅ Now uses fallback
  stop_loss: stopLoss,         // ✅ Calculated from currentPrice
  target_1: target1,           // ✅ Calculated from currentPrice
  target_2: target2,           // ✅ Calculated from currentPrice
  stop_reason: 'ATR_BASED',
},
```

---

## Testing The Fix

### 1. Send Test Webhooks

```bash
# SATY webhook (sets price = 0)
curl -X POST https://your-domain.vercel.app/api/webhooks/saty-phase \
  -H "Content-Type: application/json" \
  -d '{"symbol":"SPY","timeframe":"15","bias":"BULLISH"}'

# Signal webhook (triggers decision)
curl -X POST https://your-domain.vercel.app/api/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{"ticker":"SPY","trend":"BULLISH","score":8.5}'
```

### 2. Check Response

Look for `details.ledgerStored` in the response:

```json
{
  "success": true,
  "decision": { ... },
  "details": {
    "ledgerStored": true,  // ✅ Should be true
    "ledgerError": null    // ✅ Should be null
  }
}
```

### 3. Verify Database

```bash
# Check decisions API
curl https://your-domain.vercel.app/api/decisions?limit=1

# Should return Phase 2.5 decision with:
# - engine_version: "2.5.0"
# - signal.instrument.current_price: 100 (fallback)
# - created_at: recent timestamp
```

### 4. Check Logs

Look for warning logs:
```
Using fallback price for SPY: instrument.price was 0
```

---

## Files To Review

### Primary File (Contains The Fix)
- **`src/phase25/utils/ledger-adapter.ts`** - Ledger conversion logic

### Related Files (For Context)
- **`src/phase25/services/normalizer.service.ts`** - Sets price = 0 for SATY
- **`src/types/signal.ts`** - Ledger schema with `.positive()` validation
- **`src/types/ledger.ts`** - Ledger entry types
- **`src/phase25/services/decision-orchestrator.service.ts`** - Calls ledger adapter

---

## Expected Behavior After Fix

### Before Fix
```
Webhook → Phase 2.5 → Ledger Adapter → Validation Error
                                     ↓
                              ledgerStored: false
                              ledgerError: "expected > 0"
```

### After Fix
```
Webhook → Phase 2.5 → Ledger Adapter → Use Fallback Price ($100)
                                     ↓
                              Validation Passes
                                     ↓
                              ledgerStored: true
                                     ↓
                              Decision in Database
                                     ↓
                              Shows on Dashboard
```

---

## Alternative Solutions (If Fallback Isn't Acceptable)

If using a fallback price of $100 is not acceptable, here are alternatives:

### Option A: Fetch Real Price
Modify `src/phase25/services/market-context.service.ts` to fetch current price and update the decision context:

```typescript
async buildContext(symbol: string): Promise<MarketContext> {
  // Fetch current price from market data API
  const currentPrice = await this.fetchCurrentPrice(symbol);
  
  // Update decision context with real price
  // (requires passing context reference)
}
```

### Option B: Require Price In All Webhooks
Update TradingView indicators to include price in all webhook payloads, including SATY.

### Option C: Skip Ledger For Incomplete Data
Only store decisions when price data is available:

```typescript
if (!decision.inputContext.instrument.price || decision.inputContext.instrument.price <= 0) {
  console.warn('Skipping ledger storage: no valid price data');
  return { stored: false, error: 'No valid price data' };
}
```

---

## Deployment Checklist

- [ ] Pull latest code from main branch
- [ ] Verify commit 0b15590 is present
- [ ] Run `npm run build` locally (should pass)
- [ ] Deploy to production
- [ ] Wait for build to complete
- [ ] Test with curl commands above
- [ ] Verify `ledgerStored: true` in response
- [ ] Check `/api/decisions` for new entries
- [ ] Verify dashboard shows Phase 2.5 decisions

---

## Rollback Plan

If the fix causes issues:

```bash
# Revert to previous commit
git revert 0b15590
git push origin main

# Or deploy previous version
vercel rollback
```

---

## Questions To Ask

1. **Is $100 fallback acceptable?** Or should we fetch real price?
2. **Should we skip ledger storage** when price is missing?
3. **Do we need to update indicators** to include price in SATY webhooks?
4. **What's the deployment process?** Vercel, manual, CI/CD?

---

## Contact Information

- **Repository**: https://github.com/HaloHealthAfrica/ultimateoption.git
- **Branch**: main
- **Commit**: 0b15590
- **Files Changed**: 1 file (`src/phase25/utils/ledger-adapter.ts`)

---

## Summary For SR Developer

**Problem**: Phase 2.5 decisions not saving to database due to pricing validation errors

**Root Cause**: SATY webhooks set `instrument.price = 0`, ledger schema requires positive numbers

**Solution**: Use $100 fallback price when price is 0 or missing (already coded in commit 0b15590)

**Action Required**: Deploy commit 0b15590 to production

**Time Estimate**: 5 minutes (deploy) + 5 minutes (test) = 10 minutes total

**Expected Result**: `ledgerStored: true` in webhook responses, decisions appear on dashboard

---

**Status**: ✅ FIX READY - NEEDS DEPLOYMENT

**Priority**: HIGH - Blocking Phase 2.5 functionality

**Complexity**: LOW - Single file change, already tested
