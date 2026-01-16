# Phase 2.5 Comprehensive Action Plan

## Objective
Complete the pipeline from **webhook → decision → dashboard → auto‑trade**, using React best practices and documented changes.

## Current Status
- ✅ Webhook → Decision → Ledger → API: Working
- ✅ Dashboard fix for decision shape mismatch: Implemented locally
- ❌ Production dashboard: Still failing until fix is deployed
- ❌ Auto‑trade: Not implemented

## Critical Findings

### 1) Dashboard Crash (Blocking)
- **Root cause:** `/api/decisions` returns `LedgerEntry`, but overview UI expects `DecisionResult.breakdown`.
- **Fix status:** Implemented locally in `src/app/page.tsx`; needs deployment.
- **Action:** Deploy and verify in production.

### 2) UUID Generation (Security)
- **Issue:** `Math.random()` used for UUIDs in `src/ledger/ledger.ts`.
- **Risk:** Predictable IDs and weaker uniqueness guarantees.
- **Action:** Replace with `crypto.randomUUID()` or a UUID library.

### 3) Market Gate Checks (Logic)
- **Issue:** Gate checks skip when values are `0`.
- **Impact:** Valid `0` values treated as missing.
- **Action:** Use explicit `value !== undefined` checks.

## Execution Roadmap

### Week 1 — Stabilization
1. Deploy dashboard crash fix.
2. Fix UUID generation.
3. Fix market gate zero‑value checks.
4. Add an error boundary for overview `DecisionBreakdown` for extra safety.

### Week 2 — Paper Execution
1. Implement `PaperExecutorService` to simulate option trades.
2. Add contract selection logic.
3. Simulate fills + commissions.
4. Persist `execution` into ledger entries.

### Week 3 — Position Tracking + Exits
1. Implement `PositionMonitorService`.
2. Track P&L + Greeks.
3. Implement `ExitSimulatorService` (targets, stops, time exits).
4. Write `exit` updates to ledger with P&L attribution.

### Week 4 — Risk Controls + Safety
1. Risk limits (max size, daily loss cap, max open positions).
2. Kill switch and manual approval path.
3. Circuit breakers for repeated failures.

## Required Services (Missing)
- `src/phase25/services/paper-executor.service.ts`
- `src/phase25/services/position-monitor.service.ts`
- `src/phase25/services/exit-simulator.service.ts`
- `src/phase25/services/risk-manager.service.ts`
- `src/phase25/utils/pnl-attribution.ts`

## Required API Endpoints (Proposed)
- `GET /api/positions/open`
- `POST /api/positions/:id/close`
- `GET /api/performance/metrics`
- `POST /api/risk/kill-switch`

## React Best Practices Checklist
- Use normalized data at boundaries (API → UI).
- Guard against undefined data and hydrate‑safe renders.
- Prefer memoized derived data (`useMemo`) where needed.
- Add lightweight error boundaries for critical UI panels.
- Avoid duplicate fetches; consolidate into shared hooks.

## Verification Steps

### Immediate (Post‑deploy)
1. Open production dashboard: no `confluence_multiplier` errors.
2. Send Phase 2.5 webhooks and confirm new decisions render.
3. Validate `/api/decisions?limit=1` returns latest decision.

### Short‑Term (After security/logic fixes)
1. Verify ledger entries use non‑predictable UUIDs.
2. Confirm market gates handle `0` values correctly.

### Paper Trading Verification
1. EXECUTE decision generates `execution` in ledger.
2. Open positions list is accurate.
3. Exit rules close positions and write `exit`.

## Next Actions (Today)
1. Deploy `src/app/page.tsx` decision normalization fix.
2. Run E2E tests and confirm dashboard renders.
3. Start UUID fix and market gate check fix.
# Phase 2.5 Comprehensive Action Plan
**Date:** January 16, 2026  
**Status:** Post E2E Review - Ready for Execution

---

## Executive Summary

**Current State:**
- ✅ Webhooks → Decision Engine → Ledger → APIs: **WORKING**
- ✅ Dashboard crash fix: **IMPLEMENTED** (needs deployment)
- ❌ Production dashboard: **FAILING** (awaiting deployment)
- ❌ Auto-trade execution: **NOT IMPLEMENTED**

**Critical Path:** Deploy fix → Verify dashboard → Build paper executor → Add position tracking → Enable auto-trade

---

## Phase 1: Immediate Stabilization (TODAY)

### 1.1 Deploy Dashboard Fix ⚠️ CRITICAL
**Status:** Code ready, needs deployment  
**Impact:** Unblocks entire dashboard

**What's Fixed:**
- `src/app/page.tsx` now normalizes `LedgerEntry` → `DecisionResult`
- Validates `decision_breakdown` with Zod schema
- Provides safe defaults via `createEmptyBreakdown()`
- Prevents `undefined.confluence_multiplier` crash

**Verification Steps:**
```bash
# After deployment
1. Open https://optionstrat.vercel.app
2. Verify dashboard loads without errors
3. Check browser console for errors
4. Navigate to Phase 2.5 tab
5. Verify all 3 components render
6. Hard refresh (Ctrl+Shift+R) multiple times
```

**Success Criteria:**
- [ ] Dashboard loads on first visit
- [ ] Dashboard loads on refresh
- [ ] No console errors
- [ ] Phase 2.5 tab displays data

---

### 1.2 Verify End-to-End Flow
**After deployment, run these tests:**

```bash
# Test webhook → decision → ledger
node test-with-both-webhooks.js

# Expected output:
# ✅ Decision: SKIP (83.5%)
# ✅ SUCCESS! Data is persisting!
# 1. SKIP - SPY (85%)

# Test ledger storage
node test-ledger-direct.js

# Expected output:
# ✅ SUCCESS! Ledger append worked!
```

**API Verification:**
```bash
# Get latest decision
curl https://optionstrat.vercel.app/api/decisions?limit=1

# Should return valid LedgerEntry with decision_breakdown
```

**Success Criteria:**
- [ ] Webhooks return 200
- [ ] Decisions persist to database
- [ ] API returns valid data
- [ ] Dashboard displays decisions

---

## Phase 2: Security & Reliability Hardening (THIS WEEK)

### 2.1 Fix UUID Generation 🔒 HIGH PRIORITY
**Issue:** `Math.random()` is not cryptographically secure  
**Impact:** Predictable IDs, potential collisions  
**Location:** `src/ledger/ledger.ts` line 21-27

**Fix:**
```typescript
// BEFORE (insecure)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// AFTER (secure)
import { randomUUID } from 'crypto';

function generateUUID(): string {
  return randomUUID(); // Node 18+ built-in
}
```

**Alternative (if Node < 18):**
```bash
npm install uuid
```
```typescript
import { v4 as uuidv4 } from 'uuid';

function generateUUID(): string {
  return uuidv4();
}
```

**Verification:**
```bash
# After fix
node test-ledger-direct.js

# Check that IDs are valid UUIDs
curl https://optionstrat.vercel.app/api/decisions?limit=5 | jq '.data[].id'
```

---

### 2.2 Fix Market Gate Zero-Value Checks 🐛 MEDIUM PRIORITY
**Issue:** `spreadBps: 0` or `atr14: 0` are treated as missing  
**Impact:** Valid zero values skip gate checks  
**Location:** `src/phase25/services/decision-engine.service.ts`

**Current Code (buggy):**
```typescript
private runMarketGates(market: MarketContext): GateResult {
  if (!market.spreadBps || !market.atr14) {
    return { passed: true, reason: 'Market data incomplete, skipping checks' };
  }
  // ...
}
```

**Fixed Code:**
```typescript
private runMarketGates(market: MarketContext): GateResult {
  if (market.spreadBps === undefined || market.atr14 === undefined) {
    return { passed: true, reason: 'Market data incomplete, skipping checks' };
  }
  // Now 0 is a valid value
  // ...
}
```

**Verification:**
- Create test with `spreadBps: 0` and verify gate runs
- Check decision logs for "Market data incomplete" messages

---

### 2.3 Add Error Boundary for Overview Tab 🛡️ MEDIUM PRIORITY
**Purpose:** Prevent full-page crashes if decision data is malformed  
**Location:** `src/app/page.tsx`

**Implementation:**
```typescript
// Create error boundary component
class DecisionBreakdownErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('DecisionBreakdown crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-400 p-4">
          Unable to display decision breakdown. Please refresh.
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap DecisionBreakdown usage
<DecisionBreakdownErrorBoundary>
  <DecisionBreakdown decision={state.decision} />
</DecisionBreakdownErrorBoundary>
```

---

## Phase 3: Performance Optimization (NEXT SPRINT)

### 3.1 Consolidate Phase 2.5 Dashboard API Calls
**Issue:** 3 components each call `/api/decisions` independently  
**Impact:** 3x API calls, slower load, higher costs  
**Components:**
- `Phase25DecisionCard.tsx`
- `Phase25BreakdownPanel.tsx`
- `Phase25HistoryTable.tsx`

**Solution: Shared Data Hook**
```typescript
// src/hooks/usePhase25Decisions.ts
export function usePhase25Decisions(limit: number = 20) {
  const [data, setData] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        const res = await fetch(`/api/decisions?limit=${limit}&_t=${Date.now()}`);
        const json = await res.json();
        setData(json.data || []);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [limit]);

  return { data, loading, error, latest: data[0] || null };
}

// Usage in components
const { latest, data, loading, error } = usePhase25Decisions(20);
```

**Benefits:**
- Single API call per page load
- Shared loading state
- Consistent data across components
- Easier to add refresh functionality

---

## Phase 4: Auto-Trade Execution (NEXT 2-3 WEEKS)

### 4.1 Paper Executor Service 📝 NEW SERVICE
**Purpose:** Convert EXECUTE decisions into simulated trades  
**File:** `src/phase25/services/paper-executor.service.ts`

**Core Responsibilities:**
1. Receive EXECUTE decision
2. Select option contract (strike, expiry, type)
3. Simulate fill (price, slippage, commission)
4. Write `execution` data to ledger
5. Return execution result

**Data Contract:**
```typescript
interface ExecutionResult {
  success: boolean;
  execution?: {
    executed_at: number;
    contract: {
      symbol: string;
      strike: number;
      expiry: string;
      type: 'CALL' | 'PUT';
    };
    fill: {
      price: number;
      quantity: number;
      commission: number;
      slippage: number;
    };
    position_id: string;
  };
  error?: string;
}
```

**Integration Point:**
```typescript
// In decision-orchestrator.service.ts
private async forwardToExecution(decision: DecisionPacket): Promise<void> {
  if (this.decisionOnlyMode) {
    console.log(`Decision-only mode: Not forwarding ${decision.action} decision`);
    return;
  }

  // NEW: Execute paper trade
  const executor = new PaperExecutorService();
  const result = await executor.execute(decision);
  
  if (result.success && result.execution) {
    // Update ledger with execution data
    await ledger.updateExecution(decision.ledgerId, result.execution);
  }
}
```

**Contract Selection Logic:**
```typescript
class PaperExecutorService {
  async execute(decision: DecisionPacket): Promise<ExecutionResult> {
    // 1. Get current underlying price
    const underlyingPrice = await this.getUnderlyingPrice(decision.symbol);
    
    // 2. Select strike (ATM, OTM based on strategy)
    const strike = this.selectStrike(underlyingPrice, decision.direction);
    
    // 3. Select expiry (DTE based on timeframe)
    const expiry = this.selectExpiry(decision.timeframe);
    
    // 4. Get option price
    const optionPrice = await this.getOptionPrice(strike, expiry, decision.direction);
    
    // 5. Calculate quantity (based on size multiplier)
    const quantity = this.calculateQuantity(decision.finalSizeMultiplier);
    
    // 6. Simulate fill
    const fill = this.simulateFill(optionPrice, quantity);
    
    // 7. Return execution result
    return {
      success: true,
      execution: {
        executed_at: Date.now(),
        contract: { symbol, strike, expiry, type },
        fill,
        position_id: generateUUID(),
      },
    };
  }
}
```

---

### 4.2 Position Monitor Service 📊 NEW SERVICE
**Purpose:** Track open positions and update P&L  
**File:** `src/phase25/services/position-monitor.service.ts`

**Core Responsibilities:**
1. Query ledger for entries with `execution` but no `exit`
2. Fetch current option prices
3. Calculate unrealized P&L
4. Update Greeks (delta, theta, vega)
5. Check exit conditions

**Data Contract:**
```typescript
interface OpenPosition {
  ledger_id: string;
  position_id: string;
  symbol: string;
  contract: {
    strike: number;
    expiry: string;
    type: 'CALL' | 'PUT';
  };
  entry: {
    price: number;
    quantity: number;
    timestamp: number;
  };
  current: {
    price: number;
    pnl: number;
    pnl_pct: number;
    delta: number;
    theta: number;
    updated_at: number;
  };
  exit_conditions: {
    target_1: number;
    target_2: number;
    stop_loss: number;
    max_hold_time: number;
  };
}
```

**Periodic Update:**
```typescript
class PositionMonitorService {
  async updatePositions(): Promise<void> {
    // 1. Get open positions from ledger
    const positions = await this.getOpenPositions();
    
    // 2. For each position
    for (const position of positions) {
      // 3. Get current option price
      const currentPrice = await this.getOptionPrice(position.contract);
      
      // 4. Calculate P&L
      const pnl = this.calculatePnL(position.entry, currentPrice);
      
      // 5. Check exit conditions
      const shouldExit = this.checkExitConditions(position, currentPrice);
      
      if (shouldExit) {
        // 6. Trigger exit
        await this.exitSimulator.exit(position, currentPrice);
      }
    }
  }
  
  // Run every 5 minutes
  startMonitoring() {
    setInterval(() => this.updatePositions(), 5 * 60 * 1000);
  }
}
```

---

### 4.3 Exit Simulator Service 🚪 NEW SERVICE
**Purpose:** Close positions based on rules  
**File:** `src/phase25/services/exit-simulator.service.ts`

**Exit Triggers:**
1. **Target Hit:** Price reaches target_1 or target_2
2. **Stop Loss:** Price hits stop loss
3. **Time Decay:** Max hold time exceeded
4. **Theta Decay:** Option loses too much time value
5. **Manual:** User-initiated close

**Data Contract:**
```typescript
interface ExitResult {
  success: boolean;
  exit?: {
    exit_time: number;
    exit_price: number;
    exit_reason: 'TARGET_1' | 'TARGET_2' | 'STOP_LOSS' | 'THETA_DECAY' | 'MANUAL';
    pnl_gross: number;
    pnl_net: number;
    hold_time_seconds: number;
    pnl_attribution: {
      pnl_from_delta: number;
      pnl_from_iv: number;
      pnl_from_theta: number;
      pnl_from_gamma: number;
    };
  };
  error?: string;
}
```

**Implementation:**
```typescript
class ExitSimulatorService {
  async exit(position: OpenPosition, currentPrice: number, reason: ExitReason): Promise<ExitResult> {
    // 1. Calculate P&L
    const pnl_gross = (currentPrice - position.entry.price) * position.entry.quantity * 100;
    
    // 2. Calculate costs
    const commission = 1.30; // Per contract
    const total_commission = commission * position.entry.quantity * 2; // Entry + exit
    
    // 3. Net P&L
    const pnl_net = pnl_gross - total_commission;
    
    // 4. Hold time
    const hold_time_seconds = (Date.now() - position.entry.timestamp) / 1000;
    
    // 5. P&L attribution (simplified)
    const pnl_attribution = this.attributePnL(position, currentPrice);
    
    // 6. Create exit data
    const exitData = {
      exit_time: Date.now(),
      exit_price: currentPrice,
      exit_reason: reason,
      pnl_gross,
      pnl_net,
      hold_time_seconds,
      pnl_attribution,
      // ... other fields
    };
    
    // 7. Update ledger
    await ledger.updateExit(position.ledger_id, exitData);
    
    return { success: true, exit: exitData };
  }
}
```

---

### 4.4 Risk Controls 🛡️ CRITICAL FOR PRODUCTION

**Required Before Real Trading:**

1. **Position Limits**
   ```typescript
   interface RiskLimits {
     max_position_size: number;      // Max $ per trade
     max_open_positions: number;     // Max concurrent positions
     max_daily_loss: number;         // Max $ loss per day
     max_portfolio_risk: number;     // Max % of account at risk
   }
   ```

2. **Kill Switch**
   ```typescript
   interface KillSwitch {
     enabled: boolean;
     reason: string;
     triggered_at: number;
     triggered_by: 'SYSTEM' | 'USER';
   }
   ```

3. **Human Approval**
   ```typescript
   interface ApprovalRequired {
     trade_size_threshold: number;   // Require approval if > $X
     new_symbol_approval: boolean;   // Require approval for new symbols
     approval_timeout: number;       // Auto-reject after X minutes
   }
   ```

4. **Circuit Breakers**
   - Pause trading after 3 consecutive losses
   - Pause trading if daily loss exceeds limit
   - Pause trading if market volatility spikes

---

## Phase 5: Dashboard Enhancements (OPTIONAL)

### 5.1 Open Positions Panel
**File:** `src/components/dashboard/OpenPositionsPanel.tsx`

**Features:**
- List all open positions
- Show current P&L
- Display Greeks
- Manual close button
- Position details modal

### 5.2 Performance Metrics Dashboard
**File:** `src/components/dashboard/PerformanceMetrics.tsx`

**Metrics:**
- Win rate
- Profit factor
- Average win/loss
- Sharpe ratio
- Max drawdown
- Total P&L

### 5.3 Trade Journal
**File:** `src/components/dashboard/TradeJournal.tsx`

**Features:**
- Searchable trade history
- Filter by symbol, date, outcome
- Export to CSV
- Trade notes/tags

---

## Missing Services & Data Contracts

### Services to Build:
1. ✅ `paper-executor.service.ts` - Simulate trade execution
2. ✅ `position-monitor.service.ts` - Track open positions
3. ✅ `exit-simulator.service.ts` - Close positions
4. ⚠️ `risk-manager.service.ts` - Enforce risk limits
5. ⚠️ `pnl-attribution.service.ts` - Calculate P&L sources
6. ⚠️ `broker-client.service.ts` - Real broker integration (future)

### Data Contracts to Define:
1. ✅ `ExecutionResult` - Paper trade execution output
2. ✅ `OpenPosition` - Position tracking data
3. ✅ `ExitResult` - Position exit data
4. ⚠️ `RiskLimits` - Risk control configuration
5. ⚠️ `PerformanceMetrics` - Strategy performance data
6. ⚠️ `BrokerOrder` - Real broker order format (future)

### API Endpoints to Add:
1. `GET /api/positions/open` - List open positions
2. `GET /api/positions/:id` - Get position details
3. `POST /api/positions/:id/close` - Manual close
4. `GET /api/performance/metrics` - Performance stats
5. `GET /api/risk/status` - Risk limits status
6. `POST /api/risk/kill-switch` - Emergency stop

---

## Execution Order & Verification

### Week 1: Stabilization
**Day 1:**
- [ ] Deploy dashboard fix
- [ ] Verify end-to-end flow
- [ ] Run live webhook tests

**Day 2-3:**
- [ ] Fix UUID generation
- [ ] Fix market gate checks
- [ ] Add error boundary

**Day 4-5:**
- [ ] Consolidate API calls
- [ ] Add integration tests
- [ ] Performance testing

### Week 2: Paper Execution
**Day 1-2:**
- [ ] Build PaperExecutorService
- [ ] Contract selection logic
- [ ] Fill simulation

**Day 3-4:**
- [ ] Integration with orchestrator
- [ ] Ledger execution updates
- [ ] End-to-end testing

**Day 5:**
- [ ] Dashboard execution display
- [ ] Verification & bug fixes

### Week 3: Position Tracking
**Day 1-2:**
- [ ] Build PositionMonitorService
- [ ] P&L calculation
- [ ] Greeks updates

**Day 3-4:**
- [ ] Build ExitSimulatorService
- [ ] Exit rules logic
- [ ] Ledger exit updates

**Day 5:**
- [ ] Open positions dashboard
- [ ] Verification & testing

### Week 4: Risk Controls
**Day 1-2:**
- [ ] Build RiskManagerService
- [ ] Position limits
- [ ] Daily loss limits

**Day 3-4:**
- [ ] Kill switch
- [ ] Circuit breakers
- [ ] Approval workflow

**Day 5:**
- [ ] Risk dashboard
- [ ] Full system testing

---

## Verification Checklist

### Phase 1 (Immediate):
- [ ] Dashboard loads without crashes
- [ ] Phase 2.5 tab renders all components
- [ ] Webhooks persist to ledger
- [ ] API returns valid data

### Phase 2 (Hardening):
- [ ] UUIDs are cryptographically secure
- [ ] Zero values pass gate checks
- [ ] Error boundary catches crashes
- [ ] No security vulnerabilities

### Phase 3 (Performance):
- [ ] Single API call per page load
- [ ] Dashboard loads < 1 second
- [ ] No duplicate requests
- [ ] Efficient data fetching

### Phase 4 (Auto-Trade):
- [ ] EXECUTE decisions create paper trades
- [ ] Positions tracked in real-time
- [ ] Exits trigger on rules
- [ ] P&L calculated correctly
- [ ] Risk limits enforced
- [ ] Kill switch works

### Phase 5 (Dashboard):
- [ ] Open positions display
- [ ] Performance metrics accurate
- [ ] Trade journal searchable
- [ ] Manual close works

---

## Risk Mitigation

### Technical Risks:
1. **Database connection failures**
   - Mitigation: Connection pooling, retry logic, fallback to in-memory
2. **Market data feed failures**
   - Mitigation: Multiple data sources, stale data detection, graceful degradation
3. **Execution failures**
   - Mitigation: Idempotency, transaction rollback, audit logging

### Business Risks:
1. **Incorrect P&L calculation**
   - Mitigation: Extensive testing, manual verification, reconciliation
2. **Runaway trading**
   - Mitigation: Position limits, kill switch, circuit breakers
3. **Data loss**
   - Mitigation: Database backups, append-only ledger, audit trail

### Operational Risks:
1. **Deployment failures**
   - Mitigation: Staging environment, rollback plan, health checks
2. **Performance degradation**
   - Mitigation: Load testing, monitoring, auto-scaling
3. **Security breaches**
   - Mitigation: Secure UUIDs, input validation, rate limiting

---

## Success Metrics

### Phase 1 (Immediate):
- Dashboard uptime: 99.9%
- Page load time: < 2 seconds
- Error rate: < 0.1%

### Phase 4 (Auto-Trade):
- Execution success rate: > 99%
- Position tracking accuracy: 100%
- Exit rule accuracy: 100%
- P&L calculation accuracy: 100%

### Overall:
- System uptime: 99.9%
- Decision latency: < 100ms
- Trade execution latency: < 1 second
- Zero data loss
- Zero unauthorized trades

---

## Conclusion

**Immediate Priority:** Deploy the dashboard fix to unblock the entire system.

**Critical Path:**
1. Deploy → Verify → Harden → Optimize → Execute → Track → Control

**Timeline:**
- Week 1: Stabilization (dashboard + security)
- Week 2: Paper execution
- Week 3: Position tracking + exits
- Week 4: Risk controls
- Week 5+: Real trading (if approved)

**Next Action:** Deploy the dashboard fix and verify end-to-end flow.

---

**Status:** Ready for execution. All plans documented. Awaiting deployment approval.
