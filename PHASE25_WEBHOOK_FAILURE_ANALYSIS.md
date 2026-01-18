# Phase 2.5 Webhook Failure Analysis (last 200 receipts)

## Snapshot Summary
- Total receipts analyzed: 200
- Failed receipts: 27

## Failure Categories
1. **Wrong endpoint** (7)
   - All are `signals` receipts.
   - Message: "Wrong endpoint detected: This appears to be a saty-phase webhook..."
   - **Responsibility:** Indicator/webhook routing.
   - **Fix:** Send SATY payloads to `/api/webhooks/saty-phase` or `/api/phase25/webhooks/saty-phase`.

2. **Missing fields** (7)
   - All are `signals` receipts.
   - Message: "Missing required field: signal"
   - **Responsibility:** Indicator payload format.
   - **Fix:** Ensure `signal` object exists with required fields.

3. **Normalization failed** (12)
   - All are `signals` receipts.
   - Message: "Unable to construct signal from available fields. Need at least: ticker/symbol and trend/direction/type"
   - **Responsibility:** Indicator payload format.
   - **Fix:** Always include `ticker/symbol` and a direction (`signal.type` or `direction`/`trend`).

4. **Schema invalid** (1)
   - `saty-phase` receipt.
   - Message: "Invalid phase payload - tried adapted-flexible last"
   - **Responsibility:** Indicator payload format.
   - **Fix:** Use the SATY format in `PHASE25_WEBHOOK_SPEC_FOR_INDICATORS.md`.

## Webapp-side fixes applied
- Added text-wrapper JSON parsing for `/api/webhooks/signals` to tolerate TradingView “text” wrappers.
- Added detailed error summaries for Phase 2.5 webhooks (audit + response).
- Added context persistence + visibility to improve completeness debugging.

## What remains indicator-side
- Route SATY payloads to the correct endpoint.
- Ensure all signals include `signal.type`, `signal.aiScore` (or `ai_score`), and symbol.
- Include direction/trend fields when sending simplified payloads.
