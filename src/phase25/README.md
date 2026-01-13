# Phase 2.5 Decision Engine

A deterministic, institutional-grade decision engine for options trading that processes webhooks from multiple sources and makes consistent, auditable trading decisions.

## Architecture Overview

The Phase 2.5 Decision Engine follows a strict separation of concerns:

- **Webhooks** → **Normalizer** → **Decision Engine** → **Audit Log** → **Paper Trading**

### Core Principles

1. **Deterministic**: Same inputs always produce same outputs
2. **Immutable**: Configuration is frozen in production
3. **Auditable**: Every decision is logged with full context
4. **Institutional-grade**: Built for reliability and compliance

## Current Implementation Status

### ✅ Completed (Task 1 & 2.1)

- **Core Types & Interfaces**: Complete type system for decision contexts, market data, and audit trails
- **Configuration System**: Frozen, versioned configuration with validation
- **Property-Based Testing**: Fast-check framework with 100+ iteration tests
- **Webhook Service**: Express.js endpoints with authentication and validation
- **Route Handlers**: Complete REST API with health checks and error handling
- **Integration Tests**: Full test coverage for webhook endpoints

### 🚧 Next Steps (Task 3+)

- **Normalizer Layer**: Map webhook sources to unified DecisionContext
- **Market Context Builder**: Parallel API calls for real-time market data
- **Decision Engine Core**: Deterministic pipeline with frozen rules
- **Risk Gates**: Safety controls and position sizing
- **Audit System**: Complete decision logging and replay capability

## Quick Start

### Development Server

```bash
# Start Phase 2.5 development server
npm run phase25:dev

# Server runs on http://localhost:3001
# Health check: GET /
# Webhook endpoints:
#   POST /api/webhooks/signals
#   POST /api/webhooks/saty-phase
#   GET  /api/webhooks/health
```

### Testing

```bash
# Run all Phase 2.5 tests
npm run phase25:test

# Run property-based tests only
npm run phase25:test:pbt

# Run with watch mode
npm run phase25:test:watch

# Type checking
npm run phase25:typecheck

# Linting
npm run phase25:lint
```

## API Endpoints

### Health Check
```
GET /
GET /api/webhooks/health
```

### Signal Webhooks
```
POST /api/webhooks/signals
Content-Type: application/json

{
  "signal": {
    "type": "LONG" | "SHORT",
    "timeframe": "3" | "5" | "15" | "30" | "60" | "240",
    "quality": "EXTREME" | "HIGH" | "MEDIUM",
    "ai_score": 0-10.5
  },
  "instrument": {
    "ticker": "SPY",
    "exchange": "ARCA",
    "current_price": 450.25
  }
}
```

### SATY Phase Webhooks
```
POST /api/webhooks/saty-phase
Content-Type: application/json

{
  "meta": {
    "engine": "SATY_PO",
    "engine_version": "1.0.0",
    "event_type": "REGIME_PHASE_ENTRY"
  },
  "instrument": {
    "symbol": "SPY",
    "exchange": "ARCA"
  },
  "confidence": {
    "confidence_score": 85
  }
}
```

## Authentication

The system supports both HMAC signatures and Bearer tokens:

### Environment Variables
```bash
REQUIRE_WEBHOOK_AUTH=true
WEBHOOK_HMAC_SECRET=your-secret-key
WEBHOOK_BEARER_TOKEN=your-bearer-token
```

### HMAC Authentication
```
X-Signature: sha256=<hmac-sha256-hex>
```

### Bearer Token Authentication
```
Authorization: Bearer <your-token>
```

## Configuration

All configuration is frozen and versioned in production:

- **Engine Version**: 1.0.0
- **Phase Rules**: Immutable trading rules per market phase
- **Risk Gates**: Fixed thresholds for safety controls
- **API Timeouts**: Deterministic timeout values
- **Size Bounds**: Position sizing limits

## Testing Philosophy

The system uses property-based testing to ensure correctness:

- **100+ iterations** per property test
- **Universal properties** that must always hold
- **Deterministic behavior** validation
- **Boundary condition** testing
- **Error handling** verification

## File Structure

```
src/phase25/
├── types/           # TypeScript interfaces and types
├── config/          # Frozen configuration and rules
├── services/        # Core business logic services
├── routes/          # Express.js route handlers
├── testing/         # Property-based testing utilities
├── __tests__/       # Test suites
├── server.ts        # Express.js server setup
└── README.md        # This file
```

## Development Guidelines

1. **Never modify frozen configuration** in production
2. **Always add property-based tests** for new features
3. **Maintain deterministic behavior** - no randomness
4. **Log all decisions** with full audit trail
5. **Validate all inputs** at service boundaries
6. **Handle errors gracefully** with fallback values

## Next Implementation Phase

The next task is **Task 3.1: Create source detection and routing logic** which will implement the normalizer layer that maps different webhook sources to the unified DecisionContext format.