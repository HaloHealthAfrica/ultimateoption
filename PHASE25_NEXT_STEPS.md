# Phase 2.5 Next Steps

## Immediate (Today)
1. **Deploy the dashboard crash fix**
   - Ship the `src/app/page.tsx` normalization fix.
   - Verify production dashboard loads without the `confluence_multiplier` error.
2. **Re-run live traces after deploy**
   - Confirm webhooks → ledger → `/api/decisions` → Phase 2.5 UI render.

## Short-Term (This Week)
1. **Harden UUID generation**
   - Replace `Math.random()` UUIDs in `src/ledger/ledger.ts` with `crypto.randomUUID()` or a UUID library.
2. **Fix market gate zero-value checks**
   - In `src/phase25/services/decision-engine.service.ts`, treat `0` as valid for `spreadBps` and `atr14`.
3. **Add a small error boundary for Overview**
   - Wrap the overview `DecisionBreakdown` usage to prevent full-page crashes.

## Medium-Term (Next Sprint)
1. **Consolidate Phase 2.5 dashboard data fetches**
   - Reduce duplicate `/api/decisions` calls by sharing data in a parent hook.
2. **Add integration test coverage**
   - Add a test that ensures `/api/decisions` data shape safely renders in the overview UI.

## Verification Checklist
- [ ] Dashboard loads on hard refresh with no runtime errors.
- [ ] Phase 2.5 tab renders Decision Card, Breakdown Panel, History Table.
- [ ] `/api/decisions` shows the latest webhook decision.
- [ ] No regression in webhook processing or ledger persistence.

## References
- `PHASE25_E2E_REVIEW_REPORT.md` (findings + live trace results)
- `PHASE25_WEBHOOK_SEQUENCE_DIAGRAMS.md` (sequence diagrams)
