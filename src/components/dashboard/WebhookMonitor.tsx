'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type WebhookKind = 'signals' | 'trend' | 'saty-phase';

interface WebhookEntry {
  id: string;
  kind: WebhookKind;
  received_at: number;
  ok: boolean;
  status: number;
  ip?: string;
  user_agent?: string;
  ticker?: string;
  symbol?: string;
  timeframe?: string;
  message?: string;
}

interface RecentResponse {
  success: boolean;
  entries: WebhookEntry[];
  retrieved_at: number;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function badgeClass(ok: boolean): string {
  return ok ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30';
}

function kindBadge(kind: WebhookKind): string {
  switch (kind) {
    case 'signals': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'trend': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'saty-phase': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }
}

export default function WebhookMonitor() {
  const [token, setToken] = useState('');
  const [limit, setLimit] = useState(50);
  const [kind, setKind] = useState<'all' | WebhookKind>('all');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<WebhookEntry[]>([]);
  const [retrievedAt, setRetrievedAt] = useState<number | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!token) {
      setError('Enter your WEBHOOK_DEBUG_TOKEN to view receipts.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/webhooks/recent?token=${encodeURIComponent(token)}&limit=${encodeURIComponent(String(limit))}`);
      const data = (await res.json()) as RecentResponse | { error?: string };

      if (!res.ok) {
        const msg = 'error' in data && data.error ? data.error : `Request failed (${res.status})`;
        throw new Error(msg);
      }

      const ok = data as RecentResponse;
      setEntries(ok.entries || []);
      setRetrievedAt(ok.retrieved_at || Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhook receipts');
    } finally {
      setLoading(false);
    }
  }, [token, limit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchEntries();
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchEntries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (kind !== 'all' && e.kind !== kind) return false;
      if (onlyErrors && e.ok) return false;
      return true;
    });
  }, [entries, kind, onlyErrors]);

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Webhook Receipts</h2>
          <p className="text-gray-400 text-sm">
            Shows the most recent webhook hits (TradingView → this app). Requires your debug token.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="WEBHOOK_DEBUG_TOKEN"
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white w-64"
          />

          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'all' | WebhookKind)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white"
          >
            <option value="all">All</option>
            <option value="signals">Signals</option>
            <option value="saty-phase">SATY Phase</option>
            <option value="trend">Trend</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => setOnlyErrors(e.target.checked)}
            />
            Errors only
          </label>

          <label className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>

          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 50)))}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white w-24"
            title="Limit"
          />

          <button
            onClick={fetchEntries}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded text-sm transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-3 text-sm text-gray-400">
        <div>{filtered.length} shown / {entries.length} total</div>
        <div>{retrievedAt ? `Retrieved: ${formatTime(retrievedAt)}` : 'Not loaded yet'}</div>
      </div>

      <div className="overflow-auto border border-gray-800 rounded-lg">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Kind</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">HTTP</th>
              <th className="text-left px-3 py-2">Ticker</th>
              <th className="text-left px-3 py-2">Symbol</th>
              <th className="text-left px-3 py-2">TF</th>
              <th className="text-left px-3 py-2">Message</th>
              <th className="text-left px-3 py-2">IP</th>
              <th className="text-left px-3 py-2">User-Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-400" colSpan={10}>
                  No webhook receipts found. Trigger a TradingView alert (or run a Testing scenario), then refresh.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="bg-gray-900 hover:bg-gray-850">
                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{formatTime(e.received_at)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border ${kindBadge(e.kind)}`}>
                      {e.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border ${badgeClass(e.ok)}`}>
                      {e.ok ? 'OK' : 'FAILED'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-300">{e.status}</td>
                  <td className="px-3 py-2 text-gray-300">{e.ticker ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-300">{e.symbol ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-300">{e.timeframe ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-400 max-w-[280px] truncate" title={e.message ?? ''}>
                    {e.message ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{e.ip ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[360px] truncate" title={e.user_agent ?? ''}>
                    {e.user_agent ?? '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


