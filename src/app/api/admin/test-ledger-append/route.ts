/**
 * Test ledger append directly
 * This endpoint helps diagnose ledger storage issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGlobalLedger } from '@/ledger/globalLedger';
import { LedgerEntryCreate } from '@/types/ledger';

export async function POST(_request: NextRequest) {
  try {
    console.log('🔍 Testing ledger append...');
    
    // Create a minimal test entry
    const testEntry: LedgerEntryCreate = {
      created_at: Date.now(),
      engine_version: '2.5.0-test',
      signal: {
        signal: {
          type: 'LONG',
          timeframe: '15',
          quality: 'EXTREME',
          ai_score: 9.5,
          timestamp: Date.now(),
          bar_time: new Date().toISOString(),
        },
        instrument: {
          ticker: 'SPY',
          exchange: 'NASDAQ',
          current_price: 450.25,
        },
        entry: {
          price: 450.25,
          stop_loss: 448.50,
          target_1: 452.00,
          target_2: 454.00,
          stop_reason: 'ATR',
        },
        risk: {
          amount: 1000,
          rr_ratio_t1: 2.5,
          rr_ratio_t2: 4.0,
          stop_distance_pct: 0.39,
          recommended_shares: 571,
          recommended_contracts: 5,
          position_multiplier: 1.5,
          account_risk_pct: 1.0,
          max_loss_dollars: 1000,
        },
        market_context: {
          vwap: 449.80,
          pmh: 451.20,
          pml: 447.50,
          day_open: 448.90,
          day_change_pct: 0.30,
          price_vs_vwap_pct: 0.10,
          distance_to_pmh_pct: 0.21,
          distance_to_pml_pct: 0.61,
          atr: 4.50,
          volume_vs_avg: 1.2,
          candle_direction: 'GREEN',
          candle_size_atr: 0.8,
        },
        trend: {
          ema_8: 449.50,
          ema_21: 448.20,
          ema_50: 446.80,
          alignment: 'BULLISH',
          strength: 85,
          rsi: 62,
          macd_signal: 'BULLISH',
        },
        mtf_context: {
          '4h_bias': 'LONG',
          '4h_rsi': 58,
          '1h_bias': 'LONG',
        },
        score_breakdown: {
          strat: 3.0,
          trend: 2.5,
          gamma: 1.5,
          vwap: 1.0,
          mtf: 1.0,
          golf: 0.5,
        },
        components: ['STRAT', 'TREND', 'GAMMA', 'VWAP', 'MTF'],
        time_context: {
          market_session: 'OPEN',
          day_of_week: 'TUESDAY',
        },
      },
      decision: 'SKIP',
      decision_reason: 'Test entry for debugging',
      decision_breakdown: {
        confluence_multiplier: 1.0,
        quality_multiplier: 1.0,
        htf_alignment_multiplier: 1.0,
        rr_multiplier: 1.0,
        volume_multiplier: 1.0,
        trend_multiplier: 1.0,
        session_multiplier: 1.0,
        day_multiplier: 1.0,
        phase_confidence_boost: 0,
        phase_position_boost: 0,
        trend_alignment_boost: 0,
        final_multiplier: 1.0,
      },
      confluence_score: 85.0,
      regime: {
        volatility: 'NORMAL',
        trend: 'NEUTRAL',
        liquidity: 'NORMAL',
        iv_rank: 50,
      },
    };

    console.log('Test entry created, attempting to append...');
    
    const ledger = await getGlobalLedger();
    console.log('Ledger instance obtained');
    
    const result = await ledger.append(testEntry);
    console.log('✅ Append successful!', result.id);

    return NextResponse.json({
      success: true,
      message: 'Test entry appended successfully',
      entryId: result.id,
      entry: result,
    });

  } catch (error) {
    console.error('❌ Ledger append test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      details: error,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to test ledger append',
    method: 'POST',
  });
}
