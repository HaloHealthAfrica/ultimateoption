'use client';

import { useEffect, useState } from 'react';

interface DecisionEntry {
  id: string;
  created_at: number;
  decision: 'EXECUTE' | 'WAIT' | 'SKIP';
  confluence_score: number;
  signal: {
    signal: {
      type: 'LONG' | 'SHORT';
      timeframe: string;
      quality: 'EXTREME' | 'HIGH' | 'MEDIUM';
    };
    instrument: {
      ticker: string;
    };
  };
  decision_breakdown?: {
    final_multiplier: number;
  };
}

interface Props {
  limit?: number;
  onRefresh?: () => void;
}

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ');
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function Phase25HistoryTable({ limit = 20, onRefresh }: Props) {
  const [entries, setEntries] = useState<DecisionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'EXECUTE' | 'WAIT' | 'SKIP'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const filterParam = filter !== 'ALL' ? `&decision=${filter}` : '';
        const res = await fetch(`/api/decisions?limit=${limit}${filterParam}&_t=${Date.now()}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch history');
        }

        setEntries(data.data || []);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [limit, filter, onRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-white/60">Loading history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        <span className="font-semibold">Error:</span> {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-white/40 text-lg mb-2">No decisions yet</div>
        <div className="text-white/30 text-sm">
          {filter !== 'ALL' ? `No ${filter} decisions found` : 'Waiting for webhook signals...'}
        </div>
      </div>
    );
  }

  const actionColors = {
    EXECUTE: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    WAIT: 'border-yellow-400/30 bg-yellow-500/10 text-yellow-200',
    SKIP: 'border-red-400/30 bg-red-500/10 text-red-200',
  };

  const directionColors = {
    LONG: 'text-emerald-400',
    SHORT: 'text-red-400',
  };

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/60">Filter:</span>
        {(['ALL', 'EXECUTE', 'WAIT', 'SKIP'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={classNames(
              'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
              filter === f
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-sm font-medium text-white/70">Time</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-white/70">Ticker</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-white/70">Decision</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-white/70">Direction</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-white/70">TF</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-white/70">Quality</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-white/70">Confidence</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-white/70">Size</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <td className="py-3 px-4 text-sm text-white/80">
                  <div>{formatTime(entry.created_at)}</div>
                  <div className="text-xs text-white/40">{formatRelative(entry.created_at)}</div>
                </td>
                <td className="py-3 px-4 text-sm font-medium text-white">
                  {entry.signal?.instrument?.ticker || 'UNKNOWN'}
                </td>
                <td className="py-3 px-4">
                  <span className={classNames('px-2 py-1 rounded text-xs font-medium', actionColors[entry.decision])}>
                    {entry.decision}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={classNames('text-sm font-medium', directionColors[entry.signal?.signal?.type || 'LONG'])}>
                    {entry.signal?.signal?.type || '—'}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-white/80">
                  {entry.signal?.signal?.timeframe || '—'}M
                </td>
                <td className="py-3 px-4 text-sm text-white/80">
                  {entry.signal?.signal?.quality || '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="text-sm font-medium text-white">
                    {Math.round(entry.confluence_score || 0)}%
                  </div>
                  <div className="w-16 h-1 rounded-full bg-white/10 ml-auto mt-1">
                    <div
                      className={classNames(
                        'h-full rounded-full',
                        (entry.confluence_score || 0) >= 80 ? 'bg-emerald-500' :
                        (entry.confluence_score || 0) >= 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      )}
                      style={{ width: `${Math.min(100, entry.confluence_score || 0)}%` }}
                    />
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-sm text-white/80">
                  {entry.decision_breakdown?.final_multiplier?.toFixed(2) || '—'}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-white/60 pt-2">
        <div>Showing {entries.length} decision{entries.length !== 1 ? 's' : ''}</div>
        <div>Click row for details</div>
      </div>
    </div>
  );
}
