# Webhook Tester - Confidence Controls Guide

## New Features Added

The webhook tester now has full control over signal quality and confidence levels to help you test different decision scenarios.

## Controls Available

### 1. AI Score (5.0 - 10.0)
**What it affects**: Signal quality and expert analysis score
- **9.0-10.0**: 🔥 Excellent - Likely EXECUTE
- **8.0-8.9**: ✓ Good - High confidence
- **7.0-7.9**: ○ Fair - Medium confidence
- **5.0-6.9**: ⚠ Low - Likely WAIT or SKIP

**Impact on decision**:
- Higher AI scores boost confidence multiplier
- Affects score_breakdown (strat, gamma, vwap, golf)
- Influences final position sizing

### 2. Signal Quality Tier
**Options**: EXTREME / HIGH / MEDIUM

**What it affects**: Quality multiplier in position sizing
- **EXTREME**: 1.5x multiplier (best)
- **HIGH**: 1.3x multiplier (good)
- **MEDIUM**: 1.0x multiplier (baseline)

**Impact on decision**:
- EXTREME quality significantly boosts confidence
- Affects final position size
- Influences EXECUTE threshold

### 3. SATY Phase Confidence (50-100%)
**What it affects**: Regime gate score and confidence

- **90-100%**: 🔥 Extreme - Regime gate passes easily
- **75-89%**: ✓ High - Good regime alignment
- **50-74%**: ○ Medium - Weak regime signal

**Impact on decision**:
- Directly affects Regime gate (30% of confidence)
- Higher values increase phase_confidence_boost
- Critical for passing regime gate

### 4. Trend Strength (50-100%)
**What it affects**: Trend alignment and multi-timeframe bias

- **85-100%**: 🔥 Strong - All timeframes aligned
- **70-84%**: ✓ Good - Most timeframes aligned
- **50-69%**: ○ Weak - Mixed signals

**Impact on decision**:
- Affects trend multiplier in position sizing
- Influences alignment gate score
- Impacts RSI values across timeframes

## Quick Presets

### 🔥 Perfect Setup (EXECUTE likely)
- AI Score: 9.5
- Quality: EXTREME
- SATY Confidence: 95%
- Trend Strength: 90%

**Expected Result**: EXECUTE decision with 85-95% confidence
- All gates pass (Regime, Structural, Market)
- High position multiplier (2.0-3.0x)
- Strong confidence score

### ✓ Good Setup (High confidence)
- AI Score: 8.5
- Quality: HIGH
- SATY Confidence: 82%
- Trend Strength: 75%

**Expected Result**: EXECUTE or high-confidence WAIT
- Most gates pass
- Medium-high position multiplier (1.5-2.0x)
- Good confidence score (75-85%)

### ○ Fair Setup (WAIT likely)
- AI Score: 7.0
- Quality: MEDIUM
- SATY Confidence: 65%
- Trend Strength: 60%

**Expected Result**: WAIT decision with 60-70% confidence
- Some gates may fail
- Lower position multiplier (1.0-1.5x)
- Moderate confidence

### ⚠ Poor Setup (SKIP likely)
- AI Score: 5.5
- Quality: MEDIUM
- SATY Confidence: 55%
- Trend Strength: 50%

**Expected Result**: SKIP decision with <60% confidence
- Multiple gates fail
- Low position multiplier (0.5-1.0x)
- Poor confidence score

## How to Test Different Scenarios

### Scenario 1: Test EXECUTE Decision
1. Click "🔥 Perfect Setup" preset
2. Click "Send Staggered Test"
3. Wait for all 3 webhooks to complete
4. Check Phase 2.5 dashboard for EXECUTE decision

### Scenario 2: Test Gate Failures
1. Set AI Score to 9.5 (high)
2. Set SATY Confidence to 55% (low)
3. Send webhooks
4. Expected: Regime gate fails, decision is WAIT or SKIP

### Scenario 3: Test Quality Impact
1. Set all sliders to medium values (AI: 8.0, SATY: 75%, Trend: 70%)
2. Send with Quality: MEDIUM → Check confidence
3. Send with Quality: EXTREME → Check confidence increase
4. Compare position multipliers

### Scenario 4: Test Trend Alignment
1. Set AI Score: 9.0, SATY: 90%, Quality: EXTREME
2. Set Trend Strength: 50% → Send → Check decision
3. Set Trend Strength: 95% → Send → Check decision
4. Compare alignment gate scores

## Understanding the Results

### Decision Display Shows:
- **Action**: EXECUTE / WAIT / SKIP
- **Confidence**: Overall confidence percentage
- **Gate Results**:
  - Regime: Based on SATY confidence
  - Structural: Based on signal quality and setup
  - Market: Based on liquidity and conditions
- **Position Multiplier**: Final size (0.5x - 3.0x)

### What Each Gate Checks:

**Regime Gate (30% weight)**:
- SATY phase confidence
- Volatility regime
- Phase alignment with signal direction

**Structural Gate (10% weight)**:
- Valid setup pattern
- Signal quality tier
- Risk/reward ratios

**Market Gate (15% weight)**:
- Liquidity conditions
- Spread and depth
- Volume vs average

## Tips for Testing

1. **Start with Perfect Setup** to verify everything works
2. **Adjust one variable at a time** to see its impact
3. **Check gate scores** to understand why decisions are made
4. **Compare position multipliers** across different setups
5. **Use Auto-Send** to test consistency over time

## Expected Confidence Ranges

| Setup Quality | AI Score | SATY Conf | Trend | Expected Confidence | Likely Decision |
|--------------|----------|-----------|-------|---------------------|-----------------|
| Perfect      | 9.5      | 95%       | 90%   | 85-95%              | EXECUTE         |
| Excellent    | 9.0      | 90%       | 85%   | 80-90%              | EXECUTE         |
| Good         | 8.5      | 82%       | 75%   | 75-85%              | EXECUTE/WAIT    |
| Fair         | 7.5      | 70%       | 65%   | 65-75%              | WAIT            |
| Weak         | 6.5      | 60%       | 55%   | 55-65%              | WAIT/SKIP       |
| Poor         | 5.5      | 55%       | 50%   | 45-55%              | SKIP            |

## Troubleshooting

### Getting only WAIT decisions?
- Increase AI Score to 9.0+
- Set Quality to EXTREME
- Increase SATY Confidence to 90%+
- Increase Trend Strength to 85%+

### Getting only SKIP decisions?
- Check if values are too low
- Ensure SATY Confidence > 70%
- Ensure AI Score > 7.0
- Try "Good Setup" preset

### Not seeing gate results?
- Run the migration first: `node scripts/add-gate-results-column.js`
- Check browser console for errors
- Refresh the page after migration

## Next Steps

After testing with different confidence levels:
1. Review decisions on Phase 2.5 dashboard
2. Check gate scores and understand failures
3. Adjust thresholds in decision engine if needed
4. Use Auto-Send to test consistency
5. Monitor position multipliers across scenarios
