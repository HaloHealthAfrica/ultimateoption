# Phase 2.5 Market Feeds - Comprehensive Fix Plan
**Date:** January 19, 2026
**Status:** Diagnostic Complete - Ready to Implement

---

## 🔍 Diagnostic Results

### Root Causes Identified:

1. **Tradier API:** ✗ Authentication failing (401 Invalid Access Token)
   - API key is configured but invalid/expired
   - Likely sandbox key or revoked token

2. **TwelveData API:** ✗ All endpoints returning 401
   - API key invalid or rate limit exceeded
   - All 4 endpoints (quote, ATR, RSI, time_series) failing

3. **System Behavior:** ✅ Gracefully using fallbacks
   - 100% completeness (no crashes)
   - All decisions using fallback values
   - Confidence scores artificially conservative

---

## 🎯 Fix Strategy

### Phase 1: Immediate Fixes (API Keys) - 10 minutes

**Problem:** Invalid API keys causing all providers to fail

**Solution:**
1. Verify Tradier API key in Tradier dashboard
2. Verify TwelveData API key in TwelveData dashboard
3. Regenerate keys if needed
4. Update in Vercel environment variables
5. Redeploy

**Expected Result:** Real market data flowing

---

### Phase 2: Response Parsing Fixes - 30 minutes

**Problem:** Even with valid keys, response parsing may fail

**Files to Fix:**
- `src/phase25/services/market-context.service.ts`

**Changes Needed:**

#### A. Tradier Options Parsing
```typescript
// Current (line ~130):
const ivPercentile = quoteData.quotes?.[0]?.iv_percentile || 50;

// Fix - handle multiple response formats:
const ivPercentile = quoteData.quotes?.quote?.iv_percentile || 
                     quoteData.quotes?.[0]?.iv_percentile || 
                     50;
```

#### B. TwelveData Stats Parsing
```typescript
// Current (line ~170):
const atr14 = parseFloat(atrData.values?.[0]?.atr) || 0;

// Fix - add error code checking:
if (atrData.code === 401 || atrData.code === 429) {
  throw new Error(`TwelveData error: ${atrData.message}`);
}
const atr14 = parseFloat(atrData.values?.[0]?.atr) || 0;
```

#### C. TwelveData Liquidity Parsing
```typescript
// Current (line ~215):
if (!quote || quote.code === 400) {
  throw new Error('No quote data returned from TwelveData');
}

// Fix - handle all error codes:
if (quote.code === 401) {
  throw new Error('TwelveData authentication failed');
}
if (quote.code === 429) {
  throw new Error('TwelveData rate limit exceeded');
}
if (quote.code === 400 || !quote.symbol) {
  throw new Error('No quote data returned from TwelveData');
}
```

---

### Phase 3: Caching Layer - 1 hour

**Problem:** TwelveData free tier has strict rate limits (800 calls/day)

**Solution:** Implement Redis/memory cache with TTL

**New File:** `src/phase25/services/market-cache.service.ts`

```typescript
/**
 * Market Data Cache Service
 * Caches API responses to reduce provider calls
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

export class MarketCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  
  // Cache TTLs (in milliseconds)
  private readonly TTL = {
    QUOTE: 60 * 1000,        // 1 minute
    ATR: 5 * 60 * 1000,      // 5 minutes
    RSI: 5 * 60 * 1000,      // 5 minutes
    OPTIONS: 5 * 60 * 1000,  // 5 minutes
    TIMESERIES: 15 * 60 * 1000 // 15 minutes
  };
  
  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
```

**Integration:**
```typescript
// In market-context.service.ts
private cache: MarketCacheService;

async getTwelveDataStats(symbol: string): Promise<MarketContext['stats']> {
  // Check cache first
  const cacheKey = `twelvedata:stats:${symbol}`;
  const cached = this.cache.get(cacheKey);
  if (cached) {
    return cached as MarketContext['stats'];
  }
  
  // Fetch from API
  const stats = await this.fetchTwelveDataStats(symbol);
  
  // Cache result
  this.cache.set(cacheKey, stats, this.cache.TTL.ATR);
  
  return stats;
}
```

---

### Phase 4: Rate Limit Tracking - 30 minutes

**Problem:** No visibility into API usage

**New File:** `src/phase25/services/rate-limit-tracker.service.ts`

```typescript
/**
 * Rate Limit Tracker
 * Tracks API calls and enforces limits
 */

interface ProviderLimits {
  maxCallsPerDay: number;
  maxCallsPerMinute: number;
  currentDayCount: number;
  currentMinuteCount: number;
  lastResetDay: number;
  lastResetMinute: number;
}

export class RateLimitTracker {
  private limits: Map<string, ProviderLimits> = new Map();
  
  constructor() {
    // Initialize provider limits
    this.limits.set('tradier', {
      maxCallsPerDay: 10000,
      maxCallsPerMinute: 60,
      currentDayCount: 0,
      currentMinuteCount: 0,
      lastResetDay: Date.now(),
      lastResetMinute: Date.now()
    });
    
    this.limits.set('twelvedata', {
      maxCallsPerDay: 800,
      maxCallsPerMinute: 8,
      currentDayCount: 0,
      currentMinuteCount: 0,
      lastResetDay: Date.now(),
      lastResetMinute: Date.now()
    });
  }
  
  canMakeRequest(provider: string): boolean {
    const limit = this.limits.get(provider);
    if (!limit) return true;
    
    this.resetCountersIfNeeded(provider);
    
    return limit.currentDayCount < limit.maxCallsPerDay &&
           limit.currentMinuteCount < limit.maxCallsPerMinute;
  }
  
  recordRequest(provider: string): void {
    const limit = this.limits.get(provider);
    if (!limit) return;
    
    this.resetCountersIfNeeded(provider);
    
    limit.currentDayCount++;
    limit.currentMinuteCount++;
  }
  
  private resetCountersIfNeeded(provider: string): void {
    const limit = this.limits.get(provider);
    if (!limit) return;
    
    const now = Date.now();
    
    // Reset daily counter
    if (now - limit.lastResetDay > 24 * 60 * 60 * 1000) {
      limit.currentDayCount = 0;
      limit.lastResetDay = now;
    }
    
    // Reset minute counter
    if (now - limit.lastResetMinute > 60 * 1000) {
      limit.currentMinuteCount = 0;
      limit.lastResetMinute = now;
    }
  }
  
  getStats(provider: string): ProviderLimits | null {
    return this.limits.get(provider) || null;
  }
}
```

---

### Phase 5: Explicit Fallback Configuration - 20 minutes

**Problem:** Fallback behavior not well-defined

**New File:** `src/phase25/config/fallback-strategy.config.ts`

```typescript
/**
 * Fallback Strategy Configuration
 * Defines how system behaves when providers fail
 */

export const FALLBACK_STRATEGY = {
  // When to use fallbacks
  triggers: {
    TIMEOUT: true,           // Use fallback on timeout
    AUTH_ERROR: true,        // Use fallback on 401
    RATE_LIMIT: true,        // Use fallback on 429
    SERVER_ERROR: true,      // Use fallback on 5xx
    NETWORK_ERROR: true      // Use fallback on network issues
  },
  
  // Fallback values
  values: {
    tradier: {
      options: {
        putCallRatio: 1.0,      // Neutral
        ivPercentile: 50,       // Mid-range
        gammaBias: 'NEUTRAL',   // No bias
        optionVolume: 0,        // Unknown
        maxPain: 0,             // Unknown
        confidence: 0           // No confidence in fallback
      }
    },
    
    twelveData: {
      stats: {
        atr14: 2.0,            // Conservative ATR
        rv20: 20.0,            // Conservative volatility
        trendSlope: 0.0,       // Neutral trend
        rsi: 50.0,             // Neutral RSI
        volume: 1000000,       // Default volume
        volumeRatio: 1.0,      // Normal ratio
        confidence: 0          // No confidence in fallback
      },
      
      liquidity: {
        spreadBps: 15.0,       // Conservative (above threshold)
        depthScore: 50.0,      // Moderate
        tradeVelocity: 'NORMAL',
        bidSize: 100,
        askSize: 100,
        confidence: 0          // No confidence in fallback
      }
    }
  },
  
  // Confidence adjustments when using fallbacks
  confidencePenalty: {
    ONE_PROVIDER_FALLBACK: -10,    // -10% if 1 provider fails
    TWO_PROVIDERS_FALLBACK: -20,   // -20% if 2 providers fail
    ALL_PROVIDERS_FALLBACK: -30    // -30% if all fail
  },
  
  // Retry strategy
  retry: {
    maxAttempts: 2,
    backoffMs: [1000, 2000],  // 1s, 2s
    retryOn: ['TIMEOUT', 'NETWORK_ERROR']
  }
};
```

---

### Phase 6: Confidence Weight Validation - 1 hour

**Problem:** Confidence adjustments (+2, +3, +5) are arbitrary

**Solution:** Document rationale and create validation framework

**New File:** `src/phase25/config/confidence-weights.config.ts`

```typescript
/**
 * Confidence Weight Configuration
 * Documents rationale for each adjustment
 */

export const CONFIDENCE_WEIGHTS = {
  // Base score: AI Score * 10 (0-100 scale)
  
  // Market condition adjustments
  spread: {
    penalty: -5,
    threshold: 8,  // bps
    rationale: 'Wide spreads (>8bps) indicate poor execution quality. ' +
               'Reduces expected profit by ~0.5% per trade. ' +
               '-5 points = ~5% confidence reduction.'
  },
  
  volatility: {
    bonus: 3,
    minATR: 5,
    maxATR: 15,
    rationale: 'Optimal volatility range (5-15 ATR) provides good risk/reward. ' +
               'Too low = limited profit potential. Too high = excessive risk. ' +
               '+3 points = ~3% confidence boost in sweet spot.'
  },
  
  volume: {
    bonus: 2,
    threshold: 1.2,  // ratio
    rationale: 'High volume (>1.2x average) indicates strong participation. ' +
               'Improves execution and reduces slippage. ' +
               '+2 points = ~2% confidence boost.'
  },
  
  optionsFlow: {
    bonus: 5,
    bullishThreshold: 0.8,  // put/call ratio
    bearishThreshold: 1.2,
    rationale: 'Favorable options flow (put/call <0.8 for longs) indicates ' +
               'institutional positioning. Strong signal. ' +
               '+5 points = ~5% confidence boost.'
  },
  
  ivPercentile: {
    bonus: 3,
    threshold: 60,
    rationale: 'High IV percentile (>60) means options are expensive. ' +
               'Good for selling premium, indicates market uncertainty. ' +
               '+3 points = ~3% confidence boost for premium strategies.'
  }
};

// Validation framework
export interface ConfidenceValidation {
  weight: number;
  threshold: number;
  rationale: string;
  backtestResults?: {
    sampleSize: number;
    winRate: number;
    avgProfit: number;
    sharpeRatio: number;
  };
}

// TODO: Add backtest results when available
```

---

## 📋 Implementation Checklist

### Immediate (Today):
- [ ] 1. Verify Tradier API key in dashboard
- [ ] 2. Verify TwelveData API key in dashboard
- [ ] 3. Regenerate keys if needed
- [ ] 4. Update Vercel environment variables
- [ ] 5. Redeploy and test

### Short-term (This Week):
- [ ] 6. Fix response parsing in market-context.service.ts
- [ ] 7. Add error code checking for all providers
- [ ] 8. Implement MarketCacheService
- [ ] 9. Integrate caching into market-context.service.ts
- [ ] 10. Test with real webhooks

### Medium-term (Next Week):
- [ ] 11. Implement RateLimitTracker
- [ ] 12. Add rate limit checks before API calls
- [ ] 13. Create fallback-strategy.config.ts
- [ ] 14. Update decision engine to use fallback config
- [ ] 15. Add monitoring dashboard for API health

### Long-term (Next Month):
- [ ] 16. Document confidence weights with rationale
- [ ] 17. Create backtest framework for weight validation
- [ ] 18. Run historical backtests
- [ ] 19. Optimize weights based on results
- [ ] 20. Implement circuit breaker pattern

---

## 🧪 Testing Plan

### Test 1: API Key Validation
```bash
# After updating keys
node diagnose-market-feeds.js
# Expected: All providers returning real data
```

### Test 2: Caching Effectiveness
```bash
# Send 10 webhooks in 1 minute
for i in {1..10}; do
  curl -X POST https://optionstrat.vercel.app/api/phase25/webhooks/signals \
    -H "Content-Type: application/json" \
    -d '{"signal":{"type":"LONG","timeframe":"15","ticker":"SPY","price":580.50}}'
  sleep 5
done

# Check: Should only make 3 API calls (1 per provider)
# Remaining 9 should use cache
```

### Test 3: Rate Limit Handling
```bash
# Simulate rate limit by sending many requests
# System should gracefully degrade to fallbacks
```

### Test 4: Confidence Score Validation
```bash
# Send webhooks with different market conditions
# Verify confidence adjustments are applied correctly
```

---

## 📊 Success Metrics

### Before Fixes:
- Completeness: 100% (but using fallbacks)
- Real data: 0%
- Confidence accuracy: Low (using generic data)

### After Fixes:
- Completeness: 100%
- Real data: 100%
- Confidence accuracy: High (using real market data)
- API calls reduced: 80% (via caching)
- Rate limit violations: 0

---

## 🚨 Rollback Plan

If fixes cause issues:

1. **Immediate:** Revert to previous commit
   ```bash
   git revert HEAD
   git push
   ```

2. **Fallback:** Disable problematic provider
   ```typescript
   // In market-feeds.config.ts
   tradier: {
     enabled: false,  // Disable if causing issues
     ...
   }
   ```

3. **Emergency:** Use all fallbacks
   ```typescript
   // In buildContext()
   return {
     options: FALLBACK_VALUES.tradier.options,
     stats: FALLBACK_VALUES.twelveData.stats,
     liquidity: FALLBACK_VALUES.twelveData.liquidity,
     completeness: 0,
     errors: ['Using emergency fallbacks']
   };
   ```

---

## 📝 Next Steps

**Start with Phase 1 (API Keys):**
1. Check Tradier dashboard for API key status
2. Check TwelveData dashboard for API key status
3. Regenerate if needed
4. Update Vercel
5. Test

**Then proceed to Phase 2 (Parsing Fixes):**
1. Update error handling
2. Fix response parsing
3. Test each provider individually

**Would you like me to:**
1. Start implementing Phase 1 (API key verification)?
2. Create the caching service (Phase 3)?
3. Implement rate limit tracking (Phase 4)?
4. All of the above?

Let me know which phase to tackle first!
