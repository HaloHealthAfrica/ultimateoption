# Phase 2.6: Auto-Trading Roadmap

**Date:** January 15, 2026  
**Status:** 📋 PLANNING  
**Goal:** Complete the auto-trading loop with visualization, execution, and feedback

---

## Current State Analysis

### ✅ What's Working (Phase 2.5)
1. **Multi-Source Webhook Ingestion** - 5 webhook sources integrated
2. **Decision Engine** - Three-gate system making EXECUTE/WAIT/SKIP decisions
3. **Ledger Storage** - All decisions stored in in-memory ledger
4. **API Endpoints** - `/api/decisions` and `/api/ledger` returning data
5. **Market Context** - Tradier, TwelveData, Alpaca integration
6. **Confidence Scoring** - 82% confidence scores with detailed breakdown

### ⚠️ What's Missing (Gaps)
1. **No Visual Dashboard for Phase 2.5 Decisions** - Can't see what the engine is deciding
2. **No Paper Trading Execution** - EXECUTE decisions aren't simulated
3. **No Position Tracking** - No way to see "open positions"
4. **No Exit Simulation** - No target/stop/time-based exits
5. **No Trade Performance Metrics** - Can't measure win rate, P&L, expectancy
6. **No Feedback Loop** - Can't learn from good/bad decisions
7. **No Auto-Trade Execution** - No broker integration for real trades

---

## The Auto-Trading Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE AUTO-TRADING LOOP                    │
└─────────────────────────────────────────────────────────────────┘

1. SIGNAL INGESTION (✅ Done)
   Webhooks → Context Aggregation → Decision Engine

2. DECISION VISUALIZATION (❌ Missing)
   Dashboard showing:
   - Current decision (EXECUTE/WAIT/SKIP)
   - Confidence score and breakdown
   - Gate results (Regime/Structural/Market)
   - Reasons for decision
   - Historical decision log

3. PAPER TRADING EXECUTION (❌ Missing)
   For EXECUTE decisions:
   - Select option contract (strike, expiry, DTE)
   - Calculate Greeks (delta, gamma, theta, vega)
   - Simulate fill (spread, slippage, partial fills)
   - Store execution in ledger

4. POSITION TRACKING (❌ Missing)
   Monitor open positions:
   - Current P&L (mark-to-market)
   - Greeks changes
   - Time decay
   - Distance to targets/stops

5. EXIT SIMULATION (❌ Missing)
   Close positions when:
   - Target 1 or Target 2 hit
   - Stop loss hit
   - Theta decay threshold
   - Time-based exit (EOD for 0DTE)

6. PERFORMANCE METRICS (❌ Missing)
   Calculate and display:
   - Win rate
   - Average R-multiple
   - Expectancy
   - Max drawdown
   - P&L attribution (delta/IV/theta/gamma)

7. FEEDBACK & LEARNING (❌ Missing)
   Analyze decisions:
   - Which setups work best?
   - Which gates are most predictive?
   - Position sizing optimization
   - Regime-specific performance

8. AUTO-TRADE EXECUTION (❌ Future)
   Real broker integration:
   - Alpaca API for order placement
   - Real fills with actual spreads
   - Position monitoring
   - Risk limits and kill switches
```

---

## Phase 2.6 Objectives

### Primary Goal
**Enable complete paper trading loop with visualization and feedback**

### Success Criteria
1. ✅ Dashboard shows Phase 2.5 decisions in real-time
2. ✅ EXECUTE decisions trigger paper trade simulation
3. ✅ Open positions are tracked and displayed
4. ✅ Exits are simulated based on targets/stops
5. ✅ Performance metrics are calculated and shown
6. ✅ Feedback loop identifies what's working

---

## Implementation Plan

### STEP 1: Decision Visualization Dashboard 🎯 HIGH PRIORITY

**Goal:** See what Phase 2.5 is deciding and why

**Components to Build:**

#### 1.1 Phase 2.5 Decision Card
**Location:** `src/components/dashboard/Phase25DecisionCard.tsx`

**Display:**
- Current decision (EXECUTE/WAIT/SKIP) with color coding
- Confidence score (0-100) with progress bar
- Direction (LONG/SHORT) and ticker
- Timeframe and quality
- Position size multiplier
- Timestamp

**Data Source:** `GET /api/decisions?limit=1` (most recent)

#### 1.2 Decision Breakdown Panel
**Location:** `src/components/dashboard/DecisionBreakdownPanel.tsx`

**Display:**
- Gate Results:
  - ✅/❌ Regime Gate (phase alignment, confidence)
  - ✅/❌ Structural Gate (setup validity, liquidity)
  - ✅/❌ Market Gate (spread, ATR, depth)
- Confidence Components:
  - Regime: 30%
  - Expert: 25%
  - Alignment: 20%
  - Market: 15%
  - Structure: 10%
- Position Sizing Breakdown:
  - Base multiplier from confluence
  - Quality adjustment
  - Phase boosts
  - Final multiplier (0.5x - 3.0x)

**Data Source:** `decision.decision_breakdown` from API

#### 1.3 Decision History Table
**Location:** `src/components/dashboard/DecisionHistoryTable.tsx`

**Display:**
- Last 20 decisions in table format
- Columns: Time, Ticker, Decision, Confidence, Direction, Timeframe
- Filterable by: Decision type, Timeframe, Quality
- Sortable by: Time, Confidence
- Click to expand full details

**Data Source:** `GET /api/decisions?limit=20`

#### 1.4 Decision Reasons List
**Location:** Part of Decision Card

**Display:**
- Bullet list of reasons for decision
- Color-coded: Green (positive), Red (negative), Yellow (neutral)
- Examples:
  - ✅ "High AI score (9.2)"
  - ✅ "Phase alignment confirmed"
  - ❌ "Spread too wide (4.2%)"
  - ⚠️ "Waiting for MTF alignment"

**Data Source:** `decision.reasons` array

---

### STEP 2: Paper Trading Executor 🎯 HIGH PRIORITY

**Goal:** Simulate realistic option trades for EXECUTE decisions

**Components to Build:**

#### 2.1 Paper Executor Service
**Location:** `src/phase25/services/paper-executor.service.ts`

**Responsibilities:**
- Select option contract (strike, expiry, DTE)
- Calculate theoretical option price (Black-Scholes)
- Calculate Greeks (delta, gamma, theta, vega, IV)
- Simulate fill with spread and slippage
- Handle partial fills (>50 contracts)
- Calculate commission costs
- Store execution in ledger

**Key Functions:**
```typescript
interface IPaperExecutor {
  selectContract(signal: EnrichedSignal, decision: DecisionPacket): OptionContract;
  calculateOptionPrice(contract: OptionContract, underlying: number): number;
  calculateGreeks(contract: OptionContract, underlying: number): Greeks;
  simulateFill(contract: OptionContract, contracts: number): Fill;
  execute(signal: EnrichedSignal, decision: DecisionPacket): Execution;
}
```

#### 2.2 Contract Selection Logic
**DTE Rules:**
- 3M/5M signals → 0DTE (same day expiry)
- 15M/30M/60M signals → Weekly (next Friday)
- 240M signals → Monthly (30-45 DTE)

**Strike Selection:**
- LONG signals → ATM or slightly OTM calls
- SHORT signals → ATM or slightly OTM puts
- Use current price + 0.5% for OTM

#### 2.3 Greeks Calculator
**Black-Scholes Implementation:**
- Delta: Directional exposure (-1 to +1)
- Gamma: Delta sensitivity to price moves
- Theta: Time decay per day
- Vega: IV sensitivity
- IV: Implied volatility (estimate from market)

**Fallback Values:**
- If calculation fails, use conservative estimates
- Delta: 0.5 for ATM, 0.3 for OTM
- Theta: -0.05 per day for 0DTE, -0.02 for weekly

#### 2.4 Fill Simulation
**Spread Modeling:**
- 0DTE: 3-5% spread
- Weekly: 2-3% spread
- Monthly: 1-2% spread

**Slippage:**
- Market orders: 0.5-1% slippage
- Limit orders: 0% slippage (assume filled at limit)

**Partial Fills:**
- Orders >50 contracts: 85% fill rate
- Orders ≤50 contracts: 100% fill rate

#### 2.5 Ledger Integration
**Update Execution Field:**
```typescript
execution: {
  option_type: 'CALL' | 'PUT',
  strike: number,
  expiry: string,
  dte: number,
  contracts: number,
  entry_price: number,
  entry_iv: number,
  entry_delta: number,
  entry_theta: number,
  entry_gamma: number,
  entry_vega: number,
  spread_cost: number,
  slippage: number,
  fill_quality: 'FULL' | 'PARTIAL',
  filled_contracts: number,
  commission: number,
  underlying_at_entry: number,
  risk_amount: number
}
```

---

### STEP 3: Position Tracking 🎯 MEDIUM PRIORITY

**Goal:** Monitor open paper trades and calculate real-time P&L

**Components to Build:**

#### 3.1 Position Monitor Service
**Location:** `src/phase25/services/position-monitor.service.ts`

**Responsibilities:**
- Track all open positions (EXECUTE decisions with no exit)
- Update mark-to-market P&L every minute
- Calculate current Greeks
- Check if targets/stops are hit
- Trigger exit simulation when conditions met

**Key Functions:**
```typescript
interface IPositionMonitor {
  getOpenPositions(): Position[];
  updatePosition(id: string, currentPrice: number): void;
  checkExitConditions(position: Position): ExitTrigger | null;
  calculateCurrentPnL(position: Position, currentPrice: number): number;
}
```

#### 3.2 Open Positions Dashboard
**Location:** `src/components/dashboard/OpenPositionsPanel.tsx`

**Display:**
- Table of open positions
- Columns:
  - Ticker
  - Direction (LONG/SHORT)
  - Contract (strike, expiry, DTE)
  - Entry Price
  - Current Price
  - P&L ($)
  - P&L (%)
  - Current Delta
  - Time in Trade
  - Distance to Target 1
  - Distance to Stop
- Color coding: Green (profit), Red (loss)
- Click to see full details

**Data Source:** Query ledger for entries with `execution` but no `exit`

#### 3.3 Position Detail Modal
**Display:**
- Full execution details
- Current Greeks vs Entry Greeks
- P&L attribution breakdown
- Target/Stop levels
- Time decay chart
- Exit conditions

---

### STEP 4: Exit Simulation 🎯 MEDIUM PRIORITY

**Goal:** Close positions when targets/stops are hit

**Components to Build:**

#### 4.1 Exit Simulator Service
**Location:** `src/phase25/services/exit-simulator.service.ts`

**Responsibilities:**
- Monitor price action for open positions
- Detect when targets/stops are hit
- Simulate exit fill (spread, slippage)
- Calculate final P&L
- Attribute P&L to Greeks components
- Update ledger with exit data

**Exit Triggers:**
1. **Target 1 Hit** - Price reaches target_1 from signal
2. **Target 2 Hit** - Price reaches target_2 from signal
3. **Stop Loss Hit** - Price reaches stop_loss from signal
4. **Theta Decay** - Option loses >50% of value from theta
5. **Time Exit** - EOD for 0DTE, 3 days for weekly, 7 days for monthly
6. **Manual Exit** - User-triggered (future)

#### 4.2 P&L Attribution Calculator
**Location:** `src/phase25/utils/pnl-attribution.ts`

**Calculate:**
- **Delta P&L** - From underlying price movement
- **IV P&L** - From implied volatility changes
- **Theta P&L** - From time decay
- **Gamma P&L** - From delta changes

**Formula:**
```
Total P&L = Delta P&L + IV P&L + Theta P&L + Gamma P&L
```

**Validation:**
- Sum of components should equal total P&L (within rounding)

#### 4.3 Exit Data Storage
**Update Ledger Entry:**
```typescript
exit: {
  exit_time: number,
  exit_price: number,
  exit_iv: number,
  exit_delta: number,
  underlying_at_exit: number,
  pnl_gross: number,
  pnl_net: number,
  hold_time_seconds: number,
  exit_reason: 'TARGET_1' | 'TARGET_2' | 'STOP_LOSS' | 'THETA_DECAY' | 'TIME',
  pnl_from_delta: number,
  pnl_from_iv: number,
  pnl_from_theta: number,
  pnl_from_gamma: number,
  total_commission: number,
  total_spread_cost: number,
  total_slippage: number
}
```

---

### STEP 5: Performance Metrics 🎯 MEDIUM PRIORITY

**Goal:** Measure and display trading performance

**Components to Build:**

#### 5.1 Metrics Calculator Service
**Location:** `src/phase25/services/metrics-calculator.service.ts`

**Calculate:**
- **Win Rate** - % of trades that are profitable
- **Average Win** - Average profit on winning trades
- **Average Loss** - Average loss on losing trades
- **Average R-Multiple** - Average P&L / Risk
- **Expectancy** - (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
- **Profit Factor** - Gross Profit / Gross Loss
- **Max Drawdown** - Largest peak-to-trough decline
- **Sharpe Ratio** - Risk-adjusted returns
- **Win Streak** - Longest consecutive wins
- **Loss Streak** - Longest consecutive losses

**Minimum Sample Size:** 30 trades (return INSUFFICIENT_DATA if less)

#### 5.2 Performance Dashboard
**Location:** `src/components/dashboard/PerformanceMetricsPanel.tsx`

**Display:**
- Key metrics in card format
- Win rate with progress bar
- Expectancy with color coding
- P&L chart (cumulative)
- Drawdown chart
- Trade distribution histogram
- Performance by timeframe
- Performance by quality
- Performance by decision confidence

#### 5.3 Attribution Analysis
**Display:**
- P&L breakdown by Greek component
- Pie chart: Delta vs IV vs Theta vs Gamma
- Identify which component drives profits
- Identify which component causes losses

---

### STEP 6: Feedback & Learning 🎯 LOW PRIORITY

**Goal:** Learn from decisions and improve over time

**Components to Build:**

#### 6.1 Decision Analysis Service
**Location:** `src/phase25/services/decision-analyzer.service.ts`

**Analyze:**
- Which gate combinations lead to wins?
- Which confidence levels are most accurate?
- Which timeframes perform best?
- Which quality levels are worth trading?
- Which market regimes are favorable?
- Which position sizes are optimal?

**Output:**
- Learning suggestions (human-approved only)
- Performance reports by feature
- Recommendations for rule adjustments

#### 6.2 Learning Dashboard
**Location:** `src/components/dashboard/LearningPanel.tsx`

**Display:**
- Performance by setup type
- Gate effectiveness analysis
- Confidence calibration chart
- Regime-specific performance
- Suggested rule adjustments (pending approval)

#### 6.3 Hypothetical Tracking
**For SKIP/WAIT decisions:**
- Track what would have happened if we traded
- Calculate hypothetical P&L
- Identify false negatives (skipped winners)
- Identify true negatives (skipped losers)

---

## Implementation Priority

### Phase 2.6.1: Visualization (Week 1)
**Goal:** See what's happening

1. ✅ Decision Card showing current decision
2. ✅ Decision Breakdown Panel with gates
3. ✅ Decision History Table
4. ✅ Reasons display

**Deliverable:** Dashboard tab showing Phase 2.5 decisions

---

### Phase 2.6.2: Paper Execution (Week 2)
**Goal:** Simulate trades

1. ✅ Paper Executor Service
2. ✅ Contract selection logic
3. ✅ Greeks calculator
4. ✅ Fill simulation
5. ✅ Ledger integration

**Deliverable:** EXECUTE decisions create paper trades

---

### Phase 2.6.3: Position Tracking (Week 3)
**Goal:** Monitor open trades

1. ✅ Position Monitor Service
2. ✅ Open Positions Panel
3. ✅ Real-time P&L updates
4. ✅ Position Detail Modal

**Deliverable:** Dashboard showing open positions

---

### Phase 2.6.4: Exit Simulation (Week 4)
**Goal:** Close trades automatically

1. ✅ Exit Simulator Service
2. ✅ Target/Stop detection
3. ✅ P&L attribution
4. ✅ Ledger exit updates

**Deliverable:** Positions close automatically

---

### Phase 2.6.5: Performance Metrics (Week 5)
**Goal:** Measure results

1. ✅ Metrics Calculator Service
2. ✅ Performance Dashboard
3. ✅ Attribution Analysis
4. ✅ Charts and visualizations

**Deliverable:** Performance metrics displayed

---

### Phase 2.6.6: Feedback Loop (Week 6)
**Goal:** Learn and improve

1. ✅ Decision Analyzer Service
2. ✅ Learning Dashboard
3. ✅ Hypothetical tracking
4. ✅ Suggestions system

**Deliverable:** Learning insights and recommendations

---

## Technical Requirements

### Database Migration (Critical)
**Current:** In-memory ledger (data lost on restart)  
**Required:** PostgreSQL + TimescaleDB

**Schema:**
```sql
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  engine_version VARCHAR(20),
  signal JSONB,
  decision VARCHAR(10),
  decision_breakdown JSONB,
  confluence_score DECIMAL(5,2),
  execution JSONB,
  exit JSONB,
  regime JSONB
);

SELECT create_hypertable('ledger_entries', 'created_at');
CREATE INDEX idx_decision ON ledger_entries (decision);
CREATE INDEX idx_created_at ON ledger_entries (created_at DESC);
```

### Real-Time Updates
**Current:** Polling API every 30 seconds  
**Desired:** WebSocket or Server-Sent Events

**Options:**
1. Pusher (easiest, paid)
2. Socket.io (self-hosted)
3. Server-Sent Events (built-in)

### Background Jobs
**Required for:**
- Position monitoring (every minute)
- Exit checking (every minute)
- Metrics calculation (every hour)

**Options:**
1. Vercel Cron Jobs (limited)
2. Upstash QStash (serverless)
3. BullMQ + Redis (self-hosted)

---

## Testing Strategy

### Unit Tests
- Paper executor contract selection
- Greeks calculation accuracy
- Fill simulation logic
- P&L attribution math
- Metrics calculation

### Integration Tests
- End-to-end: Webhook → Decision → Execution → Exit
- Ledger storage and retrieval
- API endpoints
- Dashboard data flow

### Simulation Tests
- Run 100 simulated trades
- Verify all trades close properly
- Check P&L attribution sums correctly
- Validate metrics calculations

---

## Success Metrics

### Phase 2.6 Complete When:
1. ✅ Dashboard shows Phase 2.5 decisions in real-time
2. ✅ EXECUTE decisions trigger paper trades
3. ✅ Open positions are tracked and displayed
4. ✅ Exits happen automatically
5. ✅ Performance metrics are calculated
6. ✅ 100+ paper trades executed successfully
7. ✅ Win rate, expectancy, and P&L are visible
8. ✅ Learning insights are generated

---

## Future: Phase 2.7 - Real Auto-Trading

### Broker Integration (Alpaca)
1. Connect Alpaca API
2. Place real option orders
3. Monitor real fills
4. Track real positions
5. Handle real exits

### Safety Systems
1. Position size limits
2. Daily loss limits
3. Max open positions
4. Kill switch (emergency stop)
5. Human approval for large trades

### Risk Management
1. Portfolio-level risk tracking
2. Correlation analysis
3. Exposure limits by ticker
4. Volatility-adjusted sizing

---

## Next Immediate Actions

### 1. Create Phase 2.5 Dashboard Tab (TODAY)
- Add new tab to dashboard
- Create Decision Card component
- Wire up `/api/decisions` endpoint
- Display most recent decision

### 2. Build Paper Executor (THIS WEEK)
- Implement contract selection
- Add Greeks calculator
- Create fill simulator
- Integrate with decision orchestrator

### 3. Test End-to-End (THIS WEEK)
- Send test webhooks
- Verify decisions are made
- Confirm paper trades are created
- Check ledger storage

---

## Questions to Answer

1. **Database:** When to migrate from in-memory to PostgreSQL?
2. **Real-time:** Do we need WebSockets or is polling OK?
3. **Background Jobs:** Which job scheduler to use?
4. **Broker:** When to start Alpaca integration?
5. **Safety:** What risk limits should we enforce?
6. **Learning:** Should rule adjustments be auto-applied or human-approved?

---

## Resources Needed

### Development
- [ ] PostgreSQL database (Supabase or Neon)
- [ ] Redis for caching (Upstash)
- [ ] Job scheduler (QStash or BullMQ)
- [ ] Real-time service (Pusher or Socket.io)

### APIs
- [x] Tradier (options data)
- [x] TwelveData (market stats)
- [x] Alpaca (liquidity + future trading)
- [ ] Alpaca Paper Trading account

### Monitoring
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (Vercel Analytics)
- [ ] Logging (Logtail or Papertrail)

---

## Summary

**Current State:** Phase 2.5 makes decisions but we can't see them or act on them.

**Phase 2.6 Goal:** Complete the loop - visualize decisions, execute paper trades, track performance, and learn.

**Timeline:** 6 weeks to full paper trading with feedback loop.

**Next Step:** Build Phase 2.5 Dashboard Tab to visualize decisions.

---

**Let's start with visualization so you can see what the decision engine is doing!**
