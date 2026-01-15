# Phase 2.5 End-to-End Simulation Guide

## Overview

The `simulate-phase25-e2e.js` script simulates complete webhook flows using real webhook data to validate the Phase 2.5 integration and identify any gaps.

## Quick Start

```bash
# Start the development server
npm run dev

# In another terminal, run the simulation
node simulate-phase25-e2e.js
```

## Test Scenarios

### Scenario 1: SPY LONG Signal with High Confidence
**Purpose**: Tests optimal conditions for EXECUTE decision

**Flow**:
1. Send SATY Phase webhook (SPY, Accumulation, 95% confidence)
2. Send Signal webhook (LONG, AI score 9.5, EXTREME quality)

**Expected Result**: Decision EXECUTE with high confidence (>80)

**What It Tests**:
- Multi-source context aggregation
- High confidence regime alignment
- Strong signal quality processing
- Complete decision packet generation

---

### Scenario 2: AAPL SHORT Signal with Medium Confidence
**Purpose**: Tests bearish scenario with moderate confidence

**Flow**:
1. Send SATY Phase webhook (AAPL, Distribution, 75% confidence)
2. Send Signal webhook (SHORT, AI score 7.8, HIGH quality)

**Expected Result**: Decision WAIT or EXECUTE depending on final confidence (65-80)

**What It Tests**:
- Bearish regime handling
- Medium confidence threshold logic
- SHORT signal processing
- Confidence calculation accuracy

---

### Scenario 3: Low Confidence Rejection
**Purpose**: Tests rejection due to insufficient confidence

**Flow**:
1. Send SATY Phase webhook (TSLA, Low confidence 45%)
2. Send Signal webhook (LONG, AI score 6.2, MEDIUM quality)

**Expected Result**: Decision SKIP due to low confidence (<65)

**What It Tests**:
- Low confidence rejection logic
- Confidence gate enforcement
- SKIP decision reasoning
- Risk management rules

---

### Scenario 4: Signal-Only (Incomplete Context)
**Purpose**: Tests behavior when context is incomplete

**Flow**:
1. Send Signal webhook without prior SATY Phase

**Expected Result**: Context incomplete, waiting for SATY phase data

**What It Tests**:
- Context completeness validation
- Multi-source requirement enforcement
- Graceful handling of incomplete data
- Context store state management

---

## What the Simulation Checks

### Response Validation
- ✅ HTTP status codes (200 for success, 400 for errors)
- ✅ Response structure completeness
- ✅ Required fields presence
- ✅ Data type correctness

### Phase 2.5 Specific Checks
- ✅ `engineVersion` field (should be "2.5.0")
- ✅ `requestId` field (for request tracking)
- ✅ `processingTime` field (performance metrics)
- ✅ `timestamp` field (audit trail)

### Decision Packet Validation
When a decision is made, checks for:
- ✅ `action` field (EXECUTE/WAIT/SKIP)
- ✅ `confidenceScore` field (0-100)
- ✅ `reasons` array (decision reasoning)
- ✅ `direction` field (LONG/SHORT for EXECUTE)
- ✅ `finalSizeMultiplier` field (position sizing)
- ✅ `gateResults` object (gate pass/fail details)
- ✅ `inputContext` snapshot (reproducibility)
- ✅ `marketSnapshot` (market conditions)

### Gap Detection
The simulation identifies:
- 🔴 **ERROR**: Request failures, service errors
- 🟡 **MISSING_FIELD**: Missing required response fields
- 🟡 **INCOMPLETE_DECISION**: Decision packets missing data
- 🟢 **SUCCESS**: All checks passed

---

## Output Format

### Scenario Execution
```
================================================================================
Scenario: SPY LONG Signal with High Confidence
================================================================================
Description: Tests complete flow: SATY phase → Signal → Decision

────────────────────────────────────────────────────────────────────────────────
Step 1/2: Send SATY Phase (Accumulation)
────────────────────────────────────────────────────────────────────────────────

Endpoint: POST /api/phase25/webhooks/saty-phase
Payload: {...}

Response Status: 200
Response Data:
{
  "success": true,
  "message": "Context updated from SATY_PHASE, waiting for complete context",
  "processingTime": 12,
  "engineVersion": "2.5.0",
  "requestId": "req_1705334567890_abc123"
}

✅ Step completed successfully
```

### Final Summary
```
================================================================================
End-to-End Simulation Summary
================================================================================

Total Scenarios: 4
✅ Successful: 3
❌ Failed: 1
🔍 Total Gaps Identified: 2

────────────────────────────────────────────────────────────────────────────────
Gaps by Type:
────────────────────────────────────────────────────────────────────────────────

MISSING_FIELD (2 occurrences):
  • Missing engineVersion field
    Step: Send Signal (LONG with high AI score)
    Details: Response should include engine version
```

---

## Interpreting Results

### ✅ All Scenarios Pass
Phase 2.5 integration is working correctly! All webhooks are processed properly, decisions are made with complete data, and responses include all required fields.

**Next Steps**:
1. Deploy to staging environment
2. Run with production-like traffic
3. Monitor metrics and performance

### ⚠️ Some Gaps Identified
Phase 2.5 is functional but has minor issues that should be addressed.

**Common Gaps**:
- Missing response fields (engineVersion, requestId, processingTime)
- Incomplete decision packets (missing reasons, gate results)
- Missing audit trail data

**Next Steps**:
1. Review gap details in simulation output
2. Fix identified issues
3. Re-run simulation to verify fixes

### ❌ Scenarios Failing
Phase 2.5 has critical issues that need immediate attention.

**Common Failures**:
- Service initialization errors
- Context store not working
- Decision engine not accessible
- Market context builder failures

**Next Steps**:
1. Check service logs for errors
2. Verify ServiceFactory initialization
3. Test individual services in isolation
4. Fix critical issues before re-testing

---

## Customizing the Simulation

### Change Base URL
```bash
BASE_URL=https://your-domain.com node simulate-phase25-e2e.js
```

### Add New Scenarios
Edit `simulate-phase25-e2e.js` and add to the `scenarios` object:

```javascript
scenario5: {
  name: 'Your Scenario Name',
  description: 'What this scenario tests',
  steps: [
    {
      name: 'Step description',
      endpoint: '/api/phase25/webhooks/signals',
      payload: { /* your payload */ },
      expectedResult: 'What you expect to happen'
    }
  ]
}
```

### Modify Test Data
Update the payload objects in each scenario step to test different conditions:
- Change confidence scores
- Modify AI scores
- Test different symbols
- Vary timeframes
- Adjust quality levels

---

## Troubleshooting

### Simulation Won't Start
```bash
# Check if server is running
curl http://localhost:3000/api/phase25/webhooks/health

# If not running, start it
npm run dev
```

### All Scenarios Fail with Connection Errors
- Verify BASE_URL is correct
- Check if server is accessible
- Ensure no firewall blocking requests

### Scenarios Pass But No Decisions Made
- Check if ServiceFactory is initialized
- Verify DecisionOrchestratorService is created
- Review server logs for initialization errors

### Decision Packets Missing Fields
- Check DecisionEngineService implementation
- Verify all required fields are populated
- Review decision packet structure in design.md

---

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Phase 2.5 E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run dev &
      - run: sleep 10  # Wait for server to start
      - run: node simulate-phase25-e2e.js
```

---

## Performance Benchmarks

Expected performance metrics:

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Processing Time | <100ms | <500ms | >500ms |
| Response Time | <200ms | <1000ms | >1000ms |
| Success Rate | >99% | >95% | <95% |
| Context Build Time | <50ms | <200ms | >200ms |

---

## Related Documentation

- `PHASE25_WEBHOOK_INTEGRATION.md` - Complete integration guide
- `PHASE25_INTEGRATION_COMPLETE.md` - Integration summary
- `PHASE25_QUICK_START.md` - Quick reference
- `.kiro/specs/decision-engine-phase25/design.md` - Architecture details

---

## Support

If you encounter issues:
1. Check simulation output for specific gap details
2. Review server logs for errors
3. Verify all Phase 2.5 services are initialized
4. Test individual endpoints with curl
5. Check health endpoints for system status

---

**Last Updated**: January 15, 2026
**Version**: Phase 2.5.0
