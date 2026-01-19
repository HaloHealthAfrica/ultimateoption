'use client';

/**
 * Paper Trades Component
 * Displays open positions with Greeks (delta, theta, gamma, iv)
 * 
 * Requirements: 14.4
 */

import { useMemo, useState } from 'react';
import { LedgerEntry } from '@/types/ledger';
import { OptionType, Execution } from '@/types/options';
import { Metrics, RollingMetrics } from '@/learning/metricsEngine';

interface PaperTradesProps {
  entries: LedgerEntry[];
  performance?: PaperPerformance | null;
  onRefresh?: () => void;
}

export interface PaperPerformance {
  overall: Metrics;
  rolling: RollingMetrics;
  by_dte_bucket: Record<string, Metrics>;
  streaks: {
    currentStreak: number;
    currentStreakType: 'WIN' | 'LOSS' | 'NONE';
    maxWinStreak: number;
    maxLossStreak: number;
  };
  sample_size: number;
}

/**
 * Get option type color
 */
function getOptionTypeColor(type: OptionType): string {
  return type === 'CALL' ? 'text-green-400' : 'text-red-400';
}

/**
 * Get P&L color
 */
function getPnLColor(pnl: number): string {
  if (pnl > 0) return 'text-green-400';
  if (pnl < 0) return 'text-red-400';
  return 'text-gray-400';
}

/**
 * Format currency
 */
function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}$${value.toFixed(2)}`;
}

/**
 * Format time duration
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

/**
 * Greeks Display Component
 */
function GreeksDisplay({ execution }: { execution: Execution }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-xs">
      <div>
        <span className="text-gray-500">Δ</span>
        <span className="text-blue-400 ml-1">{execution.entry_delta.toFixed(3)}</span>
      </div>
      <div>
        <span className="text-gray-500">Γ</span>
        <span className="text-purple-400 ml-1">{execution.entry_gamma.toFixed(4)}</span>
      </div>
      <div>
        <span className="text-gray-500">Θ</span>
        <span className="text-orange-400 ml-1">{execution.entry_theta.toFixed(2)}</span>
      </div>
      <div>
        <span className="text-gray-500">IV</span>
        <span className="text-cyan-400 ml-1">{(execution.entry_iv * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

/**
 * Open Position Card
 */
function OpenPositionCard({ entry }: { entry: LedgerEntry }) {
  const execution = entry.execution!;
  const holdTime = Math.floor((Date.now() - entry.created_at) / 1000);
  
  // Calculate unrealized P&L (simplified - would need current price in real app)
  const costBasis = execution.entry_price * execution.filled_contracts * 100;
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className={`text-lg font-bold ${getOptionTypeColor(execution.option_type)}`}>
            {execution.option_type}
          </span>
          <span className="text-gray-400 ml-2">
            ${execution.strike} {execution.expiry}
          </span>
        </div>
        <div className="text-right">
          <div className="text-gray-400 text-xs">DTE</div>
          <div className="text-white font-bold">{execution.dte}</div>
        </div>
      </div>
      
      {/* Position Details */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
        <div>
          <span className="text-gray-500">Contracts:</span>
          <span className="text-white ml-2">{execution.filled_contracts}</span>
        </div>
        <div>
          <span className="text-gray-500">Entry:</span>
          <span className="text-white ml-2">${execution.entry_price.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">Cost Basis:</span>
          <span className="text-white ml-2">${costBasis.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">Risk:</span>
          <span className="text-red-400 ml-2">${execution.risk_amount.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Greeks */}
      <div className="mb-3 p-2 bg-gray-900 rounded">
        <div className="text-gray-500 text-xs mb-1">Greeks at Entry</div>
        <GreeksDisplay execution={execution} />
      </div>
      
      {/* Costs */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div>
          <span className="text-gray-500">Spread:</span>
          <span className="text-orange-400 ml-1">${execution.spread_cost.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">Slip:</span>
          <span className="text-orange-400 ml-1">${execution.slippage.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">Comm:</span>
          <span className="text-orange-400 ml-1">${execution.commission.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-gray-700 text-xs">
        <span className="text-gray-500">
          Hold time: {formatDuration(holdTime)}
        </span>
        <span className={`px-2 py-1 rounded ${execution.fill_quality === 'FULL' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
          {execution.fill_quality}
        </span>
      </div>
    </div>
  );
}

/**
 * Closed Position Row
 */
function ClosedPositionRow({ entry }: { entry: LedgerEntry }) {
  const execution = entry.execution!;
  const exit = entry.exit!;
  
  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/50">
      <td className="py-3 px-4">
        <span className={getOptionTypeColor(execution.option_type)}>
          {execution.option_type}
        </span>
        <span className="text-gray-400 ml-1 text-sm">
          ${execution.strike}
        </span>
      </td>
      <td className="py-3 px-4 text-gray-300">{execution.filled_contracts}</td>
      <td className="py-3 px-4 text-gray-300">${execution.entry_price.toFixed(2)}</td>
      <td className="py-3 px-4 text-gray-300">${exit.exit_price.toFixed(2)}</td>
      <td className={`py-3 px-4 font-mono ${getPnLColor(exit.pnl_net)}`}>
        {formatCurrency(exit.pnl_net)}
      </td>
      <td className="py-3 px-4 text-gray-400 text-sm">
        {formatDuration(exit.hold_time_seconds)}
      </td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 rounded text-xs ${
          exit.exit_reason.includes('TARGET') ? 'bg-green-500/20 text-green-400' :
          exit.exit_reason === 'STOP_LOSS' ? 'bg-red-500/20 text-red-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {exit.exit_reason}
        </span>
      </td>
    </tr>
  );
}

/**
 * Paper Trades Component
 */
export function PaperTrades({ entries, performance, onRefresh }: PaperTradesProps) {
  const [showClosed, setShowClosed] = useState(false);
  
  // Separate open and closed positions
  const openPositions = entries.filter(e => 
    e.decision === 'EXECUTE' && e.execution && !e.exit
  );
  const closedPositions = entries.filter(e => 
    e.decision === 'EXECUTE' && e.execution && e.exit
  );
  
  // Calculate totals
  const totalPnL = closedPositions.reduce((sum, e) => sum + (e.exit?.pnl_net ?? 0), 0);
  const winCount = closedPositions.filter(e => (e.exit?.pnl_net ?? 0) > 0).length;
  const winRate = closedPositions.length > 0 ? (winCount / closedPositions.length) * 100 : 0;
  const perfSummary = useMemo(() => {
    if (!performance?.overall) return null;
    return performance.overall;
  }, [performance]);
  const perfValid = perfSummary?.status === 'VALID';
  const displayPnL = perfValid && typeof perfSummary?.total_pnl === 'number'
    ? perfSummary.total_pnl
    : totalPnL;
  const displayWinRate = perfValid && typeof perfSummary?.win_rate === 'number'
    ? perfSummary.win_rate * 100
    : winRate;
  const displayTrades = perfValid && typeof perfSummary?.total_trades === 'number'
    ? perfSummary.total_trades
    : closedPositions.length;
  const sampleLabel = perfSummary
    ? perfSummary.status === 'VALID'
      ? `sample ${perfSummary.sample_size}`
      : `sample ${perfSummary.sample_size}/${perfSummary.required ?? 30}`
    : null;
  
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Paper Trades</h2>
          <p className="text-gray-400 text-sm">
            {openPositions.length} open / {closedPositions.length} closed
            {sampleLabel ? ` • ${sampleLabel}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowClosed(!showClosed)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              showClosed 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {showClosed ? 'Show Open' : 'Show Closed'}
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-sm transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-gray-400 text-xs">Total P&L</div>
          <div className={`text-xl font-bold ${getPnLColor(displayPnL)}`}>
            {formatCurrency(displayPnL)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-gray-400 text-xs">Win Rate</div>
          <div className="text-xl font-bold text-white">{displayWinRate.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-gray-400 text-xs">Closed Trades</div>
          <div className="text-xl font-bold text-blue-400">{displayTrades}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-gray-400 text-xs">Open Positions</div>
          <div className="text-xl font-bold text-blue-400">{openPositions.length}</div>
        </div>
      </div>
      
      {/* Content */}
      {!showClosed ? (
        // Open Positions Grid
        <div>
          {openPositions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No open positions
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {openPositions.map(entry => (
                <OpenPositionCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Closed Positions Table
        <div className="overflow-x-auto">
          {closedPositions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No closed positions
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-500 text-sm border-b border-gray-800">
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4">Qty</th>
                  <th className="py-2 px-4">Entry</th>
                  <th className="py-2 px-4">Exit</th>
                  <th className="py-2 px-4">P&L</th>
                  <th className="py-2 px-4">Duration</th>
                  <th className="py-2 px-4">Reason</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.slice(0, 20).map(entry => (
                  <ClosedPositionRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default PaperTrades;
