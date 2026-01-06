'use client';

/**
 * Signal Monitor Component
 * 
 * Displays active signals across all timeframes with validity countdown.
 * Shows signal quality, direction, and expiration status.
 * 
 * Requirements: 14.1
 */

import React, { useState, useEffect } from 'react';

/**
 * Signal display data
 */
export interface SignalDisplay {
  id: string;
  timeframe: string;
  type: 'LONG' | 'SHORT';
  quality: 'EXTREME' | 'HIGH' | 'MEDIUM';
  ai_score: number;
  ticker: string;
  price: number;
  received_at: number;
  expires_at: number;
}

/**
 * Props for SignalMonitor
 */
interface SignalMonitorProps {
  signals?: SignalDisplay[];
  onSignalClick?: (signal: SignalDisplay) => void;
  refreshInterval?: number;
}

/**
 * Get quality badge color
 */
function getQualityColor(quality: string): string {
  switch (quality) {
    case 'EXTREME': return 'bg-purple-600 text-white';
    case 'HIGH': return 'bg-green-600 text-white';
    case 'MEDIUM': return 'bg-yellow-500 text-black';
    default: return 'bg-gray-500 text-white';
  }
}

/**
 * Get direction badge color
 */
function getDirectionColor(type: string): string {
  return type === 'LONG' 
    ? 'bg-emerald-500 text-white' 
    : 'bg-red-500 text-white';
}

/**
 * Format time remaining
 */
function formatTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'EXPIRED';
  
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Get expiry status color
 */
function getExpiryColor(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'text-red-500';
  if (remaining < 60000) return 'text-orange-500';
  if (remaining < 180000) return 'text-yellow-500';
  return 'text-green-500';
}

const TIMEFRAME_LABELS: Record<string, string> = {
  '240': '4H', '60': '1H', '30': '30M', '15': '15M', '5': '5M', '3': '3M',
};

/**
 * Signal Monitor Component
 */
export function SignalMonitor({
  signals = [],
  onSignalClick,
  refreshInterval = 1000,
}: SignalMonitorProps) {
  const [, setTick] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);
  
  const timeframes = ['240', '60', '30', '15', '5', '3'];
  const signalsByTimeframe = new Map<string, SignalDisplay[]>();
  
  for (const tf of timeframes) {
    signalsByTimeframe.set(tf, signals.filter(s => s.timeframe === tf));
  }
  
  const activeSignals = signals.filter(s => s.expires_at > Date.now());
  const expiredSignals = signals.filter(s => s.expires_at <= Date.now());
  
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Signal Monitor</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Active: <span className="text-green-400 font-bold">{activeSignals.length}</span>
          </span>
          <span className="text-sm text-gray-400">
            Expired: <span className="text-red-400 font-bold">{expiredSignals.length}</span>
          </span>
        </div>
      </div>
      
      {signals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No signals received. Waiting for webhooks...
        </div>
      ) : (
        <div className="space-y-4">
          {timeframes.map(tf => {
            const tfSignals = signalsByTimeframe.get(tf) || [];
            if (tfSignals.length === 0) return null;
            
            return (
              <div key={tf} className="border border-gray-700 rounded-lg p-3">
                <div className="text-sm font-semibold text-gray-400 mb-2">
                  {TIMEFRAME_LABELS[tf]} Timeframe
                </div>
                <div className="space-y-2">
                  {tfSignals.map(signal => (
                    <div
                      key={signal.id}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        signal.expires_at > Date.now()
                          ? 'bg-gray-800 hover:bg-gray-700'
                          : 'bg-gray-800/50 opacity-50'
                      }`}
                      onClick={() => onSignalClick?.(signal)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getDirectionColor(signal.type)}`}>
                          {signal.type}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getQualityColor(signal.quality)}`}>
                          {signal.quality}
                        </span>
                        <span className="text-white font-mono">
                          {signal.ticker} @ ${signal.price.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-sm">
                          AI: {signal.ai_score.toFixed(1)}
                        </span>
                      </div>
                      <div className={`font-mono text-sm ${getExpiryColor(signal.expires_at)}`}>
                        {formatTimeRemaining(signal.expires_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SignalMonitor;
