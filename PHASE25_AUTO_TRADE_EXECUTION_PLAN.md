# Phase 2.5 Auto‑Trade Execution Plan

## Goal
Receive webhooks → build decision context → make decision → show on dashboard → auto‑trade (paper first, real later).

## Current State (What Works) ✅

### Phase 2.5 Paper Trading - COMPLETE
- ✅ Webhooks ingest and decision engine produce EXECUTE/WAIT/SKIP
- ✅ Decisions persist to ledger (in-memory, PostgreSQL migration pending)
- ✅ Phase 2.5 dashboard components (Decision Card, Breakdown, History)
- ✅ **Paper execution adapter** converts decisions to simulated fills
- ✅ **Paper exit simulator** deterministically closes positions (target/stop based on confidence)
- ✅ **Ledger integration** stores execution + exit data with full P&L attribution
- ✅ **Dashboard integration** displays paper performance metrics and trade history
- ✅ **Metrics API** exposes paper performance (overall, rolling, by DTE, streaks)

### Complete Flow (Working End-to-End)
```
Webhook → Decision Engine → EXECUTE
  ↓
Paper Execution Adapter (builds signal + decision inputs)
  ↓
executePaperTrade() (simulates fill with Greeks, slippage, spread)
  ↓
Store execution in ledger
  ↓
simulatePaperExit() (deterministic exit based on confidence)
  ↓
Update ledger with exit P&L attribution
  ↓
Dashboard displays trades + metrics
```

## What's Next

### A) Production Hardening (Required for Deployment)
1. **Database Migration**
   - Replace in-memory ledger with PostgreSQL
   - Persist across server restarts
   - Handle concurrent requests safely

2. **Error Recovery**
   - Graceful degradation when market feeds fail
   - Retry logic for ledger writes
   - Audit trail for failed executions

### C) Production Hardening
1. Replace `Math.random()` UUIDs in ledger.
2. Market feed error handling: ensure decisions still complete.
3. Observability: add logging/alerts for failed executions.

## Execution Plan

### Phase 1 — Stabilize Decision → Dashboard
1. Deploy the dashboard crash fix.
2. Verify: webhook → ledger → `/api/decisions` → Phase 2.5 UI render.

### Phase 2 — Paper Execution
1. Add `paper-executor.service.ts`
2. Add contract selection + pricing logic.
3. Simulate fills + commissions.
4. Write `execution` into ledger entries.

### Phase 3 — Position Tracking + Exits
1. Position monitor service (periodic update).
2. Exit simulator with rules (targets, stop, time, theta).
3. Ledger `exit` updates with P&L attribution.

### Phase 4 — Real Trade Integration (optional)
1. Broker client integration (Alpaca/Tradier).
2. Order placement + status reconciliation.
3. Hard safety limits + kill switch.

## Required File Additions (Proposed)
- `src/phase25/services/paper-executor.service.ts`
- `src/phase25/services/position-monitor.service.ts`
- `src/phase25/services/exit-simulator.service.ts`
- `src/phase25/utils/pnl-attribution.ts`
- `src/components/dashboard/OpenPositionsPanel.tsx` (optional)

## Verification Checklist
- [ ] Dashboard loads without crashes.
- [ ] EXECUTE decision creates a paper execution record in ledger.
- [ ] Open positions tracked and updated.
- [ ] Exit rules close positions and write `exit` data.
- [ ] Metrics and logs reflect execution events.

## Notes
- Start with paper trading; keep auto‑trade disabled for production until controls are in place.
- The Phase 2.6 roadmap already outlines most of these components—this plan aligns with it.
