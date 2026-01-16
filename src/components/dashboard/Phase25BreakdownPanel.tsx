'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface DecisionBreakdown {
  confluence_multiplier?: number;
  quality_multiplier?: number;
  htf_alignment_multiplier?: number;
  rr_multiplier?: number;
  volume_multiplier?: number;
  trend_multiplier?: number;
  session_multiplier?: number;
  day_multiplier?: number;
  phase_confidence_boost?: number;
  phase_position_boost?: number;
  final_multiplier?: number;
}

interface ConfidenceComponents {
  regime: number;
  expert: number;
  alignment: number;
  market: number;
  structure: number;
}

interface Props {
  onRefresh?: () => void;
}

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ');
}

export function Phase25BreakdownPanel({ onRefresh }: Props) {
  return (
    <Phase25BreakdownErrorBoundary>
      <Phase25BreakdownPanelInner onRefresh={onRefresh} />
    </Phase25BreakdownErrorBoundary>
  );
}

function Phase25BreakdownPanelInner({ onRefresh }: Props) {
  const [breakdown, setBreakdown] = useState<DecisionBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBreakdown() {
      try {
        setLoading(true);
        const res = await fetch(`/api/decisions?limit=1&_t=${Date.now()}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch breakdown');
        }

        const entries = data.data || [];
        if (entries.length > 0) {
          const entry = entries[0];
          // Ensure decision_breakdown exists and is an object
          const breakdown = entry.decision_breakdown;
          if (breakdown && typeof breakdown === 'object') {
            setBreakdown(breakdown);
          } else {
            console.warn('Invalid decision_breakdown format:', breakdown);
            setBreakdown(null);
          }
        } else {
          setBreakdown(null);
        }
        setError(null);
      } catch (e) {
        console.error('Error fetching breakdown:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchBreakdown();
  }, [onRefresh]);

  // useMemo MUST be called before any conditional returns
  const safeBreakdown = useMemo<DecisionBreakdown | null>(() => {
    if (!breakdown || typeof breakdown !== 'object') {
      return null;
    }

    try {
      const source = breakdown as DecisionBreakdown;
      return {
        confluence_multiplier: source.confluence_multiplier ?? 1.0,
        quality_multiplier: source.quality_multiplier ?? 1.0,
        htf_alignment_multiplier: source.htf_alignment_multiplier ?? 1.0,
        rr_multiplier: source.rr_multiplier ?? 1.0,
        volume_multiplier: source.volume_multiplier ?? 1.0,
        trend_multiplier: source.trend_multiplier ?? 1.0,
        session_multiplier: source.session_multiplier ?? 1.0,
        day_multiplier: source.day_multiplier ?? 1.0,
        phase_confidence_boost: source.phase_confidence_boost,
        phase_position_boost: source.phase_position_boost,
        final_multiplier: source.final_multiplier ?? 1.0,
      };
    } catch (e) {
      console.error('Error creating safeBreakdown:', e, 'breakdown:', breakdown);
      return {
        confluence_multiplier: 1.0,
        quality_multiplier: 1.0,
        htf_alignment_multiplier: 1.0,
        rr_multiplier: 1.0,
        volume_multiplier: 1.0,
        trend_multiplier: 1.0,
        session_multiplier: 1.0,
        day_multiplier: 1.0,
        phase_confidence_boost: undefined,
        phase_position_boost: undefined,
        final_multiplier: 1.0,
      };
    }
  }, [breakdown]);

  // NOW we can do conditional returns after all hooks are called
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-white/60">Loading breakdown...</div>
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

  if (!safeBreakdown) {
    return (
      <div className="flex items-center justify-center py-8 text-white/40">
        No breakdown available
      </div>
    );
  }

  // Confidence components (fixed weights)
  const confidenceComponents: ConfidenceComponents = {
    regime: 30,
    expert: 25,
    alignment: 20,
    market: 15,
    structure: 10,
  };

  return (
    <div className="space-y-6">
      {/* Confidence Components */}
      <div>
        <h3 className="text-sm font-medium text-white/70 mb-3">Confidence Components</h3>
        <div className="space-y-2">
          {Object.entries(confidenceComponents).map(([key, weight]) => (
            <ConfidenceBar
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              weight={weight}
            />
          ))}
        </div>
      </div>

      {/* Position Sizing Multipliers */}
      <div>
        <h3 className="text-sm font-medium text-white/70 mb-3">Position Sizing Breakdown</h3>
        <div className="grid grid-cols-2 gap-3">
          <MultiplierCard
            label="Confluence"
            value={safeBreakdown.confluence_multiplier}
            description="Multi-timeframe alignment"
          />
          <MultiplierCard
            label="Quality"
            value={safeBreakdown.quality_multiplier}
            description="Signal quality tier"
          />
          <MultiplierCard
            label="HTF Alignment"
            value={safeBreakdown.htf_alignment_multiplier}
            description="Higher timeframe bias"
          />
          <MultiplierCard
            label="R:R Ratio"
            value={safeBreakdown.rr_multiplier}
            description="Risk-reward ratio"
          />
          <MultiplierCard
            label="Volume"
            value={safeBreakdown.volume_multiplier}
            description="Volume vs average"
          />
          <MultiplierCard
            label="Trend"
            value={safeBreakdown.trend_multiplier}
            description="Trend strength"
          />
          <MultiplierCard
            label="Session"
            value={safeBreakdown.session_multiplier}
            description="Market session"
          />
          <MultiplierCard
            label="Day"
            value={safeBreakdown.day_multiplier}
            description="Day of week"
          />
        </div>
      </div>

      {/* Phase Boosts */}
      {(safeBreakdown.phase_confidence_boost !== undefined || safeBreakdown.phase_position_boost !== undefined) && (
        <div>
          <h3 className="text-sm font-medium text-white/70 mb-3">Phase Boosts</h3>
          <div className="grid grid-cols-2 gap-3">
            {safeBreakdown.phase_confidence_boost !== undefined && (
              <BoostCard
                label="Confidence Boost"
                value={safeBreakdown.phase_confidence_boost}
                description="From phase alignment"
              />
            )}
            {safeBreakdown.phase_position_boost !== undefined && (
              <BoostCard
                label="Position Boost"
                value={safeBreakdown.phase_position_boost}
                description="From phase strength"
              />
            )}
          </div>
        </div>
      )}

      {/* Final Multiplier */}
      <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-blue-200/70 mb-1">Final Position Multiplier</div>
            <div className="text-xs text-blue-200/50">Capped between 0.5x - 3.0x</div>
          </div>
          <div className="text-3xl font-bold text-blue-200">
            {(safeBreakdown.final_multiplier ?? 1.0).toFixed(2)}x
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({ label, weight }: { label: string; weight: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-white/80">{label}</span>
        <span className="text-white/60">{weight}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
          style={{ width: `${weight}%` }}
        />
      </div>
    </div>
  );
}

function MultiplierCard({
  label,
  value,
  description,
}: {
  label: string;
  value?: number;
  description: string;
}) {
  const displayValue = value !== undefined ? value.toFixed(2) : '—';
  const isPositive = value !== undefined && value >= 1.0;
  const isNegative = value !== undefined && value < 1.0;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white">{label}</span>
        <span
          className={classNames(
            'text-lg font-bold',
            isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-white/60'
          )}
        >
          {displayValue}x
        </span>
      </div>
      <div className="text-xs text-white/50">{description}</div>
    </div>
  );
}

function BoostCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  const percentage = (value * 100).toFixed(0);
  const isPositive = value > 0;

  return (
    <div className="rounded-lg border border-purple-400/30 bg-purple-500/10 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-purple-200">{label}</span>
        <span className={classNames('text-lg font-bold', isPositive ? 'text-purple-300' : 'text-white/60')}>
          {isPositive ? '+' : ''}{percentage}%
        </span>
      </div>
      <div className="text-xs text-purple-200/60">{description}</div>
    </div>
  );
}

class Phase25BreakdownErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Phase25BreakdownPanel crashed during render:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span className="font-semibold">Error:</span> Unable to render breakdown.
        </div>
      );
    }

    return this.props.children;
  }
}
