# Next Steps - Action Plan

**Date**: January 16, 2026  
**Status**: Post Dual-Write Implementation  
**Timeline**: 4 weeks

---

## ✅ Completed

- [x] **Gap 1: Webhook Routing** (CRITICAL)
  - Implemented dual-write from Phase 2 to Phase 2.5
  - All 3 webhook endpoints modified
  - Build passed, ready for deployment
  - **Impact**: Phase 2.5 decisions: 2 → 1,000+ within 24 hours

---

## 🎯 Next Gaps to Fix (Prioritized)

### Week 1: Context & Validation Improvements

#### 🔴 Priority 1: Extend Context Timeout (Day 1 - 15 minutes)

**Problem**: 15-minute timeout too strict, contexts expire before completion

**Solution**:
```bash
# Update .env.local or production environment
PHASE25_CONTEXT_TIMEOUT_MINUTES=30
```

**Expected Impact**:
- Context completion: 20-30% → 35-45%
- Decisions per day: 1,000 → 1,300-1,500

**Effort**: 15 minutes (just environment variable change)

---

#### 🟡 Priority 2: Enhanced Failure Logging (Day 1-2 - 1 hour)

**Problem**: 48.4% webhook failure rate, don't know why

**Solution**: Add detailed logging to all webhook endpoints

```typescript
// In each webhook route.ts
if (!adapterResult.success) {
  console.error('Webhook validation failed:', {
    kind: 'saty-phase',
    error: adapterResult.error,
    payload: JSON.stringify(body, null, 2),
    missing_fields: adapterResult.details?.missing_fields,
    available_fields: Object.keys(body),
    timestamp: Date.now()
  });
  
  // Also log to file for analysis
  await logFailedWebhook({
    kind: 'saty-phase',
    payload: body,
    error: adapterResult.error,
    details: adapterResult.details
  });
}
```

**Expected Impact**:
- Identify exact failure patterns
- Guide adapter improvements
- Reduce failures by 20-30%

**Effort**: 1 hour

**Files to modify**:
- `src/app/api/webhooks/signals/route.ts`
- `src/app/api/webhooks/saty-phase/route.ts`
- `src/app/api/webhooks/trend/route.ts`

---

#### 🟡 Priority 3: Analyze Failure Patterns (Day 3 - 2 hours)

**Problem**: SATY Phase has 66% failure rate (worst offender)

**Solution**: Analyze logged failures and identify patterns

```bash
# After 24 hours of logging
# Analyze failed webhook patterns
node analyze-webhook-failures.js

# Output:
# Top 5 failure reasons:
# 1. Missing 'symbol' field (45%)
# 2. Missing 'bias' field (30%)
# 3. Invalid timeframe format (15%)
# 4. Missing oscillator_value (8%)
# 5. Other (2%)
```

**Expected Impact**:
- Clear understanding of failure causes
- Targeted adapter improvements
- Prioritize fixes by impact

**Effort**: 2 hours (create analysis script + review)

---

#### 🟡 Priority 4: Improve Adapters (Day 4-5 - 3 hours)

**Problem**: Adapters still reject valid-looking payloads

**Solution**: Based on failure analysis, make adapters more flexible

**Example improvements**:
```typescript
// SATY Adapter - accept more field variations
function extractSymbol(data: Record<string, unknown>): string | null {
  // Try more locations
  if (data.symbol) return data.symbol;
  if (data.ticker) return data.ticker;
  if (data.asset) return data.asset;
  if (data.instrument?.symbol) return data.instrument.symbol;
  if (data.instrument?.ticker) return data.instrument.ticker;
  if (data.instrument?.asset) return data.instrument.asset;
  
  // Try parsing from text field
  if (data.text && typeof data.text === 'string') {
    const match = data.text.match(/symbol[:\s]+([A-Z]+)/i);
    if (match) return match[1];
  }
  
  return null;
}
```

**Expected Impact**:
- Webhook success: 51.6% → 65-70%
- SATY Phase success: 34.1% → 55-65%
- +500-1,000 successful webhooks per day

**Effort**: 3 hours

**Files to modify**:
- `src/webhooks/satyAdapter.ts`
- `src/webhooks/signalAdapter.ts`
- `src/webhooks/trendAdapter.ts`

---

### Week 2: Visibility & Monitoring

#### 🟡 Priority 5: Context Status API (Day 1-2 - 1 hour)

**Problem**: Can't see partial context state or why decisions aren't being made

**Solution**: Create API endpoint to query context state

```typescript
// src/app/api/phase25/context/status/route.ts
export async function GET() {
  const factory = ServiceFactory.getInstance();
  const contextStore = factory.getContextStore();
  
  const stats = contextStore.getCompletenessStats();
  
  return NextResponse.json({
    hasContext: stats.requiredSources.some(s => s.available),
    isComplete: stats.isComplete,
    completeness: stats.overallCompleteness,
    sources: {
      required: stats.requiredSources,
      optional: stats.optionalSources
    },
    timeUntilExpiration: calculateTimeUntilExpiration(stats)
  });
}
```

**Expected Impact**:
- Visibility into context state
- Debug why decisions aren't being made
- Track context completion patterns

**Effort**: 1 hour

---

#### 🟡 Priority 6: Context Dashboard View (Day 3-4 - 3 hours)

**Problem**: Users can't see why no decisions are being made

**Solution**: Add "Context Status" section to Phase 2.5 dashboard

```typescript
// New component: Phase25ContextStatus.tsx
<Card title="Context Status" subtitle="Current context state">
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <span>Completeness</span>
      <span className="text-2xl font-bold">{completeness}%</span>
    </div>
    
    <div className="space-y-2">
      <h4>Required Sources</h4>
      {requiredSources.map(source => (
        <SourceStatus
          key={source.source}
          name={source.source}
          available={source.available}
          age={source.age}
        />
      ))}
    </div>
    
    <div className="text-sm text-white/60">
      {isComplete 
        ? "✓ Context complete, ready for decision"
        : `⏳ Waiting for: ${missingSource}`}
    </div>
  </div>
</Card>
```

**Expected Impact**:
- User-friendly visibility
- Clear understanding of system state
- Reduced support questions

**Effort**: 3 hours

---

#### 🟢 Priority 7: Engine Version Badge & Filter (Day 5 - 45 minutes)

**Problem**: Can't distinguish Phase 2 vs Phase 2.5 decisions

**Solution**: Add version badge and filter to dashboard

```typescript
// In Phase25DecisionCard.tsx
<div className="flex items-center gap-2">
  <span className={classNames(
    'px-2 py-1 rounded text-xs font-medium',
    decision.engine_version.startsWith('2.5')
      ? 'bg-purple-500/20 text-purple-300'
      : 'bg-blue-500/20 text-blue-300'
  )}>
    v{decision.engine_version}
  </span>
  <span className="text-white/60">•</span>
  <span>{formatRelative(decision.timestamp)}</span>
</div>

// In Phase25HistoryTable.tsx
<select onChange={(e) => setEngineFilter(e.target.value)}>
  <option value="ALL">All Engines</option>
  <option value="2.0">Phase 2 Only</option>
  <option value="2.5">Phase 2.5 Only</option>
</select>
```

**Expected Impact**:
- Clear visual distinction
- Easy filtering by engine
- Better A/B testing capability

**Effort**: 45 minutes

---

### Week 3-4: Optimization (Based on Data)

#### 🟡 Priority 8: Context Persistence (If Needed - 4 hours)

**Problem**: Context lost on server restart, expires too quickly

**Solution**: Store partial context in database

```typescript
// Store context in database instead of memory
class ContextStoreService {
  async update(partial: Partial<DecisionContext>, source: WebhookSource) {
    // Save to database
    await db.query(`
      INSERT INTO phase25_context (symbol, source, data, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (symbol, source) 
      DO UPDATE SET data = $3, updated_at = NOW()
    `, [symbol, source, JSON.stringify(partial)]);
  }
  
  async build(): Promise<DecisionContext | null> {
    // Load from database
    const rows = await db.query(`
      SELECT source, data, updated_at
      FROM phase25_context
      WHERE symbol = $1
      AND updated_at > NOW() - INTERVAL '30 minutes'
    `, [symbol]);
    
    // Reconstruct context from rows
    return reconstructContext(rows);
  }
}
```

**Expected Impact**:
- Context survives restarts
- No data loss during deployments
- +20-30% more complete contexts

**Effort**: 4 hours

**When to implement**: If context completion rate is still <50% after Week 2

---

#### 🟢 Priority 9: Decision Outcome Tracking (Optional - 3 hours)

**Problem**: No way to track if decisions are good

**Solution**: Add outcome tracking to ledger

```typescript
// Add outcome field to ledger
ALTER TABLE ledger ADD COLUMN outcome VARCHAR(20);
ALTER TABLE ledger ADD COLUMN outcome_pnl DECIMAL(10,2);
ALTER TABLE ledger ADD COLUMN outcome_updated_at TIMESTAMP;

// API to update outcome
POST /api/ledger/:id/outcome
{
  "outcome": "WIN" | "LOSS" | "NEUTRAL",
  "pnl": 150.50
}
```

**Expected Impact**:
- Track decision quality
- Calculate win rate by confidence
- Optimize decision thresholds

**Effort**: 3 hours

**When to implement**: After Weeks 1-2, if time permits

---

## Quick Reference: What to Do Next

### Immediate (After Dual-Write Deployment)

**Day 1** (30 minutes):
1. Deploy dual-write fix
2. Monitor Phase 2.5 webhook receipts
3. Update `PHASE25_CONTEXT_TIMEOUT_MINUTES=30`
4. Redeploy

**Day 2** (1 hour):
5. Add enhanced failure logging
6. Deploy and let it collect data

**Day 3** (2 hours):
7. Analyze failure logs
8. Identify top 5 failure patterns

**Day 4-5** (3 hours):
9. Improve adapters based on patterns
10. Deploy and measure impact

### Week 2 (5 hours total):
11. Create context status API (1 hour)
12. Add context dashboard view (3 hours)
13. Add engine badge & filter (45 minutes)
14. Deploy and monitor

### Week 3-4 (As Needed):
15. Implement context persistence (if needed)
16. Add outcome tracking (if time permits)
17. Further optimize based on data

---

## Success Criteria

### Week 1 Goals
- [ ] Dual-write deployed and working
- [ ] Context timeout extended to 30 minutes
- [ ] Failure logging collecting data
- [ ] Adapter improvements deployed
- [ ] Webhook success rate: 51.6% → 65%+
- [ ] Decisions per day: 2 → 1,500+

### Week 2 Goals
- [ ] Context status API working
- [ ] Context dashboard view deployed
- [ ] Engine badge & filter working
- [ ] Context completion rate: 20-30% → 40-50%
- [ ] Decisions per day: 1,500 → 2,000+

### Week 3-4 Goals
- [ ] Context persistence (if needed)
- [ ] Outcome tracking (if time permits)
- [ ] Context completion rate: 40-50% → 60%+
- [ ] Decisions per day: 2,000 → 2,500-3,000+

---

## Estimated Time Investment

**Week 1**: 6.5 hours
- Timeout change: 15 min
- Failure logging: 1 hour
- Failure analysis: 2 hours
- Adapter improvements: 3 hours
- Deployment & monitoring: 30 min

**Week 2**: 5 hours
- Context status API: 1 hour
- Context dashboard: 3 hours
- Engine badge/filter: 45 min
- Deployment & monitoring: 15 min

**Week 3-4**: 4-7 hours (optional)
- Context persistence: 4 hours (if needed)
- Outcome tracking: 3 hours (if time permits)

**Total**: 15.5-18.5 hours over 4 weeks

---

## Key Takeaway

The dual-write fix solves the **critical routing issue**. The remaining gaps are **optimization opportunities** to increase the conversion rate from webhooks to decisions.

**Expected progression**:
- **Now**: 2 decisions/day (0.05% conversion)
- **Week 1**: 1,500 decisions/day (35% conversion)
- **Week 2**: 2,000 decisions/day (45% conversion)
- **Week 4**: 2,500-3,000 decisions/day (60% conversion)

Start with Week 1 priorities and adjust based on data! 🚀
