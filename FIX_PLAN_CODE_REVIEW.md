# Fix Plan: Code Review Critical & Major Issues
**Date**: January 18, 2026  
**Priority**: Critical → Major → Minor  
**Timeline**: 3-5 days for Critical + Major

---

## Phase 1: Critical Fixes (Day 1-2)

### Fix 1.1: Race Condition in Context Store
**File**: `src/phase25/services/context-store.service.ts`  
**Time**: 3 hours  
**Approach**: Add mutex for atomic operations

**Steps**:
1. Install `async-mutex` package
2. Add mutex to ContextStoreService
3. Wrap `update()` and `build()` in mutex.runExclusive()
4. Add tests for concurrent updates
5. Update orchestrator to use async update()

**Testing**:
- Send 10 webhooks simultaneously
- Verify no partial state reads
- Verify all updates are atomic

---

### Fix 1.2: Unsafe Fallback Values
**Files**: 
- `src/phase2/gates/volatility-gate.ts`
- `src/phase2/gates/spread-gate.ts`
- `src/phase25/services/market-context.service.ts`

**Time**: 2 hours  
**Approach**: Fail gates when data unavailable (conservative)

**Steps**:
1. Update volatility gate to fail on missing data
2. Update spread gate to fail on missing data
3. Update gamma gate to fail on missing data
4. Add explicit "data unavailable" error messages
5. Update tests to verify conservative behavior

**Testing**:
- Mock API failures
- Verify gates FAIL (not pass)
- Verify error messages are clear

---

### Fix 1.3: Configuration Validation at Startup
**Files**:
- `src/phase25/config/engine.config.ts`
- `src/phase25/services/service-factory.ts`

**Time**: 1 hour  
**Approach**: Call validation on app startup

**Steps**:
1. Call validateEngineConfig() in ServiceFactory constructor
2. Throw error if validation fails
3. Add startup health check
4. Log configuration on startup
5. Add environment variable validation

**Testing**:
- Test with invalid config (negative values)
- Test with missing API keys
- Verify app refuses to start

---

## Phase 2: Major Fixes (Day 3-4)

### Fix 2.1: Distributed State Management
**Files**: All Phase 2.5 services  
**Time**: 6 hours  
**Approach**: Add Redis for shared state (optional, graceful fallback)

**Steps**:
1. Add Redis client wrapper
2. Update ContextStoreService to use Redis
3. Add fallback to in-memory if Redis unavailable
4. Update RateLimitTracker to use Redis
5. Add Redis health check

**Testing**:
- Run 2 instances, send webhooks to both
- Verify context is shared
- Verify rate limits are shared
- Test Redis failure (should fallback to in-memory)

---

### Fix 2.2: Input Validation with Zod
**Files**:
- `src/app/api/webhooks/signals/route.ts`
- `src/app/api/phase25/webhooks/signals/route.ts`
- `src/webhooks/schemas.ts` (new)

**Time**: 3 hours  
**Approach**: Add Zod schemas for all webhook types

**Steps**:
1. Install `zod` package
2. Create schemas for all webhook types
3. Add validation middleware
4. Return detailed validation errors
5. Add rate limiting per IP

**Testing**:
- Send invalid payloads (negative scores, SQL injection)
- Verify detailed error messages
- Verify malicious payloads are rejected

---

### Fix 2.3: Centralize Magic Numbers
**Files**:
- `src/phase25/config/constants.ts` (update)
- `src/phase25/config/trading-rules.config.ts` (new)
- All decision engine files

**Time**: 2 hours  
**Approach**: Move all thresholds to config

**Steps**:
1. Create trading-rules.config.ts
2. Move all magic numbers to config
3. Add comments explaining each threshold
4. Update all files to use config
5. Add config override via environment variables

**Testing**:
- Change thresholds via config
- Verify decisions change accordingly
- Verify no hardcoded values remain

---

## Phase 3: Recommendations (Day 5+)

### Rec 3.1: Health Check Endpoint
**Time**: 2 hours  
**Files**: `src/app/api/health/route.ts` (new)

### Rec 3.2: Request ID Tracing
**Time**: 4 hours  
**Files**: All route handlers, services

### Rec 3.3: Structured Logging
**Time**: 3 hours  
**Files**: All services

### Rec 3.4: Performance Metrics
**Time**: 4 hours  
**Files**: All decision pipeline services

---

## Implementation Order

```
Day 1 Morning:   Fix 1.1 - Race Condition (3h)
Day 1 Afternoon: Fix 1.2 - Unsafe Fallbacks (2h)
Day 1 Evening:   Fix 1.3 - Config Validation (1h)
                 → Deploy to staging, test

Day 2 Morning:   Fix 2.2 - Input Validation (3h)
Day 2 Afternoon: Fix 2.3 - Magic Numbers (2h)
                 → Deploy to staging, test

Day 3-4:         Fix 2.1 - Redis (6h, optional)
                 → Deploy to staging, test

Day 5+:          Recommendations (as time permits)
```

---

## Testing Strategy

### Unit Tests
- Test each fix in isolation
- Mock external dependencies
- Verify edge cases

### Integration Tests
- Test complete webhook flow
- Test concurrent requests
- Test API failures

### Load Tests
- Send 100 webhooks/minute
- Verify no race conditions
- Verify rate limits work

### Staging Deployment
- Deploy after each phase
- Monitor for 24 hours
- Verify no regressions

---

## Rollback Plan

Each fix is independent and can be rolled back:

1. **Race Condition Fix**: Remove mutex, revert to synchronous
2. **Fallback Fix**: Revert to permissive fallbacks
3. **Validation Fix**: Remove validation, accept all payloads
4. **Redis Fix**: Disable Redis, use in-memory only

---

## Success Criteria

### Phase 1 (Critical)
- ✅ No race conditions under load
- ✅ Gates fail conservatively when data missing
- ✅ App refuses to start with invalid config

### Phase 2 (Major)
- ✅ Can run multiple instances
- ✅ Malicious payloads rejected
- ✅ All thresholds in config

### Phase 3 (Recommendations)
- ✅ Health check returns 200
- ✅ All requests have trace IDs
- ✅ Structured logs in production

---

## Risk Assessment

| Fix | Risk | Mitigation |
|-----|------|------------|
| Race Condition | LOW | Mutex is battle-tested, add comprehensive tests |
| Fallbacks | MEDIUM | May reject more trades, monitor rejection rate |
| Validation | LOW | Clear error messages, gradual rollout |
| Redis | MEDIUM | Optional feature, graceful fallback to in-memory |

---

**Ready to proceed with implementation!**
