'use client';

/**
 * Learning Insights Component
 * Shows metrics and suggestions with approve/reject controls
 * 
 * Requirements: 14.5
 */

import { useState } from 'react';
import { Metrics } from '@/learning/metricsEngine';
import { LearningSuggestion, SuggestionStatus } from '@/learning/learningAdvisor';

interface LearningInsightsProps {
  metrics: Metrics | null;
  suggestions: LearningSuggestion[];
  onApproveSuggestion?: (id: string) => void;
  onRejectSuggestion?: (id: string) => void;
  onRefresh?: () => void;
}

/**
 * Get status color
 */
function getStatusColor(status: SuggestionStatus): string {
  switch (status) {
    case 'PENDING': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    case 'APPROVED': return 'bg-green-500/20 text-green-400 border-green-500';
    case 'REJECTED': return 'bg-red-500/20 text-red-400 border-red-500';
  }
}

/**
 * Get change color
 */
function getChangeColor(change: number): string {
  if (change > 0) return 'text-green-400';
  if (change < 0) return 'text-red-400';
  return 'text-gray-400';
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format change percentage
 */
function formatChange(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

/**
 * Metrics Card Component
 */
function MetricsCard({ metrics }: { metrics: Metrics }) {
  if (metrics.status !== 'VALID') {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-center py-4">
          <div className="text-yellow-400 mb-2">Insufficient Data</div>
          <div className="text-gray-500 text-sm">
            Need {metrics.required ?? 30} trades, have {metrics.sample_size}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Win Rate */}
        <div>
          <div className="text-gray-500 text-xs">Win Rate</div>
          <div className={`text-xl font-bold ${metrics.win_rate! >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(metrics.win_rate!)}
          </div>
        </div>
        
        {/* Expectancy */}
        <div>
          <div className="text-gray-500 text-xs">Expectancy</div>
          <div className={`text-xl font-bold ${metrics.expectancy! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${metrics.expectancy!.toFixed(2)}
          </div>
        </div>
        
        {/* Avg R */}
        <div>
          <div className="text-gray-500 text-xs">Avg R</div>
          <div className={`text-xl font-bold ${metrics.avg_r! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.avg_r!.toFixed(2)}R
          </div>
        </div>
        
        {/* Profit Factor */}
        <div>
          <div className="text-gray-500 text-xs">Profit Factor</div>
          <div className={`text-xl font-bold ${metrics.profit_factor! >= 1 ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.profit_factor!.toFixed(2)}
          </div>
        </div>
        
        {/* Max Drawdown */}
        <div>
          <div className="text-gray-500 text-xs">Max Drawdown</div>
          <div className="text-xl font-bold text-red-400">
            ${metrics.max_drawdown!.toFixed(2)}
          </div>
        </div>
        
        {/* Avg Win */}
        <div>
          <div className="text-gray-500 text-xs">Avg Win</div>
          <div className="text-xl font-bold text-green-400">
            ${metrics.avg_win!.toFixed(2)}
          </div>
        </div>
        
        {/* Avg Loss */}
        <div>
          <div className="text-gray-500 text-xs">Avg Loss</div>
          <div className="text-xl font-bold text-red-400">
            ${metrics.avg_loss!.toFixed(2)}
          </div>
        </div>
        
        {/* Sample Size */}
        <div>
          <div className="text-gray-500 text-xs">Sample Size</div>
          <div className="text-xl font-bold text-white">
            {metrics.sample_size}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Suggestion Card Component
 */
function SuggestionCard({ 
  suggestion, 
  onApprove, 
  onReject 
}: { 
  suggestion: LearningSuggestion;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-white font-medium">{suggestion.parameterType}</span>
          <span className="text-gray-500 text-sm ml-2">
            {Object.entries(suggestion.featureContext).map(([k, v]) => `${k}: ${v}`).join(', ')}
          </span>
        </div>
        <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(suggestion.status)}`}>
          {suggestion.status}
        </span>
      </div>
      
      {/* Change Display */}
      <div className="flex items-center gap-4 mb-3">
        <div className="text-gray-400">
          <span className="text-sm">Current:</span>
          <span className="text-white ml-2 font-mono">{suggestion.currentValue.toFixed(2)}</span>
        </div>
        <div className="text-gray-400">→</div>
        <div className="text-gray-400">
          <span className="text-sm">Suggested:</span>
          <span className="text-white ml-2 font-mono">{suggestion.suggestedValue.toFixed(2)}</span>
        </div>
        <div className={`font-bold ${getChangeColor(suggestion.changePercent)}`}>
          {formatChange(suggestion.changePercent)}
        </div>
      </div>
      
      {/* Rationale */}
      <div className="text-gray-400 text-sm mb-3">
        {suggestion.rationale}
      </div>
      
      {/* Evidence (expandable) */}
      <button 
        onClick={() => setExpanded(!expanded)}
        className="text-blue-400 text-sm hover:underline mb-3"
      >
        {expanded ? 'Hide Evidence' : 'Show Evidence'}
      </button>
      
      {expanded && (
        <div className="bg-gray-900 rounded p-3 mb-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Sample Size:</span>
              <span className="text-white ml-2">{suggestion.evidence.sampleSize}</span>
            </div>
            <div>
              <span className="text-gray-500">Win Rate:</span>
              <span className="text-white ml-2">{formatPercent(suggestion.evidence.winRate)}</span>
            </div>
            <div>
              <span className="text-gray-500">Expectancy:</span>
              <span className="text-white ml-2">${suggestion.evidence.expectancy.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Avg R:</span>
              <span className="text-white ml-2">{suggestion.evidence.avgR.toFixed(2)}R</span>
            </div>
            <div>
              <span className="text-gray-500">Profit Factor:</span>
              <span className="text-white ml-2">{suggestion.evidence.profitFactor.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Actions (only for PENDING) */}
      {suggestion.status === 'PENDING' && (onApprove || onReject) && (
        <div className="flex gap-2 pt-3 border-t border-gray-700">
          {onApprove && (
            <button
              onClick={onApprove}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
            >
              Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Learning Insights Component
 */
export function LearningInsights({ 
  metrics, 
  suggestions, 
  onApproveSuggestion, 
  onRejectSuggestion,
  onRefresh 
}: LearningInsightsProps) {
  const [filter, setFilter] = useState<SuggestionStatus | 'ALL'>('PENDING');
  
  // Filter suggestions
  const filteredSuggestions = filter === 'ALL' 
    ? suggestions 
    : suggestions.filter(s => s.status === filter);
  
  // Count by status
  const pendingCount = suggestions.filter(s => s.status === 'PENDING').length;
  const approvedCount = suggestions.filter(s => s.status === 'APPROVED').length;
  const rejectedCount = suggestions.filter(s => s.status === 'REJECTED').length;
  
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Learning Insights</h2>
          <p className="text-gray-400 text-sm">
            Performance metrics and parameter suggestions
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-sm transition-colors"
          >
            Refresh
          </button>
        )}
      </div>
      
      {/* Metrics Section */}
      <div className="mb-6">
        <h3 className="text-gray-400 text-sm font-medium mb-3">Performance Metrics</h3>
        {metrics ? (
          <MetricsCard metrics={metrics} />
        ) : (
          <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500">
            No metrics available
          </div>
        )}
      </div>
      
      {/* Suggestions Section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-gray-400 text-sm font-medium">Parameter Suggestions</h3>
          
          {/* Filter Tabs */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  filter === status 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {status}
                {status === 'PENDING' && pendingCount > 0 && (
                  <span className="ml-1 bg-yellow-500 text-black px-1 rounded">
                    {pendingCount}
                  </span>
                )}
                {status === 'APPROVED' && approvedCount > 0 && (
                  <span className="ml-1 bg-green-500 text-black px-1 rounded">
                    {approvedCount}
                  </span>
                )}
                {status === 'REJECTED' && rejectedCount > 0 && (
                  <span className="ml-1 bg-red-500 text-black px-1 rounded">
                    {rejectedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Suggestions List */}
        {filteredSuggestions.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500">
            No {filter === 'ALL' ? '' : filter.toLowerCase()} suggestions
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSuggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApprove={onApproveSuggestion ? () => onApproveSuggestion(suggestion.id) : undefined}
                onReject={onRejectSuggestion ? () => onRejectSuggestion(suggestion.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Warning */}
      <div className="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-yellow-400">⚠️</span>
          <div className="text-yellow-400 text-sm">
            Suggestions are advisory only. All changes require human approval and will not be 
            automatically applied to the decision engine.
          </div>
        </div>
      </div>
    </div>
  );
}

export default LearningInsights;
