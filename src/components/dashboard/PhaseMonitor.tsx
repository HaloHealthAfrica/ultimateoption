'use client';

import React, { useState, useEffect } from 'react';

interface PhaseData {
  symbol: string;
  timeframe: string;
  local_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence_score: number;
  created_at: string;
  expires_at: string;
}

interface RegimeContext {
  symbol: string;
  phases: PhaseData[];
  is_aligned: boolean;
  active_count: number;
  last_updated: string;
}

export default function PhaseMonitor() {
  const [regimeContext, setRegimeContext] = useState<RegimeContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('SPY');

  const fetchRegimeContext = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/phase/current?symbol=${symbol}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch regime context: ${response.statusText}`);
      }
      
      const data = await response.json();
      setRegimeContext(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setRegimeContext(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegimeContext();
    const interval = setInterval(fetchRegimeContext, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [symbol]);

  const getBiasColor = (bias: string) => {
    switch (bias) {
      case 'BULLISH': return 'text-green-600 bg-green-50';
      case 'BEARISH': return 'text-red-600 bg-red-50';
      case 'NEUTRAL': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Phase Monitor</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Phase Monitor</h2>
        <div className="text-red-600 bg-red-50 p-4 rounded">
          Error: {error}
        </div>
        <button 
          onClick={fetchRegimeContext}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Phase Monitor</h2>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="px-3 py-1 border rounded text-sm w-20"
            placeholder="Symbol"
          />
          <button 
            onClick={fetchRegimeContext}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {regimeContext ? (
        <div>
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium">Regime Status:</span>
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  regimeContext.is_aligned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {regimeContext.is_aligned ? 'ALIGNED' : 'NOT ALIGNED'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Active: {regimeContext.active_count}/4 timeframes
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {['1D', '4H', '1H', '15M'].map(timeframe => {
              const phase = regimeContext.phases.find(p => p.timeframe === timeframe);
              
              return (
                <div key={timeframe} className="border rounded p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-sm w-8">{timeframe}</span>
                      {phase ? (
                        <>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getBiasColor(phase.local_bias)}`}>
                            {phase.local_bias}
                          </span>
                          <span className={`text-sm font-medium ${getConfidenceColor(phase.confidence_score)}`}>
                            {phase.confidence_score}%
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400 text-sm">No active phase</span>
                      )}
                    </div>
                    
                    {phase && (
                      <div className="text-xs text-gray-500">
                        Expires: {formatTimeRemaining(phase.expires_at)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Last updated: {new Date(regimeContext.last_updated).toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">
          No regime context data available for {symbol}
        </div>
      )}
    </div>
  );
}