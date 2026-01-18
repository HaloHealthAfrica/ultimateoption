'use client';

import { useState } from 'react';

type WebhookType = 'saty' | 'trend' | 'signal';
type Interval = '3min' | '5min' | '15min';

interface TestResult {
  type: WebhookType;
  interval: Interval;
  success: boolean;
  status: number;
  message: string;
  timestamp: number;
  duration: number;
  decision?: {
    action: string;
    confidence: number;
  };
}

export default function WebhookTesterPage() {
  const [ticker, setTicker] = useState('SPY');
  const [price, setPrice] = useState(450.25);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [autoInterval, setAutoInterval] = useState<NodeJS.Timeout | null>(null);

  const sendWebhook = async (type: WebhookType, interval: Interval): Promise<TestResult> => {
    const startTime = Date.now();
    const timestamp = Date.now();

    let url = '';
    let payload: unknown = {};

    switch (type) {
      case 'saty':
        url = '/api/phase25/webhooks/saty-phase';
        payload = {
          text: JSON.stringify({
            meta: {
              engine: 'SATY_PO',
              engine_version: '1.0.0',
              event_id: `test_${timestamp}_saty`,
              event_type: 'REGIME_PHASE_ENTRY',
              generated_at: new Date(timestamp).toISOString(),
            },
            instrument: {
              symbol: ticker,
              exchange: 'NASDAQ',
              asset_class: 'EQUITY',
              session: 'REGULAR',
            },
            timeframe: {
              chart_tf: interval.replace('min', ''),
              event_tf: interval.replace('min', ''),
              tf_role: 'REGIME',
              bar_close_time: new Date(timestamp).toISOString(),
            },
            event: {
              name: 'ENTER_ACCUMULATION',
              description: 'Entering accumulation phase',
              directional_implication: 'UPSIDE_POTENTIAL',
              event_priority: 8,
            },
            oscillator_state: {
              value: -45.5,
              previous_value: -52.3,
              zone_from: 'ACCUMULATION',
              zone_to: 'ACCUMULATION',
              distance_from_zero: 45.5,
              distance_from_extreme: 34.5,
              velocity: 'INCREASING',
            },
            regime_context: {
              local_bias: 'BULLISH',
              htf_bias: {
                tf: '15',
                bias: 'BULLISH',
                osc_value: -35.2,
              },
              macro_bias: {
                tf: '60',
                bias: 'BULLISH',
              },
            },
            market_structure: {
              mean_reversion_phase: 'OVERSOLD_BOUNCE',
              trend_phase: 'EARLY_UPTREND',
              is_counter_trend: false,
              compression_state: 'EXPANDING',
            },
            confidence: {
              raw_strength: 78.5,
              htf_alignment: true,
              confidence_score: 82,
              confidence_tier: 'HIGH',
            },
            execution_guidance: {
              trade_allowed: true,
              allowed_directions: ['LONG'],
              recommended_execution_tf: ['5', '15'],
              requires_confirmation: ['SIGNAL_QUALITY', 'VOLUME'],
            },
            risk_hints: {
              avoid_if: ['EXTREME_VOLATILITY', 'LOW_LIQUIDITY'],
              time_decay_minutes: 180,
              cooldown_tf: interval.replace('min', ''),
            },
            audit: {
              source: 'WEBHOOK_TESTER',
              alert_frequency: 'ONCE_PER_BAR_CLOSE',
              deduplication_key: `saty_${interval}_${ticker}_${timestamp}`,
            },
          })
        };
        break;

      case 'trend':
        url = '/api/webhooks/trend';
        payload = {
          ticker: ticker,
          exchange: 'NASDAQ',
          price: price,
          timestamp: timestamp,
          timeframes: {
            tf3min: { trend: 'BULLISH', strength: 75, rsi: 58 },
            tf5min: { trend: 'BULLISH', strength: 80, rsi: 62 },
            tf15min: { trend: 'BULLISH', strength: 70, rsi: 55 },
            tf30min: { trend: 'NEUTRAL', strength: 50, rsi: 50 },
            tf1h: { trend: 'BULLISH', strength: 65, rsi: 58 },
          },
        };
        break;

      case 'signal':
        url = '/api/phase25/webhooks/signals';
        payload = {
          signal: {
            type: 'LONG',
            timeframe: interval.replace('min', ''),
            quality: 'HIGH',
            ai_score: 8.5,
            timestamp: timestamp,
            bar_time: new Date(timestamp).toISOString(),
          },
          instrument: {
            exchange: 'NASDAQ',
            ticker: ticker,
            current_price: price,
          },
          entry: {
            price: price,
            stop_loss: price * 0.98,
            target_1: price * 1.02,
            target_2: price * 1.04,
            stop_reason: 'ATR_BASED',
          },
          risk: {
            amount: 1000,
            rr_ratio_t1: 2.0,
            rr_ratio_t2: 4.0,
            stop_distance_pct: 2.0,
            recommended_shares: 100,
            recommended_contracts: 2,
            position_multiplier: 1.0,
            account_risk_pct: 1.0,
            max_loss_dollars: 1000,
          },
          market_context: {
            vwap: price,
            pmh: price * 1.01,
            pml: price * 0.99,
            day_open: price * 0.995,
            day_change_pct: 0.5,
            price_vs_vwap_pct: 0.1,
            distance_to_pmh_pct: 1.0,
            distance_to_pml_pct: 1.0,
            atr: 3.45,
            volume_vs_avg: 1.2,
            candle_direction: 'GREEN',
            candle_size_atr: 0.8,
          },
          trend: {
            ema_8: price * 1.001,
            ema_21: price * 0.999,
            ema_50: price * 0.997,
            alignment: 'BULLISH',
            strength: 75,
            rsi: 58,
            macd_signal: 'BULLISH',
          },
          mtf_context: {
            '4h_bias': 'LONG',
            '4h_rsi': 58,
            '1h_bias': 'LONG',
          },
          score_breakdown: {
            strat: 85,
            trend: 80,
            gamma: 75,
            vwap: 70,
            mtf: 80,
            golf: 78,
          },
          components: ['STRAT_2U', 'TREND_ALIGNED', 'VWAP_ABOVE'],
          time_context: {
            market_session: 'OPEN',
            day_of_week: 'MONDAY',
          },
        };
        break;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      return {
        type,
        interval,
        success: response.ok,
        status: response.status,
        message: data.message || (response.ok ? 'Success' : data.error || 'Failed'),
        timestamp,
        duration,
        decision: data.decision ? {
          action: data.decision.action,
          confidence: data.decision.confidenceScore,
        } : undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        type,
        interval,
        success: false,
        status: 0,
        message: error instanceof Error ? error.message : 'Network error',
        timestamp,
        duration,
      };
    }
  };

  const runStaggeredTest = async () => {
    setRunning(true);
    setResults([]);

    // Step 1: SATY Phase (3min)
    const satyResult = await sendWebhook('saty', '3min');
    setResults(prev => [...prev, satyResult]);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Trend (5min)
    const trendResult = await sendWebhook('trend', '5min');
    setResults(prev => [...prev, trendResult]);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Signal (15min)
    const signalResult = await sendWebhook('signal', '15min');
    setResults(prev => [...prev, signalResult]);

    setRunning(false);
  };

  const startAutoSend = () => {
    if (autoInterval) {
      clearInterval(autoInterval);
      setAutoInterval(null);
      return;
    }

    // Send immediately
    runStaggeredTest();

    // Then every 3 minutes
    const interval = setInterval(() => {
      runStaggeredTest();
    }, 3 * 60 * 1000);

    setAutoInterval(interval);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Webhook Tester</h1>
          <p className="text-white/60">
            Send test webhooks to Phase 2.5 decision engine and see results in real-time
          </p>
        </div>

        {/* Configuration */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Ticker Symbol</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                placeholder="SPY"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Current Price</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                step="0.01"
                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                placeholder="450.25"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={runStaggeredTest}
              disabled={running}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {running ? 'Sending...' : 'Send Staggered Test (3→5→15min)'}
            </button>

            <button
              onClick={startAutoSend}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                autoInterval
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {autoInterval ? 'Stop Auto-Send' : 'Start Auto-Send (Every 3min)'}
            </button>

            <button
              onClick={clearResults}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Clear Results
            </button>

            <a
              href="/"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors"
            >
              View Dashboard →
            </a>
          </div>

          {autoInterval && (
            <div className="mt-4 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-200 text-sm">
              ✓ Auto-send active - Sending webhooks every 3 minutes
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Results</h2>
            <span className="text-sm text-white/60">{results.length} webhooks sent</span>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              No webhooks sent yet. Click &quot;Send Staggered Test&quot; to begin.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                        {result.success ? '✓' : '✗'}
                      </span>
                      <div>
                        <div className="font-semibold">
                          {result.type.toUpperCase()} ({result.interval})
                        </div>
                        <div className="text-sm text-white/60">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white/60">Status: {result.status}</div>
                      <div className="text-sm text-white/60">{result.duration}ms</div>
                    </div>
                  </div>

                  <div className="text-sm text-white/80 mb-2">{result.message}</div>

                  {result.decision && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <div className="text-sm">
                        <span className="text-white/60">Decision: </span>
                        <span className="font-semibold text-yellow-400">{result.decision.action}</span>
                        <span className="text-white/60"> (</span>
                        <span className="font-semibold">{result.decision.confidence.toFixed(1)}%</span>
                        <span className="text-white/60"> confidence)</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3 text-blue-200">How to Use</h3>
          <ol className="space-y-2 text-sm text-white/80">
            <li>1. Configure ticker symbol and price above</li>
            <li>2. Click &quot;Send Staggered Test&quot; to send all 3 webhooks in sequence</li>
            <li>3. Watch results appear below in real-time</li>
            <li>4. Click &quot;View Dashboard&quot; to see the decision on Phase 2.5 tab</li>
            <li>5. Use &quot;Auto-Send&quot; to continuously send webhooks every 3 minutes</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
