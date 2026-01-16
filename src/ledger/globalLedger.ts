/**
 * Global Ledger Singleton
 * 
 * Provides a ledger instance for the application.
 * Uses KV storage if available (production), falls back to in-memory (development).
 */

import { InMemoryLedger } from './inMemoryLedger';
import type { LedgerEntry, LedgerEntryCreate, LedgerQueryFilters } from '@/types/ledger';

// Define a common interface for both ledger types
interface ILedger {
  append(entry: LedgerEntryCreate): Promise<LedgerEntry>;
  get(id: string): Promise<LedgerEntry | null>;
  query(filters: LedgerQueryFilters): Promise<LedgerEntry[]>;
  updateExit(id: string, exit: LedgerEntry['exit']): Promise<void>;
  updateHypothetical(id: string, hypothetical: LedgerEntry['hypothetical']): Promise<void>;
  clear(): Promise<void> | void;
}

// Check if KV is available (production with Vercel KV)
const isKVAvailable = () => {
  try {
    return !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  } catch {
    return false;
  }
};

let globalLedgerInstance: ILedger | null = null;

/**
 * Get the global ledger instance
 * Uses KV in production, in-memory in development
 */
export async function getGlobalLedger(): Promise<ILedger> {
  if (!globalLedgerInstance) {
    if (isKVAvailable()) {
      // Use KV storage in production
      console.log('Using KV Ledger (persistent)');
      const { KVLedger } = await import('./kvLedger');
      globalLedgerInstance = new KVLedger();
    } else {
      // Use in-memory in development
      console.log('Using In-Memory Ledger (development only)');
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
