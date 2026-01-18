e these endpoints and payloads exactly. Incorrect routing or missing fields causes failures.

## 1) Phase 2.5 SATY Phase
**Endpoint:** `POST /api/phase25/webhooks/saty-phase`  
**Accepts:** raw JSON or `{ "text": "<stringified JSON>" }`

**Required fields (inside the payload):**
- `meta.engine`: **string** — must be `"SATY_PO"` (source identifier).
- `meta.engine_version`: **string** — SATY engine version (e.g., `"1.0.0"`).
- `meta.event_id`: **string** — unique event ID.
- `meta.event_type`: **string** — event category (e.g., `"REGIME_PHASE_ENTRY"`).
- `meta.generated_at`: **string** — ISO timestamp of event creation.
- `instrument.symbol`: **string** — ticker symbol (e.g., `"SPY"`).
- `instrument.exchange`: **string** — exchange (e.g., `"NASDAQ"`).
- `timeframe.chart_tf`: **string** — chart timeframe (e.g., `"15"`).
- `timeframe.event_tf`: **string** — event timeframe (e.g., `"15M"`).
- `event.name`: **string** — phase event name (e.g., `"ENTER_ACCUMULATION"`).
- `regime_context.local_bias`: **string** — `"BULLISH" | "BEARISH" | "NEUTRAL"`.
- `confidence.confidence_score`: **number** — 0–100 regime confidence.

**Example (text wrapper):**
```json
{
  "text": "{\"meta\":{\"engine\":\"SATY_PO\",\"engine_version\":\"1.0.0\",\"event_id\":\"evt_001\",\"event_type\":\"REGIME_PHASE_ENTRY\",\"generated_at\":\"2026-01-14T02:00:00Z\"},\"instrument\":{\"symbol\":\"SPY\",\"exchange\":\"NASDAQ\",\"asset_class\":\"ETF\",\"session\":\"REGULAR\"},\"timeframe\":{\"chart_tf\":\"15\",\"event_tf\":\"15M\",\"tf_role\":\"SETUP_FORMATION\",\"bar_close_time\":\"2026-01-14T02:15:00Z\"},\"event\":{\"name\":\"ENTER_ACCUMULATION\",\"description\":\"Test\",\"directional_implication\":\"UPSIDE_POTENTIAL\",\"event_priority\":8},\"regime_context\":{\"local_bias\":\"BULLISH\",\"htf_bias\":{\"tf\":\"60\",\"bias\":\"BULLISH\",\"osc_value\":52.3}},\"confidence\":{\"confidence_score\":85}}"
}
```

**Interpretation:**
- `local_bias` drives regime bias alignment.
- `confidence_score` is the regime confidence used in the Phase 2.5 regime gate.

---

## 2) Phase 2.5 Signals (TradingView)
**Endpoint:** `POST /api/phase25/webhooks/signals`  
**Required fields:**
- `signal.type`: **string** — `"LONG"` or `"SHORT"` (trade direction).
- `signal.ai_score`: **number** — 0–10.5 confidence score.
- `signal.timeframe`: **string** — chart timeframe (e.g., `"15"`).
- `instrument.ticker`: **string** — ticker symbol (e.g., `"SPY"`).
- `instrument.exchange`: **string** — exchange (e.g., `"NASDAQ"`).

**Strongly recommended fields:**
- `entry.price`: **number** — entry price.
- `entry.stop_loss`: **number** — stop loss price.
- `entry.target_1`: **number** — target 1 price.
- `entry.target_2`: **number** — target 2 price.
- `risk.rr_ratio_t1`: **number** — R:R to target 1.
- `risk.rr_ratio_t2`: **number** — R:R to target 2.
- `risk.position_multiplier`: **number** — size multiplier (0.5–3.0 typical).
- `time_context.market_session`: **string** — `"OPEN" | "MIDDAY" | "POWER_HOUR" | "AFTERHOURS"`.
- `time_context.day_of_week`: **string** — `"MONDAY"` … `"FRIDAY"`.

**Example (minimal):**
```json
{
  "signal": {
    "type": "LONG",
    "ai_score": 8.5,
    "timeframe": "15",
    "timestamp": 1705334500000
  },
  "instrument": {
    "ticker": "SPY",
    "exchange": "NASDAQ",
    "current_price": 450.25
  }
}
```

**Interpretation:**
- `signal.type` drives trade direction.
- `signal.ai_score` drives confidence scoring.
- `signal.timeframe` drives decision context alignment.

---

## 3) Trend Webhook (MTF alignment)
**Endpoint:** `POST /api/webhooks/trend`  
**Accepts TradingView format (recommended):**

```json
{
  "event": "trend_change",
  "trigger_timeframe": "5m",
  "ticker": "SPY",
  "exchange": "AMEX",
  "price": 686.44,
  "timeframes": {
    "3m": {"dir": "neutral", "chg": false},
    "5m": {"dir": "bearish", "chg": true},
    "15m": {"dir": "bearish", "chg": false},
    "30m": {"dir": "bearish", "chg": false},
    "1h": {"dir": "bearish", "chg": false},
    "4h": {"dir": "bearish", "chg": false},
    "1w": {"dir": "bearish", "chg": false},
    "1M": {"dir": "bullish", "chg": false}
  }
}
```

**Field definitions:**
- `event`: **string** — event name (e.g., `"trend_change"`).
- `trigger_timeframe`: **string** — timeframe that triggered alert (e.g., `"5m"`).
- `ticker`: **string** — ticker symbol.
- `exchange`: **string** — exchange.
- `price`: **number** — current price.
- `timeframes`: **object** — map of timeframe keys to trend states.
  - Each timeframe has:
    - `dir`: **string** — `"bullish" | "bearish" | "neutral"`.
    - `chg`: **boolean** — whether direction changed.

**Interpretation:**
- Used for MTF bias/alignment. Missing timeframes default to neutral.

---

## 4) Phase 2 Signals (Legacy)
**Endpoint:** `POST /api/webhooks/signals`  
**Required fields:**
- `signal.type`: **string** — `"LONG"` or `"SHORT"`.
- `signal.aiScore` (or `signal.ai_score`): **number** — 0–10.5 confidence score.
- `signal.symbol` (or `instrument.ticker`): **string** — ticker symbol.
- `satyPhase.phase`: **number** — -100 to 100 SATY phase (optional but recommended).
- `marketSession`: **string** — `"OPEN" | "MIDDAY" | "POWER_HOUR" | "AFTERHOURS"` (optional).

**Example (legacy):**
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

---

## Common Errors to Avoid
- **Wrong endpoint:** SATY payloads sent to `/api/webhooks/signals`.
- **Missing `signal` object:** Required for signals endpoints.
- **Missing direction:** Must include `signal.type` or `direction`.
- **Missing symbol:** Must include `signal.symbol` or `instrument.ticker`.

If you fix only one thing: **send SATY payloads to the SATY endpoint and include `signal.type + ai_score + symbol` for signals.**
# Phase 2.5 Webhook Specification (for Indicators)

