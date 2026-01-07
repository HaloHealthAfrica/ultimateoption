/**
 * SATY Phase Webhook API
 * 
 * POST endpoint for receiving SATY phase webhooks.
 * Validates and processes incoming SatyPhaseWebhook payloads.
 * 
 * Requirements: 18.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeParseSatyPhaseWebhook } from '@/types/saty';
import { PhaseStore } from '@/saty/storage/phaseStore';
import { executionPublisher } from '@/events/eventBus';
import { WebhookAuditLog } from '@/webhooks/auditLog';

/**
 * POST /api/webhooks/saty-phase
 * 
 * Receives TradingView webhook with SatyPhaseWebhook payload.
 * Payload should be JSON with a "text" field containing stringified phase data.
 */
export async function POST(request: NextRequest) {
  const audit = WebhookAuditLog.getInstance();
  try {
    const body = await request.json();
    
    // Parse and validate the phase
    const result = safeParseSatyPhaseWebhook(body);
    
    if (!result.success) {
      audit.add({
        kind: 'saty-phase',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Invalid phase payload',
      });
      return NextResponse.json(
        { 
          error: 'Invalid phase payload',
          details: result.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }
    
    const phase = result.data;
    
    // Calculate decay time based on timeframe
    const decayMinutes = getDecayMinutes(phase.timeframe.chart_tf);
    
    // Store phase in phase store
    const phaseStore = PhaseStore.getInstance();
    phaseStore.updatePhase(phase);
    
    // Publish event for learning modules
    executionPublisher.phaseReceived(phase, phase.timeframe.event_tf, decayMinutes);

    audit.add({
      kind: 'saty-phase',
      ok: true,
      status: 200,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      symbol: phase.instrument.symbol,
      timeframe: phase.timeframe.chart_tf,
    });
    
    return NextResponse.json({
      success: true,
      phase: {
        phase_type: phase.meta.event_type,
        timeframe: phase.timeframe.chart_tf,
        ticker: phase.instrument.symbol,
        direction: phase.regime_context.local_bias,
      },
      decay: {
        minutes: decayMinutes,
        expires_at: Date.now() + decayMinutes * 60 * 1000,
      },
      received_at: Date.now(),
    });
  } catch (error) {
    console.error('Error in POST /api/webhooks/saty-phase:', error);

    audit.add({
      kind: 'saty-phase',
      ok: false,
      status: 500,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get decay time in minutes based on timeframe
 */
function getDecayMinutes(timeframe: string): number {
  const decayMap: Record<string, number> = {
    '3': 6,      // 3M -> 6 minutes
    '5': 10,     // 5M -> 10 minutes
    '15': 30,    // 15M -> 30 minutes
    '30': 60,    // 30M -> 60 minutes
    '60': 120,   // 1H -> 120 minutes
    '240': 480,  // 4H -> 480 minutes
  };
  
  return decayMap[timeframe] || 60;
}

// Block other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit phases.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit phases.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit phases.' },
    { status: 405 }
  );
}
