/**
 * Paper Trading Module Exports
 * Central export point for all paper trading components
 */

// Contract selector
export {
  selectContract,
  selectOptionType,
  selectDTE,
  selectStrike,
  calculateExpiryDate,
  getNextFridayDTE,
  getMonthlyDTE,
  getDteBucket,
} from './contractSelector';

// Greeks calculator
export {
  calculateGreeks,
  estimateIV,
  normalCDF,
  normalPDF,
} from './greeksCalculator';

// Fill simulator
export {
  simulateFill,
  simulateExitFill,
  calculateBidAsk,
  calculateSlippage,
  determineFillQuality,
  calculateCommission,
  calculateTheoreticalPrice,
} from './fillSimulator';

// Paper executor orchestrator
export {
  executePaperTrade,
  canExecute,
  previewExecution,
} from './optionsExecutor';

// Exit attributor
export {
  calculateExitAttribution,
  determineExitReason,
  ExitReasonSchema,
  PnlAttributionSchema,
  ExitDataSchema,
  type ExitReason,
  type PnlAttribution,
  type ExitData,
  type EntryData,
  type ExitContext,
} from './exitAttributor';