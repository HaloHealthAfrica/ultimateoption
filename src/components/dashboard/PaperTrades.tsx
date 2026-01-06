'use client';

/**
 * Paper Trades Component
 * 
 * Displays paper trading positions and history.
 * Shows open positions, closed trades, and P&L summary.
 * 
 * Requirements: 14.4
 */

import React, { useState } from 'react';

/**
 * Trade display data
 */
export interface TradeDisplay {
  id: string;
  ticker: string;
  option_type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;
  dte: number;
  contracts: number;
  entry_price: number;
  entry_time: number;
  exit?: {
    price: number;
    time: number;
    pnl_net: number;
    exit_reason: string;
  };
  current_price?: number;
  unrealized_pnl?: number;
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    iv: number;
  };
}

/**
 * Props for PaperTrades
 */
interface PaperTradesProps {
  trades?: TradeDisplay[];
  onTradeClick?: (trade: TradeDisplay) => void;
}

/**
 * Format currency
 */
function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return prefix + '$' + Math.abs(value).toFixed(2);
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
 * Get P&L color
 */
function getPnlColor(pnl: number): string {
  if (pnl > 0) return 'text-green-400';
  if (pnl < 0) return 'text-red-400';
  return 'text-gray-400';
}

/**
 * Paper Trades Component
 */
export function PaperTrades({ trades = [], onTradeClick }: PaperTradesProps) {
  const [view, setView] = useState<'open' | 'closed' | 'all'>('all');
  
  const openTrades = trades.filter(t => !t.exit);
  const closedTrades = trades.filter(t => t.exit);
  
  const filteredTrades = view === 'open' ? openTrades : view === 'closed' ? closedTrades : trades;
  
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.exit?.pnl_net || 0), 0);
  const unrealizedPnl = openTrades.reduce((sum, t) => sum + (t.unrealized_pnl || 0), 0);
  const winCount = closedTrades.filter(t => (t.exit?.pnl_net || 0) > 0).length;
  const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;
  
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Paper Trades</h2>
        <div className="flex items-center gap-2">
          {(['all', 'open', 'closed'] as const).map(v => (
            <button
              key={v}
              className={`px-3 py-1 rounded text-sm ${
                view === v ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)} ({v === 'all' ? trades.length : v === 'open' ? openTrades.length : closedTrades.length})
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Realized P&L</div>
          <div className={`text-lg font-bold ${getPnlColor(totalPnl)}`}>{formatCurrency(totalPnl)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Unrealized P&L</div>
          <div className={`text-lg font-bold ${getPnlColor(unrealizedPnl)}`}>{formatCurrency(unrealizedPnl)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Win Rate</div>
          <div className="text-lg font-bold text-white">{winRate.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Total Trades</div>
          <div className="text-lg font-bold text-white">{closedTrades.length}</div>
        </div>
      </div>
      
      {filteredTrades.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No trades to display.</div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredTrades.map(trade => (
            <div
              key={trade.id}
              className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors"
              onClick={() => onTradeClick?.(trade)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    trade.option_type === 'CALL' ? 'bg-emerald-500' : 'bg-red-500'
                  } text-white`}>
                    {trade.option_type}
                  </span>
                  <span className="text-white font-mono">
                    {trade.ticker} ${trade.strike} {trade.expiry}
                  </span>
                  <span className="text-gray-400 text-sm">{trade.dte}DTE</span>
                </div>
                <div className="text-right">
                  {trade.exit ? (
                    <span className={`font-bold ${getPnlColor(trade.exit.pnl_net)}`}>
                      {formatCurrency(trade.exit.pnl_net)}
                    </span>
                  ) : (
                    <span className={`font-bold ${getPnlColor(trade.unrealized_pnl || 0)}`}>
                      {formatCurrency(trade.unrealized_pnl || 0)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-400">
                  {trade.contracts} contracts @ ${trade.entry_price.toFixed(2)}
                </div>
                {trade.greeks && (
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>Δ {trade.greeks.delta.toFixed(2)}</span>
                    <span>Γ {trade.greeks.gamma.toFixed(3)}</span>
                    <span>Θ {trade.greeks.theta.toFixed(2)}</span>
                    <span>IV {(trade.greeks.iv * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
              
              <div className="text-xs text-gray-500 mt-1">
                {trade.exit ? (
                  <span>Closed: {formatDate(trade.exit.time)} ({trade.exit.exit_reason})</span>
                ) : (
                  <span>Opened: {formatDate(trade.entry_time)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PaperTrades;
