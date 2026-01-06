'use client';

/**
 * Decision Breakdown Component
 * 
 * Displays detailed breakdown of decision engine calculations
 * including all multipliers and the final decision.
 * 
 * Requirements: 14.3
 */

import React from 'react';

/**
 * Breakdown data matching DecisionBreakdown type
 */
export interface BreakdownData {
  confluence_multiplier: number;
  quality_multiplier: number;
  htf_alignment_multiplier: number;
  rr_multiplier: number;
  volume_multiplier: number;
  trend_multiplier: number;
  session_multiplier: number;
  day_multiplier: number;
  phase_confidence_boost: number;
  phase_position_boost: number;
  trend_alignment_boost: number;
  final_multiplier: number;
}

/**
 * Decision display data
 */
export interface DecisionDisplay {
  decision: 'EXECUTE' | 'WAIT' | 'SKIP';
  reason: string;
  confluence_score: number;
  breakdown: BreakdownData;
  engine_version: string;
  timestamp: number;
}

/**
 * Props for DecisionBreakdown
 */
interface DecisionBreakdownProps {
  decision?: DecisionDisplay;
  showDetails?: boolean;
}

/**
 * Get decision badge color
 */
function getDecisionColor(decision: string): string {
  switch (decision) {
    case 'EXECUTE': return 'bg-green-500 text-white';
    case 'WAIT': return 'bg-yellow-500 text-black';
    case 'SKIP': return 'bg-red-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
}

/**
 * Get multiplier bar color based on value
 */
function getMultiplierColor(value: number): string {
  if (value >= 1.2) return 'bg-green-500';
  if (value >= 1.0) return 'bg-emerald-400';
  if (value >= 0.8) return 'bg-yellow-500';
  if (value >= 0.6) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Multiplier row component
 */
function MultiplierRow({ label, value, description }: { 
  label: string; 
  value: number; 
  description?: string;
}) {
  const percentage = Math.min(100, Math.max(0, (value / 1.5) * 100));
  
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className={`text-sm font-mono font-bold ${
          value >= 1.0 ? 'text-green-400' : 'text-red-400'
        }`}>
          {value.toFixed(2)}x
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getMultiplierColor(value)} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
}

/**
 * Decision Breakdown Component
 */
export function DecisionBreakdown({
  decision,
  showDetails = true,
}: DecisionBreakdownProps) {
  if (!decision) {
    return (
      <div className="bg-gray-900 rounded-lg p-4">
        <h2 className="text-xl font-bold text-white mb-4">Decision Breakdown</h2>
        <div className="text-center py-8 text-gray-500">
          No decision made yet. Waiting for signals...
        </div>
      </div>
    );
  }
  
  const { breakdown } = decision;
  
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Decision Breakdown</h2>
        <span className="text-xs text-gray-500 font-mono">v{decision.engine_version}</span>
      </div>
      
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`px-4 py-2 rounded-lg text-lg font-bold ${getDecisionColor(decision.decision)}`}>
            {decision.decision}
          </span>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {decision.confluence_score.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">Confluence Score</div>
          </div>
        </div>
        <p className="text-sm text-gray-400">{decision.reason}</p>
      </div>
      
      {showDetails && (
        <div className="space-y-1">
          <MultiplierRow label="Confluence" value={breakdown.confluence_multiplier} description="Multi-timeframe alignment" />
          <MultiplierRow label="Quality" value={breakdown.quality_multiplier} description="Signal quality (EXTREME/HIGH/MEDIUM)" />
          <MultiplierRow label="HTF Alignment" value={breakdown.htf_alignment_multiplier} description="Higher timeframe alignment" />
          <MultiplierRow label="Risk/Reward" value={breakdown.rr_multiplier} description="R:R ratio quality" />
          <MultiplierRow label="Volume" value={breakdown.volume_multiplier} description="Volume confirmation" />
          <MultiplierRow label="Trend" value={breakdown.trend_multiplier} description="Trend strength" />
          <MultiplierRow label="Session" value={breakdown.session_multiplier} description="Market session timing" />
          <MultiplierRow label="Day" value={breakdown.day_multiplier} description="Day of week factor" />
          
          {(breakdown.phase_confidence_boost > 0 || breakdown.phase_position_boost > 0 || breakdown.trend_alignment_boost > 0) && (
            <div className="mt-4 space-y-2">
              {/* Phase 1B Boosts Section */}
              <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-500/30">
                <h4 className="text-sm font-semibold text-purple-300 mb-2">Phase 1B Boosts</h4>
                
                {/* Phase Boosts */}
                {(breakdown.phase_confidence_boost > 0 || breakdown.phase_position_boost > 0) && (
                  <div className="mb-3">
                    <div className="text-xs text-purple-200 mb-1">SATY Phase Integration</div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-purple-300">Phase Confidence Boost</span>
                      <span className="text-sm font-bold text-purple-400">
                        {breakdown.phase_confidence_boost > 0 ? `+${(breakdown.phase_confidence_boost * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-300">Phase Position Boost</span>
                      <span className="text-sm font-bold text-purple-400">
                        {breakdown.phase_position_boost > 0 ? `+${(breakdown.phase_position_boost * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Trend Alignment Boost */}
                {breakdown.trend_alignment_boost > 0 && (
                  <div>
                    <div className="text-xs text-blue-200 mb-1">Multi-Timeframe Trend Analysis</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-300">Trend Alignment Boost</span>
                      <span className="text-sm font-bold text-blue-400">
                        +{(breakdown.trend_alignment_boost * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Final Multiplier</span>
              <span className={`font-mono font-bold text-lg ${
                breakdown.final_multiplier >= 1.0 ? 'text-green-400' : 'text-orange-400'
              }`}>
                {breakdown.final_multiplier.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DecisionBreakdown;
