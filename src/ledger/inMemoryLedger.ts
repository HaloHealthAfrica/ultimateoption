/**
 * In-Memory Ledger Implementation
 * For testing and development without PostgreSQL
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import {
  LedgerEntry,
  LedgerEntryCreate,
  LedgerEntrySchema,
  ExitData,
  Hypothetical,
  LedgerQueryFilters,
} from '../types/ledger';
import { ILedger, LedgerError } from './ledger';

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
 * In-memory Ledger implementation
 * Maintains append-only semantics for testing
 */
export class InMemoryLedger implements ILedger {
  private entries: Map<string, LedgerEntry> = new Map();
  private orderedIds: string[] = [];

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

    this.entries.set(id, fullEntry);
    this.orderedIds.push(id);
    
    return fullEntry;
  }

  /**
   * Update exit data for a closed position
   * Requirement 4.4: Only exit data can be updated
   */
  async updateExit(id: string, exit: ExitData): Promise<void> {
    const existing = this.entries.get(id);
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

    // Create new entry with exit data (immutable update)
    const updated: LedgerEntry = {
      ...existing,
      exit,
    };
    this.entries.set(id, updated);
  }

  /**
   * Update hypothetical data for skipped trades
   * Requirement 4.5: Track hypothetical outcomes
   */
  async updateHypothetical(id: string, hypothetical: Hypothetical): Promise<void> {
    const existing = this.entries.get(id);
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

    // Create new entry with hypothetical data (immutable update)
    const updated: LedgerEntry = {
      ...existing,
      hypothetical,
    };
    this.entries.set(id, updated);
  }

  /**
   * Get a single entry by ID
   */
  async get(id: string): Promise<LedgerEntry | null> {
    return this.entries.get(id) || null;
  }

  /**
   * Query entries with filters
   */
  async query(filters: LedgerQueryFilters): Promise<LedgerEntry[]> {
    let results = Array.from(this.entries.values());

    // Apply filters
    if (filters.timeframe) {
      results = results.filter(e => e.signal.signal.timeframe === filters.timeframe);
    }
    if (filters.quality) {
      results = results.filter(e => e.signal.signal.quality === filters.quality);
    }
    if (filters.decision) {
      results = results.filter(e => e.decision === filters.decision);
    }
    if (filters.regime_volatility) {
      results = results.filter(e => e.regime.volatility === filters.regime_volatility);
    }
    if (filters.from_date) {
      results = results.filter(e => e.created_at >= filters.from_date!);
    }
    if (filters.to_date) {
      results = results.filter(e => e.created_at <= filters.to_date!);
    }

    // Sort by created_at descending
    results.sort((a, b) => b.created_at - a.created_at);

    // Apply pagination
    const limit = Math.min(filters.limit || 100, 1000);
    const offset = filters.offset || 0;
    
    return results.slice(offset, offset + limit);
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
   * Get all entries (for testing)
   */
  getAllEntries(): LedgerEntry[] {
    return this.orderedIds.map(id => this.entries.get(id)!);
  }

  /**
   * Get entry count (for testing)
   */
  getCount(): number {
    return this.entries.size;
  }

  /**
   * Clear all entries (for testing only)
   */
  clear(): void {
    this.entries.clear();
    this.orderedIds = [];
  }
}
