/**
 * Global Ledger Singleton
 * 
 * Provides a ledger instance for the application.
 * Uses PostgreSQL if DATABASE_URL is available, falls back to in-memory otherwise.
 */

import { InMemoryLedger } from './inMemoryLedger';
import { PostgresLedger } from './ledger';
import type { LedgerEntry, LedgerEntryCreate, LedgerQueryFilters } from '@/types/ledger';

// Define a common interface for both ledger types
interface ILedger {
  append(entry: LedgerEntryCreate): Promise<LedgerEntry>;
  get(id: string): Promise<LedgerEntry | null>;
  query(filters: LedgerQueryFilters): Promise<LedgerEntry[]>;
  updateExit(id: string, exit: LedgerEntry['exit']): Promise<void>;
  updateHypothetical(id: string, hypothetical: LedgerEntry['hypothetical']): Promise<void>;
  clear?(): Promise<void> | void;
}

// Check if PostgreSQL is available
const isDatabaseAvailable = () => {
  try {
    return !!process.env.DATABASE_URL;
  } catch {
    return false;
  }
};

let globalLedgerInstance: ILedger | null = null;

/**
 * Get the global ledger instance
 * Uses PostgreSQL in production, in-memory in development
 */
export async function getGlobalLedger(): Promise<ILedger> {
  if (!globalLedgerInstance) {
    if (isDatabaseAvailable()) {
      try {
        // Use PostgreSQL storage in production
        console.log('Using PostgreSQL Ledger (persistent) with Neon');
        const connectionString = process.env.DATABASE_URL!;
        globalLedgerInstance = new PostgresLedger(connectionString);
        console.log('PostgreSQL Ledger initialized successfully');
      } catch (error) {
        console.error('Failed to initialize PostgreSQL Ledger, falling back to in-memory:', error);
        globalLedgerInstance = new InMemoryLedger();
      }
    } else {
      // Use in-memory in development
      console.log('Using In-Memory Ledger (development only - no DATABASE_URL found)');
      globalLedgerInstance = new InMemoryLedger();
    }
  }
  return globalLedgerInstance;
}

/**
 * Reset the global ledger (for testing only)
 */
export function resetGlobalLedger(): void {
  if (globalLedgerInstance) {
    if (typeof globalLedgerInstance.clear === 'function') {
      void globalLedgerInstance.clear();
    }
  }
  globalLedgerInstance = null;
}
