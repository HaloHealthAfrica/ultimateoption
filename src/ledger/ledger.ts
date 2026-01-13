/**
 * Ledger Core
 * Append-only immutable audit trail for all trading decisions
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { Pool } from 'pg';
import {
  LedgerEntry,
  LedgerEntryCreate,
  LedgerEntrySchema,
  ExitData,
  Hypothetical,
  LedgerQueryFilters,
} from '../types/ledger';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Ledger operation result
 */
export interface LedgerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Ledger error types
 */
export type LedgerErrorType = 
  | 'DELETE_NOT_ALLOWED'
  | 'OVERWRITE_NOT_ALLOWED'
  | 'ENTRY_NOT_FOUND'
  | 'INVALID_UPDATE'
  | 'DATABASE_ERROR'
  | 'VALIDATION_ERROR';

export class LedgerError extends Error {
  constructor(
    public readonly type: LedgerErrorType,
    message: string
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}

/**
 * Ledger interface for append-only operations
 */
export interface ILedger {
  append(entry: LedgerEntryCreate): Promise<LedgerEntry>;
  updateExit(id: string, exit: ExitData): Promise<void>;
  updateHypothetical(id: string, hypothetical: Hypothetical): Promise<void>;
  get(id: string): Promise<LedgerEntry | null>;
  query(filters: LedgerQueryFilters): Promise<LedgerEntry[]>;
}

/**
 * PostgreSQL-backed Ledger implementation
 * Requirement 4.1: Append-only with no deletes or overwrites
 */
export class PostgresLedger implements ILedger {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  /**
   * Append a new entry to the ledger
   * Requirement 4.2: Create entry with all required fields
   */
  async append(entry: LedgerEntryCreate): Promise<LedgerEntry> {
    const id = generateUUID();
    const created_at = entry.created_at || Date.now();
    
    // Destructure to exclude created_at from entry spread
    const { created_at: _, ...entryWithoutCreatedAt } = entry;
    
    const fullEntry: LedgerEntry = {
      ...entryWithoutCreatedAt,
      id,
      created_at,
    };

    // Validate entry
    const validation = LedgerEntrySchema.safeParse(fullEntry);
    if (!validation.success) {
      throw new LedgerError(
        'VALIDATION_ERROR',
        `Invalid ledger entry: ${validation.error.message}`
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO ledger_entries (
          id, created_at, engine_version, signal, phase_context,
          decision, decision_reason, decision_breakdown, confluence_score,
          execution, exit_data, regime, hypothetical
        ) VALUES ($1, to_timestamp($2/1000.0), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          fullEntry.id,
          fullEntry.created_at,
          fullEntry.engine_version,
          JSON.stringify(fullEntry.signal),
          fullEntry.phase_context ? JSON.stringify(fullEntry.phase_context) : null,
          fullEntry.decision,
          fullEntry.decision_reason,
          JSON.stringify(fullEntry.decision_breakdown),
          fullEntry.confluence_score,
          fullEntry.execution ? JSON.stringify(fullEntry.execution) : null,
          fullEntry.exit ? JSON.stringify(fullEntry.exit) : null,
          JSON.stringify(fullEntry.regime),
          fullEntry.hypothetical ? JSON.stringify(fullEntry.hypothetical) : null,
        ]
      );
      return fullEntry;
    } catch (error) {
      throw new LedgerError(
        'DATABASE_ERROR',
        `Failed to append entry: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update exit data for a closed position
   * Requirement 4.4: Only exit data can be updated
   */
  async updateExit(id: string, exit: ExitData): Promise<void> {
    const client = await this.pool.connect();
    try {
      // First check if entry exists and doesn't already have exit data
      const existing = await this.get(id);
      if (!existing) {
        throw new LedgerError('ENTRY_NOT_FOUND', `Entry ${id} not found`);
      }
      if (existing.exit) {
        throw new LedgerError(
          'OVERWRITE_NOT_ALLOWED',
          `Exit data already exists for entry ${id}. Overwrites are not permitted.`
        );
      }
      if (existing.decision !== 'EXECUTE') {
        throw new LedgerError(
          'INVALID_UPDATE',
          `Cannot add exit data to non-executed entry ${id}`
        );
      }

      await client.query(
        `UPDATE ledger_entries SET exit_data = $1 WHERE id = $2`,
        [JSON.stringify(exit), id]
      );
    } catch (error) {
      if (error instanceof LedgerError) throw error;
      throw new LedgerError(
        'DATABASE_ERROR',
        `Failed to update exit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update hypothetical data for skipped trades
   * Requirement 4.5: Track hypothetical outcomes
   */
  async updateHypothetical(id: string, hypothetical: Hypothetical): Promise<void> {
    const client = await this.pool.connect();
    try {
      // First check if entry exists
      const existing = await this.get(id);
      if (!existing) {
        throw new LedgerError('ENTRY_NOT_FOUND', `Entry ${id} not found`);
      }
      if (existing.hypothetical) {
        throw new LedgerError(
          'OVERWRITE_NOT_ALLOWED',
          `Hypothetical data already exists for entry ${id}. Overwrites are not permitted.`
        );
      }
      if (existing.decision === 'EXECUTE') {
        throw new LedgerError(
          'INVALID_UPDATE',
          `Cannot add hypothetical data to executed entry ${id}`
        );
      }

      await client.query(
        `UPDATE ledger_entries SET hypothetical = $1 WHERE id = $2`,
        [JSON.stringify(hypothetical), id]
      );
    } catch (error) {
      if (error instanceof LedgerError) throw error;
      throw new LedgerError(
        'DATABASE_ERROR',
        `Failed to update hypothetical: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get a single entry by ID
   */
  async get(id: string): Promise<LedgerEntry | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM ledger_entries WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) return null;
      return this.rowToEntry(result.rows[0]);
    } catch (error) {
      throw new LedgerError(
        'DATABASE_ERROR',
        `Failed to get entry: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Query entries with filters
   * Requirement 4.8: Support filtering by various fields
   */
  async query(filters: LedgerQueryFilters): Promise<LedgerEntry[]> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filters.timeframe) {
        conditions.push(`signal->'signal'->>'timeframe' = ${paramIndex++}`);
        params.push(filters.timeframe);
      }
      if (filters.quality) {
        conditions.push(`signal->'signal'->>'quality' = ${paramIndex++}`);
        params.push(filters.quality);
      }
      if (filters.decision) {
        conditions.push(`decision = ${paramIndex++}`);
        params.push(filters.decision);
      }
      if (filters.dte_bucket) {
        conditions.push(`execution->>'dte_bucket' = ${paramIndex++}`);
        params.push(filters.dte_bucket);
      }
      if (filters.regime_volatility) {
        conditions.push(`regime->>'volatility' = ${paramIndex++}`);
        params.push(filters.regime_volatility);
      }
      if (filters.from_date) {
        conditions.push(`created_at >= to_timestamp(${paramIndex++}/1000.0)`);
        params.push(filters.from_date);
      }
      if (filters.to_date) {
        conditions.push(`created_at <= to_timestamp(${paramIndex++}/1000.0)`);
        params.push(filters.to_date);
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      const limit = Math.min(filters.limit || 100, 1000);
      const offset = filters.offset || 0;

      const result = await client.query(
        `SELECT * FROM ledger_entries ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ${paramIndex++} OFFSET ${paramIndex}`,
        [...params, limit, offset]
      );

      return result.rows.map(row => this.rowToEntry(row));
    } catch (error) {
      throw new LedgerError(
        'DATABASE_ERROR',
        `Failed to query entries: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * DELETE operation - BLOCKED
   * Requirement 4.1: No deletes permitted
   */
  async delete(_id: string): Promise<never> {
    throw new LedgerError(
      'DELETE_NOT_ALLOWED',
      'Delete operations are not permitted on the ledger. The ledger is append-only.'
    );
  }

  /**
   * OVERWRITE operation - BLOCKED
   * Requirement 4.1: No overwrites permitted
   */
  async overwrite(_id: string, _entry: LedgerEntryCreate): Promise<never> {
    throw new LedgerError(
      'OVERWRITE_NOT_ALLOWED',
      'Overwrite operations are not permitted on the ledger. The ledger is append-only.'
    );
  }

  /**
   * Convert database row to LedgerEntry
   */
  private rowToEntry(row: Record<string, unknown>): LedgerEntry {
    return {
      id: row.id as string,
      created_at: new Date(row.created_at as string).getTime(),
      engine_version: row.engine_version as string,
      signal: row.signal as LedgerEntry['signal'],
      phase_context: row.phase_context as LedgerEntry['phase_context'],
      decision: row.decision as LedgerEntry['decision'],
      decision_reason: row.decision_reason as string,
      decision_breakdown: row.decision_breakdown as LedgerEntry['decision_breakdown'],
      confluence_score: parseFloat(row.confluence_score as string),
      execution: row.execution as LedgerEntry['execution'],
      exit: row.exit_data as LedgerEntry['exit'],
      regime: row.regime as LedgerEntry['regime'],
      hypothetical: row.hypothetical as LedgerEntry['hypothetical'],
    };
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
