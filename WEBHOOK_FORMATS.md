# Webhook Formats Guide

This document provides the exact JSON formats required for each webhook type.

---

## 1. SATY Phase Webhook

**Endpoint:** `POST /api/webhooks/saty-phase`

**Format:** Requires a `text` field containing stringified JSON

### Minimal Example
```json
{
  "text": "{\"meta\":{\"engine\":\"SATY_PO\",\"engine_version\":\"1.0.0\",\"event_id\":\"evt_001\",\"event_type\":\"REGIME_PHASE_ENTRY\",\"generated_at\":\"2026-01-14T02:00:00Z\"},\"instrument\":{\"symbol\":\"SPY\",\"exchange\":\"NASDAQ\",\"asset_class\":\"ETF\",\"session\":\"REGULAR\"},\"timeframe\":{\"chart_tf\":\"15\",\"event_tf\":\"15M\",\"tf_role\":\"SETUP_FORMATION\",\"bar_close_time\":\"2026-01-14T02:15:00Z\"},\"event\":{\"name\":\"ENTER_ACCUMULATION\",\"description\":\"Entering accumulation phase\",\"directional_implication\":\"UPSIDE_POTENTIAL\",\"event_priority\":8},\"oscillator_state\":{\"value\":45.5,\"previous_value\":38.2,\"zone_from\":\"NEUTRAL\",\"zone_to\":\"ACCUMULATION\",\"distance_from_zero\":45.5,\"distance_from_extreme\":54.5,\"velocity\":\"INCREASING\"},\"regime_context\":{\"local_bias\":\"BULLISH\",\"htf_bias\":{\"tf\":\"60\",\"bias\":\"BULLISH\",\"osc_value\":52.3},\"macro_bias\":{\"tf\":\"240\",\"bias\":\"BULLISH\"}},\"market_structure\":{\"mean_reversion_phase\":\"EXPANSION\",\"trend_phase\":\"TRENDING\",\"is_counter_trend\":false,\"compression_state\":\"EXPANDING\"},\"confidence\":{\"raw_strength\":0.85,\"htf_alignment\":true,\"confidence_score\":85,\"confidence_tier\":\"HIGH\"},\"execution_guidance\":{\"trade_allowed\":true,\"allowed_directions\":[\"LONG\"],\"recommended_execution_tf\":[\"5\",\"15\"],\"requires_confirmation\":[\"PRICE_ACTION\"]},\"risk_hints\":{\"avoid_if\":[\"LOW_VOLUME\"],\"time_decay_minutes\":30,\"cooldown_tf\":\"15\"},\"audit\":{\"source\":\"tradingview\",\"alert_frequency\":\"once_per_bar\",\"deduplication_key\":\"spy_15m_001\"}}"
}
```

### Key Fields (inside the stringified JSON)

#### Required Fields
- `meta.engine`: "SATY_PO"
- `meta.engine_version`: string (e.g., "1.0.0")
- `meta.event_id`: unique string
- `meta.event_type`: "REGIME_PHASE_ENTRY" | "REGIME_PHASE_EXIT" | "REGIME_REVERSAL"
- `meta.generated_at`: ISO timestamp string

- `instrument.symbol`: string (e.g., "SPY")
- `instrument.exchange`: string (e.g., "NASDAQ")
- `instrument.asset_class`: string (e.g., "ETF", "STOCK")
- `instrument.session`: string (e.g., "REGULAR")

- `timeframe.chart_tf`: string (e.g., "3", "5", "15", "30", "60", "240")
- `timeframe.event_tf`: string (e.g., "3M", "5M", "15M")
- `timeframe.tf_role`: "REGIME" | "BIAS" | "SETUP_FORMATION" | "STRUCTURAL"
- `timeframe.bar_close_time`: ISO timestamp string

- `event.name`: "EXIT_ACCUMULATION" | "ENTER_ACCUMULATION" | "EXIT_DISTRIBUTION" | "ENTER_DISTRIBUTION" | "ZERO_CROSS_UP" | "ZERO_CROSS_DOWN"
- `event.description`: string
- `event.directional_implication`: "UPSIDE_POTENTIAL" | "DOWNSIDE_POTENTIAL" | "NEUTRAL"
- `event.event_priority`: number (1-10)

- `oscillator_state.value`: number
- `oscillator_state.previous_value`: number
- `oscillator_state.zone_from`: string
- `oscillator_state.zone_to`: string
- `oscillator_state.distance_from_zero`: number
- `oscillator_state.distance_from_extreme`: number
- `oscillator_state.velocity`: "INCREASING" | "DECREASING"

- `regime_context.local_bias`: "BULLISH" | "BEARISH" | "NEUTRAL"
- `regime_context.htf_bias.tf`: string
- `regime_context.htf_bias.bias`: "BULLISH" | "BEARISH" | "NEUTRAL"
- `regime_context.htf_bias.osc_value`: number
- `regime_context.macro_bias.tf`: string
- `regime_context.macro_bias.bias`: "BULLISH" | "BEARISH" | "NEUTRAL"

- `market_structure.mean_reversion_phase`: string
- `market_structure.trend_phase`: string
- `market_structure.is_counter_trend`: boolean
- `market_structure.compression_state`: string

- `confidence.raw_strength`: number (0-1)
- `confidence.htf_alignment`: boolean
- `confidence.confidence_score`: number (0-100)
- `confidence.confidence_tier`: "LOW" | "MEDIUM" | "HIGH" | "EXTREME"

- `execution_guidance.trade_allowed`: boolean
- `execution_guidance.allowed_directions`: array of "LONG" | "SHORT"
- `execution_guidance.recommended_execution_tf`: array of strings
- `execution_guidance.requires_confirmation`: array of strings

- `risk_hints.avoid_if`: array of strings
- `risk_hints.time_decay_minutes`: number
- `risk_hints.cooldown_tf`: string

- `audit.source`: string
- `audit.alert_frequency`: string
- `audit.deduplication_key`: string

### TradingView Alert Message Format
```
{
  "text": "{{strategy.order.alert_message}}"
}
```

Then in your strategy, set the alert message to the full SATY JSON (stringified).

---

## 2. Signals Webhook

**Endpoint:** `POST /api/webhooks/signals`

**Format:** Direct JSON object (no text wrapper)

**Purpose:** Receives trading signals and processes them through the Phase 2 Decision Engine to determine if the trade should be accepted or rejected based on multiple market condition gates.

### Minimal Example (LONG)
```json
{
  "signal": {
    "type": "LONG",
    "aiScore": 8.5,
    "symbol": "SPY",
    "timestamp": 1705334500000
  },
  "satyPhase": {
    "phase": 45.5
  },
  "marketSession": "OPEN"
}
```

### Minimal Example (SHORT)
```json
{
  "signal": {
    "type": "SHORT",
    "aiScore": 7.2,
    "symbol": "AAPL",
    "timestamp": 1705335100000
  },
  "satyPhase": {
    "phase": -42.8
  },
  "marketSession": "OPEN"
}
```

### Complete Example with All Fields
```json
{
  "signal": {
    "type": "LONG",
    "aiScore": 8.5,
    "symbol": "SPY",
    "timestamp": 1705334500000
  },
  "satyPhase": {
    "phase": 45.5,
    "confidence": 75.0
  },
  "marketSession": "OPEN"
}
```

---

### Required Fields

#### signal (required object)
The core signal information from your trading indicator.

| Field | Type | Required | Range/Values | Description |
|-------|------|----------|--------------|-------------|
| `type` | string | ✅ Yes | "LONG" or "SHORT" | Direction of the trade signal |
| `aiScore` | number | ✅ Yes | 0 - 10.5 | AI confidence score for the signal (higher = more confident) |
| `symbol` | string | ✅ Yes | Any ticker | Stock/ETF symbol (e.g., "SPY", "AAPL", "QQQ") |
| `timestamp` | number | ❌ No | Unix timestamp (ms) | When the signal was generated (defaults to current time if omitted) |

**Notes:**
- `aiScore` will be clamped to 0-10.5 range if outside bounds
- `symbol` will be automatically converted to uppercase
- `type` is case-insensitive but will be normalized to uppercase

---

#### satyPhase (optional object)
SATY Phase Oscillator data for regime context.

| Field | Type | Required | Range/Values | Description |
|-------|------|----------|--------------|-------------|
| `phase` | number | ❌ No | -100 to 100 | SATY phase oscillator value (positive = accumulation, negative = distribution) |
| `confidence` | number | ❌ No | 0 - 100 | Confidence in the phase reading (defaults to absolute value of phase) |

**Notes:**
- If `satyPhase` is omitted entirely, defaults to `phase: 0`
- `phase` will be clamped to -100 to 100 range if outside bounds
- Positive values indicate bullish accumulation phase
- Negative values indicate bearish distribution phase
- Values near zero indicate neutral/transition phase

**Phase Interpretation:**
- `65 to 100`: Strong accumulation (bullish)
- `35 to 65`: Moderate accumulation
- `-35 to 35`: Neutral/transition zone
- `-65 to -35`: Moderate distribution
- `-100 to -65`: Strong distribution (bearish)

---

#### marketSession (optional string)
Current market session for time-based filtering.

| Value | Description | Typical Hours (ET) |
|-------|-------------|-------------------|
| `OPEN` | Market open (default) | 9:30 AM - 11:00 AM |
| `MIDDAY` | Midday session | 11:00 AM - 2:00 PM |
| `POWER_HOUR` | Last hour of trading | 3:00 PM - 4:00 PM |
| `AFTERHOURS` | After-hours trading | 4:00 PM - 8:00 PM |

**Notes:**
- Defaults to `"OPEN"` if omitted
- Used by SESSION_GATE to filter trades based on time of day
- Case-insensitive

---

### TradingView Alert Message Format

For TradingView Pine Script alerts, use this format:

```json
{
  "signal": {
    "type": "{{strategy.order.action}}",
    "aiScore": {{ai_score_variable}},
    "symbol": "{{ticker}}",
    "timestamp": {{time}}
  },
  "satyPhase": {
    "phase": {{saty_phase_variable}}
  },
  "marketSession": "{{session_variable}}"
}
```

**Pine Script Example:**
```pinescript
// In your strategy
ai_score = 8.5  // Your AI score calculation
saty_phase = 45.5  // Your SATY phase value
session = "OPEN"  // Current session

// Alert message
alert_message = '{"signal":{"type":"LONG","aiScore":' + str.tostring(ai_score) + ',"symbol":"' + syminfo.ticker + '","timestamp":' + str.tostring(time) + '},"satyPhase":{"phase":' + str.tostring(saty_phase) + '},"marketSession":"' + session + '"}'

// Create alert with this message
strategy.entry("Long", strategy.long, alert_message=alert_message)
```

---

### Response Format

The webhook returns a decision from the Phase 2 Decision Engine:

```json
{
  "decision": "ACCEPT" | "REJECT",
  "symbol": "SPY",
  "engine_version": "2.0.0",
  "timestamp": "2026-01-14T02:58:52.586Z",
  "gates": {
    "passed": ["VOLATILITY_GATE", "GAMMA_GATE", "SESSION_GATE"],
    "failed": ["SPREAD_GATE", "PHASE_GATE"]
  },
  "reasons": ["SPREAD_TOO_WIDE", "PHASE_CONFIDENCE_LOW"],
  "audit": {
    "timestamp": "2026-01-14T02:58:52.586Z",
    "symbol": "SPY",
    "session": "OPEN",
    "context_snapshot": {
      "indicator": { ... },
      "market": { ... }
    },
    "gate_results": [ ... ],
    "processing_time_ms": 0.31
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `decision` | string | "ACCEPT" or "REJECT" - Final decision on whether to take the trade |
| `symbol` | string | The symbol that was evaluated |
| `engine_version` | string | Version of the decision engine (currently "2.0.0") |
| `timestamp` | string | ISO timestamp when the decision was made |
| `gates.passed` | array | List of gates that passed |
| `gates.failed` | array | List of gates that failed |
| `reasons` | array | Specific reasons for rejection (empty if ACCEPT) |
| `audit` | object | Detailed audit trail with full context and gate results |

---

### Decision Engine Gates

The signal is evaluated through 5 gates. **ALL gates must pass for ACCEPT decision.**

#### 1. SPREAD_GATE
**Purpose:** Ensures the bid-ask spread is tight enough for efficient execution.

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Spread (bps) | ≤ 12 bps | Bid-ask spread in basis points |

**Rejection Reasons:**
- `SPREAD_TOO_WIDE`: Spread exceeds 12 basis points

---

#### 2. VOLATILITY_GATE
**Purpose:** Filters out trades during extreme volatility conditions.

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Put/Call Ratio | ≤ 2.0 | Options put/call ratio |

**Rejection Reasons:**
- `VOLATILITY_TOO_HIGH`: Put/call ratio exceeds 2.0 (extreme fear)

---

#### 3. GAMMA_GATE
**Purpose:** Ensures gamma exposure is favorable for the trade direction.

| Signal Type | Required Gamma Bias | Description |
|-------------|-------------------|-------------|
| LONG | POSITIVE or NEUTRAL | Positive gamma supports upside |
| SHORT | NEGATIVE or NEUTRAL | Negative gamma supports downside |

**Rejection Reasons:**
- `GAMMA_BIAS_UNFAVORABLE`: Gamma bias opposes trade direction

---

#### 4. PHASE_GATE
**Purpose:** Validates SATY phase alignment with trade direction.

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Phase Confidence | ≥ 65 | Absolute value of SATY phase |

**Additional Rules:**
- LONG signals require phase > 0 (accumulation)
- SHORT signals require phase < 0 (distribution)

**Rejection Reasons:**
- `PHASE_CONFIDENCE_LOW`: Phase confidence below 65
- `PHASE_MISALIGNMENT`: Phase direction opposes signal direction

---

#### 5. SESSION_GATE
**Purpose:** Filters trades based on market session timing.

| Session | Allowed | Notes |
|---------|---------|-------|
| OPEN | ✅ Yes | Best liquidity and volatility |
| MIDDAY | ✅ Yes | Moderate conditions |
| POWER_HOUR | ✅ Yes | High volume, good for exits |
| AFTERHOURS | ❌ No | Low liquidity, wide spreads |

**Rejection Reasons:**
- `SESSION_NOT_ALLOWED`: Trading during after-hours session

---

### Example Responses

#### Successful ACCEPT
```json
{
  "decision": "ACCEPT",
  "symbol": "SPY",
  "engine_version": "2.0.0",
  "timestamp": "2026-01-14T03:00:00.000Z",
  "gates": {
    "passed": [
      "SPREAD_GATE",
      "VOLATILITY_GATE",
      "GAMMA_GATE",
      "PHASE_GATE",
      "SESSION_GATE"
    ],
    "failed": []
  },
  "reasons": [],
  "audit": {
    "processing_time_ms": 0.45
  }
}
```

#### Rejection with Multiple Failed Gates
```json
{
  "decision": "REJECT",
  "symbol": "SPY",
  "engine_version": "2.0.0",
  "timestamp": "2026-01-14T02:58:52.586Z",
  "gates": {
    "passed": ["VOLATILITY_GATE", "GAMMA_GATE", "SESSION_GATE"],
    "failed": ["SPREAD_GATE", "PHASE_GATE"]
  },
  "reasons": [
    "SPREAD_TOO_WIDE",
    "PHASE_CONFIDENCE_LOW"
  ],
  "audit": {
    "gate_results": [
      {
        "gate": "SPREAD_GATE",
        "passed": false,
        "reason": "SPREAD_TOO_WIDE",
        "value": 999,
        "threshold": 12
      },
      {
        "gate": "PHASE_GATE",
        "passed": false,
        "reason": "PHASE_CONFIDENCE_LOW",
        "value": 45.5,
        "threshold": 65
      }
    ],
    "processing_time_ms": 0.31
  }
}
```

---

### Common Errors

| Error | Status | Description | Solution |
|-------|--------|-------------|----------|
| Missing required field: signal | 400 | The `signal` object is missing | Include the `signal` object in your payload |
| Missing required field: signal.type | 400 | The `type` field is missing | Add `"type": "LONG"` or `"type": "SHORT"` |
| Missing or invalid field: signal.aiScore | 400 | The `aiScore` is missing or not a number | Add `"aiScore": 8.5` (must be a number) |
| Missing required field: signal.symbol | 400 | The `symbol` field is missing | Add `"symbol": "SPY"` |
| Invalid signal type | 400 | Type must be "LONG" or "SHORT" | Use only "LONG" or "SHORT" (case-insensitive) |
| Invalid JSON payload | 400 | JSON is malformed | Validate your JSON syntax |
| Content-Type must be application/json | 400 | Wrong content type header | Set header: `Content-Type: application/json` |

---

### Integration Tips

1. **Always include aiScore**: This is the most important field for decision quality
2. **Use SATY phase when available**: Improves decision accuracy by 15-20%
3. **Set correct marketSession**: Helps filter out low-quality after-hours signals
4. **Handle REJECT decisions**: Don't blindly execute - respect the decision engine
5. **Monitor gate failures**: Track which gates fail most often to improve your signals
6. **Check processing_time_ms**: Should be < 1ms for most requests

---

### Performance Metrics

| Metric | Typical Value | Notes |
|--------|---------------|-------|
| Response Time | < 500ms | Includes market data fetching |
| Processing Time | < 1ms | Decision engine only |
| Success Rate | 95%+ | For valid payloads |
| Gate Pass Rate | Varies | Depends on market conditions |

---

## 3. Trend Webhook

**Endpoint:** `POST /api/webhooks/trend`

**Format:** Requires a `text` field containing stringified JSON

### Minimal Example (BULLISH)
```json
{
  "text": "{\"ticker\":\"SPY\",\"exchange\":\"NASDAQ\",\"timestamp\":\"2026-01-14T02:10:00Z\",\"price\":450.50,\"timeframes\":{\"tf3min\":{\"direction\":\"bullish\",\"open\":450.00,\"close\":450.30},\"tf5min\":{\"direction\":\"bullish\",\"open\":449.80,\"close\":450.50},\"tf15min\":{\"direction\":\"bullish\",\"open\":449.00,\"close\":450.50},\"tf30min\":{\"direction\":\"bullish\",\"open\":448.50,\"close\":450.50},\"tf60min\":{\"direction\":\"bullish\",\"open\":447.50,\"close\":450.50},\"tf240min\":{\"direction\":\"bullish\",\"open\":445.00,\"close\":450.50},\"tf1week\":{\"direction\":\"bullish\",\"open\":440.00,\"close\":450.50},\"tf1month\":{\"direction\":\"neutral\",\"open\":435.00,\"close\":450.50}}}"
}
```

### Minimal Example (BEARISH)
```json
{
  "text": "{\"ticker\":\"AAPL\",\"exchange\":\"NASDAQ\",\"timestamp\":\"2026-01-14T02:20:00Z\",\"price\":186.00,\"timeframes\":{\"tf3min\":{\"direction\":\"bearish\",\"open\":186.50,\"close\":186.00},\"tf5min\":{\"direction\":\"bearish\",\"open\":186.80,\"close\":186.00},\"tf15min\":{\"direction\":\"bearish\",\"open\":187.50,\"close\":186.00},\"tf30min\":{\"direction\":\"bearish\",\"open\":188.00,\"close\":186.00},\"tf60min\":{\"direction\":\"bearish\",\"open\":188.50,\"close\":186.00},\"tf240min\":{\"direction\":\"bearish\",\"open\":190.00,\"close\":186.00},\"tf1week\":{\"direction\":\"neutral\",\"open\":185.00,\"close\":186.00},\"tf1month\":{\"direction\":\"bullish\",\"open\":180.00,\"close\":186.00}}}"
}
```

### Key Fields (inside the stringified JSON)

#### Required Fields
- `ticker`: string (e.g., "SPY", "AAPL")
- `exchange`: string (e.g., "NASDAQ", "NYSE")
- `timestamp`: ISO timestamp string
- `price`: number (current price)

#### timeframes (required - all 8 timeframes)
Each timeframe must have:
- `direction`: "bullish" | "bearish" | "neutral"
- `open`: number (opening price)
- `close`: number (closing price)

Required timeframes:
- `tf3min`: 3-minute timeframe
- `tf5min`: 5-minute timeframe
- `tf15min`: 15-minute timeframe
- `tf30min`: 30-minute timeframe
- `tf60min`: 60-minute (1-hour) timeframe
- `tf240min`: 240-minute (4-hour) timeframe
- `tf1week`: 1-week timeframe
- `tf1month`: 1-month timeframe

### TradingView Alert Message Format
```
{
  "text": "{\"ticker\":\"{{ticker}}\",\"exchange\":\"{{exchange}}\",\"timestamp\":\"{{time}}\",\"price\":{{close}},\"timeframes\":{\"tf3min\":{\"direction\":\"{{tf3min_direction}}\",\"open\":{{tf3min_open}},\"close\":{{tf3min_close}}},\"tf5min\":{\"direction\":\"{{tf5min_direction}}\",\"open\":{{tf5min_open}},\"close\":{{tf5min_close}}},\"tf15min\":{\"direction\":\"{{tf15min_direction}}\",\"open\":{{tf15min_open}},\"close\":{{tf15min_close}}},\"tf30min\":{\"direction\":\"{{tf30min_direction}}\",\"open\":{{tf30min_open}},\"close\":{{tf30min_close}}},\"tf60min\":{\"direction\":\"{{tf60min_direction}}\",\"open\":{{tf60min_open}},\"close\":{{tf60min_close}}},\"tf240min\":{\"direction\":\"{{tf240min_direction}}\",\"open\":{{tf240min_open}},\"close\":{{tf240min_close}}},\"tf1week\":{\"direction\":\"{{tf1week_direction}}\",\"open\":{{tf1week_open}},\"close\":{{tf1week_close}}},\"tf1month\":{\"direction\":\"{{tf1month_direction}}\",\"open\":{{tf1month_open}},\"close\":{{tf1month_close}}}}}"
}
```

### Response Format
```json
{
  "success": true,
  "trend": {
    "ticker": "SPY",
    "exchange": "NASDAQ",
    "price": 450.5,
    "timestamp": "2026-01-14T02:10:00Z"
  },
  "alignment": {
    "score": 87.5,
    "strength": "STRONG",
    "dominant_trend": "bullish",
    "bullish_count": 7,
    "bearish_count": 0,
    "neutral_count": 1,
    "htf_bias": "bullish",
    "ltf_bias": "bullish"
  },
  "storage": {
    "ttl_minutes": 60,
    "expires_at": 1768363062251
  },
  "authentication": {
    "method": "no-auth-configured",
    "authenticated": true
  }
}
```

---

## Authentication

**All webhooks are now authentication-optional!** ✅

You can send webhooks:
- ✅ Without any authentication headers
- ✅ Without query parameters
- ✅ Without bearer tokens

The system will accept and process all webhooks regardless of authentication.

If you want to add authentication for security, you can optionally include:
- Query parameter: `?key=your_secret`
- HMAC signature header: `x-signature: sha256=...`
- Bearer token: `Authorization: Bearer your_secret`

---

## Testing with cURL

### SATY Phase
```bash
curl -X POST http://localhost:3000/api/webhooks/saty-phase \
  -H "Content-Type: application/json" \
  -d @test-payloads/saty-phase-1.json
```

### Signals
```bash
curl -X POST http://localhost:3000/api/webhooks/signals \
  -H "Content-Type: application/json" \
  -d @test-payloads/signals-buy.json
```

### Trend
```bash
curl -X POST http://localhost:3000/api/webhooks/trend \
  -H "Content-Type: application/json" \
  -d @test-payloads/trend-bullish.json
```

---

## Common Errors

### SATY Phase Errors
- ❌ "Invalid phase payload" - Missing required fields or incorrect format
- ❌ "Invalid JSON in text field" - The stringified JSON inside `text` is malformed

### Signals Errors
- ❌ "Missing required field: signal" - The `signal` object is missing
- ❌ "Missing required field: signal.type" - The `type` field is missing
- ❌ "Missing or invalid field: signal.aiScore" - The `aiScore` is missing or not a number
- ❌ "Invalid signal type" - Type must be "LONG" or "SHORT"

### Trend Errors
- ❌ "Invalid trend payload" - Missing required fields
- ❌ "Missing required field: exchange" - Exchange field is missing
- ❌ "Invalid timestamp" - Timestamp must be ISO string format
- ❌ "Missing timeframes" - All 8 timeframes must be provided

---

## Quick Reference

| Webhook Type | Wrapper Format | Key Required Fields |
|--------------|----------------|---------------------|
| SATY Phase | `{"text": "..."}` | meta, instrument, timeframe, event, oscillator_state, regime_context |
| Signals | Direct JSON | signal.type, signal.aiScore, signal.symbol |
| Trend | `{"text": "..."}` | ticker, exchange, timestamp, price, timeframes (all 8) |

---

## Need Help?

- Check the test payloads in `test-payloads/` directory for working examples
- Run the E2E tests: `node test-webhooks-e2e.js`
- View webhook receipts: http://localhost:3000 → Webhooks tab
- Check audit log: `GET /api/webhooks/recent`
