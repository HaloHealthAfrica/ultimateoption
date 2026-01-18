'use client';

import { useEffect, useState } from 'react';

interface DecisionPacket {
  action: 'EXECUTE' | 'WAIT' | 'SKIP';
  direction: 'LONG' | 'SHORT';
  ticker: string;
  timeframe: string;
  quality: 'EXTREME' | 'HIGH' | 'MEDIUM';
  confidenceScore: number;
  finalSizeMultiplier: number;
  reasons: string[];
  timestamp: number;
  engineVersion?: string;
  gateResults?: {
    regime: { passed: boolean; reason: string };
    structural: { passed: boolean; reason: string };
    market: { passed: boolean; reason: string };
  };
}

interface Props {
  onRefresh?: () => void;
}

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ');
}

function formatRelative(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function Phase25DecisionCard({ onRefresh }: Props) {
  const [decision, setDecision] = useState<DecisionPacket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDecision() {
      try {
        setLoading(true);
        const res = await fetch(`/api/decisions?limit=1&_t=${Date.now()}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch decision');
        }

        const entries = data.data || [];
        if (entries.length > 0) {
          const entry = entries[0];
          setDecision({
            action: entry.decision,
            direction: entry.signal?.signal?.type || 'LONG',
            ticker: entry.signal?.instrument?.ticker || 'UNKNOWN',
            timeframe: entry.signal?.signal?.timeframe || '15',
            quality: entry.signal?.signal?.quality || 'MEDIUM',
            confidenceScore: entry.confluence_score || 0,
            finalSizeMultiplier: entry.decision_breakdown?.final_multiplier || 1.0,
            reasons: entry.decision_reason?.split(', ') || [],
            timestamp: entry.created_at,
            engineVersion: entry.engine_version,
            gateResults: entry.gate_results,
          });
        } else {
          setDecision(null);
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchDecision();
  }, [onRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Loading decision...</div>
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

  if (!decision) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-white/40 text-lg mb-2">No decisions yet</div>
        <div className="text-white/30 text-sm">Waiting for webhook signals...</div>
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

  const qualityColors = {
    EXTREME: 'text-purple-400',
    HIGH: 'text-blue-400',
    MEDIUM: 'text-white/60',
  };

  return (
    <div className="space-y-4">
      {/* Main Decision Display */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={classNames('px-4 py-2 rounded-xl border font-semibold text-lg', actionColors[decision.action])}>
              {decision.action}
            </div>
            <div className="text-2xl font-bold text-white">
              {decision.ticker}
            </div>
            <div className={classNames('text-xl font-semibold', directionColors[decision.direction])}>
              {decision.direction}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-white/60">
            <span>Timeframe: <span className="text-white">{decision.timeframe}M</span></span>
            <span>Quality: <span className={qualityColors[decision.quality]}>{decision.quality}</span></span>
            <span>Size: <span className="text-white">{decision.finalSizeMultiplier.toFixed(2)}x</span></span>
            <span>Engine: <span className="text-white">{decision.engineVersion || '—'}</span></span>
            <span className="text-white/40">•</span>
            <span>{formatRelative(decision.timestamp)}</span>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="text-right">
          <div className="text-3xl font-bold text-white mb-1">
            {Math.round(decision.confidenceScore)}%
          </div>
          <div className="text-xs text-white/50">Confidence</div>
        </div>
      </div>

      {/* Confidence Progress Bar */}
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={classNames(
            'absolute inset-y-0 left-0 rounded-full transition-all',
            decision.confidenceScore >= 80 ? 'bg-emerald-500' :
            decision.confidenceScore >= 60 ? 'bg-yellow-500' :
            'bg-red-500'
          )}
          style={{ width: `${Math.min(100, decision.confidenceScore)}%` }}
        />
      </div>

      {/* Gate Results */}
      {decision.gateResults && (
        <div className="grid grid-cols-3 gap-3">
          <GateResult
            name="Regime"
            passed={decision.gateResults.regime.passed}
            reason={decision.gateResults.regime.reason}
          />
          <GateResult
            name="Structural"
            passed={decision.gateResults.structural.passed}
            reason={decision.gateResults.structural.reason}
          />
          <GateResult
            name="Market"
            passed={decision.gateResults.market.passed}
            reason={decision.gateResults.market.reason}
          />
        </div>
      )}

      {/* Reasons */}
      {decision.reasons.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-white/70">Decision Reasons:</div>
          <div className="space-y-1">
            {decision.reasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-white/40 mt-0.5">•</span>
                <span className="text-white/80">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GateResult({ name, passed, reason }: { name: string; passed: boolean; reason: string }) {
  return (
    <div
      className={classNames(
        'rounded-lg border px-3 py-2',
        passed
          ? 'border-emerald-400/30 bg-emerald-500/10'
          : 'border-red-400/30 bg-red-500/10'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={passed ? 'text-emerald-400' : 'text-red-400'}>
          {passed ? '✓' : '✗'}
        </span>
        <span className="text-sm font-medium text-white">{name}</span>
      </div>
      <div className="text-xs text-white/60">{reason}</div>
    </div>
  );
}
