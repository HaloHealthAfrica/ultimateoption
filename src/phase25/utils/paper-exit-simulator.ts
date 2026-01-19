/**
 * Paper exit simulator for Phase 2.5 decisions
 *
 * Simulates a deterministic exit based on confidence and risk thresholds,
 * then maps it into the ledger exit format.
 */

import { DecisionPacket, TradeDirection } from '../types';
import { Execution, OptionContract } from '@/types/options';
import { RISK_THRESHOLDS } from '../config/trading-rules.config';
import { calculateGreeks } from '@/paper/greeksCalculator';
import { simulateExitFill } from '@/paper/fillSimulator';
import { calculateExitAttribution, type ExitReason } from '@/paper/exitAttributor';
import type { EnrichedSignal } from '@/types/signal';
import type { ExitData as LedgerExitData } from '@/types/ledger';
import { getDteBucket } from '@/types/options';

const TARGET2_CONF = parseFloat(process.env.PHASE25_PAPER_EXIT_TARGET2_CONF || '80');
const TARGET1_CONF = parseFloat(process.env.PHASE25_PAPER_EXIT_TARGET1_CONF || '60');

function getHoldMinutes(dte: number): number {
  const override = parseInt(process.env.PHASE25_PAPER_EXIT_MINUTES || '', 10);
  if (Number.isFinite(override) && override > 0) {
    return override;
  }

  const bucket = getDteBucket(dte);
  switch (bucket) {
    case '0DTE':
      return 30;
    case 'WEEKLY':
      return 240;
    case 'MONTHLY':
      return 1440;
    case 'LEAP':
      return 4320;
    default:
      return 240;
  }
}

function getExitLevels(entryPrice: number, direction: TradeDirection) {
  if (direction === 'LONG') {
    return {
      stopLoss: entryPrice * (1 - RISK_THRESHOLDS.STOP_LOSS_PCT),
      target1: entryPrice * (1 + RISK_THRESHOLDS.TARGET_1_PCT),
      target2: entryPrice * (1 + RISK_THRESHOLDS.TARGET_2_PCT),
    };
  }

  return {
    stopLoss: entryPrice * (1 + RISK_THRESHOLDS.STOP_LOSS_PCT),
    target1: entryPrice * (1 - RISK_THRESHOLDS.TARGET_1_PCT),
    target2: entryPrice * (1 - RISK_THRESHOLDS.TARGET_2_PCT),
  };
}

function chooseExit(
  entryPrice: number,
  direction: TradeDirection,
  confidence: number
): { underlyingAtExit: number; reason: ExitReason } {
  const { stopLoss, target1, target2 } = getExitLevels(entryPrice, direction);

  if (confidence >= TARGET2_CONF) {
    return { underlyingAtExit: target2, reason: 'TARGET_2' };
  }

  if (confidence >= TARGET1_CONF) {
    return { underlyingAtExit: target1, reason: 'TARGET_1' };
  }

  return { underlyingAtExit: stopLoss, reason: 'STOP_LOSS' };
}

function buildContract(execution: Execution): OptionContract {
  return {
    type: execution.option_type,
    strike: execution.strike,
    expiry: execution.expiry,
    dte: execution.dte,
  };
}

export function simulatePaperExit(
  decision: DecisionPacket,
  execution: Execution,
  signal: EnrichedSignal
): LedgerExitData {
  const direction = decision.direction || signal.signal.type;
  const entryUnderlying = execution.underlying_at_entry;
  const { underlyingAtExit, reason } = chooseExit(
    entryUnderlying,
    direction,
    decision.confidenceScore
  );

  const holdMinutes = getHoldMinutes(execution.dte);
  const exitTime = decision.timestamp + holdMinutes * 60 * 1000;
  const exitTimeIso = new Date(exitTime).toISOString();

  const contract = buildContract(execution);
  const ivRank = decision.marketSnapshot?.options?.ivPercentile || 50;
  const exitGreeks = calculateGreeks(contract, underlyingAtExit, ivRank);

  const exitFill = simulateExitFill(
    contract,
    execution.filled_contracts,
    underlyingAtExit,
    exitGreeks
  );

  const entryGreeks = {
    delta: execution.entry_delta,
    gamma: execution.entry_gamma,
    theta: execution.entry_theta,
    vega: execution.entry_vega,
    iv: execution.entry_iv,
  };

  const exitAttribution = calculateExitAttribution(
    {
      entry_price: execution.entry_price,
      entry_time: new Date(decision.timestamp).toISOString(),
      contracts: execution.contracts,
      filled_contracts: execution.filled_contracts,
      spread_cost: execution.spread_cost,
      slippage: execution.slippage,
      risk_amount: execution.risk_amount,
      underlying_at_entry: execution.underlying_at_entry,
      entry_greeks: entryGreeks,
    },
    {
      exit_price: exitFill.exitPrice,
      exit_time: exitTimeIso,
      exit_reason: reason,
      underlying_at_exit: underlyingAtExit,
      exit_iv: exitGreeks.iv,
      exit_greeks: exitGreeks,
    }
  );

  const totalCommission = exitAttribution.commission_cost;
  const totalSpread = exitAttribution.spread_cost;
  const totalSlippage = exitAttribution.slippage_cost + exitFill.slippage;
  const pnlNet = exitAttribution.pnl_gross - (totalCommission + totalSpread + totalSlippage);
  const holdTimeSeconds = Math.max(0, Math.floor((exitTime - decision.timestamp) / 1000));

  return {
    exit_time: exitTime,
    exit_price: exitAttribution.exit_price,
    exit_iv: exitGreeks.iv,
    exit_delta: exitGreeks.delta,
    underlying_at_exit: underlyingAtExit,
    pnl_gross: exitAttribution.pnl_gross,
    pnl_net: pnlNet,
    hold_time_seconds: holdTimeSeconds,
    exit_reason: exitAttribution.exit_reason,
    pnl_from_delta: exitAttribution.attribution.delta_contribution,
    pnl_from_iv: exitAttribution.attribution.iv_contribution,
    pnl_from_theta: exitAttribution.attribution.theta_contribution,
    pnl_from_gamma: exitAttribution.attribution.gamma_contribution,
    total_commission: totalCommission,
    total_spread_cost: totalSpread,
    total_slippage: totalSlippage,
  };
}
