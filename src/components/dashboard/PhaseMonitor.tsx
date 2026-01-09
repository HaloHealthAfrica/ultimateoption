'use client';

import React, { useState, useEffect, useCallback } from 'react';

type LocalBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

interface RegimePhaseApi {
  timeframe: string;
  event_type: string;
  event_name: string;
  local_bias: LocalBias;
  confidence_score: number;
  htf_alignment: boolean;
  generated_at: number | string;
}

interface RegimeContextApiResponse {
  symbol: string;
  regime_context: {
    setup_phase: RegimePhaseApi | null;      // 15M
    bias_phase: RegimePhaseApi | null;       // 1H
    regime_phase: RegimePhaseApi | null;     // 4H
    structural_phase: RegimePhaseApi | null; // 1D
  };
  alignment: {
    is_aligned: boolean;
    active_count: number;
  };
  retrieved_at: number;
}

export default function PhaseMonitor() {
  const [regimeContext, setRegimeContext] = useState<RegimeContextApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('SPY');

  const fetchRegimeContext = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/phase/current?symbol=${symbol}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch regime context: ${response.statusText}`);
      }
      
      const data: RegimeContextApiResponse = await response.json();
      setRegimeContext(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setRegimeContext(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchRegimeContext();
    const interval = setInterval(fetchRegimeContext, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [symbol, fetchRegimeContext]);

  const getBiasColor = (bias: string) => {
    switch (bias) {
      case 'BULLISH': return 'text-green-400 bg-green-500/20 border border-green-500/50';
      case 'BEARISH': return 'text-red-400 bg-red-500/20 border border-red-500/50';
      case 'NEUTRAL': return 'text-gray-400 bg-gray-500/20 border border-gray-500/50';
      default: return 'text-gray-400 bg-gray-500/20 border border-gray-500/50';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatGeneratedAt = (ts: number | string) => {
    const timestamp = typeof ts === 'string' ? new Date(ts).getTime() : ts;
    return new Date(timestamp).toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Phase Monitor</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-700 rounded"></div>
            <div className="h-16 bg-gray-700 rounded"></div>
            <div className="h-16 bg-gray-700 rounded"></div>
            <div className="h-16 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Phase Monitor</h2>
        <div className="text-red-400 bg-red-500/20 border border-red-500/50 p-4 rounded">
          Error: {error}
        </div>
        <button 
          onClick={fetchRegimeContext}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Phase Monitor</h2>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="px-3 py-1 bg-gray-800 border border-gray-700 text-white rounded text-sm w-20"
            placeholder="Symbol"
          />
          <button 
            onClick={fetchRegimeContext}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {regimeContext ? (
        <div>
          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium text-white">Regime Status:</span>
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  regimeContext.alignment.is_aligned ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
                }`}>
                  {regimeContext.alignment.is_aligned ? 'ALIGNED' : 'NOT ALIGNED'}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                Active: {regimeContext.alignment.active_count}/4 timeframes
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(['1D', '4H', '1H', '15M'] as const).map(timeframe => {
              const phaseByTf: Record<typeof timeframe, RegimePhaseApi | null> = {
                '15M': regimeContext.regime_context.setup_phase,
                '1H': regimeContext.regime_context.bias_phase,
                '4H': regimeContext.regime_context.regime_phase,
                '1D': regimeContext.regime_context.structural_phase,
              } as const;
              const phase = phaseByTf[timeframe];
              
              return (
                <div key={timeframe} className="border border-gray-700 rounded-lg p-3 bg-gray-800">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-sm w-8 text-gray-300">{timeframe}</span>
                      {phase ? (
                        <>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getBiasColor(phase.local_bias)}`}>
                            {phase.local_bias}
                          </span>
                          <span className={`text-sm font-medium ${getConfidenceColor(phase.confidence_score)}`}>
                            {phase.confidence_score}%
                          </span>
                          <span className="text-xs text-gray-400">
                            {phase.event_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-500 text-sm">No active phase</span>
                      )}
                    </div>
                    
                    {phase && (
                      <div className="text-xs text-gray-500">
                        Updated: {formatGeneratedAt(phase.generated_at)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Retrieved: {new Date(regimeContext.retrieved_at).toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-gray-400 text-center py-8">
          No regime context data available for {symbol}
        </div>
      )}
    </div>
  );
}