# Webhook Tester Guide

**URL**: https://ultimateoption.vercel.app/webhook-tester  
**Purpose**: Interactive testing of Phase 2.5 webhook flow in production

---

## Overview

The Webhook Tester is a browser-based tool that allows you to send test webhooks to the Phase 2.5 decision engine and see results in real-time. Perfect for:

- Testing the complete webhook → decision flow
- Validating Phase 2.5 decision logic
- Demonstrating the system to stakeholders
- Debugging webhook processing issues
- Continuous testing with auto-send mode

---

## Features

### 1. Staggered Webhook Testing
Sends all 3 webhook types in sequence, simulating real-world timing:
- **3-minute**: SATY Phase webhook (regime context)
- **5-minute**: Trend/MTF webhook (alignment context)
- **15-minute**: TradingView Signal webhook (triggers decision)

### 2. Auto-Send Mode
Continuously sends webhooks every 3 minutes for ongoing testing.

### 3. Real-Time Results
See webhook responses immediately:
- Success/failure status
- Response time (ms)
- Decision outcome (EXECUTE/WAIT/SKIP)
- Confidence score
- Error messages (if any)

### 4. Configurable Parameters
- Ticker symbol (default: SPY)
- Current price (default: $450.25)

### 5. Direct Dashboard Link
One-click access to view decisions on Phase 2.5 dashboard.

---

## How to Use

### Step 1: Access the Page
Visit: https://ultimateoption.vercel.app/webhook-tester

### Step 2: Configure Parameters
- **Ticker Symbol**: Enter the stock ticker (e.g., SPY, AAPL, TSLA)
- **Current Price**: Enter the current market price

### Step 3: Send Webhooks

**Option A: Single Test**
1. Click "Send Staggered Test (3→5→15min)"
2. Watch as 3 webhooks are sent in sequence
3. Results appear below in real-time

**Option B: Continuous Testing**
1. Click "Start Auto-Send (Every 3min)"
2. Webhooks will be sent automatically every 3 minutes
3. Click "Stop Auto-Send" to stop

### Step 4: View Results
Results appear below showing:
- ✓ Success or ✗ Failure
- Webhook type (SATY, TREND, SIGNAL)
- Timeframe (3min, 5min, 15min)
- Status code and response time
- Message from server
- Decision outcome (if applicable)

### Step 5: Check Dashboard
Click "View Dashboard →" to see the decision on the Phase 2.5 tab.

---

## Example Workflow

### Testing a Complete Flow

1. **Configure**:
   - Ticker: SPY
   - Price: 450.25

2. **Send Test**:
   - Click "Send Staggered Test"
   - Wait ~6 seconds for all 3 webhooks

3. **Review Results**:
   ```
   ✓ SATY (3min)
   Status: 200 | 264ms
   Message: Context updated from SATY_PHASE, waiting for complete context

   ✓ TREND (5min)
   Status: 200 | 35ms
   Message: Success

   ✓ SIGNAL (15min)
   Status: 200 | 1063ms
   Message: Decision made: WAIT (confidence: 69.7)
   Decision: WAIT (69.7% confidence)
   ```

4. **View Dashboard**:
   - Click "View Dashboard"
   - Go to Phase 2.5 tab
   - See decision card with full breakdown

---

## What Each Webhook Does

### SATY Phase Webhook (3min)
**Purpose**: Provides regime context

**What it sends**:
- Phase information (1-4)
- Bias (BULLISH/BEARISH/NEUTRAL)
- Confidence score
- Volatility level
- Market structure

**Expected Response**:
```
Status: 200
Message: Context updated from SATY_PHASE, waiting for complete context
```

### Trend Webhook (5min)
**Purpose**: Provides multi-timeframe alignment

**What it sends**:
- Trend direction for each timeframe
- Strength scores
- RSI values
- Overall alignment

**Expected Response**:
```
Status: 200
Message: Success
```

### Signal Webhook (15min)
**Purpose**: Triggers decision with expert analysis

**What it sends**:
- Signal type (LONG/SHORT)
- AI score
- Quality grade
- Entry/exit prices
- Risk parameters

**Expected Response**:
```
Status: 200
Message: Decision made: WAIT (confidence: 69.7)
Decision: WAIT (69.7% confidence)
```

---

## Understanding Results

### Success Indicators
- ✓ Green checkmark
- Status: 200
- Message shows decision or context update

### Failure Indicators
- ✗ Red X
- Status: 400, 401, 500
- Error message explains what went wrong

### Decision Outcomes

**EXECUTE** (Confidence ≥ 75%)
```
Decision: EXECUTE (85.5% confidence)
```
- All gates passed
- High confidence
- Trade would be executed

**WAIT** (Confidence 60-74%)
```
Decision: WAIT (69.7% confidence)
```
- All gates passed
- Moderate confidence
- Waiting for better setup

**SKIP** (Confidence < 60%)
```
Decision: SKIP (45.2% confidence)
```
- One or more gates failed
- Low confidence
- Trade rejected

---

## Auto-Send Mode

### When to Use
- Continuous testing during development
- Load testing the system
- Demonstrating real-time decision making
- Monitoring system stability

### How It Works
1. Click "Start Auto-Send"
2. Sends staggered test immediately
3. Repeats every 3 minutes
4. Green indicator shows it's active
5. Click "Stop Auto-Send" to stop

### Important Notes
- Webhooks are sent every 3 minutes
- Each cycle sends all 3 webhooks (SATY → Trend → Signal)
- Results accumulate in the list below
- Use "Clear Results" to reset the list

---

## Troubleshooting

### No Results Appearing
**Problem**: Clicked button but nothing happens  
**Solution**: Check browser console for errors, refresh page

### All Webhooks Failing
**Problem**: All show red X with status 0  
**Solution**: Check internet connection, verify production URL is accessible

### Signal Webhook Fails
**Problem**: SATY and Trend succeed, but Signal fails  
**Solution**: Check error message, may be validation issue with payload

### Decision Shows SKIP
**Problem**: Expected EXECUTE but got SKIP  
**Solution**: Check confidence score and gate results on dashboard

### Context Status Shows "Missing"
**Problem**: Dashboard shows webhooks as missing  
**Solution**: Wait 30 seconds for database to update, refresh dashboard

---

## Advanced Usage

### Testing Different Scenarios

**Bullish Setup**:
- Use LONG signal
- High AI score (8.5)
- HIGH quality
- Bullish trend alignment

**Bearish Setup**:
- Change signal type to SHORT
- Adjust trend to bearish
- Test with different confidence levels

**Edge Cases**:
- Very low price ($1.00)
- Very high price ($10,000)
- Different tickers (AAPL, TSLA, etc.)

### Monitoring System Health

1. **Start Auto-Send**
2. **Watch for patterns**:
   - Consistent response times?
   - Any failures?
   - Decision consistency?
3. **Check Dashboard**:
   - Context Status updates?
   - Decisions appearing?
   - Gate scores reasonable?

---

## Integration with Dashboard

### Viewing Decisions

After sending webhooks:

1. **Click "View Dashboard"**
2. **Go to Phase 2.5 tab**
3. **See**:
   - Current Decision card
   - Gate results with scores
   - Expert analysis
   - Market conditions
   - Position sizing

### Context Status

Check the Context Status panel:
- Shows webhook receipt times
- Displays completeness percentage
- Lists all sources (required and optional)

### Webhook Receipts

Go to Webhooks tab:
- See all webhook receipts
- Check payloads and headers
- Verify timing and status

---

## Best Practices

### For Testing
1. Start with single test before auto-send
2. Clear results between test runs
3. Check dashboard after each test
4. Verify context status updates

### For Demonstrations
1. Use auto-send for continuous flow
2. Keep dashboard open in another tab
3. Show real-time decision updates
4. Explain gate scores and confidence

### For Debugging
1. Send single webhook at a time
2. Check error messages carefully
3. Verify payload format
4. Review webhook receipts page

---

## API Endpoints Used

The tester sends webhooks to these endpoints:

1. **SATY Phase**: `/api/phase25/webhooks/saty-phase`
2. **Trend**: `/api/webhooks/trend`
3. **Signal**: `/api/phase25/webhooks/signals`

All endpoints:
- Accept POST requests
- Require `Content-Type: application/json`
- Return JSON responses
- Log to webhook_receipts table

---

## Limitations

### Rate Limiting
- No built-in rate limiting in tester
- Be mindful of server load
- Use auto-send responsibly

### Data Persistence
- Results only stored in browser
- Refresh clears results
- Use "Clear Results" to reset

### Authentication
- No authentication required for testing
- Production webhooks may require auth
- Debug token can be configured

---

## Keyboard Shortcuts

- **Enter**: Send staggered test (when focused on input)
- **Escape**: Stop auto-send (if active)
- **Ctrl+K**: Clear results

---

## Mobile Support

The tester is fully responsive:
- Works on tablets and phones
- Touch-friendly buttons
- Scrollable results list
- Optimized layout for small screens

---

## Support

If you encounter issues:

1. **Check Browser Console**: Look for JavaScript errors
2. **Verify URL**: Ensure you're on the correct production URL
3. **Test Individual Endpoints**: Use curl or Postman
4. **Review Documentation**: Check WEBHOOK_FORMATS.md
5. **Check Vercel Logs**: Look for server-side errors

---

## Quick Reference

### URLs
- **Tester**: https://ultimateoption.vercel.app/webhook-tester
- **Dashboard**: https://ultimateoption.vercel.app
- **Phase 2.5 Tab**: https://ultimateoption.vercel.app (click Phase 2.5)

### Buttons
- **Send Staggered Test**: Send all 3 webhooks once
- **Start Auto-Send**: Send webhooks every 3 minutes
- **Stop Auto-Send**: Stop automatic sending
- **Clear Results**: Remove all results from list
- **View Dashboard**: Open main dashboard

### Timing
- SATY Phase: Sent first
- Trend: Sent 2 seconds after SATY
- Signal: Sent 2 seconds after Trend
- Auto-send: Repeats every 3 minutes

---

**Status**: ✅ Ready for production use  
**Access**: https://ultimateoption.vercel.app/webhook-tester
