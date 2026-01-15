# Phase 2.5 Dashboard - Quick Start

**Status:** ✅ READY TO TEST

---

## What You Got

A complete Phase 2.5 dashboard tab that shows:

1. **Current Decision Card** - Latest EXECUTE/WAIT/SKIP decision with confidence
2. **Decision Breakdown Panel** - All multipliers and confidence components
3. **Decision History Table** - Last 20 decisions with filtering

---

## How to Test

### 1. Start the Dev Server
```bash
cd optionstrat
npm run dev
```

### 2. Open Dashboard
Navigate to: http://localhost:3000

Click the **"Phase 2.5"** tab (between Overview and Trades)

### 3. Send Test Webhooks
In another terminal:
```bash
cd optionstrat
node simulate-phase25-e2e.js
```

This will send test webhooks and create decisions.

### 4. Watch the Dashboard Update
- Decision card will show the latest decision
- Breakdown panel will show all multipliers
- History table will show all decisions
- Auto-refreshes every 5 seconds

---

## What You'll See

### Empty State (No Decisions Yet)
```
┌─────────────────────────────────────┐
│  Current Decision                   │
│                                     │
│  No decisions yet                   │
│  Waiting for webhook signals...     │
└─────────────────────────────────────┘
```

### With Decisions
```
┌─────────────────────────────────────┐
│  Current Decision                   │
│                                     │
│  [EXECUTE]  SPY  LONG               │
│  Timeframe: 15M  Quality: EXTREME   │
│  Size: 1.85x  •  2m ago             │
│                                     │
│  Confidence: 82%                    │
│  ████████████████░░░░                │
│                                     │
│  ✓ Regime Gate                      │
│  ✓ Structural Gate                  │
│  ✓ Market Gate                      │
│                                     │
│  Reasons:                           │
│  • High AI score (9.2)              │
│  • Phase alignment confirmed        │
│  • Strong HTF bias                  │
└─────────────────────────────────────┘
```

---

## Features

### Color Coding
- **EXECUTE** = Green
- **WAIT** = Yellow
- **SKIP** = Red
- **LONG** = Green text
- **SHORT** = Red text

### Confidence Bars
- **≥80%** = Green bar
- **60-79%** = Yellow bar
- **<60%** = Red bar

### Gate Results
- **✓** = Passed (green)
- **✗** = Failed (red)

### Filtering
Click filter buttons in history table:
- ALL - Show everything
- EXECUTE - Only executed decisions
- WAIT - Only wait decisions
- SKIP - Only skipped decisions

---

## Troubleshooting

### "No decisions yet"
**Problem:** No webhooks received  
**Solution:** Run `node simulate-phase25-e2e.js`

### "Error: Failed to fetch decision"
**Problem:** API not responding  
**Solution:** Check dev server is running on port 3000

### Dashboard not updating
**Problem:** Auto-refresh disabled  
**Solution:** Check "Auto-refresh" checkbox in header

---

## Next Steps

### Today
1. ✅ Dashboard built - DONE
2. 🔄 Test with webhooks - DO THIS NOW
3. 🔄 Deploy to Vercel
4. 🔄 Test on production

### This Week (Phase 2.6.2)
1. Build Paper Executor Service
2. Simulate option fills
3. Calculate Greeks
4. Store execution data

### Next Week (Phase 2.6.3)
1. Add position tracking
2. Monitor open trades
3. Calculate real-time P&L
4. Display open positions

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Send test webhooks
node simulate-phase25-e2e.js

# Build for production
npm run build

# Check for errors
npm run lint
```

---

## Files Created

- `src/components/dashboard/Phase25DecisionCard.tsx`
- `src/components/dashboard/Phase25BreakdownPanel.tsx`
- `src/components/dashboard/Phase25HistoryTable.tsx`
- `src/app/page.tsx` (modified - added Phase 2.5 tab)

---

## API Endpoints Used

- `GET /api/decisions?limit=1` - Latest decision
- `GET /api/decisions?limit=20&decision={filter}` - History

---

**Ready to test!** 🚀

Open http://localhost:3000 and click "Phase 2.5" tab.
