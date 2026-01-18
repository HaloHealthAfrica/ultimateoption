# Phase 2.5 Gap Review and Fixes

## Summary of Gaps

### Gap 1: Webhook Routing (CRITICAL)
- **Claim:** Webhooks were routed to Phase 2, not Phase 2.5.
- **Status:** ✅ **Already fixed** via dual-write in core webhook endpoints.
- **Evidence:** `/api/webhooks/saty-phase`, `/api/webhooks/signals`, and `/api/webhooks/trend` all call the Phase 2.5 orchestrator in addition to Phase 2.

### Gap 2: Context Incompleteness (HIGH)
- **Claim:** Context completion rate too low.
- **Status:** 🟡 **Partially fixed**
  - ✅ **Extended timeout** default from 15 → 30 minutes (`PHASE25_CONTEXT_TIMEOUT_MINUTES` still supported).
  - ✅ **Added DB persistence** of latest context snapshot per symbol.
  - ⚠️ **Still needs** more source coverage and real‑world payload tuning to raise completion rate.

### Gap 3: High Webhook Failure Rate (MEDIUM)
- **Claim:** Validation failures are high, especially SATY.
- **Status:** 🟡 **Improved logging**
  - ✅ Phase 2.5 webhooks now include routing/error details in response and audit log message.
  - ⚠️ **Still needs** payload pattern analysis to refine adapters.

### Gap 4: No Context Visibility (MEDIUM)
- **Claim:** No way to see partial context.
- **Status:** ✅ **Fixed**
  - Added `GET /api/phase25/context/status` for completeness + latest snapshot.
  - Added `Phase25ContextStatus` panel to the Phase 2.5 dashboard.

### Gap 5: Engine Separation (LOW)
- **Claim:** Hard to distinguish Phase 2 vs Phase 2.5 on dashboard.
- **Status:** ✅ **Fixed**
  - Added `engine_version` filter support in `/api/decisions`.
  - Added engine badge display in Phase 2.5 Decision Card.
  - Added engine column + filter in Phase 2.5 History Table.

## Fixes Implemented

### 1) Context Timeout + Persistence
- **File:** `src/phase25/services/context-store.service.ts`
- Default timeout now 30 minutes (configurable).
- Context snapshots persisted via `phase25_context_snapshots` table.

### 2) Context Snapshot DB Utility
- **File:** `src/phase25/utils/contextDb.ts`
- `upsertPhase25ContextSnapshot(symbol, context)`
- `getLatestPhase25ContextSnapshot(symbol?)`

### 3) Context Status API
- **File:** `src/app/api/phase25/context/status/route.ts`
- Returns context completeness + latest snapshot.

### 4) Dashboard Context Panel
- **File:** `src/components/dashboard/Phase25ContextStatus.tsx`
- **Integrated in:** `src/app/page.tsx` (Phase 2.5 tab)

### 5) Enhanced Phase 2.5 Webhook Failure Logging
- **Files:** `src/app/api/phase25/webhooks/saty-phase/route.ts`, `src/app/api/phase25/webhooks/signals/route.ts`
- Added error detail summaries in audit logs and responses.

### 6) Engine Version Visibility + Filtering
- **Files:** `src/types/ledger.ts`, `src/ledger/ledger.ts`, `src/app/api/decisions/route.ts`
- **UI:** `src/components/dashboard/Phase25DecisionCard.tsx`, `Phase25HistoryTable.tsx`

## Open Items (Recommended)
- Analyze webhook failure patterns with real payloads to tune adapters.
- Consider persisting context history (not just latest) if debugging needs expand.
- Add metrics around context completeness rate over time.
