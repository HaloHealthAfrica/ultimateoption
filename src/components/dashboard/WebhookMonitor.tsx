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
  raw_payload?: string;
  headers?: Record<string, string>;
}

interface RecentResponse {
  success: boolean;
  entries: WebhookEntry[];
  retrieved_at: number;
  auth_required?: boolean; // Indicates if authentication is required
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
  const [limit, setLimit] = useState(50);
  const [kind, setKind] = useState<'all' | WebhookKind>('all');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<WebhookEntry[]>([]);
  const [retrievedAt, setRetrievedAt] = useState<number | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/webhooks/recent?limit=${encodeURIComponent(String(limit))}`;
      
      const res = await fetch(url);
      const data = (await res.json()) as RecentResponse | { error?: string };

      if (!res.ok) {
        const msg = 'error' in data && data.error ? data.error : `Request failed (${res.status})`;
        throw new Error(msg);
      }

      const ok = data as RecentResponse;
      setEntries(ok.entries || []);
      setRetrievedAt(ok.retrieved_at || Date.now());
      // Note: auth_required field is available in response but not used in UI since auth is optional
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhook receipts');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Auto-fetch on component mount to check if auth is required
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

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
            Shows the most recent webhook hits (TradingView → this app).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

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
        <table className="min-w-[1400px] w-full text-sm">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Kind</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">HTTP</th>
              <th className="text-left px-3 py-2">Ticker</th>
              <th className="text-left px-3 py-2">Symbol</th>
              <th className="text-left px-3 py-2">TF</th>
              <th className="text-left px-3 py-2 min-w-[400px]">Message</th>
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
              filtered.map((entry) => (
                <>
                  <tr 
                    key={entry.id} 
                    className="bg-gray-900 hover:bg-gray-850 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{formatTime(entry.received_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border ${kindBadge(entry.kind)}`}>
                        {entry.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border ${badgeClass(entry.ok)}`}>
                        {entry.ok ? 'OK' : 'FAILED'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-300">{entry.status}</td>
                    <td className="px-3 py-2 text-gray-300">{entry.ticker ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-300">{entry.symbol ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-300">{entry.timeframe ?? '-'}</td>
                    <td className="px-3 py-2">
                      <div className="min-w-[400px] max-w-[600px]">
                        <div className="text-gray-300 break-words">
                          {entry.message ?? 'No message'}
                        </div>
                        <div className="text-blue-400 text-xs mt-1">
                          {expandedId === entry.id ? '▼ Click to collapse' : '▶ Click to expand details'}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{entry.ip ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[360px] truncate" title={entry.user_agent ?? ''}>
                      {entry.user_agent ?? '-'}
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr key={`${entry.id}-details`} className="bg-gray-850">
                      <td colSpan={10} className="px-3 py-4">
                        <div className="bg-gray-800 rounded-lg p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Basic Info */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-300 mb-3">Basic Information</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Status:</span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${badgeClass(entry.ok)}`}>
                                    {entry.ok ? 'OK' : 'FAILED'} ({entry.status})
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Kind:</span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${kindBadge(entry.kind)}`}>
                                    {entry.kind}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">IP Address:</span>
                                  <span className="text-gray-300">{entry.ip || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Ticker:</span>
                                  <span className="text-gray-300">{entry.ticker || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Symbol:</span>
                                  <span className="text-gray-300">{entry.symbol || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Timeframe:</span>
                                  <span className="text-gray-300">{entry.timeframe || 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            {/* User Agent */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-300 mb-3">User Agent</h4>
                              <div className="bg-gray-900 rounded p-3 text-xs text-gray-400 break-all">
                                {entry.user_agent || 'N/A'}
                              </div>
                            </div>
                          </div>

                          {/* Message */}
                          <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3">Full Message</h4>
                            <div className="bg-gray-900 rounded p-3 text-sm text-gray-300">
                              {entry.message || 'No message'}
                            </div>
                          </div>

                          {/* Raw Payload */}
                          {entry.raw_payload && (
                            <div className="mb-6">
                              <h4 className="text-sm font-semibold text-gray-300 mb-3">Raw Payload</h4>
                              <div className="bg-gray-900 rounded p-3 text-xs text-gray-400 font-mono overflow-x-auto max-h-96 overflow-y-auto">
                                <pre className="whitespace-pre-wrap break-words">{entry.raw_payload}</pre>
                              </div>
                            </div>
                          )}

                          {/* Headers */}
                          {entry.headers && Object.keys(entry.headers).length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-300 mb-3">Headers</h4>
                              <div className="bg-gray-900 rounded p-3 text-xs text-gray-400 space-y-1">
                                {Object.entries(entry.headers).map(([key, value]) => (
                                  <div key={key} className="flex">
                                    <span className="text-blue-400 w-48 shrink-0">{key}:</span>
                                    <span className="break-all">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
