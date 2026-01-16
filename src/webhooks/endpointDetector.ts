/**
 * Endpoint Auto-Detection for Webhooks
 * 
 * Detects webhook payload type and suggests the correct endpoint.
 * Helps prevent misrouted webhooks by analyzing payload structure.
 */

export type WebhookType = 'saty-phase' | 'signals' | 'trend' | 'unknown';

export interface DetectionResult {
  type: WebhookType;
  confidence: number; // 0-100
  correctEndpoint: string;
  indicators: string[];
  suggestions?: string[];
}

/**
 * Detect webhook type from payload structure
 * 
 * Analyzes payload to determine which endpoint it should be sent to.
 * Returns confidence score and helpful suggestions.
 */
export function detectWebhookType(payload: unknown): DetectionResult {
  if (!payload || typeof payload !== 'object') {
    return {
      type: 'unknown',
      confidence: 0,
      correctEndpoint: '',
      indicators: ['Invalid payload: not an object'],
      suggestions: ['Payload must be a valid JSON object']
    };
  }

  const data = payload as Record<string, unknown>;
  const indicators: string[] = [];
  const suggestions: string[] = [];
  const scores = { saty: 0, signals: 0, trend: 0 };

  // Check for SATY Phase indicators
  checkSatyIndicators(data, scores, indicators);

  // Check for Signals indicators
  checkSignalsIndicators(data, scores, indicators);

  // Check for Trend indicators
  checkTrendIndicators(data, scores, indicators);

  // Determine winner
  const maxScore = Math.max(scores.saty, scores.signals, scores.trend);
  let type: WebhookType = 'unknown';
  let endpoint = '';

  if (maxScore === 0) {
    type = 'unknown';
    endpoint = '';
    suggestions.push('Unable to determine webhook type from payload structure');
    suggestions.push('Check that payload includes identifying fields');
  } else if (scores.saty === maxScore) {
    type = 'saty-phase';
    endpoint = '/api/webhooks/saty-phase';
    if (maxScore < 50) {
      suggestions.push('Low confidence - consider adding meta.engine="SATY_PO" field');
    }
  } else if (scores.signals === maxScore) {
    type = 'signals';
    endpoint = '/api/webhooks/signals';
    if (maxScore < 50) {
      suggestions.push('Low confidence - consider adding signal.ai_score field');
    }
  } else if (scores.trend === maxScore) {
    type = 'trend';
    endpoint = '/api/webhooks/trend';
    if (maxScore < 50) {
      suggestions.push('Low confidence - consider adding timeframes structure');
    }
  }

  return {
    type,
    confidence: maxScore,
    correctEndpoint: endpoint,
    indicators,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}

/**
 * Check for SATY Phase webhook indicators
 */
function checkSatyIndicators(
  data: Record<string, unknown>,
  scores: Record<string, number>,
  indicators: string[]
): void {
  // Strong indicator: meta.engine = "SATY_PO"
  if (data.meta && typeof data.meta === 'object') {
    const meta = data.meta as Record<string, unknown>;
    if (meta.engine === 'SATY_PO') {
      scores.saty += 80;
      indicators.push('✓ Has meta.engine="SATY_PO" (strong SATY indicator)');
    }
  }

  // Strong indicator: regime_context with local_bias
  if (data.regime_context && typeof data.regime_context === 'object') {
    const regime = data.regime_context as Record<string, unknown>;
    if (regime.local_bias) {
      scores.saty += 40;
      indicators.push('✓ Has regime_context.local_bias (SATY indicator)');
    }
  }

  // Medium indicator: oscillator_state
  if (data.oscillator_state && typeof data.oscillator_state === 'object') {
    scores.saty += 30;
    indicators.push('✓ Has oscillator_state (SATY indicator)');
  }

  // Medium indicator: phase object with name
  if (data.phase && typeof data.phase === 'object') {
    const phase = data.phase as Record<string, unknown>;
    if (phase.name || phase.current !== undefined) {
      scores.saty += 30;
      indicators.push('✓ Has phase object (SATY indicator)');
    }
  }

  // Weak indicator: event with phase-related fields
  if (data.event && typeof data.event === 'object') {
    const event = data.event as Record<string, unknown>;
    if (event.phase_name || event.name) {
      scores.saty += 20;
      indicators.push('✓ Has event.phase_name (weak SATY indicator)');
    }
  }

  // Weak indicator: execution_guidance
  if (data.execution_guidance && typeof data.execution_guidance === 'object') {
    scores.saty += 15;
    indicators.push('✓ Has execution_guidance (weak SATY indicator)');
  }

  // Weak indicator: market_structure
  if (data.market_structure && typeof data.market_structure === 'object') {
    scores.saty += 15;
    indicators.push('✓ Has market_structure (weak SATY indicator)');
  }
}

/**
 * Check for Signals webhook indicators
 */
function checkSignalsIndicators(
  data: Record<string, unknown>,
  scores: Record<string, number>,
  indicators: string[]
): void {
  // Strong indicator: signal object with ai_score and quality
  if (data.signal && typeof data.signal === 'object') {
    const sig = data.signal as Record<string, unknown>;
    
    if (sig.ai_score !== undefined || sig.aiScore !== undefined) {
      scores.signals += 50;
      indicators.push('✓ Has signal.ai_score (strong Signals indicator)');
    }
    
    if (sig.quality) {
      scores.signals += 30;
      indicators.push('✓ Has signal.quality (Signals indicator)');
    }
    
    if (sig.type) {
      scores.signals += 20;
      indicators.push('✓ Has signal.type (Signals indicator)');
    }
  }

  // Medium indicator: risk object
  if (data.risk && typeof data.risk === 'object') {
    const risk = data.risk as Record<string, unknown>;
    if (risk.rr_ratio_t1 || risk.rr_ratio_t2 || risk.amount) {
      scores.signals += 30;
      indicators.push('✓ Has risk object (Signals indicator)');
    }
  }

  // Medium indicator: entry object
  if (data.entry && typeof data.entry === 'object') {
    const entry = data.entry as Record<string, unknown>;
    if (entry.price || entry.target_1 || entry.stop_loss) {
      scores.signals += 30;
      indicators.push('✓ Has entry object (Signals indicator)');
    }
  }

  // Medium indicator: components array
  if (Array.isArray(data.components)) {
    scores.signals += 25;
    indicators.push('✓ Has components array (Signals indicator)');
  }

  // Weak indicator: trend object (but not timeframes)
  if (data.trend && typeof data.trend === 'object' && !data.timeframes) {
    const trend = data.trend as Record<string, unknown>;
    if (trend.rsi || trend.ema_8 || trend.strength) {
      scores.signals += 20;
      indicators.push('✓ Has trend object (weak Signals indicator)');
    }
  }

  // Weak indicator: market_context (different from market_structure)
  if (data.market_context && typeof data.market_context === 'object') {
    scores.signals += 15;
    indicators.push('✓ Has market_context (weak Signals indicator)');
  }

  // Weak indicator: score_breakdown
  if (data.score_breakdown && typeof data.score_breakdown === 'object') {
    scores.signals += 15;
    indicators.push('✓ Has score_breakdown (weak Signals indicator)');
  }
}

/**
 * Check for Trend webhook indicators
 */
function checkTrendIndicators(
  data: Record<string, unknown>,
  scores: Record<string, number>,
  indicators: string[]
): void {
  // Very strong indicator: timeframes object with multiple timeframes
  if (data.timeframes && typeof data.timeframes === 'object') {
    const tf = data.timeframes as Record<string, unknown>;
    
    // Check for standard timeframe keys
    const hasStandardKeys = 
      (tf.tf3min || tf.tf5min || tf.tf15min || tf.tf30min || tf.tf1h || tf.tf4h) ||
      (tf['3m'] || tf['5m'] || tf['15m'] || tf['30m'] || tf['1h'] || tf['4h']);
    
    if (hasStandardKeys) {
      scores.trend += 80;
      indicators.push('✓ Has timeframes with multiple TFs (very strong Trend indicator)');
    } else {
      scores.trend += 40;
      indicators.push('✓ Has timeframes object (Trend indicator)');
    }
  }

  // Strong indicator: "Trend Change:" in text
  if (typeof data === 'string' && (data as string).includes('Trend Change:')) {
    scores.trend += 70;
    indicators.push('✓ Contains "Trend Change:" text (strong Trend indicator)');
  }

  // Medium indicator: ticker and exchange (common in trend webhooks)
  if (data.ticker && data.exchange && !data.signal && !data.phase) {
    scores.trend += 30;
    indicators.push('✓ Has ticker and exchange without signal/phase (Trend indicator)');
  }

  // Weak indicator: price field (common in trend webhooks)
  if (data.price && typeof data.price === 'number' && !data.signal) {
    scores.trend += 15;
    indicators.push('✓ Has price field (weak Trend indicator)');
  }

  // Weak indicator: timestamp field
  if (data.timestamp && typeof data.timestamp === 'number') {
    scores.trend += 10;
    indicators.push('✓ Has timestamp (weak Trend indicator)');
  }
}

/**
 * Check if payload is being sent to wrong endpoint
 * 
 * Returns true if payload type doesn't match current endpoint
 */
export function isWrongEndpoint(
  payload: unknown,
  currentEndpoint: 'saty-phase' | 'signals' | 'trend'
): {
  isWrong: boolean;
  detection: DetectionResult;
  message?: string;
} {
  const detection = detectWebhookType(payload);
  
  // If confidence is too low, don't make a determination
  if (detection.confidence < 30) {
    return {
      isWrong: false,
      detection,
      message: 'Confidence too low to determine if wrong endpoint'
    };
  }

  // Check if detected type matches current endpoint
  const isWrong = detection.type !== 'unknown' && detection.type !== currentEndpoint;

  if (isWrong) {
    return {
      isWrong: true,
      detection,
      message: `This appears to be a ${detection.type} webhook (confidence: ${detection.confidence}%), but was sent to ${currentEndpoint} endpoint. Please send to ${detection.correctEndpoint} instead.`
    };
  }

  return {
    isWrong: false,
    detection
  };
}

/**
 * Get helpful error message for wrong endpoint
 */
export function getWrongEndpointError(
  detection: DetectionResult,
  currentEndpoint: string
): {
  error: string;
  message: string;
  correct_endpoint: string;
  confidence: number;
  indicators: string[];
  suggestions?: string[];
  hint: string;
} {
  return {
    error: 'Wrong endpoint',
    message: `This appears to be a ${detection.type} webhook (confidence: ${detection.confidence}%)`,
    correct_endpoint: detection.correctEndpoint,
    confidence: detection.confidence,
    indicators: detection.indicators,
    suggestions: detection.suggestions,
    hint: `Update your TradingView alert URL from ${currentEndpoint} to ${detection.correctEndpoint}`
  };
}

/**
 * Get detection summary for logging
 */
export function getDetectionSummary(detection: DetectionResult): string {
  return `Detected as ${detection.type} (${detection.confidence}% confidence) - ${detection.indicators.length} indicators found`;
}
