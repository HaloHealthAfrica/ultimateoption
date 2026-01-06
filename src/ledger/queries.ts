/**
 * Ledger Query Functions
 * 
 * Provides typed query builders and aggregation functions for ledger entries.
 * 
 * Requirements: 13.3, 13.4
 */

import {
  LedgerEntry,
  LedgerQueryFilters,
  VolatilityRegime,
} from '../types/ledger';
import { Decision } from '../types/decision';
import { ILedger } from './ledger';

/**
 * Trade type classification based on timeframe
 */
export type TradeType = 'SCALP' | 'DAY' | 'SWING';

/**
 * DTE bucket classification
 */
export type DTEBucket = '0DTE' | 'WEEKLY' | 'MONTHLY';

/**
 * Extended query filters with additional options
 */
export interface ExtendedQueryFilters {
  timeframe?: string;
  quality?: string;
  decision?: Decision;
  dte_bucket?: DTEBucket | string;
  trade_type?: TradeType | string;
  regime_volatility?: VolatilityRegime;
  from_date?: number;
  to_date?: number;
  limit?: number;
  offset?: number;
  ticker?: string;
  has_exit?: boolean;
  has_hypothetical?: boolean;
  min_confluence?: number;
  max_confluence?: number;
  exit_reason?: string;
}

/**
 * Aggregated metrics from query results
 */
export interface QueryAggregates {
  total_count: number;
  execute_count: number;
  wait_count: number;
  skip_count: number;
  with_exit_count: number;
  with_hypothetical_count: number;
  avg_confluence: number;
  total_pnl_net: number;
  win_count: number;
  loss_count: number;
}

/**
 * Classify timeframe into trade type
 */
export function classifyTradeType(timeframe: string): TradeType {
  const tf = timeframe.toUpperCase();
  if (tf === '3' || tf === '3M' || tf === '5' || tf === '5M') {
    return 'SCALP';
  }
  if (tf === '15' || tf === '15M' || tf === '30' || tf === '30M' || tf === '60' || tf === '60M' || tf === '1H') {
    return 'DAY';
  }
  return 'SWING';
}

/**
 * Classify DTE into bucket
 */
export function classifyDTEBucket(dte: number): DTEBucket {
  if (dte === 0) return '0DTE';
  if (dte <= 7) return 'WEEKLY';
  return 'MONTHLY';
}

/**
 * Query ledger with extended filters
 */
export async function queryLedger(
  ledger: ILedger,
  filters: ExtendedQueryFilters
): Promise<LedgerEntry[]> {
  // First get base results from ledger
  const baseFilters: LedgerQueryFilters = {
    timeframe: filters.timeframe,
    quality: filters.quality,
    decision: filters.decision,
    regime_volatility: filters.regime_volatility,
    from_date: filters.from_date,
    to_date: filters.to_date,
    // Request more than needed to allow for post-filtering
    limit: Math.min((filters.limit || 100) * 2, 1000),
    offset: 0,
  };

  let results = await ledger.query(baseFilters);

  // Apply extended filters
  if (filters.trade_type) {
    results = results.filter(e => 
      classifyTradeType(e.signal.signal.timeframe) === filters.trade_type
    );
  }

  if (filters.dte_bucket && filters.decision === 'EXECUTE') {
    results = results.filter(e => {
      if (!e.execution) return false;
      return classifyDTEBucket(e.execution.dte) === filters.dte_bucket;
    });
  }

  if (filters.ticker) {
    results = results.filter(e => 
      e.signal.instrument.ticker.toUpperCase() === filters.ticker!.toUpperCase()
    );
  }

  if (filters.has_exit !== undefined) {
    results = results.filter(e => 
      filters.has_exit ? e.exit !== undefined : e.exit === undefined
    );
  }

  if (filters.has_hypothetical !== undefined) {
    results = results.filter(e => 
      filters.has_hypothetical ? e.hypothetical !== undefined : e.hypothetical === undefined
    );
  }

  if (filters.min_confluence !== undefined) {
    results = results.filter(e => e.confluence_score >= filters.min_confluence!);
  }

  if (filters.max_confluence !== undefined) {
    results = results.filter(e => e.confluence_score <= filters.max_confluence!);
  }

  if (filters.exit_reason) {
    results = results.filter(e => e.exit?.exit_reason === filters.exit_reason);
  }

  // Apply final pagination
  const limit = Math.min(filters.limit || 100, 1000);
  const offset = filters.offset || 0;

  return results.slice(offset, offset + limit);
}

/**
 * Calculate aggregates from query results
 */
export function calculateAggregates(entries: LedgerEntry[]): QueryAggregates {
  const aggregates: QueryAggregates = {
    total_count: entries.length,
    execute_count: 0,
    wait_count: 0,
    skip_count: 0,
    with_exit_count: 0,
    with_hypothetical_count: 0,
    avg_confluence: 0,
    total_pnl_net: 0,
    win_count: 0,
    loss_count: 0,
  };

  if (entries.length === 0) return aggregates;

  let confluenceSum = 0;

  for (const entry of entries) {
    // Decision counts
    if (entry.decision === 'EXECUTE') aggregates.execute_count++;
    else if (entry.decision === 'WAIT') aggregates.wait_count++;
    else if (entry.decision === 'SKIP') aggregates.skip_count++;

    // Exit/hypothetical counts
    if (entry.exit) {
      aggregates.with_exit_count++;
      aggregates.total_pnl_net += entry.exit.pnl_net;
      if (entry.exit.pnl_net > 0) aggregates.win_count++;
      else if (entry.exit.pnl_net < 0) aggregates.loss_count++;
    }
    if (entry.hypothetical) aggregates.with_hypothetical_count++;

    // Confluence sum
    confluenceSum += entry.confluence_score;
  }

  aggregates.avg_confluence = confluenceSum / entries.length;

  return aggregates;
}

/**
 * Query entries by decision type
 */
export async function queryByDecision(
  ledger: ILedger,
  decision: Decision,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { decision, limit });
}

/**
 * Query entries by trade type
 */
export async function queryByTradeType(
  ledger: ILedger,
  tradeType: TradeType,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { trade_type: tradeType, limit });
}

/**
 * Query entries by DTE bucket (only for EXECUTE decisions)
 */
export async function queryByDTEBucket(
  ledger: ILedger,
  dteBucket: DTEBucket,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { 
    decision: 'EXECUTE', 
    dte_bucket: dteBucket, 
    limit 
  });
}

/**
 * Query entries by volatility regime
 */
export async function queryByVolatilityRegime(
  ledger: ILedger,
  volatility: VolatilityRegime,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { regime_volatility: volatility, limit });
}

/**
 * Query entries within date range
 */
export async function queryByDateRange(
  ledger: ILedger,
  fromDate: number,
  toDate: number,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { from_date: fromDate, to_date: toDate, limit });
}

/**
 * Query closed trades (EXECUTE with exit data)
 */
export async function queryClosedTrades(
  ledger: ILedger,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { 
    decision: 'EXECUTE', 
    has_exit: true, 
    limit 
  });
}

/**
 * Query open trades (EXECUTE without exit data)
 */
export async function queryOpenTrades(
  ledger: ILedger,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { 
    decision: 'EXECUTE', 
    has_exit: false, 
    limit 
  });
}

/**
 * Query winning trades
 */
export async function queryWinningTrades(
  ledger: ILedger,
  limit: number = 100
): Promise<LedgerEntry[]> {
  const closed = await queryClosedTrades(ledger, limit * 2);
  return closed.filter(e => e.exit && e.exit.pnl_net > 0).slice(0, limit);
}

/**
 * Query losing trades
 */
export async function queryLosingTrades(
  ledger: ILedger,
  limit: number = 100
): Promise<LedgerEntry[]> {
  const closed = await queryClosedTrades(ledger, limit * 2);
  return closed.filter(e => e.exit && e.exit.pnl_net < 0).slice(0, limit);
}

/**
 * Query entries with hypothetical tracking
 */
export async function queryWithHypotheticals(
  ledger: ILedger,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { has_hypothetical: true, limit });
}

/**
 * Query high confluence entries
 */
export async function queryHighConfluence(
  ledger: ILedger,
  minConfluence: number = 70,
  limit: number = 100
): Promise<LedgerEntry[]> {
  return queryLedger(ledger, { min_confluence: minConfluence, limit });
}
