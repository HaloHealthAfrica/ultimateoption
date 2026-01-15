# Phase 2.5 Webhook Integration

## Overview

Phase 2.5 webhook endpoints are now fully integrated with the Next.js application. The system processes webhooks through the DecisionOrchestratorService, which coordinates all Phase 2.5 services for multi-source decision making.

## Architecture

```
Webhook Request
    ↓
Next.js API Route (/api/phase25/webhooks/*)
    ↓
ServiceFactory (singleton)
    ↓
DecisionOrchestratorService
    ↓
┌─────────────────────────────────────────┐
│  Source Router → Normalizer             │
│  Context Store (multi-source)           │
│  Market Context Builder (parallel)      │
│  Decision Engine (deterministic)        │
│  Audit Logger                           │
└─────────────────────────────────────────┘
    ↓
Decision Packet + Audit Trail
```

## Endpoints

### 1. Signal Webhook
**Endpoint**: `POST /api/phase25/webhooks/signals`

Receives TradingView signals and other signal sources (Ultimate Options, etc.).

**Request**:
```json
{
  "signal": {
    "type": "LONG",
    "timeframe": "15",
    "quality": "EXTREME",
    "ai_score": 9.2
  },
  "instrument": {
    "ticker": "SPY",
    "exchange": "NASDAQ",
    "current_price": 450.25
  },
  "risk": {
    "rr_ratio_t1": 3.5
  }
}
```

**Response**:
```json
{
  "success": true,
  "decision": {
    "action": "EXECUTE",
    "direction": "LONG",
    "finalSizeMultiplier": 1.5,
    "confidenceScore": 82,
    "reasons": ["High AI score", "Phase alignment"],
    "engineVersion": "2.5.0",
    "timestamp": 1705234567890
  },
  "message": "Decision made: EXECUTE (confidence: 82)",
  "processingTime": 245,
  "engineVersion": "2.5.0",
  "requestId": "req_1705234567890_abc123",
  "timestamp": 1705234567890
}
```

### 2. SATY Phase Webhook
**Endpoint**: `POST /api/phase25/webhooks/saty-phase`

Receives SATY phase data for regime analysis.

**Request**:
```json
{
  "meta": {
    "engine": "SATY_PO",
    "version": "1.0"
  },
  "instrument": {
    "symbol": "SPY",
    "exchange": "NASDAQ"
  },
  "phase": {
    "current_phase": 2,
    "phase_name": "MARKUP",
    "volatility_regime": "NORMAL"
  },
  "confidence": {
    "confidence_score": 85
  },
  "execution_guidance": {
    "trade_allowed": true,
    "bias": "LONG"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Context updated from SATY_PHASE, waiting for complete context",
  "processingTime": 12,
  "engineVersion": "2.5.0",
  "requestId": "req_1705234567890_xyz789",
  "timestamp": 1705234567890
}
```

### 3. Health Check
**Endpoint**: `GET /api/phase25/webhooks/health`

Basic health check for monitoring.

**Response**:
```json
{
  "status": "healthy",
  "engine": "Phase 2.5 Decision Engine",
  "version": "2.5.0",
  "timestamp": 1705234567890,
  "uptime": 3600.5
}
```

### 4. Detailed Health Check
**Endpoint**: `GET /api/phase25/webhooks/health/detailed`

Comprehensive health status with metrics.

**Response**:
```json
{
  "status": "healthy",
  "score": 95,
  "issues": [],
  "details": {
    "orchestrator": true,
    "contextStore": true,
    "marketFeeds": true,
    "decisionEngine": true,
    "configuration": true
  },
  "metrics": {
    "decisions": {
      "total": 1250,
      "execute": 450,
      "wait": 300,
      "skip": 500
    },
    "performance": {
      "avgProcessingTime": 245,
      "p95ProcessingTime": 450,
      "p99ProcessingTime": 680
    },
    "system": {
      "uptime": 3600.5,
      "memoryUsage": 125000000
    }
  },
  "engine": "Phase 2.5 Decision Engine",
  "version": "2.5.0",
  "uptime": 3600.5,
  "timestamp": 1705234567890
}
```

### 5. Metrics
**Endpoint**: `GET /api/phase25/webhooks/metrics`

System metrics and performance data.

**Response**:
```json
{
  "success": true,
  "decisions": {
    "total": 1250,
    "byAction": {
      "EXECUTE": 450,
      "WAIT": 300,
      "SKIP": 500
    },
    "avgConfidence": 72.5
  },
  "performance": {
    "avgProcessingTime": 245,
    "p95ProcessingTime": 450,
    "p99ProcessingTime": 680,
    "requestsPerMinute": 12.5
  },
  "system": {
    "uptime": 3600.5,
    "memoryUsage": 125000000,
    "contextUpdates": 2500
  },
  "engine": "Phase 2.5 Decision Engine",
  "version": "2.5.0",
  "timestamp": 1705234567890
}
```

## Processing Flow

### Multi-Source Context Building

Phase 2.5 uses a Context Store to aggregate data from multiple webhook sources before making decisions:

1. **Signal Webhook** → Updates `expert` section in Context Store
2. **SATY Phase Webhook** → Updates `regime` section in Context Store
3. **MTF Dots Webhook** → Updates `alignment` section in Context Store
4. **STRAT Webhook** → Updates `structure` section in Context Store

When all required sources have provided data, the Context Store builds a complete DecisionContext and triggers the decision pipeline.

### Decision Pipeline

```
1. Source Router
   ↓ Detects webhook source
   
2. Normalizer
   ↓ Converts to canonical format
   
3. Context Store
   ↓ Aggregates multi-source data
   
4. Market Context Builder (parallel)
   ├─ Tradier API (options data)
   ├─ TwelveData API (market stats)
   └─ Alpaca API (liquidity)
   ↓
   
5. Decision Engine
   ├─ Regime Gate
   ├─ Structural Gate
   ├─ Market Gates
   ├─ Confidence Calculation
   └─ Size Calculation
   ↓
   
6. Audit Logger
   ↓ Records complete decision trail
   
7. Conditional Forwarding
   └─ EXECUTE → Paper Trading (if enabled)
```

## Key Features

### 1. Multi-Source Aggregation
- Context Store maintains latest data from each webhook source
- Decisions only made when complete context is available
- Partial updates stored until all required sources provide data

### 2. Deterministic Decision Making
- Same inputs always produce same outputs
- All rules frozen and versioned
- Complete audit trail for reproducibility

### 3. Parallel Market Context Fetching
- All market data APIs called concurrently
- Timeout protection (600ms per API)
- Graceful degradation with fallback values

### 4. Comprehensive Audit Trail
- Every webhook receipt logged
- Complete decision context captured
- Market snapshots preserved
- Processing times tracked

### 5. Health Monitoring
- Basic health check for uptime monitoring
- Detailed health with component status
- Metrics endpoint for performance analysis

## Configuration

Phase 2.5 uses the ServiceFactory singleton pattern for dependency injection:

```typescript
import { ServiceFactory } from '@/phase25/services/service-factory';

// Get or create orchestrator
const factory = ServiceFactory.getInstance();
const orchestrator = factory.getOrchestrator() || factory.createOrchestrator(false);

// Process webhook
const result = await orchestrator.processWebhook(payload);
```

### Decision-Only Mode

To run Phase 2.5 without forwarding to paper trading:

```typescript
const orchestrator = factory.createOrchestrator(true); // decision-only mode
```

## Testing

### Test Signal Webhook

```bash
curl -X POST http://localhost:3000/api/phase25/webhooks/signals \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "type": "LONG",
      "timeframe": "15",
      "quality": "EXTREME",
      "ai_score": 9.2
    },
    "instrument": {
      "ticker": "SPY",
      "exchange": "NASDAQ",
      "current_price": 450.25
    }
  }'
```

### Test SATY Phase Webhook

```bash
curl -X POST http://localhost:3000/api/phase25/webhooks/saty-phase \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {
      "engine": "SATY_PO"
    },
    "instrument": {
      "symbol": "SPY"
    },
    "phase": {
      "current_phase": 2,
      "phase_name": "MARKUP"
    },
    "confidence": {
      "confidence_score": 85
    }
  }'
```

### Check Health

```bash
curl http://localhost:3000/api/phase25/webhooks/health
curl http://localhost:3000/api/phase25/webhooks/health/detailed
curl http://localhost:3000/api/phase25/webhooks/metrics
```

## Comparison: Phase 2 vs Phase 2.5

| Feature | Phase 2 | Phase 2.5 |
|---------|---------|-----------|
| **Webhook Sources** | Single (TradingView) | Multiple (5 sources) |
| **Context Building** | Immediate | Multi-source aggregation |
| **Market Context** | Sequential API calls | Parallel API calls |
| **Decision Logic** | Embedded in route | Separate Decision Engine |
| **Audit Trail** | Basic logging | Comprehensive audit |
| **Metrics** | None | Full metrics system |
| **Health Checks** | None | Basic + Detailed |
| **Endpoints** | `/api/webhooks/*` | `/api/phase25/webhooks/*` |

## Migration Path

Phase 2 and Phase 2.5 run side-by-side:

1. **Phase 2** (Current Production)
   - Endpoints: `/api/webhooks/signals`, `/api/webhooks/saty-phase`, `/api/webhooks/trend`
   - Single-source processing
   - Immediate decisions

2. **Phase 2.5** (New System)
   - Endpoints: `/api/phase25/webhooks/signals`, `/api/phase25/webhooks/saty-phase`
   - Multi-source aggregation
   - Enhanced decision engine

To migrate:
1. Start sending webhooks to Phase 2.5 endpoints
2. Monitor metrics and health endpoints
3. Compare decision outputs between Phase 2 and Phase 2.5
4. Gradually shift traffic to Phase 2.5
5. Deprecate Phase 2 endpoints when confident

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "details": "Detailed error message",
  "engineVersion": "2.5.0",
  "requestId": "req_1705234567890_abc123",
  "timestamp": 1705234567890
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (invalid payload)
- `401` - Unauthorized (invalid auth)
- `500` - Internal Server Error
- `503` - Service Unavailable (orchestrator not ready)

## Security

All endpoints include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-Engine-Version: 2.5.0`
- `X-Service: Phase25-Decision-Engine`

Authentication (when configured):
- Bearer token validation
- HMAC signature verification

## Monitoring

Key metrics to monitor:
- Processing time (avg, p95, p99)
- Decision distribution (EXECUTE/WAIT/SKIP)
- Context completeness rate
- Market feed success rate
- Error rates by type

## Next Steps

1. ✅ Create Next.js API routes for Phase 2.5
2. ✅ Wire up DecisionOrchestratorService
3. ✅ Add health and metrics endpoints
4. 🔄 Test webhook processing end-to-end
5. 🔄 Monitor metrics and performance
6. 🔄 Compare Phase 2 vs Phase 2.5 decisions
7. 🔄 Migrate production traffic

## Related Documentation

- `WEBHOOK_END_TO_END_VALIDATION.md` - Phase 2 webhook validation
- `WEBHOOK_PHASE2_PHASE25_VALIDATION.md` - Phase comparison
- `PHASE2_INTEGRATION_SUMMARY.md` - Phase 2 integration details
- `.kiro/specs/decision-engine-phase25/design.md` - Phase 2.5 design spec
