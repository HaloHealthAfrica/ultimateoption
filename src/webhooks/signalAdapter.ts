/**
 * Flexible Signal Adapter
 * 
 * Handles incomplete or non-standard signal webhook payloads by inferring
 * missing fields from available data. This adapter reduces webhook failures
 * by constructing valid signal structures from partial data.
 * 
 * Use Cases:
 * - TradingView alerts with simplified message formats
 * - Legacy webhook formats missing signal wrapper
 * - Payloads with signal data in non-standard locations
 */

export interface FlexibleSignalPayload {
  signal?: {
    type?: string;
    quality?: string;
    ai_score?: number;
    aiScore?: number;
    timeframe?: string;
    timestamp?: number;
    symbol?: string;
  };
  instrument?: {
    ticker?: string;
    symbol?: string;
    exchange?: string;
    current_price?: number;
  };
  trend?: string;
  direction?: string;
  bias?: string;
  signal_type?: string;
  type?: string;
  quality?: string;
  score?: number;
  confidence?: number;
  ai_score?: number;
  aiScore?: number;
  ticker?: string;
  symbol?: string;
  timeframe?: string;
  timestamp?: number;
  price?: number;
  [key: string]: unknown;
}

export interface AdaptedSignalPayload {
  signal: {
    type: string;
    quality: string;
    ai_score: number;
    timeframe: string;
    timestamp: number;
    symbol?: string;
  };
  instrument: {
    ticker: string;
    exchange: string;
    current_price?: number;
  };
}

export interface AdapterResult {
  success: boolean;
  data?: AdaptedSignalPayload;
  error?: string;
  adaptations?: string[];
}

/**
 * Adapt flexible signal payload to standard format
 * 
 * Tries to construct a valid signal payload from incomplete data by:
 * 1. Checking if signal field exists and is complete
 * 2. Inferring signal.type from trend/direction/bias fields
 * 3. Inferring signal.quality from score/confidence fields
 * 4. Inferring signal.ai_score from various score fields
 * 5. Using sensible defaults for missing optional fields
 */
export function adaptFlexibleSignal(payload: unknown): AdapterResult {
  if (!payload || typeof payload !== 'object') {
    return {
      success: false,
      error: 'Payload must be a valid object'
    };
  }

  const data = payload as FlexibleSignalPayload;
  const adaptations: string[] = [];

  try {
    // Step 1: Check if signal field exists and is complete
    if (data.signal && typeof data.signal === 'object') {
      const sig = data.signal;
      const hasType = !!sig.type;
      const hasScore = sig.ai_score !== undefined || sig.aiScore !== undefined;
      
      // If signal is complete, just normalize it
      if (hasType && hasScore) {
        return {
          success: true,
          data: normalizeCompleteSignal(data),
          adaptations: ['Signal field was complete, normalized only']
        };
      }
    }

    // Step 2: Construct signal from available fields
    const constructedSignal = constructSignalFromFlexible(data, adaptations);
    
    if (!constructedSignal) {
      return {
        success: false,
        error: 'Unable to construct signal from available fields. Need at least: ticker/symbol and trend/direction/type',
        adaptations
      };
    }

    // Step 3: Construct instrument
    const instrument = constructInstrument(data, adaptations);
    
    if (!instrument) {
      return {
        success: false,
        error: 'Unable to determine ticker/symbol',
        adaptations
      };
    }

    const adapted: AdaptedSignalPayload = {
      signal: constructedSignal,
      instrument
    };

    return {
      success: true,
      data: adapted,
      adaptations
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during adaptation',
      adaptations
    };
  }
}

/**
 * Normalize a complete signal payload
 */
function normalizeCompleteSignal(data: FlexibleSignalPayload): AdaptedSignalPayload {
  const sig = data.signal!;
  
  return {
    signal: {
      type: sig.type || 'LONG',
      quality: sig.quality || 'MEDIUM',
      ai_score: sig.ai_score ?? sig.aiScore ?? 5.0,
      timeframe: sig.timeframe || data.timeframe || '15',
      timestamp: sig.timestamp || data.timestamp || Date.now(),
      symbol: sig.symbol
    },
    instrument: {
      ticker: data.instrument?.ticker || data.instrument?.symbol || data.ticker || data.symbol || sig.symbol || 'SPY',
      exchange: data.instrument?.exchange || 'NASDAQ',
      current_price: data.instrument?.current_price || data.price
    }
  };
}

/**
 * Construct signal object from flexible payload
 */
function constructSignalFromFlexible(
  data: FlexibleSignalPayload,
  adaptations: string[]
): AdaptedSignalPayload['signal'] | null {
  // Infer signal type
  const type = inferSignalType(data, adaptations);
  if (!type) {
    return null;
  }

  // Infer quality
  const quality = inferQuality(data, adaptations);

  // Infer AI score
  const ai_score = inferAiScore(data, adaptations);

  // Get timeframe
  const timeframe = data.signal?.timeframe || data.timeframe || '15';
  if (!data.signal?.timeframe && !data.timeframe) {
    adaptations.push('Used default timeframe: 15');
  }

  // Get timestamp
  const timestamp = data.signal?.timestamp || data.timestamp || Date.now();
  if (!data.signal?.timestamp && !data.timestamp) {
    adaptations.push('Used current timestamp');
  }

  // Get symbol (optional in signal, required in instrument)
  const symbol = data.signal?.symbol || data.instrument?.ticker || data.instrument?.symbol || data.ticker || data.symbol;

  return {
    type,
    quality,
    ai_score,
    timeframe,
    timestamp,
    symbol
  };
}

/**
 * Infer signal type from various fields
 */
function inferSignalType(data: FlexibleSignalPayload, adaptations: string[]): string | null {
  // Check signal.type first
  if (data.signal?.type) {
    return normalizeSignalType(data.signal.type);
  }

  // Check top-level type field
  if (data.type) {
    adaptations.push('Inferred signal.type from top-level type field');
    return normalizeSignalType(data.type);
  }

  // Check signal_type field
  if (data.signal_type) {
    adaptations.push('Inferred signal.type from signal_type field');
    return normalizeSignalType(data.signal_type);
  }

  // Check trend field
  if (data.trend) {
    adaptations.push('Inferred signal.type from trend field');
    return trendToSignalType(data.trend);
  }

  // Check direction field
  if (data.direction) {
    adaptations.push('Inferred signal.type from direction field');
    return trendToSignalType(data.direction);
  }

  // Check bias field
  if (data.bias) {
    adaptations.push('Inferred signal.type from bias field');
    return trendToSignalType(data.bias);
  }

  return null;
}

/**
 * Normalize signal type to LONG or SHORT
 */
function normalizeSignalType(type: string): string {
  const normalized = type.toUpperCase();
  
  if (normalized === 'LONG' || normalized === 'BUY' || normalized === 'BULLISH') {
    return 'LONG';
  }
  
  if (normalized === 'SHORT' || normalized === 'SELL' || normalized === 'BEARISH') {
    return 'SHORT';
  }
  
  // Default to LONG if unclear
  return 'LONG';
}

/**
 * Convert trend/direction/bias to signal type
 */
function trendToSignalType(trend: string): string {
  const normalized = trend.toUpperCase();
  
  if (normalized === 'BULLISH' || normalized === 'LONG' || normalized === 'UP' || normalized === 'BUY') {
    return 'LONG';
  }
  
  if (normalized === 'BEARISH' || normalized === 'SHORT' || normalized === 'DOWN' || normalized === 'SELL') {
    return 'SHORT';
  }
  
  // Default to LONG
  return 'LONG';
}

/**
 * Infer quality from score/confidence fields
 */
function inferQuality(data: FlexibleSignalPayload, adaptations: string[]): string {
  // Check signal.quality first
  if (data.signal?.quality) {
    return normalizeQuality(data.signal.quality);
  }

  // Check top-level quality field
  if (data.quality) {
    adaptations.push('Used top-level quality field');
    return normalizeQuality(data.quality);
  }

  // Infer from score fields
  const score = data.signal?.ai_score ?? data.signal?.aiScore ?? data.ai_score ?? data.aiScore ?? data.score ?? data.confidence;
  
  if (typeof score === 'number') {
    adaptations.push(`Inferred quality from score: ${score}`);
    return scoreToQuality(score);
  }

  // Default to MEDIUM
  adaptations.push('Used default quality: MEDIUM');
  return 'MEDIUM';
}

/**
 * Normalize quality string
 */
function normalizeQuality(quality: string): string {
  const normalized = quality.toUpperCase();
  
  if (normalized === 'EXTREME' || normalized === 'VERY_HIGH' || normalized === 'EXCELLENT') {
    return 'EXTREME';
  }
  
  if (normalized === 'HIGH' || normalized === 'GOOD') {
    return 'HIGH';
  }
  
  if (normalized === 'MEDIUM' || normalized === 'MODERATE' || normalized === 'AVERAGE') {
    return 'MEDIUM';
  }
  
  // Default to MEDIUM
  return 'MEDIUM';
}

/**
 * Convert numeric score to quality
 */
function scoreToQuality(score: number): string {
  if (score >= 9) return 'EXTREME';
  if (score >= 7) return 'HIGH';
  return 'MEDIUM';
}

/**
 * Infer AI score from various score fields
 */
function inferAiScore(data: FlexibleSignalPayload, adaptations: string[]): number {
  // Check signal.ai_score first
  if (data.signal?.ai_score !== undefined) {
    return clampScore(data.signal.ai_score);
  }

  // Check signal.aiScore (camelCase)
  if (data.signal?.aiScore !== undefined) {
    return clampScore(data.signal.aiScore);
  }

  // Check top-level ai_score
  if (data.ai_score !== undefined) {
    adaptations.push('Used top-level ai_score field');
    return clampScore(data.ai_score);
  }

  // Check top-level aiScore
  if (data.aiScore !== undefined) {
    adaptations.push('Used top-level aiScore field');
    return clampScore(data.aiScore);
  }

  // Check score field
  if (data.score !== undefined) {
    adaptations.push('Used score field as ai_score');
    return clampScore(data.score);
  }

  // Check confidence field
  if (data.confidence !== undefined) {
    adaptations.push('Used confidence field as ai_score');
    return clampScore(data.confidence);
  }

  // Default to 5.0 (neutral)
  adaptations.push('Used default ai_score: 5.0');
  return 5.0;
}

/**
 * Clamp score to valid range (0-10.5)
 */
function clampScore(score: number): number {
  if (isNaN(score)) return 5.0;
  if (score < 0) return 0;
  if (score > 10.5) return 10.5;
  return score;
}

/**
 * Construct instrument object
 */
function constructInstrument(
  data: FlexibleSignalPayload,
  adaptations: string[]
): AdaptedSignalPayload['instrument'] | null {
  // Try to get ticker from various locations
  const ticker = 
    data.instrument?.ticker ||
    data.instrument?.symbol ||
    data.ticker ||
    data.symbol ||
    data.signal?.symbol;

  if (!ticker) {
    return null;
  }

  // Get exchange
  const exchange = data.instrument?.exchange || 'NASDAQ';
  if (!data.instrument?.exchange) {
    adaptations.push('Used default exchange: NASDAQ');
  }

  // Get price
  const current_price = data.instrument?.current_price || data.price;

  return {
    ticker: ticker.toString().toUpperCase(),
    exchange,
    current_price
  };
}

/**
 * Validate adapted payload has all required fields
 */
export function validateAdaptedPayload(payload: AdaptedSignalPayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate signal
  if (!payload.signal) {
    errors.push('Missing signal object');
  } else {
    if (!payload.signal.type) {
      errors.push('Missing signal.type');
    }
    if (payload.signal.ai_score === undefined) {
      errors.push('Missing signal.ai_score');
    }
  }

  // Validate instrument
  if (!payload.instrument) {
    errors.push('Missing instrument object');
  } else {
    if (!payload.instrument.ticker) {
      errors.push('Missing instrument.ticker');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
