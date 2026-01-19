# Code Review Part 2: Major Concerns

## 2. MAJOR CONCERNS (Should Fix Soon)

### ⚠️ MAJOR #1: No Distributed State Management
**Files**: All Phase 2.5 services  
**Severity**: MEDIUM - Blocks horizontal scaling

**Problem**: Context store, metrics, and rate limiters use in-memory state.

```typescript
// CURRENT CODE
export class ContextStoreService {
  private context: StoredContext;  // ❌ In-memory only
  private completenessRules: CompletenessRules;
}

export class RateLimitTracker {
  private requestCounts: Map<string, number> = new Map();  // ❌ In-memory
  private lastReset: Map<string, number> = new Map();
}
```

**Impact**:
- Cannot run multiple instances (load balancing impossible)
- Context lost on deployment/restart
- Rate limits not shared across instances

**Scenario**:
```
Instance A: Receives SATY_PHASE webhook, stores in memory
Instance B: Receives TRADINGVIEW_SIGNAL webhook, doesn't see SATY data
Result: Instance B waits forever for complete context
```

**Fix**: Use Redis for shared state

```typescript
// RECOMMENDED FIX
import { Redis } from 'ioredis';

export class ContextStoreService {
  private redis: Redis;
  private localCache: Map<string, StoredContext> = new Map();
  
  async update(partial: Partial<DecisionContext>, source: WebhookSource): Promise<void> {
    const key = `context:${partial.instrument?.symbol}`;
    
    // Get current context from Redis
    const current = await this.redis.get(key);
    const context = current ? JSON.parse(current) : {};
    
    // Update
    if (partial.regime) context.regime = partial.regime;
    context.lastUpdated = context.lastUpdated || {};
    context.lastUpdated[source] = Date.now();
    
    // Save back to Redis with TTL
    await this.redis.setex(key, 300, JSON.stringify(context));
    
    // Update local cache for fast reads
    this.localCache.set(key, context);
  }
}
```

---

### ⚠️ MAJOR #2: Insufficient Input Validation
**File**: `src/app/api/webhooks/signals/route.ts`  
**Severity**: MEDIUM - Security risk

**Problem**: Validation only checks JSON structure, not value ranges.

```typescript
// CURRENT CODE
if (!body || typeof body !== 'object') {
  return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
}

// ❌ No validation of:
// - Numeric ranges (aiScore could be -999 or 1000000)
// - String formats (ticker could be "'; DROP TABLE--")
// - Required fields (signal.type could be missing)
// - Array lengths (could send 10MB array)
```

**Attack Vectors**:
1. **Resource Exhaustion**: Send massive arrays/objects
2. **SQL Injection**: Ticker symbols with SQL commands
3. **Logic Bombs**: Extreme values that break calculations

**Fix**: Add comprehensive validation layer


```typescript
// RECOMMENDED FIX
import { z } from 'zod';

const SignalSchema = z.object({
  signal: z.object({
    type: z.enum(['LONG', 'SHORT']),
    ai_score: z.number().min(0).max(10.5),
    quality: z.enum(['EXTREME', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    timeframe: z.string().regex(/^\d+$/).optional(),
    timestamp: z.number().int().positive().optional()
  }),
  instrument: z.object({
    ticker: z.string().regex(/^[A-Z]{1,5}$/),  // 1-5 uppercase letters only
    exchange: z.string().max(20).optional(),
    current_price: z.number().positive().max(1000000).optional()
  }),
  risk: z.object({
    rr_ratio_t1: z.number().min(0).max(100).optional(),
    rr_ratio_t2: z.number().min(0).max(100).optional()
  }).optional()
});

// In route handler:
try {
  const validated = SignalSchema.parse(body);
  // Use validated data
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      error: 'Validation failed',
      details: error.errors
    }, { status: 400 });
  }
}
```

---

### ⚠️ MAJOR #3: Magic Numbers Everywhere
**Files**: Multiple gate and decision files  
**Severity**: MEDIUM - Maintainability issue

**Problem**: Hardcoded thresholds scattered throughout code.

```typescript
// CURRENT CODE - Magic numbers
if (confidenceScore >= 70) return "EXECUTE";  // ❌ Why 70?
if (confidenceScore >= 50) return "WAIT";     // ❌ Why 50?

const stopLoss = currentPrice * 0.98;  // ❌ Why 2%?
const target1 = currentPrice * 1.02;   // ❌ Why 2%?

if (alignmentPct >= 0.8) {  // ❌ Why 80%?
  alignmentScore *= 1.2;    // ❌ Why 1.2x?
}
```

**Impact**:
- Cannot A/B test different thresholds
- Hard to understand business logic
- Difficult to optimize based on backtest results

**Fix**: Centralize all constants
