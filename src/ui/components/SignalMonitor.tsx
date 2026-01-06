'use client';

/**
 * Signal Monitor Component
 * Displays active signals across all timeframes with expiry countdown
 * 
 * Requirements: 14.1
 */

import { useState, useEffect } from 'react';
import { StoredSignal } from '@/webhooks/timeframeStore';
import { Timeframe, SignalType, SignalQuality } from '@/types/signal';

interface SignalMonitorProps {
  signals: Map<string, StoredSignal>;
  onRefresh?: () => void;
}

// Timeframe display order (highest to lowest)
const TIMEFRAME_ORDER: Timeframe[] = ['240', '60', '30', '15', '5', '3'];

// Timeframe labels
const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '240': '4H',
  '60': '1H',
  '30': '30M',
  '15': '15M',
  '5': '5M',
  '3': '3M',
};

// Quality colors
const QUALITY_COLORS: Record<SignalQuality, string> = {
  'EXTREME': 'bg-purple-500',
  'HIGH': 'bg-green-500',
  'MEDIUM': 'bg-yellow-500',
};

// Signal type colors
const SIGNAL_TYPE_COLORS: Record<SignalType, string> = {
  'LONG': 'text-green-400',
  'SHORT': 'text-red-400',
};

/**
 * Format remaining time as MM:SS or HH:MM:SS
 */
function formatRemainingTime(ms: number): string {
  if (ms <= 0) return 'Expired';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get urgency class based on remaining time
 */
function getUrgencyClass(ms: number, totalMs: number): string {
  const ratio = ms / totalMs;
  if (ratio <= 0.1) return 'text-red-500 animate-pulse';
  if (ratio <= 0.25) return 'text-orange-500';
  if (ratio <= 0.5) return 'text-yellow-500';
  return 'text-gray-400';
}

/**
 * Signal Card Component
 */
function SignalCard({ stored, now }: { stored: StoredSignal; now: number }) {
  const { signal, expires_at, validity_minutes } = stored;
  const remaining = expires_at - now;
  const totalMs = validity_minutes * 60 * 1000;
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-lg font-bold text-white">
          {TIMEFRAME_LABELS[signal.signal.timeframe]}
        </span>
        <span className={`px-2 py-1 rounded text-xs font-medium ${QUALITY_COLORS[signal.signal.quality]}`}>
          {signal.signal.quality}
        </span>
      </div>
      
      {/* Signal Type & Ticker */}
      <div className="flex justify-between items-center mb-2">
        <span className={`text-xl font-bold ${SIGNAL_TYPE_COLORS[signal.signal.type]}`}>
          {signal.signal.type}
        </span>
        <span className="text-gray-300 font-mono">
          {signal.instrument.ticker}
        </span>
      </div>
      
      {/* Price Info */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-gray-500">Entry:</span>
          <span className="text-white ml-2">${signal.entry.price.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">Stop:</span>
          <span className="text-red-400 ml-2">${signal.entry.stop_loss.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">T1:</span>
          <span className="text-green-400 ml-2">${signal.entry.target_1.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">T2:</span>
          <span className="text-green-400 ml-2">${signal.entry.target_2.toFixed(2)}</span>
        </div>
      </div>
      
      {/* AI Score */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-gray-500 text-sm">AI Score:</span>
        <span className="text-blue-400 font-bold">{signal.signal.ai_score.toFixed(1)}</span>
      </div>
      
      {/* R:R Ratio */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-gray-500 text-sm">R:R (T1/T2):</span>
        <span className="text-white">
          {signal.risk.rr_ratio_t1.toFixed(1)} / {signal.risk.rr_ratio_t2.toFixed(1)}
        </span>
      </div>
      
      {/* Expiry Countdown */}
      <div className="border-t border-gray-700 pt-3 mt-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-sm">Expires in:</span>
          <span className={`font-mono font-bold ${getUrgencyClass(remaining, totalMs)}`}>
            {formatRemainingTime(remaining)}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-1000"
            style={{ width: `${Math.max(0, (remaining / totalMs) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Empty Slot Component
 */
function EmptySlot({ timeframe }: { timeframe: Timeframe }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 border-dashed">
      <div className="flex justify-between items-center mb-3">
        <span className="text-lg font-bold text-gray-500">
          {TIMEFRAME_LABELS[timeframe]}
        </span>
      </div>
      <div className="text-center py-6 text-gray-600">
        No active signal
      </div>
    </div>
  );
}

/**
 * Signal Monitor Component
 */
export function SignalMonitor({ signals, onRefresh }: SignalMonitorProps) {
  const [now, setNow] = useState(Date.now());
  
  // Update time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Count active signals
  const activeCount = signals.size;
  
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Signal Monitor</h2>
          <p className="text-gray-400 text-sm">
            {activeCount} active signal{activeCount !== 1 ? 's' : ''} across timeframes
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            Refresh
          </button>
        )}
      </div>
      
      {/* Signal Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TIMEFRAME_ORDER.map((tf) => {
          const stored = signals.get(tf);
          return stored ? (
            <SignalCard key={tf} stored={stored} now={now} />
          ) : (
            <EmptySlot key={tf} timeframe={tf} />
          );
        })}
      </div>
    </div>
  );
}

export default SignalMonitor;
