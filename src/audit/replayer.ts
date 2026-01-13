/**
 * Decision Replayer
 * 
 * Replays historical decisions to verify determinism.
 * Uses exact engine version and signal snapshot from ledger entry.
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { LedgerEntry } from '../types/ledger';
import { Decision, DecisionBreakdown } from '../types/decision';
import { Timeframe } from '../types/signal';
import { makeDecision, ENGINE_VERSION } from '../engine/decisionEngine';
import { StoredSignal } from '../webhooks/timeframeStore';
import { StoredPhase } from '../webhooks/phaseStore';

/**
 * Replay result status
 */
export type ReplayStatus = 'MATCH' | 'MISMATCH' | 'VERSION_MISMATCH' | 'ERROR';

/**
 * Detailed mismatch information
 */
export interface MismatchDetails {
  field: string;
  original: unknown;
  replayed: unknown;
}

/**
 * Replay result
 * Requirement 15.4
 */
export interface ReplayResult {
  status: ReplayStatus;
  entry_id: string;
  original_version: string;
  replay_version: string;
  
  // Original decision
  original_decision: Decision;
  original_confluence: number;
  original_breakdown: DecisionBreakdown;
  
  // Replayed decision
  replayed_decision?: Decision;
  replayed_confluence?: number;
  replayed_breakdown?: DecisionBreakdown;
  
  // Mismatch details (if any)
  mismatches?: MismatchDetails[];
  
  // Error message (if status is ERROR)
  error?: string;
  
  // Timing
  replayed_at: number;
  replay_duration_ms: number;
}

/**
 * Batch replay summary
 */
export interface BatchReplayResult {
  total: number;
  matches: number;
  mismatches: number;
  version_mismatches: number;
  errors: number;
  results: ReplayResult[];
  summary: {
    match_rate: number;
    avg_replay_duration_ms: number;
  };
}


/**
 * Convert ledger entry signal to stored signal format
 * Requirement 15.2: Use exact signal snapshot
 */
function entryToStoredSignal(entry: LedgerEntry): StoredSignal {
  const signal = entry.signal;
  
  return {
    signal,
    received_at: entry.created_at,
    expires_at: entry.created_at + 60 * 60 * 1000, // 1 hour default
    validity_minutes: 60,
  };
}

/**
 * Replay a single decision
 * Requirement 15.1, 15.2, 15.3
 * 
 * @param entry - Ledger entry to replay
 * @returns Replay result with match/mismatch status
 */
export function replayDecision(entry: LedgerEntry): ReplayResult {
  const _startTime = Date.now();
  
  try {
    // Check engine version
    // Requirement 15.1: Load exact engine version
    if (entry.engine_version !== ENGINE_VERSION) {
      return {
        status: 'VERSION_MISMATCH',
        entry_id: entry.id,
        original_version: entry.engine_version,
        replay_version: ENGINE_VERSION,
        original_decision: entry.decision,
        original_confluence: entry.confluence_score,
        original_breakdown: entry.decision_breakdown,
        replayed_at: Date.now(),
        replay_duration_ms: Date.now() - _startTime,
      };
    }
    
    // Convert entry signal to stored signal format
    const storedSignal = entryToStoredSignal(entry);
    const timeframe = entry.signal.signal.timeframe;
    
    // Create a Map with the single signal
    const signalsMap = new Map<Timeframe, StoredSignal>();
    signalsMap.set(timeframe, storedSignal);
    
    // Create phases map (empty for now - phases not stored in ledger)
    const phasesMap = new Map<string, StoredPhase>();
    
    // Replay the decision with the same inputs
    // Requirement 15.2: Use exact signal snapshot
    const replayedResult = makeDecision(
      signalsMap,
      phasesMap
    );
    
    // Compare results
    // Requirement 15.3: Compare and report match/mismatch
    const mismatches: MismatchDetails[] = [];
    
    if (replayedResult.decision !== entry.decision) {
      mismatches.push({
        field: 'decision',
        original: entry.decision,
        replayed: replayedResult.decision,
      });
    }
    
    if (Math.abs(replayedResult.confluence_score - entry.confluence_score) > 0.001) {
      mismatches.push({
        field: 'confluence_score',
        original: entry.confluence_score,
        replayed: replayedResult.confluence_score,
      });
    }
    
    // Compare breakdown fields
    const breakdownFields: (keyof DecisionBreakdown)[] = [
      'confluence_multiplier',
      'quality_multiplier',
      'htf_alignment_multiplier',
      'rr_multiplier',
      'volume_multiplier',
      'trend_multiplier',
      'session_multiplier',
      'day_multiplier',
      'phase_confidence_boost',
      'phase_position_boost',
      'final_multiplier',
    ];
    
    for (const field of breakdownFields) {
      const original = entry.decision_breakdown[field];
      const replayed = replayedResult.breakdown[field];
      
      if (typeof original === 'number' && typeof replayed === 'number') {
        if (Math.abs(original - replayed) > 0.001) {
          mismatches.push({
            field: `breakdown.${field}`,
            original,
            replayed,
          });
        }
      } else if (original !== replayed) {
        mismatches.push({
          field: `breakdown.${field}`,
          original,
          replayed,
        });
      }
    }
    
    return {
      status: mismatches.length === 0 ? 'MATCH' : 'MISMATCH',
      entry_id: entry.id,
      original_version: entry.engine_version,
      replay_version: ENGINE_VERSION,
      original_decision: entry.decision,
      original_confluence: entry.confluence_score,
      original_breakdown: entry.decision_breakdown,
      replayed_decision: replayedResult.decision,
      replayed_confluence: replayedResult.confluence_score,
      replayed_breakdown: replayedResult.breakdown,
      mismatches: mismatches.length > 0 ? mismatches : undefined,
      replayed_at: Date.now(),
      replay_duration_ms: Date.now() - _startTime,
    };
  } catch (error) {
    return {
      status: 'ERROR',
      entry_id: entry.id,
      original_version: entry.engine_version,
      replay_version: ENGINE_VERSION,
      original_decision: entry.decision,
      original_confluence: entry.confluence_score,
      original_breakdown: entry.decision_breakdown,
      error: error instanceof Error ? error.message : 'Unknown error',
      replayed_at: Date.now(),
      replay_duration_ms: Date.now() - _startTime,
    };
  }
}

/**
 * Replay multiple decisions in batch
 * 
 * @param entries - Ledger entries to replay
 * @returns Batch replay result with summary
 */
export function replayBatch(entries: LedgerEntry[]): BatchReplayResult {
  const results: ReplayResult[] = [];
  
  for (const entry of entries) {
    results.push(replayDecision(entry));
  }
  
  const matches = results.filter(r => r.status === 'MATCH').length;
  const mismatches = results.filter(r => r.status === 'MISMATCH').length;
  const versionMismatches = results.filter(r => r.status === 'VERSION_MISMATCH').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  const totalDuration = results.reduce((sum, r) => sum + r.replay_duration_ms, 0);
  
  return {
    total: entries.length,
    matches,
    mismatches,
    version_mismatches: versionMismatches,
    errors,
    results,
    summary: {
      match_rate: entries.length > 0 ? matches / entries.length : 0,
      avg_replay_duration_ms: entries.length > 0 ? totalDuration / entries.length : 0,
    },
  };
}

/**
 * Verify determinism by replaying the same entry multiple times
 * 
 * @param entry - Ledger entry to verify
 * @param iterations - Number of replay iterations
 * @returns True if all replays produce identical results
 */
export function verifyDeterminism(entry: LedgerEntry, iterations: number = 10): boolean {
  const results: ReplayResult[] = [];
  
  for (let i = 0; i < iterations; i++) {
    results.push(replayDecision(entry));
  }
  
  // All results should be identical
  const firstResult = results[0];
  
  return results.every(r => 
    r.status === firstResult.status &&
    r.replayed_decision === firstResult.replayed_decision &&
    r.replayed_confluence === firstResult.replayed_confluence
  );
}

/**
 * Generate audit report for a batch of replays
 * 
 * @param batchResult - Batch replay result
 * @returns Formatted audit report string
 */
export function generateAuditReport(batchResult: BatchReplayResult): string {
  const lines: string[] = [
    '=== Decision Replay Audit Report ===',
    '',
    `Total Entries: ${batchResult.total}`,
    `Matches: ${batchResult.matches} (${(batchResult.summary.match_rate * 100).toFixed(1)}%)`,
    `Mismatches: ${batchResult.mismatches}`,
    `Version Mismatches: ${batchResult.version_mismatches}`,
    `Errors: ${batchResult.errors}`,
    `Avg Replay Duration: ${batchResult.summary.avg_replay_duration_ms.toFixed(2)}ms`,
    '',
  ];
  
  if (batchResult.mismatches > 0) {
    lines.push('=== Mismatches ===');
    lines.push('');
    
    for (const result of batchResult.results.filter(r => r.status === 'MISMATCH')) {
      lines.push(`Entry: ${result.entry_id}`);
      lines.push(`  Original: ${result.original_decision} (confluence: ${result.original_confluence})`);
      lines.push(`  Replayed: ${result.replayed_decision} (confluence: ${result.replayed_confluence})`);
      
      if (result.mismatches) {
        for (const mismatch of result.mismatches) {
          lines.push(`  - ${mismatch.field}: ${mismatch.original} -> ${mismatch.replayed}`);
        }
      }
      lines.push('');
    }
  }
  
  if (batchResult.errors > 0) {
    lines.push('=== Errors ===');
    lines.push('');
    
    for (const result of batchResult.results.filter(r => r.status === 'ERROR')) {
      lines.push(`Entry: ${result.entry_id}`);
      lines.push(`  Error: ${result.error}`);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}
