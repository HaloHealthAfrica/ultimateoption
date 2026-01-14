# Webhook Status Report
**Generated:** January 14, 2026

## Executive Summary

Total webhooks received: **1,752**
- ✅ Successful: 221 (12.6%)
- ❌ Failed: 1,531 (87.4%)

## Webhook Status by Type

### 1. SATY Phase Webhooks
**Status:** ✅ **WORKING** (with issues)

**Statistics:**
- Successful: 132 webhooks
- Failed: 1,376 webhooks
- Success rate: 8.7%
- Last successful: Jan 14, 2026 at 15:18:49 (TODAY)

**Issues Found:**
- ❌ **1,376 Trend webhooks are being sent to the SATY phase endpoint**
- These show error: "Wrong endpoint: This appears to be a Trend webhook"
- Trend webhooks have "Trend Change:" header and `timeframes` structure

**Action Required:**
1. Update TradingView alerts for "Trend Change" (all timeframes: 3min, 5min, 15min, etc.)
2. Change webhook URL from `/api/webhooks/saty-phase` to `/api/webhooks/trend`

**Current Status:** SATY phase webhooks ARE working correctly when sent proper SATY data

---

### 2. Signals Webhooks
**Status:** ⚠️ **NOT RECEIVING NEW WEBHOOKS**

**Statistics:**
- Successful: 86 webhooks (historical)
- Failed: 154 webhooks (historical)
- Success rate: 35.8%
- Last successful: **Jan 10, 2026 at 00:45** (4 days ago)
- Last failed: Jan 12, 2026 at 15:32 (authentication errors)

**Issues Found:**
- ❌ **No signals webhooks received since Jan 12**
- Old failures (Jan 12) were authentication errors (now fixed)
- Signals endpoint is ready and working
- **TradingView is not sending signals**

**Action Required:**
1. Check TradingView signals alert configuration
2. Verify alert is enabled
3. Check if market conditions are triggering the alert
4. Test by manually triggering a signal from TradingView

**Current Status:** Endpoint is working, waiting for TradingView to send signals

---

### 3. Trend Webhooks
**Status:** ⚠️ **BARELY USED** (being sent to wrong endpoint)

**Statistics:**
- Successful: 3 webhooks
- Failed: 1 webhook
- Success rate: 75%
- Last successful: Jan 9, 2026 at 03:50 (5 days ago)

**Issues Found:**
- ❌ **Only 4 total trend webhooks ever received at correct endpoint**
- ❌ **1,376 trend webhooks sent to `/api/webhooks/saty-phase` instead**
- Trend webhooks have distinctive format:
  - Header: "3min Trend Change: bearish" (or other timeframes)
  - JSON with `timeframes` object containing tf3min, tf5min, etc.

**Action Required:**
1. Update ALL TradingView "Trend Change" alerts
2. Change webhook URL to `/api/webhooks/trend`
3. This will fix 1,376 failed webhooks!

**Current Status:** Endpoint is working, but webhooks are being sent to wrong URL

---

## Recent Fixes Implemented

### ✅ Database Migration (Jan 14, 2026)
- Added `raw_payload` column to store complete webhook payloads
- Added `headers` column to store HTTP request headers
- Migration completed successfully
- All new webhooks now capture full data for debugging

### ✅ Authentication Made Optional (Jan 14, 2026)
- Removed authentication requirement for all webhook endpoints
- SATY phase, Signals, and Trend webhooks now work without tokens
- Simplified webhook configuration in TradingView

### ✅ Wrong Endpoint Detection (Jan 14, 2026)
- Added detection for trend webhooks sent to SATY phase endpoint
- Clear error messages guide users to correct endpoint
- Helps identify misconfigured TradingView alerts

### ✅ Webhook Details UI (Jan 14, 2026)
- Expandable rows in webhook receipts page
- Shows complete raw payload and headers
- Helps debug webhook issues

### ✅ Diagnostic Endpoints (Jan 14, 2026)
- `/api/webhooks/stats` - Overall webhook statistics
- `/api/webhooks/debug-payload?id=123` - View specific webhook details
- `/api/webhooks/recent-by-kind?kind=signals` - Filter by webhook type
- `/api/webhooks/migrate` - Database migration endpoint

---

## Action Items Summary

### HIGH PRIORITY
1. **Fix Trend Webhook URLs in TradingView**
   - Impact: Will fix 1,376 failed webhooks
   - Change: `/api/webhooks/saty-phase` → `/api/webhooks/trend`
   - Alerts affected: All "Trend Change" alerts (3min, 5min, 15min, etc.)

### MEDIUM PRIORITY
2. **Investigate Signals Alert**
   - Impact: Signals haven't been received since Jan 12
   - Check: TradingView alert configuration
   - Verify: Alert is enabled and triggering conditions are met

### LOW PRIORITY
3. **Monitor Webhook Success Rates**
   - Current overall success rate: 12.6%
   - Target: >90% after fixing trend webhook URLs
   - Use `/api/webhooks/stats` to track progress

---

## Webhook Endpoint Reference

### Correct Endpoints
- **SATY Phase:** `//@version=6
indicator("SATY Phase Detector - Webhook", overlay=true)

// === INPUTS ===
group0 = "🔑 Webhook Configuration"
enableSatyWebhook = input.bool(true, "Enable SATY Phase Webhook", group=group0)
satyWebhookUrl = input.string("https://optionstrat.vercel.app/api/webhooks/saty-phase", "Webhook URL", group=group0)
satyApiKey = input.string("your_saty_phase_api_key_here", "API Key", group=group0, tooltip="Your secret API key for the SATY phase endpoint")
testMode = input.bool(false, "🧪 Test Mode (Send on every bar)", group=group0, tooltip="Enable to send webhook on every bar for testing. DISABLE in production!")

group1 = "SATY Phase Settings"
atrPeriod = input.int(14, "ATR Period", group=group1)
volatilityLowThreshold = input.float(0.8, "Low Volatility Threshold", step=0.1, group=group1, tooltip="ATR below this % of average = low volatility")
volatilityHighThreshold = input.float(1.2, "High Volatility Threshold", step=0.1, group=group1, tooltip="ATR above this % of average = high volatility")

group2 = "Display Settings"
showPhaseLabel = input.bool(true, "Show Phase Label", group=group2)
showEMAs = input.bool(true, "Show EMAs", group=group2)
showPhaseBackground = input.bool(true, "Show Phase Background Color", group=group2)

// === TIMEFRAME VALIDATION ===
getValidTimeframe() =>
    tf = timeframe.period
    if tf == "1" or tf == "2" or tf == "3"
        "3"
    else if tf == "4" or tf == "5"
        "5"
    else if tf == "10" or tf == "15"
        "15"
    else if tf == "20" or tf == "30"
        "30"
    else if tf == "45" or tf == "60"
        "60"
    else if tf == "120" or tf == "180" or tf == "240"
        "240"
    else if tf == "D" or tf == "1D" or tf == "W" or tf == "1W" or tf == "M" or tf == "1M"
        "240"
    else
        "15"

validTimeframe = getValidTimeframe()

// === MARKET SESSION - Canonical: OPEN | MIDDAY | POWER_HOUR | AFTERHOURS ===
getMarketSession() =>
    hourNY = hour(time, "America/New_York")
    minuteNY = minute(time)
    
    if hourNY < 9 or (hourNY == 9 and minuteNY < 30)
        "AFTERHOURS"
    else if hourNY >= 16
        "AFTERHOURS"
    else if hourNY == 9 and minuteNY >= 30
        "OPEN"
    else if hourNY == 10 and minuteNY < 30
        "OPEN"
    else if hourNY >= 15
        "POWER_HOUR"
    else
        "MIDDAY"

marketSession = getMarketSession()

// === CORE CALCULATIONS ===
atr = ta.atr(atrPeriod)
vwap = ta.vwap

// EMAs
emaFast = ta.ema(close, 8)
emaSlow = ta.ema(close, 21)
ema50 = ta.ema(close, 50)

// Trend Detection
trendUp = emaFast > emaSlow and emaSlow > ema50
trendDown = emaFast < emaSlow and emaSlow < ema50

// Trend Strength (0-100)
trendStrength = 0.0
if trendUp
    trendStrength := math.min(100, math.max(0, math.abs((emaFast - ema50) / atr) * 25))
else if trendDown
    trendStrength := math.min(100, math.max(0, math.abs((ema50 - emaFast) / atr) * 25))

// Price vs EMAs
priceAboveEma50 = close > ema50
priceAboveEma21 = close > emaSlow
priceBelowEma50 = close < ema50
priceBelowEma21 = close < emaSlow

// Volatility
atrNormalized = atr / close * 100
atrSma = ta.sma(atrNormalized, 20)
lowVolatility = atrNormalized < atrSma * volatilityLowThreshold
highVolatility = atrNormalized > atrSma * volatilityHighThreshold

// RSI & MACD
rsiValue = ta.rsi(close, 14)
[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)
macdBullish = macdLine > signalLine
macdBearish = macdLine < signalLine

// BOS Detection
bosLookback = 10
highestHigh = ta.highest(high, bosLookback)
lowestLow = ta.lowest(low, bosLookback)
bullishBOS = close > highestHigh[1]
bearishBOS = close < lowestLow[1]

// PMH/PML
pmh = request.security(syminfo.tickerid, "D", high[1], lookahead=barmerge.lookahead_on)
pml = request.security(syminfo.tickerid, "D", low[1], lookahead=barmerge.lookahead_on)

// Volume
avgVolume = ta.sma(volume, 20)
volumeRatio = nz(volume / avgVolume, 1.0)

// === SATY PHASE DETECTION ===
// Phase 1: ACCUMULATION - Low volatility, sideways, building base
// Phase 2: MARKUP - Uptrend, bullish momentum
// Phase 3: DISTRIBUTION - High volatility at top, potential reversal
// Phase 4: MARKDOWN - Downtrend, bearish momentum

satyPhase = 0
satyPhaseName = ""
satyPhaseDescription = ""

if lowVolatility and not trendUp and not trendDown
    satyPhase := 1
    satyPhaseName := "ACCUMULATION"
    satyPhaseDescription := "Price consolidating, building base"
else if trendUp and priceAboveEma50 and priceAboveEma21
    satyPhase := 2
    satyPhaseName := "MARKUP"
    satyPhaseDescription := "Uptrend in progress, bullish momentum"
else if highVolatility and priceAboveEma50 and not trendUp
    satyPhase := 3
    satyPhaseName := "DISTRIBUTION"
    satyPhaseDescription := "Price topping, potential reversal"
else if trendDown and priceBelowEma50 and priceBelowEma21
    satyPhase := 4
    satyPhaseName := "MARKDOWN"
    satyPhaseDescription := "Downtrend in progress, bearish momentum"
else if priceAboveEma50
    satyPhase := 2
    satyPhaseName := "MARKUP"
    satyPhaseDescription := "Generally bullish, above key MAs"
else
    satyPhase := 4
    satyPhaseName := "MARKDOWN"
    satyPhaseDescription := "Generally bearish, below key MAs"

// Phase change detection - FIXED: Store previous phase BEFORE comparing
var int storedPrevPhase = 0
int phaseFrom = storedPrevPhase
satyPhaseChanged = satyPhase != storedPrevPhase
storedPrevPhase := satyPhase

// === VISUAL DISPLAY ===

// EMAs
plot(showEMAs ? emaFast : na, title="EMA 8", color=color.blue, linewidth=2)
plot(showEMAs ? emaSlow : na, title="EMA 21", color=color.orange, linewidth=2)
plot(showEMAs ? ema50 : na, title="EMA 50", color=color.yellow, linewidth=1)

// Phase background color
phaseColor = satyPhase == 1 ? color.new(color.gray, 90) : 
             satyPhase == 2 ? color.new(color.green, 90) : 
             satyPhase == 3 ? color.new(color.orange, 90) : 
             color.new(color.red, 90)

bgcolor(showPhaseBackground ? phaseColor : na)

// Phase change markers
plotshape(satyPhaseChanged and satyPhase == 1, title="Accumulation Start", location=location.belowbar, color=color.gray, style=shape.diamond, text="ACC", size=size.normal)
plotshape(satyPhaseChanged and satyPhase == 2, title="Markup Start", location=location.belowbar, color=color.green, style=shape.triangleup, text="MARKUP", size=size.normal)
plotshape(satyPhaseChanged and satyPhase == 3, title="Distribution Start", location=location.abovebar, color=color.orange, style=shape.triangledown, text="DIST", size=size.normal)
plotshape(satyPhaseChanged and satyPhase == 4, title="Markdown Start", location=location.abovebar, color=color.red, style=shape.triangledown, text="MARKDOWN", size=size.normal)

// Phase label
var label phaseLabel = na
if showPhaseLabel and barstate.islast
    label.delete(phaseLabel)
    labelColor = satyPhase == 1 ? color.gray : satyPhase == 2 ? color.green : satyPhase == 3 ? color.orange : color.red
    phaseLabel := label.new(bar_index, high + atr, 
                           text="SATY Phase: " + satyPhaseName + "\n" + satyPhaseDescription + (testMode ? "\n⚠️ TEST MODE ON" : ""),
                           color=labelColor, textcolor=color.white, 
                           style=label.style_label_down, size=size.normal)

// === HELPER CALCULATIONS FOR JSON ===
dayOfWeekNum = dayofweek
dayOfWeekStr = dayOfWeekNum == 1 ? "SUNDAY" : dayOfWeekNum == 2 ? "MONDAY" : dayOfWeekNum == 3 ? "TUESDAY" : dayOfWeekNum == 4 ? "WEDNESDAY" : dayOfWeekNum == 5 ? "THURSDAY" : dayOfWeekNum == 6 ? "FRIDAY" : "SATURDAY"

// Oscillator state
oscillatorState = rsiValue > 70 ? "OVERBOUGHT" : rsiValue < 30 ? "OVERSOLD" : rsiValue > 50 ? "BULLISH" : "BEARISH"

// Regime context
regimeContext = trendUp ? "TRENDING_UP" : trendDown ? "TRENDING_DOWN" : lowVolatility ? "RANGING" : "VOLATILE"

// Market structure
marketStructure = bullishBOS ? "HIGHER_HIGHS" : bearishBOS ? "LOWER_LOWS" : "CONSOLIDATION"

// Trend alignment
trendAlignment = trendUp ? "BULLISH" : trendDown ? "BEARISH" : "NEUTRAL"

// MACD signal string
macdSignalStr = macdBullish ? "BULLISH" : macdBearish ? "BEARISH" : "NEUTRAL"

// Confidence score (0-100)
confidenceScore = math.min(100, math.max(0, trendStrength))

// Execution guidance
executionBias = trendUp ? "LONG" : trendDown ? "SHORT" : "NEUTRAL"
executionUrgency = highVolatility ? "HIGH" : lowVolatility ? "LOW" : "MEDIUM"

// Safe values
safeAtr = math.max(0.01, nz(atr, 0.01))
safeVwap = math.max(0.01, nz(vwap, close))
safePmh = math.max(0.01, nz(pmh, high))
safePml = math.max(0.01, nz(pml, low))
safeEmaFast = math.max(0.01, nz(emaFast, close))
safeEmaSlow = math.max(0.01, nz(emaSlow, close))
safeEma50 = math.max(0.01, nz(ema50, close))
safeTrendStrength = math.max(0, math.min(100, nz(trendStrength, 50)))
safeRsi = math.max(0, math.min(100, nz(rsiValue, 50)))
safeVolumeRatio = math.max(0.01, nz(volumeRatio, 1))
safeAtrNormalized = math.max(0.01, nz(atrNormalized, 1))
safeAtrSma = math.max(0.01, nz(atrSma, 1))

// Stop distance hint
stopDistancePct = safeAtr / close * 100 * 1.5

// Event type - changes based on whether this is a phase change or status update
eventType = satyPhaseChanged ? "PHASE_CHANGE" : "STATUS_UPDATE"

// === JSON BUILDER - FULL CANONICAL FORMAT ===
buildJsonSatyPhase() =>
    json = '{'
    
    // Meta section
    json := json + '"meta":{'
    json := json + '"version":"1.0",'
    json := json + '"source":"tradingview_indicator",'
    json := json + '"indicator_name":"SATY Phase Detector"'
    json := json + '},'
    
    // Timeframe section
    json := json + '"timeframe":{'
    json := json + '"chart_tf":"' + validTimeframe + '",'
    json := json + '"event_tf":"' + validTimeframe + '",'
    json := json + '"tf_role":"primary",'
    json := json + '"bar_close_time":"' + str.format_time(time, "yyyy-MM-dd'T'HH:mm:ss'Z'", "UTC") + '"'
    json := json + '},'
    
    // Instrument section - using "symbol" per canonical spec
    json := json + '"instrument":{'
    json := json + '"exchange":"' + syminfo.prefix + '",'
    json := json + '"symbol":"' + syminfo.ticker + '",'
    json := json + '"current_price":' + str.tostring(close, "#.##")
    json := json + '},'
    
    // Event section - FIXED: Using phaseFrom which was captured before update
    json := json + '"event":{'
    json := json + '"type":"' + eventType + '",'
    json := json + '"timestamp":' + str.tostring(math.round(time / 1000)) + ','
    json := json + '"phase_from":' + str.tostring(phaseFrom) + ','
    json := json + '"phase_to":' + str.tostring(satyPhase) + ','
    json := json + '"phase_name":"' + satyPhaseName + '",'
    json := json + '"description":"' + satyPhaseDescription + '"'
    json := json + '},'
    
    // Oscillator state section
    json := json + '"oscillator_state":{'
    json := json + '"rsi_14":' + str.tostring(safeRsi, "#.#") + ','
    json := json + '"rsi_state":"' + oscillatorState + '",'
    json := json + '"macd_signal":"' + macdSignalStr + '",'
    json := json + '"macd_histogram":' + str.tostring(nz(histLine, 0), "#.####")
    json := json + '},'
    
    // Regime context section
    json := json + '"regime_context":{'
    json := json + '"regime":"' + regimeContext + '",'
    json := json + '"volatility_state":"' + (lowVolatility ? "LOW" : highVolatility ? "HIGH" : "NORMAL") + '",'
    json := json + '"atr":' + str.tostring(safeAtr, "#.##") + ','
    json := json + '"atr_normalized":' + str.tostring(safeAtrNormalized, "#.##") + ','
    json := json + '"trend_strength":' + str.tostring(safeTrendStrength, "#")
    json := json + '},'
    
    // Market structure section
    json := json + '"market_structure":{'
    json := json + '"structure":"' + marketStructure + '",'
    json := json + '"ema_8":' + str.tostring(safeEmaFast, "#.##") + ','
    json := json + '"ema_21":' + str.tostring(safeEmaSlow, "#.##") + ','
    json := json + '"ema_50":' + str.tostring(safeEma50, "#.##") + ','
    json := json + '"price_vs_ema50":"' + (priceAboveEma50 ? "ABOVE" : "BELOW") + '",'
    json := json + '"price_vs_ema21":"' + (priceAboveEma21 ? "ABOVE" : "BELOW") + '",'
    json := json + '"vwap":' + str.tostring(safeVwap, "#.##") + ','
    json := json + '"pmh":' + str.tostring(safePmh, "#.##") + ','
    json := json + '"pml":' + str.tostring(safePml, "#.##")
    json := json + '},'
    
    // Confidence section
    json := json + '"confidence":{'
    json := json + '"score":' + str.tostring(confidenceScore, "#") + ','
    json := json + '"trend_alignment":"' + trendAlignment + '",'
    json := json + '"volatility_confirmation":' + (lowVolatility and satyPhase == 1 ? 'true' : highVolatility and satyPhase == 3 ? 'true' : trendUp and satyPhase == 2 ? 'true' : trendDown and satyPhase == 4 ? 'true' : 'false')
    json := json + '},'
    
    // Execution guidance section
    json := json + '"execution_guidance":{'
    json := json + '"bias":"' + executionBias + '",'
    json := json + '"urgency":"' + executionUrgency + '",'
    json := json + '"session":"' + marketSession + '",'
    json := json + '"day_of_week":"' + dayOfWeekStr + '"'
    json := json + '},'
    
    // Risk hints section
    json := json + '"risk_hints":{'
    json := json + '"suggested_stop_pct":' + str.tostring(stopDistancePct, "#.##") + ','
    json := json + '"atr_multiplier":1.5,'
    json := json + '"position_size_hint":"' + (highVolatility ? "QUARTER" : lowVolatility ? "HALF" : "FULL") + '"'
    json := json + '},'
    
    // Audit section
    json := json + '"audit":{'
    json := json + '"generated_at":"' + str.format_time(timenow, "yyyy-MM-dd'T'HH:mm:ss'Z'", "UTC") + '",'
    json := json + '"bar_index":' + str.tostring(bar_index) + ','
    json := json + '"volume":' + str.tostring(volume, "#") + ','
    json := json + '"volume_vs_avg":' + str.tostring(safeVolumeRatio, "#.##") + ','
    json := json + '"test_mode":' + (testMode ? 'true' : 'false')
    json := json + '}'
    
    json := json + '}'
    json

// === BUILD FULL WEBHOOK URL WITH KEY ===
satyFullUrl = satyWebhookUrl + "?key=" + satyApiKey

// === SEND WEBHOOK ALERT ===
// Trigger conditions:
// 1. Phase changed (normal mode)
// 2. Every bar (test mode) - for debugging
shouldSendAlert = (satyPhaseChanged or testMode) and enableSatyWebhook

if shouldSendAlert
    alert(buildJsonSatyPhase(), alert.freq_once_per_bar)

// === INFO TABLE ===
var table infoTable = table.new(position.top_right, 2, 7, bgcolor=color.new(color.black, 80), border_width=1)

if barstate.islast
    table.cell(infoTable, 0, 0, "SATY Webhook", text_color=color.white, text_size=size.small, bgcolor=color.new(color.purple, 60))
    table.cell(infoTable, 1, 0, enableSatyWebhook ? "✅ ON" : "❌ OFF", text_color=enableSatyWebhook ? color.green : color.red, text_size=size.small, bgcolor=color.new(color.purple, 60))
    
    phaseDisplayColor = satyPhase == 1 ? color.gray : satyPhase == 2 ? color.green : satyPhase == 3 ? color.orange : color.red
    table.cell(infoTable, 0, 1, "Phase:", text_color=color.white, text_size=size.tiny)
    table.cell(infoTable, 1, 1, satyPhaseName, text_color=phaseDisplayColor, text_size=size.tiny)
    
    table.cell(infoTable, 0, 2, "Regime:", text_color=color.white, text_size=size.tiny)
    table.cell(infoTable, 1, 2, regimeContext, text_color=color.aqua, text_size=size.tiny)
    
    table.cell(infoTable, 0, 3, "Session:", text_color=color.white, text_size=size.tiny)
    table.cell(infoTable, 1, 3, marketSession, text_color=color.yellow, text_size=size.tiny)
    
    table.cell(infoTable, 0, 4, "Timeframe:", text_color=color.white, text_size=size.tiny)
    table.cell(infoTable, 1, 4, validTimeframe, text_color=color.yellow, text_size=size.tiny)
    
    table.cell(infoTable, 0, 5, "Test Mode:", text_color=color.white, text_size=size.tiny)
    table.cell(infoTable, 1, 5, testMode ? "⚠️ ON" : "OFF", text_color=testMode ? color.orange : color.gray, text_size=size.tiny)
    
    table.cell(infoTable, 0, 6, "Webhook URL:", text_color=color.white, text_size=size.tiny)
    table.cell(infoTable, 1, 6, satyWebhookUrl + "?key=***", text_color=color.gray, text_size=size.tiny)

// === ALERT CONDITIONS ===
alertcondition(satyPhaseChanged, title="🔄 Phase Changed", message="SATY Phase Changed")
alertcondition(satyPhaseChanged and satyPhase == 1, title="🔄 Phase: ACCUMULATION", message="Phase: ACCUMULATION")
alertcondition(satyPhaseChanged and satyPhase == 2, title="🔄 Phase: MARKUP", message="Phase: MARKUP")
alertcondition(satyPhaseChanged and satyPhase == 3, title="🔄 Phase: DISTRIBUTION", message="Phase: DISTRIBUTION")
alertcondition(satyPhaseChanged and satyPhase == 4, title="🔄 Phase: MARKDOWN", message="Phase: MARKDOWN")
alertcondition(lowVolatility, title="📉 Low Volatility", message="Low Volatility Detected")
alertcondition(highVolatility, title="📈 High Volatility", message="High Volatility Detected")
alertcondition(testMode, title="🧪 Test Mode Alert", message="Test Mode - Every Bar")

ta with oscillator state, regime context, etc.
  
- **Signals:** `https://optionstrat.vercel.app/api/webhooks/signals`
  - For: Trading signals (BUY/SELL) with AI scores
  
- **Trend:** `https://optionstrat.vercel.app/api/webhooks/trend`
  - For: Multi-timeframe trend data with direction indicators

### Authentication
- ✅ **No authentication required** (as of Jan 14, 2026)
- All endpoints accept webhooks without tokens
- Simplified TradingView configuration

---

## Expected Payload Formats

### SATY Phase Payload
```json
{
  "meta": { "engine": "SATY_PO", ... },
  "instrument": { "symbol": "SPY", ... },
  "timeframe": { "chart_tf": "3", ... },
  "event": { "name": "ENTER_ACCUMULATION", ... },
  "oscillator_state": { "value": 50, ... },
  "regime_context": { "local_bias": "BULLISH", ... }
}
```

### Signals Payload
```json
{
  "signal": {
    "type": "BUY",
    "symbol": "SPY",
    "aiScore": 85.5,
    ...
  }
}
```

### Trend Payload
```
3min Trend Change: bearish
{
  "ticker": "SPY",
  "timeframes": {
    "tf3min": { "direction": "bearish", ... },
    "tf5min": { "direction": "neutral", ... },
    ...
  }
}
```

---

## Next Steps

1. **Immediate:** Update TradingView trend alert URLs
2. **Today:** Check signals alert configuration
3. **This Week:** Monitor webhook success rates
4. **Ongoing:** Use diagnostic endpoints to troubleshoot issues

---

## Support Resources

- **Webhook Receipts UI:** https://optionstrat.vercel.app (Webhooks tab)
- **Statistics API:** https://optionstrat.vercel.app/api/webhooks/stats
- **Debug Specific Webhook:** https://optionstrat.vercel.app/api/webhooks/debug-payload?id=<ID>
- **Filter by Type:** https://optionstrat.vercel.app/api/webhooks/recent-by-kind?kind=signals

---

**Report Generated:** January 14, 2026, 15:30 UTC
**System Status:** Operational with configuration issues
**Overall Health:** 🟡 Yellow (needs TradingView alert updates)
