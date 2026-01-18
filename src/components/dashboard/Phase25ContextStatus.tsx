'use client';

import { useEffect, useState } from 'react';

type ContextStatusResponse = {
  status: {
    isComplete: boolean;
    completeness: number;
    requiredSources: { source: string; available: boolean; age?: number }[];
    optionalSources: { source: string; available: boolean; age?: number }[];
  };
  snapshot: {
    symbol: string;
    updated_at: number;
  } | null;
  timestamp: number;
};

function formatAge(ageMs?: number): string {
  if (ageMs === undefined) return '—';
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ');
}

export function Phase25ContextStatus() {
  const [data, setData] = useState<ContextStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/phase25/context/status?_t=${Date.now()}`);
        const json = (await res.json()) as ContextStatusResponse;
        if (!res.ok) {
          throw new Error((json as unknown as { error?: string })?.error || 'Failed to load context status');
        }
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error');
        }
      }
    }

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        <span className="font-semibold">Error:</span> {error}
      </div>
    );
  }

  if (!data) {
    return <div className="text-white/60">Loading context status...</div>;
  }

  const completenessPct = Math.round(data.status.completeness * 100);
  const completenessColor = data.status.isComplete ? 'text-emerald-300' : 'text-yellow-300';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/70">Completeness</span>
        <span className={classNames('font-semibold', completenessColor)}>
          {completenessPct}% {data.status.isComplete ? 'Complete' : 'Partial'}
        </span>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-white/50 uppercase tracking-wide">Required Sources</div>
        {data.status.requiredSources.map((source) => (
          <div key={source.source} className="flex items-center justify-between text-sm">
            <span className="text-white/80">{source.source}</span>
            <span className={source.available ? 'text-emerald-300' : 'text-red-300'}>
              {source.available ? `OK (${formatAge(source.age)})` : 'Missing'}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-white/50 uppercase tracking-wide">Optional Sources</div>
        {data.status.optionalSources.map((source) => (
          <div key={source.source} className="flex items-center justify-between text-sm">
            <span className="text-white/80">{source.source}</span>
            <span className={source.available ? 'text-white/70' : 'text-white/40'}>
              {source.available ? `Seen (${formatAge(source.age)})` : 'Missing'}
            </span>
          </div>
        ))}
      </div>

      {data.snapshot ? (
        <div className="text-xs text-white/50">
          Latest snapshot: {data.snapshot.symbol} · {new Date(data.snapshot.updated_at).toLocaleTimeString()}
        </div>
      ) : (
        <div className="text-xs text-white/40">No persisted snapshot yet.</div>
      )}
    </div>
  );
}
