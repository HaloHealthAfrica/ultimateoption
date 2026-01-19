/**
 * Paper execution adapter for Phase 2.5 decisions
 *
 * Builds the EnrichedSignal + DecisionResult required by the paper
 * options executor from a Phase 2.5 DecisionPacket.
 */

import { DecisionPacket } from '../types';
import { createEmptyBreakdown, DecisionResult } from '@/types/decision';
import { EnrichedSignal } from '@/types/signal';
import { buildEnrichedSignalFromDecision } from './ledger-adapter';

function getBaseContracts(): number {
  const raw = parseFloat(process.env.PHASE25_PAPER_BASE_CONTRACTS || '1');
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function getRecommendedContracts(decision: DecisionPacket): number {
  const base = getBaseContracts();
  const multiplier = Number.isFinite(decision.finalSizeMultiplier) && decision.finalSizeMultiplier > 0
    ? decision.finalSizeMultiplier
    : 1;
  const scaled = Math.round(base * multiplier);
  return Math.max(1, scaled);
}

export function buildPaperTradeInputs(decision: DecisionPacket): {
  signal: EnrichedSignal;
  decision: DecisionResult;
  recommendedContracts: number;
} {
  const recommendedContracts = getRecommendedContracts(decision);
  const signal = buildEnrichedSignalFromDecision(decision, recommendedContracts);

  const breakdown = createEmptyBreakdown();
  breakdown.final_multiplier = decision.finalSizeMultiplier;

  const reason = decision.reasons.join('; ') || `${decision.action} decision`;

  const paperDecision: DecisionResult = {
    decision: 'EXECUTE',
    reason,
    breakdown,
    engine_version: decision.engineVersion,
    confluence_score: Math.max(0, Math.min(100, decision.confidenceScore)),
    recommended_contracts: recommendedContracts,
    entry_signal: signal,
    stop_loss: signal.entry.stop_loss,
    target_1: signal.entry.target_1,
    target_2: signal.entry.target_2,
  };

  return { signal, decision: paperDecision, recommendedContracts };
}
