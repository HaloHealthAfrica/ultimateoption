'use client';

/**
 * Decision Breakdown Component
 * Shows all multiplier values that contribute to the final decision
 * 
 * Requirements: 14.3
 */

import { DecisionResult, Decision } from '@/types/decision';

interface DecisionBreakdownProps {
  result: DecisionResult | null;
}

/**
 * Get decision color
 */
function getDecisionColor(decision: Decision): string {
  switch (decision) {
    case 'EXECUTE': return 'text-green-400 bg-green-500/20 border-green-500';
    case 'WAIT': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
    case 'SKIP': return 'text-red-400 bg-red-500/20 border-red-500';
  }
}

/**
 * Get multiplier color based on value
 */
function getMultiplierColor(value: number, isBoost: boolean = false): string {
  if (isBoost) {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  }
  
  if (value >= 1.2) return 'text-green-400';
  if (value >= 1.0) return 'text-blue-400';
  if (value >= 0.8) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * Format multiplier value
 */
function formatMultiplier(value: number, isBoost: boolean = false): string {
  if (isBoost) {
    const percent = (value * 100).toFixed(0);
    return value >= 0 ? `+${percent}%` : `${percent}%`;
  }
  return value.toFixed(2) + 'x';
}

/**
 * Multiplier Row Component
 */
function MultiplierRow({ 
  label, 
  value, 
  description,
  isBoost = false 
}: { 
  label: string; 
  value: number; 
  description: string;
  isBoost?: boolean;
}) {
  const colorClass = getMultiplierColor(value, isBoost);
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <div className="flex-1">
        <div className="text-gray-300 text-sm">{label}</div>
        <div className="text-gray-500 text-xs">{description}</div>
      </div>
      <div className={`font-mono font-bold ${colorClass}`}>
        {formatMultiplier(value, isBoost)}
      </div>
    </div>
  );
}

/**
 * Decision Breakdown Component
 */
export function DecisionBreakdown({ result }: DecisionBreakdownProps) {
  if (!result) {
    return (
      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Decision Breakdown</h2>
        <div className="text-center py-8 text-gray-500">
          No decision available. Waiting for signals...
        </div>
      </div>
    );
  }
  
  const { decision, reason, breakdown, engine_version, confluence_score, recommended_contracts } = result;
  
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Decision Breakdown</h2>
          <p className="text-gray-400 text-sm">Engine v{engine_version}</p>
        </div>
        
        {/* Decision Badge */}
        <div className={`px-4 py-2 rounded-lg border ${getDecisionColor(decision)}`}>
          <span className="text-lg font-bold">{decision}</span>
        </div>
      </div>
      
      {/* Reason */}
      <div className="mb-6 p-3 bg-gray-800 rounded-lg">
        <div className="text-gray-400 text-xs mb-1">Reason</div>
        <div className="text-white">{reason}</div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-gray-400 text-xs">Confluence Score</div>
          <div className="text-2xl font-bold text-blue-400">{confluence_score.toFixed(0)}%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-gray-400 text-xs">Recommended Contracts</div>
          <div className="text-2xl font-bold text-white">{recommended_contracts}</div>
        </div>
      </div>
      
      {/* Multipliers Section */}
      <div className="mb-4">
        <h3 className="text-gray-400 text-sm font-medium mb-3">Position Multipliers</h3>
        <div className="bg-gray-800 rounded-lg p-4">
          <MultiplierRow 
            label="Confluence" 
            value={breakdown.confluence_multiplier}
            description="Based on multi-timeframe alignment"
          />
          <MultiplierRow 
            label="Quality" 
            value={breakdown.quality_multiplier}
            description="Signal quality (EXTREME/HIGH/MEDIUM)"
          />
          <MultiplierRow 
            label="HTF Alignment" 
            value={breakdown.htf_alignment_multiplier}
            description="4H and 1H bias alignment"
          />
          <MultiplierRow 
            label="R:R Ratio" 
            value={breakdown.rr_multiplier}
            description="Risk-to-reward ratio"
          />
          <MultiplierRow 
            label="Volume" 
            value={breakdown.volume_multiplier}
            description="Volume vs average"
          />
          <MultiplierRow 
            label="Trend" 
            value={breakdown.trend_multiplier}
            description="Trend strength"
          />
          <MultiplierRow 
            label="Session" 
            value={breakdown.session_multiplier}
            description="Market session timing"
          />
          <MultiplierRow 
            label="Day" 
            value={breakdown.day_multiplier}
            description="Day of week"
          />
        </div>
      </div>
      
      {/* Phase Boosts */}
      <div className="mb-4">
        <h3 className="text-gray-400 text-sm font-medium mb-3">Phase Boosts</h3>
        <div className="bg-gray-800 rounded-lg p-4">
          <MultiplierRow 
            label="Confidence Boost" 
            value={breakdown.phase_confidence_boost}
            description="From HTF phase alignment"
            isBoost
          />
          <MultiplierRow 
            label="Position Boost" 
            value={breakdown.phase_position_boost}
            description="From high confidence phase"
            isBoost
          />
        </div>
      </div>
      
      {/* Final Multiplier */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-medium">Final Multiplier</div>
            <div className="text-gray-500 text-xs">All factors combined (clamped 0.5-3.0)</div>
          </div>
          <div className={`text-2xl font-bold font-mono ${getMultiplierColor(breakdown.final_multiplier)}`}>
            {breakdown.final_multiplier.toFixed(2)}x
          </div>
        </div>
      </div>
      
      {/* Entry Details (if EXECUTE) */}
      {decision === 'EXECUTE' && result.entry_signal && (
        <div className="mt-6 pt-4 border-t border-gray-800">
          <h3 className="text-gray-400 text-sm font-medium mb-3">Entry Details</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-gray-400 text-xs">Stop Loss</div>
              <div className="text-red-400 font-mono">${result.stop_loss?.toFixed(2)}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-gray-400 text-xs">Target 1</div>
              <div className="text-green-400 font-mono">${result.target_1?.toFixed(2)}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-gray-400 text-xs">Target 2</div>
              <div className="text-green-400 font-mono">${result.target_2?.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DecisionBreakdown;
