/**
 * Learning Module
 * 
 * Exports feature extraction and metrics functionality.
 * This module is ISOLATED from the execution path.
 */

// Feature Extractor
export {
  classifyTradeType,
  bucketDTE,
  bucketAIScore,
  bucketIVRank,
  bucketTrendStrength,
  bucketVolume,
  classifyHTFAlignment,
  extractFeatures,
  extractSignalFeatures,
  createFeatureKey,
  createDTEIsolatedKey,
  groupByFeatures,
  groupByDTEBucket,
  groupByTradeType,
  type TradeType,
  type DTEBucket,
  type AIScoreBucket,
  type IVRankBucket,
  type TrendStrengthBucket,
  type VolumeBucket,
  type TradeFeatures,
} from './featureExtractor';

// Metrics Engine
export {
  calculateMetrics,
  getRollingMetrics,
  getMetricsByDTEBucket,
  getMetricsForFeatures,
  calculateStreakStats,
  MINIMUM_SAMPLE_SIZE,
  type MetricsStatus,
  type Metrics,
  type RollingMetrics,
} from './metricsEngine';

// Regime Manager
export {
  analyzeRegime,
  getPerformanceByVolatilityRegime,
  getPerformanceByTrendRegime,
  getRegimePerformance,
  detectRegimeMismatch,
  type RegimeStatus,
  type DegradationIndicators,
  type RegimeAnalysis,
  type RegimePerformance,
} from './regimeManager';

// Learning Advisor
export {
  hasSufficientSample,
  clampChange,
  isSignificantChange,
  generateQualityMultiplierSuggestions,
  generateDTESuggestions,
  generateTradeTypeSuggestions,
  generateAllSuggestions,
  filterSuggestionsByStatus,
  updateSuggestionStatus,
  SUGGESTION_BOUNDS,
  type SuggestionStatus,
  type ParameterType,
  type SuggestionEvidence,
  type LearningSuggestion,
} from './learningAdvisor';

// Suggestion Exporter
export {
  formatSuggestionsForExport,
  serializeSuggestions,
  parseSuggestions,
  getExportFilename,
  filterForExport,
  createSuggestionSummary,
  validateSuggestionsForExport,
  EXPORT_VERSION,
  type SuggestionExport,
} from './suggestionExporter';
