# Phase 2.5 Quick Start Guide

## TL;DR

Phase 2.5 webhook endpoints are live at `/api/phase25/webhooks/*`. They process webhooks through a multi-source decision orchestrator that aggregates data from 5 sources before making trading decisions.

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/phase25/webhooks/signals` | POST | TradingView signals |
| `/api/phase25/webhooks/saty-phase` | POST | SATY phase data |
| `/api/phase25/webhooks/health` | GET | Basic health check |
| `/api/phase25/webhooks/health/detailed` | GET | Detailed health + metrics |
| `/api/phase25/webhooks/metrics` | GET | System metrics |

## Quick Test

```bash
# Start dev server
npm run dev

# Test signal webhook
curl -X POST http://localhost:3000/api/phase25/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{"signal":{"type":"LONG","timeframe":"15","quality":"EXTREME","ai_score":9.2},"instrument":{"ticker":"SPY","exchange":"NASDAQ","current_price":450.25}}'

# Check health
curl http://localhost:3000/api/phase25/webhooks/health

# Run automated tests
node test-phase25-webhooks.js
```

## How It Works

1. **Webhook arrives** → Next.js API route receives it
2. **Source detection** → Router identifies webhook source (TradingView, SATY, etc.)
3. **Normalization** → Converts to canonical DecisionContext format
4. **Context aggregation** → Stores data from each source
5. **Completeness check** → Waits for all required sources
6. **Market context** → Fetches data from Tradier, TwelveData, Alpaca (parallel)
7. **Decision engine** → Applies deterministic rules
8. **Audit logging** → Records complete decision trail
9. **Response** → Returns decision packet or context status

## Multi-Source Flow

Phase 2.5 aggregates data from multiple sources:

```
SATY Phase Webhook → Updates regime section
Signal Webhook → Updates expert section
MTF Dots Webhook → Updates alignment section
STRAT Webhook → Updates structure section
Ultimate Options → Updates expert section

When complete → Decision Engine runs → Decision made
```

## Response Types

### Context Building (Waiting for More Data)
```json
{
  "success": true,
  "message": "Context updated from SATY_PHASE, waiting for complete context",
  "processingTime": 12
}
```

### Decision Made
```json
{
  "success": true,
  "decision": {
    "action": "EXECUTE",
    "direction": "LONG",
    "finalSizeMultiplier": 1.5,
    "confidenceScore": 82,
    "reasons": ["High AI score", "Phase alignment"]
  },
  "message": "Decision made: EXECUTE (confidence: 82)",
  "processingTime": 245
}
```

## Key Differences from Phase 2

| Feature | Phase 2 | Phase 2.5 |
|---------|---------|-----------|
| Endpoints | `/api/webhooks/*` | `/api/phase25/webhooks/*` |
| Processing | Immediate | Multi-source aggregation |
| Sources | 1 (TradingView) | 5 (TradingView, SATY, MTF, UO, STRAT) |
| Market Data | Sequential | Parallel |
| Metrics | None | Full metrics |

## Files

- **Routes**: `src/app/api/phase25/webhooks/*/route.ts`
- **Orchestrator**: `src/phase25/services/decision-orchestrator.service.ts`
- **Factory**: `src/phase25/services/service-factory.ts`
- **Tests**: `test-phase25-webhooks.js`
- **Docs**: `PHASE25_WEBHOOK_INTEGRATION.md`

## Monitoring

Check these endpoints:
- Health: `GET /api/phase25/webhooks/health`
- Detailed: `GET /api/phase25/webhooks/health/detailed`
- Metrics: `GET /api/phase25/webhooks/metrics`

## Next Steps

1. Run `node test-phase25-webhooks.js` to validate setup
2. Send test webhooks to Phase 2.5 endpoints
3. Monitor metrics and health endpoints
4. Compare with Phase 2 decisions
5. Gradually migrate production traffic

## Documentation

- `PHASE25_WEBHOOK_INTEGRATION.md` - Complete guide
- `PHASE25_INTEGRATION_COMPLETE.md` - Integration summary
- `.kiro/specs/decision-engine-phase25/design.md` - Architecture

---

**Ready to use!** 🚀
