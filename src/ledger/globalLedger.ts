/**
 * Global Ledger Singleton
 * 
 * Provides a single in-memory ledger instance for the application.
 * This will be replaced with PostgreSQL in production.
 */

import { InMemoryLedger } from './inMemoryLedger';

let globalLedgerInstance: InMemoryLedger | null = null;

/**
 * Get the global ledger instance
 */
export function getGlobalLedger(): InMemoryLedger {
  if (!globalLedgerInstance) {
    globalLedgerInstance = new InMemoryLedger();
  }
  return globalLedgerInstance;
}

/**
 * Reset the global ledger (for testing only)
 */
export function resetGlobalLedger(): void {
  if (globalLedgerInstance) {
    globalLedgerInstance.clear();
  }
  globalLedgerInstance = null;
}
