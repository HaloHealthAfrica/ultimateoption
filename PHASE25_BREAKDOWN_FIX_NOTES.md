# Phase 2.5 Breakdown Hydration Fix Notes

## What changed
- Wrapped `Phase25BreakdownPanel` in a local error boundary to prevent a hydration-time crash from taking down the whole card.
- Moved the actual rendering logic into `Phase25BreakdownPanelInner`.
- Replaced the inline `safeBreakdown` object creation with a `useMemo` guard that:
  - Returns `null` when `breakdown` is falsy or not an object.
  - Builds a fully defaulted object only when `breakdown` is valid.
  - Falls back to a safe default object if anything unexpected happens during creation.

## Why this fixes the crash
- On refresh/hydration, `breakdown` can briefly be `undefined` or otherwise invalid.
- The memoized guard ensures we never dereference properties until `breakdown` is confirmed safe.
- The error boundary catches any render-time exception that could still slip through due to hydration races.

## Files touched
- `src/components/dashboard/Phase25BreakdownPanel.tsx`

## How to verify
- Open the dashboard, go to the Phase 2.5 tab.
- Hard refresh several times and confirm no console error for `confluence_multiplier`.
- Verify the fallback UI appears if data is missing.
