# Indicator Fixes - Quick Reference

**Date**: January 16, 2026  
**Priority**: HIGH  
**Impact**: +1,150 decisions per day

---

## Problem

48.4% of webhooks fail (2,055 out of 4,243) due to missing fields in TradingView indicator payloads.

---

## Quick Fixes

### SATY Phase Alerts (66% failure rate - WORST!)

**Minimum required fields**:
```pinescript
alert_message = '{' +
  '"symbol":"' + syminfo.ticker + '",' +
  '"timeframe":"' + timeframe.period + '",' +
  '"bias":"BULLISH"' +  // or "BEARISH" based on your logic
'}'
```

**Test**:
```bash
curl -X POST https://yourdomain.com/api/webhooks/validate \
  -H "Content-Type: application/json" \
  -d '{"symbol":"SPY","timeframe":"15","bias":"BULLISH"}'
```

---

### Signal Alerts (27.4% failure rate)

**Minimum required fields**:
```pinescript
alert_message = '{' +
  '"ticker":"' + syminfo.ticker + '",' +
  '"trend":"BULLISH",' +  // or "BEARISH"
  '"score":8.5' +  // your score logic
'}'
```

**Test**:
```bash
curl -X POST https://yourdomain.com/api/webhooks/validate \
  -H "Content-Type: application/json" \
  -d '{"ticker":"SPY","trend":"BULLISH","score":8.5}'
```

---

### Trend Alerts (9.0% failure rate)

**Minimum required fields**:
```pinescript
alert_message = '{' +
  '"ticker":"' + syminfo.ticker + '",' +
  '"exchange":"NASDAQ",' +
  '"price":' + str.tostring(close) + ',' +
  '"timeframes":{' +
    '"3m":{"dir":"bullish","chg":true},' +
    '"5m":{"dir":"bullish","chg":false}' +
  '}' +
'}'
```

**Test**:
```bash
curl -X POST https://yourdomain.com/api/webhooks/validate \
  -H "Content-Type: application/json" \
  -d '{"ticker":"SPY","exchange":"NASDAQ","price":450.25,"timeframes":{"3m":{"dir":"bullish","chg":true}}}'
```

---

## Validation Endpoint

**URL**: `https://yourdomain.com/api/webhooks/validate`

**Use it to test payloads before deploying indicators!**

---

## Expected Impact

| Type | Current | After Fix | Gain |
|------|---------|-----------|------|
| SATY | 832 | 1,700+ | +868 |
| Signals | 1,114 | 1,380+ | +266 |
| Trend | 242 | 260+ | +18 |
| **Total** | **2,188** | **3,340+** | **+1,152** |

**Decisions**: 650/day → 1,800/day 🚀

---

## Action Steps

1. Update indicator code with minimum fields
2. Test with validation endpoint
3. Deploy updated indicators
4. Monitor webhook success rate

**Time**: 2-4 hours  
**ROI**: +1,150 decisions per day

See `INDICATOR_SIDE_FIXES_NEEDED.md` for full details.
