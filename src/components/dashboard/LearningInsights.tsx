'use client';

/**
 * Learning Insights Component
 * 
 * Displays learning suggestions with approve/reject controls.
 * Shows evidence and rationale for each suggestion.
 * 
 * Requirements: 14.5
 */

import React, { useState } from 'react';

/**
 * Suggestion evidence
 */
export interface SuggestionEvidence {
  sampleSize: number;
  winRate: number;
  expectancy: number;
  avgR: number;
  profitFactor: number;
  featureKey: string;
}

/**
 * Learning suggestion display
 */
export interface SuggestionDisplay {
  id: string;
  createdAt: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  parameterType: string;
  featureContext: Record<string, string>;
  currentValue: number;
  suggestedValue: number;
  changePercent: number;
  evidence: SuggestionEvidence;
  rationale: string;
}

/**
 * Props for LearningInsights
 */
interface LearningInsightsProps {
  suggestions?: SuggestionDisplay[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING': return 'bg-yellow-500 text-black';
    case 'APPROVED': return 'bg-green-500 text-white';
    case 'REJECTED': return 'bg-red-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
}

/**
 * Get change direction color
 */
function getChangeColor(change: number): string {
  if (change > 0) return 'text-green-400';
  if (change < 0) return 'text-red-400';
  return 'text-gray-400';
}

/**
 * Format date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Learning Insights Component
 */
export function LearningInsights({
  suggestions = [],
  onApprove,
  onReject,
}: LearningInsightsProps) {
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const filteredSuggestions = filter === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.status === filter);
  
  const pendingCount = suggestions.filter(s => s.status === 'PENDING').length;
  const approvedCount = suggestions.filter(s => s.status === 'APPROVED').length;
  const rejectedCount = suggestions.filter(s => s.status === 'REJECTED').length;
  
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Learning Insights</h2>
        <div className="flex items-center gap-2">
          {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
            <button
              key={f}
              className={`px-3 py-1 rounded text-sm ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `All (${suggestions.length})` : 
               f === 'PENDING' ? `Pending (${pendingCount})` :
               f === 'APPROVED' ? `Approved (${approvedCount})` :
               `Rejected (${rejectedCount})`}
            </button>
          ))}
        </div>
      </div>
      
      {suggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No learning suggestions available. Need at least 30 trades for analysis.
        </div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No suggestions match the current filter.
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredSuggestions.map(suggestion => (
            <div
              key={suggestion.id}
              className="bg-gray-800 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(suggestion.status)}`}>
                    {suggestion.status}
                  </span>
                  <span className="text-white font-semibold">{suggestion.parameterType}</span>
                  <span className="text-gray-400 text-sm">
                    {Object.entries(suggestion.featureContext).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{formatDate(suggestion.createdAt)}</span>
              </div>
              
              <div className="flex items-center gap-4 mb-2">
                <div className="text-sm">
                  <span className="text-gray-400">Current: </span>
                  <span className="text-white font-mono">{suggestion.currentValue.toFixed(2)}</span>
                </div>
                <span className="text-gray-500">→</span>
                <div className="text-sm">
                  <span className="text-gray-400">Suggested: </span>
                  <span className="text-white font-mono">{suggestion.suggestedValue.toFixed(2)}</span>
                </div>
                <span className={`font-bold ${getChangeColor(suggestion.changePercent)}`}>
                  {suggestion.changePercent > 0 ? '+' : ''}{suggestion.changePercent.toFixed(1)}%
                </span>
              </div>
              
              <div 
                className="text-sm text-gray-400 cursor-pointer hover:text-gray-300"
                onClick={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
              >
                {expandedId === suggestion.id ? '▼' : '▶'} {suggestion.rationale}
              </div>
              
              {expandedId === suggestion.id && (
                <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                  <div className="text-sm font-semibold text-gray-300 mb-2">Evidence</div>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    <div>
                      <div className="text-gray-500">Sample Size</div>
                      <div className="text-white font-mono">{suggestion.evidence.sampleSize}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Win Rate</div>
                      <div className="text-white font-mono">{(suggestion.evidence.winRate * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Expectancy</div>
                      <div className="text-white font-mono">${suggestion.evidence.expectancy.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Avg R</div>
                      <div className="text-white font-mono">{suggestion.evidence.avgR.toFixed(2)}R</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Profit Factor</div>
                      <div className="text-white font-mono">{suggestion.evidence.profitFactor.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}
              
              {suggestion.status === 'PENDING' && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                    onClick={() => onApprove?.(suggestion.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm"
                    onClick={() => onReject?.(suggestion.id)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
        <strong>Note:</strong> Approved suggestions must be manually copied to engine_overrides.ts and require an engine restart to take effect.
      </div>
    </div>
  );
}

export default LearningInsights;
