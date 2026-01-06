'use client';

/**
 * Confluence View Component
 * Visualizes multi-timeframe alignment for trading decisions
 * 
 * Requirements: 14.2
 */

import { StoredSignal } from '@/webhooks/timeframeStore';
import { Timeframe, SignalType } from '@/types/signal';

interface ConfluenceViewProps {
  signals: Map<string, StoredSignal>;
  confluenceScore: number;
  direction: SignalType | null;
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

// Weight percentages for display
const WEIGHT_PERCENTAGES: Record<Timeframe, number> = {
  '240': 40,
  '60': 25,
  '30': 15,
  '15': 10,
  '5': 7,
  '3': 3,
};

/**
 * Get alignment status for a signal
 */
function getAlignmentStatus(
  signal: StoredSignal | undefined,
  targetDirection: SignalType | null
): 'aligned' | 'counter' | 'neutral' {
  if (!signal || !targetDirection) return 'neutral';
  
  if (signal.signal.signal.type === targetDirection) {
    return 'aligned';
  }
  return 'counter';
}

/**
 * Get color class based on alignment
 */
function getAlignmentColor(status: 'aligned' | 'counter' | 'neutral'): string {
  switch (status) {
    case 'aligned': return 'bg-green-500';
    case 'counter': return 'bg-red-500';
    case 'neutral': return 'bg-gray-600';
  }
}

/**
 * Get text color based on alignment
 */
function getAlignmentTextColor(status: 'aligned' | 'counter' | 'neutral'): string {
  switch (status) {
    case 'aligned': return 'text-green-400';
    case 'counter': return 'text-red-400';
    case 'neutral': return 'text-gray-500';
  }
}

/**
 * Get confluence score color
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Get confluence score background
 */
function getScoreBackground(score: number): string {
  if (score >= 80) return 'bg-green-500/20 border-green-500';
  if (score >= 60) return 'bg-yellow-500/20 border-yellow-500';
  if (score >= 40) return 'bg-orange-500/20 border-orange-500';
  return 'bg-red-500/20 border-red-500';
}

/**
 * Timeframe Bar Component
 */
function TimeframeBar({ 
  timeframe, 
  signal, 
  direction,
  weight 
}: { 
  timeframe: Timeframe; 
  signal: StoredSignal | undefined;
  direction: SignalType | null;
  weight: number;
}) {
  const status = getAlignmentStatus(signal, direction);
  const colorClass = getAlignmentColor(status);
  const textColorClass = getAlignmentTextColor(status);
  
  return (
    <div className="flex items-center gap-4">
      {/* Timeframe Label */}
      <div className="w-12 text-right">
        <span className="text-gray-400 font-mono text-sm">
          {TIMEFRAME_LABELS[timeframe]}
        </span>
      </div>
      
      {/* Weight */}
      <div className="w-12 text-right">
        <span className="text-gray-500 text-xs">
          {weight}%
        </span>
      </div>
      
      {/* Bar */}
      <div className="flex-1 h-8 bg-gray-800 rounded-lg overflow-hidden relative">
        {signal ? (
          <>
            <div 
              className={`h-full ${colorClass} transition-all duration-300`}
              style={{ width: `${weight * 2.5}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <span className={`font-bold text-sm ${textColorClass}`}>
                {signal.signal.signal.type}
              </span>
              <span className="text-gray-400 text-xs">
                {signal.signal.signal.quality}
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-gray-600 text-sm">No Signal</span>
          </div>
        )}
      </div>
      
      {/* Contribution */}
      <div className="w-16 text-right">
        {signal && (
          <span className={`text-sm font-mono ${textColorClass}`}>
            {status === 'aligned' ? '+' : status === 'counter' ? '-' : ''}{weight}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Confluence View Component
 */
export function ConfluenceView({ signals, confluenceScore, direction }: ConfluenceViewProps) {
  // Count aligned vs counter signals
  let alignedCount = 0;
  let counterCount = 0;
  
  TIMEFRAME_ORDER.forEach(tf => {
    const signal = signals.get(tf);
    if (signal && direction) {
      if (signal.signal.signal.type === direction) {
        alignedCount++;
      } else {
        counterCount++;
      }
    }
  });
  
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Confluence Analysis</h2>
          <p className="text-gray-400 text-sm">
            Multi-timeframe alignment visualization
          </p>
        </div>
        
        {/* Score Display */}
        <div className={`px-4 py-3 rounded-lg border ${getScoreBackground(confluenceScore)}`}>
          <div className="text-center">
            <div className={`text-3xl font-bold ${getScoreColor(confluenceScore)}`}>
              {confluenceScore.toFixed(0)}%
            </div>
            <div className="text-gray-400 text-xs mt-1">Confluence</div>
          </div>
        </div>
      </div>
      
      {/* Direction Indicator */}
      {direction && (
        <div className="mb-6 p-3 bg-gray-800 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Primary Direction:</span>
            <span className={`text-xl font-bold ${direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
              {direction}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2 text-sm">
            <span className="text-gray-500">
              {alignedCount} aligned / {counterCount} counter
            </span>
            <span className="text-gray-500">
              {signals.size} active signals
            </span>
          </div>
        </div>
      )}
      
      {/* Timeframe Bars */}
      <div className="space-y-3">
        {/* Header Row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 pb-2 border-b border-gray-800">
          <div className="w-12 text-right">TF</div>
          <div className="w-12 text-right">Weight</div>
          <div className="flex-1">Signal</div>
          <div className="w-16 text-right">Score</div>
        </div>
        
        {/* Timeframe Rows */}
        {TIMEFRAME_ORDER.map(tf => (
          <TimeframeBar
            key={tf}
            timeframe={tf}
            signal={signals.get(tf)}
            direction={direction}
            weight={WEIGHT_PERCENTAGES[tf]}
          />
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-800">
        <div className="flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-gray-400">Aligned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-gray-400">Counter</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-600" />
            <span className="text-gray-400">No Signal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfluenceView;
