'use client';

/**
 * Confluence View Component
 * 
 * Displays multi-timeframe confluence matrix showing
 * signal alignment across timeframes.
 * 
 * Requirements: 14.2
 */

import React from 'react';

/**
 * Confluence cell data
 */
export interface ConfluenceCell {
  timeframe: string;
  hasSignal: boolean;
  signalType?: 'LONG' | 'SHORT';
  quality?: 'EXTREME' | 'HIGH' | 'MEDIUM';
  ai_score?: number;
  isExpired?: boolean;
}

/**
 * Confluence score data
 */
export interface ConfluenceScore {
  total: number;
  aligned: number;
  direction: 'LONG' | 'SHORT' | 'MIXED' | 'NONE';
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  percentage: number;
}

/**
 * Props for ConfluenceView
 */
interface ConfluenceViewProps {
  cells: ConfluenceCell[];
  score?: ConfluenceScore;
  onCellClick?: (cell: ConfluenceCell) => void;
}

const TIMEFRAME_LABELS: Record<string, string> = {
  '240': '4H', '60': '1H', '30': '30M', '15': '15M', '5': '5M', '3': '3M',
};

/**
 * Get cell background color based on signal
 */
function getCellColor(cell: ConfluenceCell): string {
  if (!cell.hasSignal) return 'bg-gray-800';
  if (cell.isExpired) return 'bg-gray-700 opacity-50';
  
  if (cell.signalType === 'LONG') {
    switch (cell.quality) {
      case 'EXTREME': return 'bg-emerald-600';
      case 'HIGH': return 'bg-emerald-500';
      default: return 'bg-emerald-400';
    }
  } else {
    switch (cell.quality) {
      case 'EXTREME': return 'bg-red-600';
      case 'HIGH': return 'bg-red-500';
      default: return 'bg-red-400';
    }
  }
}

/**
 * Get strength badge color
 */
function getStrengthColor(strength: string): string {
  switch (strength) {
    case 'STRONG': return 'bg-green-500 text-white';
    case 'MODERATE': return 'bg-yellow-500 text-black';
    case 'WEAK': return 'bg-orange-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
}

/**
 * Confluence View Component
 */
export function ConfluenceView({
  cells,
  score,
  onCellClick,
}: ConfluenceViewProps) {
  const timeframes = ['240', '60', '30', '15', '5', '3'];
  
  const cellMap = new Map<string, ConfluenceCell>();
  for (const cell of cells) {
    cellMap.set(cell.timeframe, cell);
  }
  
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Confluence Matrix</h2>
        {score && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              Score: <span className="text-white font-bold">{score.percentage.toFixed(0)}%</span>
            </span>
            <span className={`px-2 py-1 rounded text-xs font-bold ${getStrengthColor(score.strength)}`}>
              {score.strength}
            </span>
            {score.direction !== 'NONE' && (
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                score.direction === 'LONG' ? 'bg-emerald-500' :
                score.direction === 'SHORT' ? 'bg-red-500' : 'bg-yellow-500'
              } text-white`}>
                {score.direction}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-6 gap-2">
        {timeframes.map(tf => (
          <div key={`header-${tf}`} className="text-center text-sm font-semibold text-gray-400 pb-2">
            {TIMEFRAME_LABELS[tf]}
          </div>
        ))}
        
        {timeframes.map(tf => {
          const cell = cellMap.get(tf) || { timeframe: tf, hasSignal: false };
          
          return (
            <div
              key={`cell-${tf}`}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${getCellColor(cell)}`}
              onClick={() => onCellClick?.(cell)}
            >
              {cell.hasSignal ? (
                <>
                  <span className="text-white font-bold text-lg">
                    {cell.signalType === 'LONG' ? '↑' : '↓'}
                  </span>
                  <span className="text-white/80 text-xs">
                    {cell.ai_score?.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-gray-600 text-2xl">—</span>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500"></div>
          <span>LONG</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span>SHORT</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-800"></div>
          <span>No Signal</span>
        </div>
      </div>
    </div>
  );
}

export default ConfluenceView;
