/**
 * Normalizer Service for Phase 2.5 Decision Engine
 * 
 * Converts diverse webhook formats into canonical DecisionContext format.
 * Each source has its own mapper with no cross-source logic.
 */

import { INormalizer, 
  WebhookSource, DecisionContext,
  TradeDirection, NormalizedPayload } from '../types';

export class NormalizerService implements INormalizer {
  
  /**
   * Detect webhook source based on payload structure
   */
  detectSource(payload: unknown): WebhookSource {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload: must be an object');
    }

    const data = payload as Record<string, unknown>;

    // SATY Phase detection - has meta.engine = "SATY_PO"
    if ((data.meta as Record<string, unknown>)?.engine === 'SATY_PO') {
      return "SATY_PHASE";
    }

    // MTF Dots detection - has timeframes object with tf3min, tf5min, etc.
    if (data.timeframes && 
        typeof data.timeframes === 'object' &&
        (data.timeframes as Record<string, unknown>).tf3min &&
        (data.timeframes as Record<string, unknown>).tf5min) {
      return "MTF_DOTS";
    }

    // TradingView Signal detection - has signal with timeframe (check first)
    if ((data.signal as Record<string, unknown>)?.type && 
        (data.signal as Record<string, unknown>)?.timeframe &&
        (data.instrument as Record<string, unknown>)?.ticker) {
      return "TRADINGVIEW_SIGNAL";
    }

    // Ultimate Options detection - has signal with ai_score and quality but no timeframe
    if ((data.signal as Record<string, unknown>)?.ai_score !== undefined && 
        (data.signal as Record<string, unknown>)?.quality &&
        !(data.signal as Record<string, unknown>)?.timeframe) {
      return "ULTIMATE_OPTIONS";
    }

    // STRAT Execution detection - has setup_valid and liquidity_ok
    if (data.setup_valid !== undefined && 
        data.liquidity_ok !== undefined) {
      return "STRAT_EXEC";
    }

    throw new Error(`Unknown webhook source: unable to detect source from payload structure`);
  }

  /**
   * Normalize payload to partial DecisionContext based on detected source
   */
  normalize(payload: unknown, source?: WebhookSource): NormalizedPayload {
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
  private mapSatyPhase(payload: unknown): Partial<DecisionContext> {
    const data = payload as Record<string, unknown>;
    
    // Extract phase information from data.phase or event.name (fallback)
    const phaseName = (data.data as Record<string, unknown>)?.phase || this.extractPhaseName((data.event as Record<string, unknown>)?.name as string);
    const phase = this.getPhaseNumber(phaseName as "ACCUMULATION" | "MARKUP" | "MARKDOWN" | "DISTRIBUTION");
    
    // Extract volatility from regime context or default to NORMAL
    const volatility = this.extractVolatility(data.regime_context);
    
    // Extract bias from data.bias or regime_context.local_bias (fallback)
    const bias = this.mapBias(((data.data as Record<string, unknown>)?.bias || (data.regime_context as Record<string, unknown>)?.local_bias) as string);

    return {
      instrument: {
        symbol: (data.data as Record<string, unknown>)?.symbol as string || (data.instrument as Record<string, unknown>)?.symbol as string || '',
        exchange: (data.instrument as Record<string, unknown>)?.exchange as string || '',
        price: 0 // Will be updated from other sources
      },
      regime: {
        phase,
        phaseName: phaseName as "ACCUMULATION" | "MARKUP" | "MARKDOWN" | "DISTRIBUTION",
        volatility,
        confidence: (data.data as Record<string, unknown>)?.confidence as number || (data.confidence as Record<string, unknown>)?.confidence_score as number || 0,
        bias
      }
    };
  }

  /**
   * Map MTF Dots webhook to alignment context
   */
  private mapMtfDots(payload: unknown): Partial<DecisionContext> {
    const data = payload as Record<string, unknown>;
    const timeframes = (data.timeframes as Record<string, unknown>) || {};
    
    // Map timeframe states
    const tfStates: Record<string, "BULLISH" | "BEARISH" | "NEUTRAL"> = {};
    let bullishCount = 0;
    let bearishCount = 0;
    let totalCount = 0;

    // Process each timeframe
    const timeframeKeys = ['tf3min', 'tf5min', 'tf15min', 'tf30min', 'tf60min', 'tf240min'];
    
    for (const tf of timeframeKeys) {
      const tfData = timeframes[tf] as Record<string, unknown>;
      if (tfData?.direction) {
        const direction = this.normalizeDirection(tfData.direction as string);
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
        symbol: data.ticker as string || '',
        exchange: data.exchange as string || '',
        price: data.price as number || 0
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
  private mapUltimateOptions(payload: unknown): Partial<DecisionContext> {
    const data = payload as Record<string, unknown>;
    const signal = (data.signal as Record<string, unknown>) || {};
    
    return {
      instrument: {
        symbol: (data.instrument as Record<string, unknown>)?.ticker as string || '',
        exchange: (data.instrument as Record<string, unknown>)?.exchange as string || '',
        price: (data.instrument as Record<string, unknown>)?.current_price as number || 0
      },
      expert: {
        direction: signal.type as TradeDirection,
        aiScore: signal.ai_score as number || 0,
        quality: (signal.quality as "EXTREME" | "HIGH" | "MEDIUM") || 'MEDIUM',
        components: signal.components as string[] || [],
        rr1: (data.risk as Record<string, unknown>)?.rr_ratio_t1 as number || 0,
        rr2: (data.risk as Record<string, unknown>)?.rr_ratio_t2 as number || 0
      }
    };
  }

  /**
   * Map STRAT execution webhook to structure validation
   */
  private mapStratExecution(payload: unknown): Partial<DecisionContext> {
    const data = payload as Record<string, unknown>;
    
    return {
      instrument: {
        symbol: data.symbol as string || '',
        exchange: data.exchange as string || '',
        price: data.price as number || 0
      },
      structure: {
        validSetup: data.setup_valid === true,
        liquidityOk: data.liquidity_ok === true,
        executionQuality: (data.quality as "A" | "B" | "C") || 'C'
      }
    };
  }

  /**
   * Map TradingView signal webhook to expert opinion (alternative source)
   */
  private mapTradingViewSignal(payload: unknown): Partial<DecisionContext> {
    const data = payload as Record<string, unknown>;
    const signal = (data.signal as Record<string, unknown>) || {};
    
    return {
      instrument: {
        symbol: (data.instrument as Record<string, unknown>)?.ticker as string || '',
        exchange: (data.instrument as Record<string, unknown>)?.exchange as string || '',
        price: (data.instrument as Record<string, unknown>)?.current_price as number || 0
      },
      expert: {
        direction: signal.type as TradeDirection,
        aiScore: signal.ai_score as number || 0,
        quality: (signal.quality as "EXTREME" | "HIGH" | "MEDIUM") || 'MEDIUM',
        components: [], // TradingView doesn't provide component breakdown
        rr1: (data.risk as Record<string, unknown>)?.rr_ratio_t1 as number || 0,
        rr2: (data.risk as Record<string, unknown>)?.rr_ratio_t2 as number || 0
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

  private extractVolatility(regimeContext: unknown): DecisionContext['regime']['volatility'] {
    const context = regimeContext as Record<string, unknown>;
    // Look for volatility indicators in regime context
    if (context?.volatility) {
      const vol = (context.volatility as string).toLowerCase();
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