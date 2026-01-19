'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PhaseMonitor from '@/components/dashboard/PhaseMonitor';
import TrendAlignment from '@/components/dashboard/TrendAlignment';
import WebhookMonitor from '@/components/dashboard/WebhookMonitor';
import { Phase25DecisionCard } from '@/components/dashboard/Phase25DecisionCard';
import { Phase25BreakdownPanel } from '@/components/dashboard/Phase25BreakdownPanel';
import { Phase25HistoryTable } from '@/components/dashboard/Phase25HistoryTable';
import { Phase25ContextStatus } from '@/components/dashboard/Phase25ContextStatus';
import { ConfluenceView } from '@/ui/components/ConfluenceView';
import { DecisionBreakdown } from '@/ui/components/DecisionBreakdown';
import { LearningInsights } from '@/ui/components/LearningInsights';
import { PaperTrades, PaperPerformance } from '@/ui/components/PaperTrades';
import { SignalMonitor } from '@/ui/components/SignalMonitor';
import { Metrics } from '@/learning/metricsEngine';
import { LearningSuggestion } from '@/learning/learningAdvisor';
import { DecisionBreakdownSchema, DecisionResult, createEmptyBreakdown } from '@/types/decision';
import { LedgerEntry } from '@/types/ledger';
import { SignalType } from '@/types/signal';
import { StoredSignal } from '@/webhooks/timeframeStore';

type TabKey = 'overview' | 'phase25' | 'trades' | 'learning' | 'webhooks';
type WebhookSubTab = 'receipts' | 'tracker';

interface DashboardState {
  signals: Map<string, StoredSignal>;
  confluenceScore: number;
  direction: SignalType | null;
  decision: DecisionResult | null;
  ledgerEntries: LedgerEntry[];
  metrics: Metrics | null;
  paperPerformance: PaperPerformance | null;
  suggestions: LearningSuggestion[];
  lastUpdated: number;
  error: string | null;
}

const initialState: DashboardState = {
  signals: new Map(),
  confluenceScore: 0,
  direction: null,
  decision: null,
  ledgerEntries: [],
  metrics: null,
  paperPerformance: null,
  suggestions: [],
  // Important: must be deterministic across SSR + client hydration.
  // We'll set a real timestamp after mount / first fetch.
  lastUpdated: 0,
  error: null,
};

interface SignalItem {
  timeframe: string;
  signal: StoredSignal['signal'];
  received_at: number;
  expires_at: number;
  validity_minutes: number;
}

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ');
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function formatRelative(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

async function fetchJson<T>(url: string): Promise<T> {
  // Cache-bust to keep the dashboard "live" even if the browser caches responses.
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`);
  const data = (await res.json()) as T;
  if (!res.ok) {
    const msg = (data as unknown as { error?: string })?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function fetchDashboardData(): Promise<Partial<DashboardState>> {
  const next: Partial<DashboardState> = {};
  const errors: string[] = [];

  // Signals
  try {
    const payload = await fetchJson<{ signals?: SignalItem[] }>('/api/signals/current');
    const map = new Map<string, StoredSignal>();
    for (const item of payload.signals || []) {
      map.set(item.timeframe, {
        signal: item.signal,
        received_at: item.received_at,
        expires_at: item.expires_at,
        validity_minutes: item.validity_minutes,
      });
    }
    next.signals = map;

    // Simple “coverage score” from HTF→LTF weights
    const weights: Record<string, number> = { '240': 0.4, '60': 0.25, '30': 0.15, '15': 0.1, '5': 0.07, '3': 0.03 };
    let total = 0;
    let direction: SignalType | null = null;

    for (const [tf, stored] of map) {
      const w = weights[tf] ?? 0;
      if (w > 0) {
        total += w;
        direction ||= stored.signal.signal.type;
      }
    }

    next.confluenceScore = Math.round(total * 100);
    next.direction = direction;
  } catch (e) {
    errors.push(`Signals: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  // Decisions (API returns LedgerEntry)
  try {
    const payload = await fetchJson<{ data?: LedgerEntry[]; decisions?: LedgerEntry[] }>('/api/decisions?limit=1');
    const list = payload.data || payload.decisions || [];
    const latest = list[0];
    if (latest) {
      const parsedBreakdown = DecisionBreakdownSchema.safeParse(latest.decision_breakdown);
      next.decision = {
        decision: latest.decision,
        reason: latest.decision_reason ?? 'No reason provided',
        breakdown: parsedBreakdown.success ? parsedBreakdown.data : createEmptyBreakdown(),
        engine_version: latest.engine_version ?? 'unknown',
        confluence_score: latest.confluence_score ?? 0,
        recommended_contracts: latest.signal?.risk?.recommended_contracts ?? 0,
        entry_signal: latest.signal ?? null,
        stop_loss: latest.signal?.entry?.stop_loss ?? null,
        target_1: latest.signal?.entry?.target_1 ?? null,
        target_2: latest.signal?.entry?.target_2 ?? null,
      };
    } else {
      next.decision = null;
    }
  } catch (e) {
    errors.push(`Decisions: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  // Ledger (API returns { data: [] })
  try {
    const payload = await fetchJson<{ data?: LedgerEntry[]; entries?: LedgerEntry[] }>('/api/ledger?limit=100');
    next.ledgerEntries = payload.data || payload.entries || [];
  } catch (e) {
    errors.push(`Ledger: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  // Metrics
  try {
    const payload = await fetchJson<{ metrics: Metrics | null }>('/api/metrics');
    next.metrics = payload.metrics ?? null;
  } catch (e) {
    errors.push(`Metrics: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  // Paper performance (Phase 2.5)
  try {
    const payload = await fetchJson<{ paper_performance?: PaperPerformance | null }>('/api/phase25/webhooks/metrics');
    next.paperPerformance = payload.paper_performance ?? null;
  } catch (e) {
    errors.push(`Paper metrics: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  // Suggestions
  try {
    const payload = await fetchJson<{ suggestions?: LearningSuggestion[] }>('/api/learning/suggestions?status=PENDING&limit=10');
    next.suggestions = payload.suggestions || [];
  } catch (e) {
    errors.push(`Suggestions: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  next.lastUpdated = Date.now();
  next.error = errors.length ? errors.join(' | ') : null;
  return next;
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-white/60">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      {children}
    </section>
  );
}

class OverviewDecisionBreakdownBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Overview DecisionBreakdown crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span className="font-semibold">Error:</span> Unable to render decision breakdown.
        </div>
      );
    }

    return this.props.children;
  }
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'px-4 py-2 text-sm font-medium rounded-xl transition-colors',
        active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
      )}
    >
      {label}
    </button>
  );
}

export default function DashboardPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [webhookSubTab, setWebhookSubTab] = useState<WebhookSubTab>('receipts');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMs, setRefreshMs] = useState(5000);

  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<DashboardState>(initialState);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const patch = await fetchDashboardData();
      setState((prev) => ({ ...prev, ...patch }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        lastUpdated: Date.now(),
        error: e instanceof Error ? e.message : 'Unknown error',
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => refresh(), refreshMs);
    return () => clearInterval(id);
  }, [autoRefresh, refreshMs, refresh]);

  const headerStatus = useMemo(() => {
    const connected = !state.error;
    const hasSignals = state.signals.size > 0;

    if (!mounted || !state.lastUpdated) {
      return {
        updated: '—',
        ago: '—',
        connected,
        hasSignals,
      };
    }

    return {
      updated: formatTime(state.lastUpdated),
      ago: formatRelative(state.lastUpdated),
      connected,
      hasSignals,
    };
  }, [mounted, state.error, state.lastUpdated, state.signals.size]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1000px_circle_at_20%_-10%,rgba(59,130,246,0.25),transparent_50%),radial-gradient(900px_circle_at_90%_0%,rgba(168,85,247,0.18),transparent_55%),radial-gradient(900px_circle_at_50%_120%,rgba(16,185,129,0.12),transparent_55%)]" />

      <header className="border-b border-white/10 bg-black/20 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-white/10" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Options Trading Platform</h1>
                <p className="text-sm text-white/60">
                  Dashboard • updated {headerStatus.ago} ({headerStatus.updated})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className={classNames(
                  'rounded-xl border px-3 py-2 text-sm',
                  headerStatus.connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/30 bg-red-500/10 text-red-200'
                )}
              >
                {headerStatus.connected ? 'Connected' : 'API error'}
              </div>

              <div
                className={classNames(
                  'rounded-xl border px-3 py-2 text-sm',
                  headerStatus.hasSignals ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-white/60'
                )}
              >
                {headerStatus.hasSignals ? 'Signals: ACTIVE' : 'Signals: waiting'}
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black text-blue-500"
                  />
                  Auto-refresh
                </label>
                <select
                  value={String(refreshMs)}
                  onChange={(e) => setRefreshMs(Number(e.target.value))}
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
                  disabled={!autoRefresh}
                >
                  <option value="3000">3s</option>
                  <option value="5000">5s</option>
                  <option value="10000">10s</option>
                  <option value="30000">30s</option>
                </select>
              </div>

              <button
                onClick={refresh}
                className={classNames(
                  'rounded-xl px-4 py-2 text-sm font-medium border transition-colors',
                  loading ? 'border-white/10 bg-white/5 text-white/60' : 'border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/15 text-blue-200'
                )}
                disabled={loading}
              >
                {loading ? 'Refreshing…' : 'Refresh now'}
              </button>

              <a
                href="/testing"
                className="rounded-xl px-4 py-2 text-sm font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
              >
                Testing →
              </a>
            </div>
          </div>

          {state.error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <span className="font-semibold">API warning:</span> {state.error}
            </div>
          ) : null}

          <nav className="mt-5 flex flex-wrap gap-2">
            <TabButton label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
            <TabButton label="Phase 2.5" active={tab === 'phase25'} onClick={() => setTab('phase25')} />
            <TabButton label="Trades" active={tab === 'trades'} onClick={() => setTab('trades')} />
            <TabButton label="Learning" active={tab === 'learning'} onClick={() => setTab('learning')} />
            <TabButton label="Webhooks" active={tab === 'webhooks'} onClick={() => setTab('webhooks')} />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {tab === 'overview' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-6">
              <Card title="Signals" subtitle="Active signals across timeframes (expires automatically)">
                <SignalMonitor signals={state.signals} onRefresh={refresh} />
              </Card>

              <Card title="Decision" subtitle="Most recent decision breakdown (if any)">
                <OverviewDecisionBreakdownBoundary>
                  <DecisionBreakdown result={state.decision} />
                </OverviewDecisionBreakdownBoundary>
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <Card title="Confluence" subtitle="At-a-glance confluence snapshot">
                <ConfluenceView confluenceScore={state.confluenceScore} direction={state.direction} signals={state.signals} />
              </Card>

              <Card title="Phase" subtitle="Regime context by timeframe">
                <PhaseMonitor />
              </Card>

              <Card title="Trend" subtitle="Multi-timeframe trend alignment">
                <TrendAlignment />
              </Card>
            </div>
          </div>
        ) : null}

        {tab === 'phase25' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <Card title="Current Decision" subtitle="Latest Phase 2.5 decision with confidence and gates">
                  <Phase25DecisionCard onRefresh={refresh} />
                </Card>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <Card title="Decision Breakdown" subtitle="Confidence components and position sizing">
                  <Phase25BreakdownPanel onRefresh={refresh} />
                </Card>
                <Card title="Context Status" subtitle="Webhook coverage and freshness">
                  <Phase25ContextStatus />
                </Card>
              </div>
            </div>

            <Card title="Decision History" subtitle="Recent decisions from Phase 2.5 engine">
              <Phase25HistoryTable limit={20} onRefresh={refresh} />
            </Card>
          </div>
        ) : null}

        {tab === 'trades' ? (
          <div className="space-y-6">
            <Card title="Paper Trades" subtitle="Read-only ledger view (DB-backed later)">
              <PaperTrades
                entries={state.ledgerEntries}
                performance={state.paperPerformance}
                onRefresh={refresh}
              />
            </Card>
          </div>
        ) : null}

        {tab === 'learning' ? (
          <div className="space-y-6">
            <Card title="Learning" subtitle="Metrics + suggestions (read-only)">
              <LearningInsights metrics={state.metrics} suggestions={state.suggestions} onRefresh={refresh} />
            </Card>
          </div>
        ) : null}

        {tab === 'webhooks' ? (
          <div className="space-y-6">
            {/* Sub-tabs for webhooks */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
              <button
                onClick={() => setWebhookSubTab('receipts')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  webhookSubTab === 'receipts'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Receipts
              </button>
              <button
                onClick={() => setWebhookSubTab('tracker')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  webhookSubTab === 'tracker'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Pipeline Tracker
              </button>
            </div>

            {webhookSubTab === 'receipts' ? (
              <Card title="Webhook Receipts" subtitle="Verify TradingView → Vercel hits (debug token optional)">
                <WebhookMonitor />
              </Card>
            ) : (
              <Card title="Webhook Receipts" subtitle="View webhook delivery history">
                <WebhookMonitor />
              </Card>
            )}
          </div>
        ) : null}
      </main>

      <footer className="border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-white/50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>Paper Trading Only • No Real Money • No Live Execution</div>
          <div>Last updated: {headerStatus.ago}</div>
        </div>
      </footer>
    </div>
  );
}


