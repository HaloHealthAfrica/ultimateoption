# Phase 2.5 Auto‑Trade Execution Plan

## Goal
Receive webhooks → build decision context → make decision → show on dashboard → auto‑trade (paper first, real later).

## Current State (What Works)
- Webhooks ingest and decision engine produce EXECUTE/WAIT/SKIP.
- Decisions persist to ledger (Postgres).
- Phase 2.5 dashboard components exist (Decision Card, Breakdown, History).

## Gaps to Close

### A) UI Reliability (Blocking)
1. **Overview dashboard crash**
   - Cause: `/api/decisions` returns ledger shape, overview expects `DecisionResult`.
   - Fix: Normalize ledger entry → `DecisionResult` (already implemented locally; needs deploy).

### B) Auto‑Trade Execution (Missing)
1. **Paper Executor Service**
   - Needed to convert EXECUTE decisions into simulated option trades.
   - Must write `execution` data back to ledger.

2. **Position Tracking**
   - Track open positions from ledger entries with `execution` but no `exit`.
   - Update P&L + Greeks periodically.

3. **Exit Simulation**
   - Trigger exits on targets/stops/time rules.
   - Write `exit` data to ledger and close positions.

4. **Risk Controls**
   - Max position size, daily loss cap, max open positions.
   - Kill switch + human‑approval flag for large trades.

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
