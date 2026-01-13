/**
 * Normalizer Service for Phase 2.5 Decision Engine
 * 
 * Converts diverse webhook formats into canonical DecisionContext format.
 * Each source has its own mapper with no cross-source logic.
 */

import { 
  INormalizer, 
  WebhookSource, 
  NormalizedPayload, 
  DecisionContext,
  TradeDirection 
} from '../types';

export class NormalizerService implements INormalizer {
  
  /**
   * Detect webhook source based on payload structure
   */
  detectSource(payload: any): WebhookSource {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload: must be an object');
    }

    // SATY Phase detection - has meta.engine = "SATY_PO"
    if (payload.meta?.engine === 'SATY_PO') {
      return "SATY_PHASE";
    }

    // MTF Dots detection - has timeframes object with tf3min, tf5min, etc.
    if (payload.timeframes && 
        typeof payload.timeframes === 'object' &&
        payload.timeframes.tf3min &&
        payload.timeframes.tf5min) {
      return "MTF_DOTS";
    }

    // TradingView Signal detection - has signal with timeframe (check first)
    if (payload.signal?.type && 
        payload.signal?.timeframe &&
        payload.instrument?.ticker) {
      return "TRADINGVIEW_SIGNAL";
    }

    // Ultimate Options detection - has signal with ai_score and quality but no timeframe
    if (payload.signal?.ai_score !== undefined && 
        payload.signal?.quality &&
        !payload.signal?.timeframe) {
      return "ULTIMATE_OPTIONS";
    }

    // STRAT Execution detection - has setup_valid and liquidity_ok
    if (payload.setup_valid !== undefined && 
        payload.liquidity_ok !== undefined) {
      return "STRAT_EXEC";
    }

    throw new Error(`Unknown webhook source: unable to detect source from payload structure`);
  }

  /**
   * Normalize payload to partial DecisionContext based on detected source
   */
  normalize(payload: any, source?: WebhookSource): NormalizedPayload {
    const detectedSource = source || this.detectSource(payload);
    
    let partial: Partial<DecisionContext>;
    
    switch (detectedSource) {
      case "SATY_PHASE":
        partial = this.mapSatyPhase(payload);
        break;
      case "MTF_DOTS":
        partial = this.mapMtfDots(payload);
        break;
      case "ULTIMATE_OPTIONS":
        partial = this.mapUltimateOptions(payload);
        break;
      case "STRAT_EXEC":
        partial = this.mapStratExecution(payload);
        break;
      case "TRADINGVIEW_SIGNAL":
        partial = this.mapTradingViewSignal(payload);
        break;
      default:
        throw new Error(`Unsupported webhook source: ${detectedSource}`);
    }

    return {
      source: detectedSource,
      partial,
      timestamp: Date.now()
    };
  }

  /**
   * Map SATY phase webhook to regime context
   */
  private mapSatyPhase(payload: any): Partial<DecisionContext> {
    // Extract phase information from data.phase or event.name (fallback)
    const phaseName = payload.data?.phase || this.extractPhaseName(payload.event?.name);
    const phase = this.getPhaseNumber(phaseName);
    
    // Extract volatility from regime context or default to NORMAL
    const volatility = this.extractVolatility(payload.regime_context);
    
    // Extract bias from data.bias or regime_context.local_bias (fallback)
    const bias = this.mapBias(payload.data?.bias || payload.regime_context?.local_bias);

    return {
      instrument: {
        symbol: payload.data?.symbol || payload.instrument?.symbol || '',
        exchange: payload.instrument?.exchange || '',
        price: 0, // Will be updated from other sources
        timestamp: Date.now()
      },
      regime: {
        phase,
        phaseName,
        volatility,
        confidence: payload.data?.confidence || payload.confidence?.confidence_score || 0,
        bias,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Map MTF Dots webhook to alignment context
   */
  private mapMtfDots(payload: any): Partial<DecisionContext> {
    const timeframes = payload.timeframes || {};
    
    // Map timeframe states
    const tfStates: Record<string, "BULLISH" | "BEARISH" | "NEUTRAL"> = {};
    let bullishCount = 0;
    let bearishCount = 0;
    let totalCount = 0;

    // Process each timeframe
    const timeframeKeys = ['tf3min', 'tf5min', 'tf15min', 'tf30min', 'tf60min', 'tf240min'];
    
    for (const tf of timeframeKeys) {
      if (timeframes[tf]?.direction) {
        const direction = this.normalizeDirection(timeframes[tf].direction);
        tfStates[tf] = direction;
        
        if (direction === 'BULLISH') bullishCount++;
        else if (direction === 'BEARISH') bearishCount++;
        totalCount++;
      }
    }

    // Calculate alignment percentages (rounded to 2 decimal places)
    const bullishPct = totalCount > 0 ? Math.round((bullishCount / totalCount) * 10000) / 100 : 0;
    const bearishPct = totalCount > 0 ? Math.round((bearishCount / totalCount) * 10000) / 100 : 0;

    return {
      instrument: {
        symbol: payload.ticker || '',
        exchange: payload.exchange || '',
        price: payload.price || 0
      },
      alignment: {
        tfStates,
        bullishPct,
        bearishPct
      }
    };
  }

  /**
   * Map Ultimate Options webhook to expert opinion
   */
  private mapUltimateOptions(payload: any): Partial<DecisionContext> {
    const signal = payload.signal || {};
    
    return {
      instrument: {
        symbol: payload.instrument?.ticker || '',
        exchange: payload.instrument?.exchange || '',
        price: payload.instrument?.current_price || 0,
        timestamp: Date.now()
      },
      expert: {
        direction: signal.type as TradeDirection,
        aiScore: signal.ai_score || 0,
        quality: signal.quality || 'MEDIUM',
        components: signal.components || [],
        rr1: payload.risk?.rr_ratio_t1 || 0,
        rr2: payload.risk?.rr_ratio_t2 || 0,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Map STRAT execution webhook to structure validation
   */
  private mapStratExecution(payload: any): Partial<DecisionContext> {
    return {
      instrument: {
        symbol: payload.symbol || '',
        exchange: payload.exchange || '',
        price: payload.price || 0
      },
      structure: {
        validSetup: payload.setup_valid === true,
        liquidityOk: payload.liquidity_ok === true,
        executionQuality: payload.quality || 'C'
      }
    };
  }

  /**
   * Map TradingView signal webhook to expert opinion (alternative source)
   */
  private mapTradingViewSignal(payload: any): Partial<DecisionContext> {
    const signal = payload.signal || {};
    
    return {
      instrument: {
        symbol: payload.instrument?.ticker || '',
        exchange: payload.instrument?.exchange || '',
        price: payload.instrument?.current_price || 0,
        timestamp: Date.now()
      },
      expert: {
        direction: signal.type as TradeDirection,
        aiScore: signal.ai_score || 0,
        quality: signal.quality || 'MEDIUM',
        components: [], // TradingView doesn't provide component breakdown
        rr1: payload.risk?.rr_ratio_t1 || 0,
        rr2: payload.risk?.rr_ratio_t2 || 0,
        timestamp: Date.now()
      }
    };
  }

  // Helper methods for data transformation

  private extractPhaseName(eventName: string): DecisionContext['regime']['phaseName'] {
    if (!eventName) return 'ACCUMULATION';
    
    if (eventName.includes('ACCUMULATION')) return 'ACCUMULATION';
    if (eventName.includes('MARKUP')) return 'MARKUP';
    if (eventName.includes('DISTRIBUTION')) return 'DISTRIBUTION';
    if (eventName.includes('MARKDOWN')) return 'MARKDOWN';
    
    // Default to ACCUMULATION for unknown events
    return 'ACCUMULATION';
  }

  private getPhaseNumber(phaseName: DecisionContext['regime']['phaseName']): 1 | 2 | 3 | 4 {
    switch (phaseName) {
      case 'ACCUMULATION': return 1;
      case 'MARKUP': return 2;
      case 'DISTRIBUTION': return 3;
      case 'MARKDOWN': return 4;
      default: return 1;
    }
  }

  private extractVolatility(regimeContext: any): DecisionContext['regime']['volatility'] {
    // Look for volatility indicators in regime context
    if (regimeContext?.volatility) {
      const vol = regimeContext.volatility.toLowerCase();
      if (vol.includes('high')) return 'HIGH';
      if (vol.includes('low')) return 'LOW';
    }
    
    // Default to NORMAL if not specified
    return 'NORMAL';
  }

  private mapBias(localBias: string): DecisionContext['regime']['bias'] {
    if (!localBias) return 'NEUTRAL';
    
    const bias = localBias.toUpperCase();
    if (bias === 'BULLISH') return 'LONG';
    if (bias === 'BEARISH') return 'SHORT';
    return 'NEUTRAL';
  }

  private normalizeDirection(direction: string): "BULLISH" | "BEARISH" | "NEUTRAL" {
    if (!direction) return 'NEUTRAL';
    
    const dir = direction.toLowerCase();
    if (dir === 'bullish' || dir === 'bull') return 'BULLISH';
    if (dir === 'bearish' || dir === 'bear') return 'BEARISH';
    return 'NEUTRAL';
  }
}