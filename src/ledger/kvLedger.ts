/**
 * KV Ledger Implementation
 * 
 * Uses Vercel KV (Redis) for persistent storage across serverless invocations.
 * This is a temporary solution until PostgreSQL is set up.
 */

import { kv } from '@vercel/kv';
import { LedgerEntry, LedgerEntryCreate, LedgerQueryFilters } from '@/types/ledger';
import { v4 as uuidv4 } from 'uuid';

const LEDGER_KEY_PREFIX = 'ledger:entry:';
const LEDGER_INDEX_KEY = 'ledger:index';
const LEDGER_BY_DECISION_KEY = 'ledger:by_decision:';

export class KVLedger {
  /**
   * Append a new entry to the ledger
   */
  async append(entry: LedgerEntryCreate): Promise<LedgerEntry> {
    const id = uuidv4();
    const created_at = Date.now();
    
    const ledgerEntry: LedgerEntry = {
      ...entry,
      id,
      created_at,
    };
    
    // Store the entry
    await kv.set(`${LEDGER_KEY_PREFIX}${id}`, JSON.stringify(ledgerEntry));
    
    // Add to index (sorted set by timestamp)
    await kv.zadd(LEDGER_INDEX_KEY, {
      score: created_at,
      member: id,
    });
    
    // Add to decision type index
    await kv.sadd(`${LEDGER_BY_DECISION_KEY}${entry.decision}`, id);
    
    console.log('KV Ledger: Entry stored', { id, decision: entry.decision });
    
    return ledgerEntry;
  }
  
  /**
   * Get a single entry by ID
   */
  async get(id: string): Promise<LedgerEntry | null> {
    const data = await kv.get<string>(`${LEDGER_KEY_PREFIX}${id}`);
    if (!data) return null;
    
    return JSON.parse(data) as LedgerEntry;
  }
  
  /**
   * Query entries with filters
   */
  async query(filters: LedgerQueryFilters): Promise<LedgerEntry[]> {
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    
    // Get IDs from index (most recent first)
    const ids = await kv.zrange(LEDGER_INDEX_KEY, 0, -1, {
      rev: true, // Reverse order (newest first)
    });
    
    if (!ids || ids.length === 0) {
      return [];
    }
    
    // Fetch entries
    const entries: LedgerEntry[] = [];
    for (const id of ids) {
      const entry = await this.get(id as string);
      if (entry) {
        // Apply filters
        if (filters.decision && entry.decision !== filters.decision) continue;
        if (filters.timeframe && entry.signal?.signal?.timeframe !== filters.timeframe) continue;
        if (filters.quality && entry.signal?.signal?.quality !== filters.quality) continue;
        if (filters.from_date && entry.created_at < filters.from_date) continue;
        if (filters.to_date && entry.created_at > filters.to_date) continue;
        
        entries.push(entry);
      }
    }
    
    // Apply pagination
    return entries.slice(offset, offset + limit);
  }
  
  /**
   * Update exit data for an entry
   */
  async updateExit(id: string, exit: LedgerEntry['exit']): Promise<void> {
    const entry = await this.get(id);
    if (!entry) {
      throw new Error(`Entry ${id} not found`);
    }
    
    entry.exit = exit;
    await kv.set(`${LEDGER_KEY_PREFIX}${id}`, JSON.stringify(entry));
  }
  
  /**
   * Update hypothetical data for an entry
   */
  async updateHypothetical(id: string, hypothetical: LedgerEntry['hypothetical']): Promise<void> {
    const entry = await this.get(id);
    if (!entry) {
      throw new Error(`Entry ${id} not found`);
    }
    
    entry.hypothetical = hypothetical;
    await kv.set(`${LEDGER_KEY_PREFIX}${id}`, JSON.stringify(entry));
  }
  
  /**
   * Clear all entries (for testing only)
   */
  async clear(): Promise<void> {
    // Get all IDs
    const ids = await kv.zrange(LEDGER_INDEX_KEY, 0, -1);
    
    // Delete all entries
    if (ids && ids.length > 0) {
      for (const id of ids) {
        await kv.del(`${LEDGER_KEY_PREFIX}${id}`);
      }
    }
    
    // Clear indexes
    await kv.del(LEDGER_INDEX_KEY);
    await kv.del(`${LEDGER_BY_DECISION_KEY}EXECUTE`);
    await kv.del(`${LEDGER_BY_DECISION_KEY}WAIT`);
    await kv.del(`${LEDGER_BY_DECISION_KEY}SKIP`);
    
    console.log('KV Ledger: Cleared');
  }
  
  /**
   * Get count of entries
   */
  async count(): Promise<number> {
    const count = await kv.zcard(LEDGER_INDEX_KEY);
    return count || 0;
  }
}
