/**
 * Phase Current API
 * 
 * GET endpoint for retrieving current SATY phase regime context.
 * Returns active phases across 15M/1H/4H/1D timeframes.
 * 
 * Requirements: 26.1, 26.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { PhaseStore } from '@/saty/storage/phaseStore';

/**
 * GET /api/phase/current?symbol=SPY
 * 
 * Returns regime context for the specified symbol.
 * Defaults to SPY if no symbol provided.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'SPY';
    
    // Get regime context from phase store
    const phaseStore = PhaseStore.getInstance();
    const regimeContext = phaseStore.getRegimeContext(symbol);
    
    // Format response with phase details
    const response = {
      symbol,
      regime_context: {
        setup_phase: regimeContext.setup_phase ? {
          timeframe: regimeContext.setup_phase.timeframe.event_tf,
          event_type: regimeContext.setup_phase.meta.event_type,
          event_name: regimeContext.setup_phase.event.name,
          local_bias: regimeContext.setup_phase.regime_context.local_bias,
          confidence_score: regimeContext.setup_phase.confidence.confidence_score,
          htf_alignment: regimeContext.setup_phase.confidence.htf_alignment,
          generated_at: new Date(regimeContext.setup_phase.meta.generated_at).getTime(),
        } : null,
        
        bias_phase: regimeContext.bias_phase ? {
          timeframe: regimeContext.bias_phase.timeframe.event_tf,
          event_type: regimeContext.bias_phase.meta.event_type,
          event_name: regimeContext.bias_phase.event.name,
          local_bias: regimeContext.bias_phase.regime_context.local_bias,
          confidence_score: regimeContext.bias_phase.confidence.confidence_score,
          htf_alignment: regimeContext.bias_phase.confidence.htf_alignment,
          generated_at: new Date(regimeContext.bias_phase.meta.generated_at).getTime(),
        } : null,
        
        regime_phase: regimeContext.regime_phase ? {
          timeframe: regimeContext.regime_phase.timeframe.event_tf,
          event_type: regimeContext.regime_phase.meta.event_type,
          event_name: regimeContext.regime_phase.event.name,
          local_bias: regimeContext.regime_phase.regime_context.local_bias,
          confidence_score: regimeContext.regime_phase.confidence.confidence_score,
          htf_alignment: regimeContext.regime_phase.confidence.htf_alignment,
          generated_at: new Date(regimeContext.regime_phase.meta.generated_at).getTime(),
        } : null,
        
        structural_phase: regimeContext.structural_phase ? {
          timeframe: regimeContext.structural_phase.timeframe.event_tf,
          event_type: regimeContext.structural_phase.meta.event_type,
          event_name: regimeContext.structural_phase.event.name,
          local_bias: regimeContext.structural_phase.regime_context.local_bias,
          confidence_score: regimeContext.structural_phase.confidence.confidence_score,
          htf_alignment: regimeContext.structural_phase.confidence.htf_alignment,
          generated_at: new Date(regimeContext.structural_phase.meta.generated_at).getTime(),
        } : null,
      },
      alignment: {
        is_aligned: regimeContext.is_aligned,
        active_count: regimeContext.active_count,
      },
      retrieved_at: Date.now(),
    };
    
    return NextResponse.json(response);
  } catch {
    console.error('Error in GET /api/phase/current:');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Block other methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve phase data.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve phase data.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve phase data.' },
    { status: 405 }
  );
}