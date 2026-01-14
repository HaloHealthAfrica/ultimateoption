# Webhook End-to-End Test Plan

## Objective
Test that all three webhook types (saty-phase, signals, trend) are:
1. Received successfully without authentication
2. Parsed and validated correctly
3. Processed through the system
4. Stored appropriately
5. Available for retrieval

## Test Scenarios

### Scenario 1: SATY Phase Webhook
**Endpoint:** POST /api/webhooks/saty-phase

**Test Cases:**
1. Valid SATY phase webhook (text-wrapped format)
2. Valid SATY phase webhook (direct format)
3. Valid SATY phase webhook (flexible/adapted format)
4. Multiple SATY webhooks in sequence

**Expected Results:**
- HTTP 200 response
- Phase stored in PhaseStore
- Event published to executionPublisher
- Webhook receipt recorded in audit log
- Authentication method: "no-auth-provided"

### Scenario 2: Signals Webhook
**Endpoint:** POST /api/webhooks/signals

**Test Cases:**
1. Valid signals webhook (BUY signal)
2. Valid signals webhook (SELL signal)
3. Multiple signals webhooks in sequence

**Expected Results:**
- HTTP 200 response
- Signal stored in SignalStore
- Event published to executionPublisher
- Webhook receipt recorded in audit log
- Authentication method: "no-auth-provided"

### Scenario 3: Trend Webhook
**Endpoint:** POST /api/webhooks/trend

**Test Cases:**
1. Valid trend webhook (BULLISH)
2. Valid trend webhook (BEARISH)
3. Multiple trend webhooks in sequence

**Expected Results:**
- HTTP 200 response
- Trend stored in TrendStore
- Event published to executionPublisher
- Webhook receipt recorded in audit log
- Authentication method: "no-auth-provided"

### Scenario 4: Mixed Webhook Sequence
**Test Cases:**
1. Send SATY → Signals → Trend in sequence
2. Send multiple of each type interleaved
3. Verify all are processed correctly

**Expected Results:**
- All webhooks processed successfully
- Correct order maintained in audit log
- All data available via respective APIs

## Test Execution Steps

1. **Setup:** Ensure local server is running
2. **Execute:** Send test webhooks using curl/fetch
3. **Verify:** Check responses, audit log, and data stores
4. **Cleanup:** Review results and document findings

## Success Criteria
- ✅ All webhooks return HTTP 200
- ✅ No authentication errors
- ✅ All data correctly stored
- ✅ All webhooks visible in audit log
- ✅ Data retrievable via GET endpoints
