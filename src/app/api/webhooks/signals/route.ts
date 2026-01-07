/**
 * Signals Webhook API
 * 
 * POST endpoint for receiving TradingView signals.
 * Validates and processes incoming EnrichedSignal payloads.
 * 
 * Requirements: 1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeParseEnrichedSignal } from '@/types/signal';
import { calculateSignalValidityMinutes } from '@/webhooks/validityCalculator';
import { getTimeframeStore } from '@/webhooks/timeframeStore';
import { executionPublisher } from '@/events/eventBus';
import { WebhookAuditLog } from '@/webhooks/auditLog';

/**
 * POST /api/webhooks/signals
 * 
 * Receives TradingView webhook with EnrichedSignal payload.
 * Payload should be JSON with a "text" field containing stringified signal data.
 */
export async function POST(request: NextRequest) {
  const audit = WebhookAuditLog.getInstance();
  try {
    const body = await request.json();
    
    // Parse and validate the signal
    const result = safeParseEnrichedSignal(body);
    
    if (!result.success) {
      audit.add({
        kind: 'signals',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Invalid signal payload',
      });
      return NextResponse.json(
        { 
          error: 'Invalid signal payload',
          details: result.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }
    
    const signal = result.data;
    
    // Calculate validity
    const validityMinutes = calculateSignalValidityMinutes(signal);
    
    // Store signal in timeframe store
    const timeframeStore = getTimeframeStore();
    timeframeStore.storeSignal(signal);
    
    // Publish event for learning modules
    executionPublisher.signalReceived(signal, signal.signal.timeframe, validityMinutes);
    
    audit.add({
      kind: 'signals',
      ok: true,
      status: 200,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      ticker: signal.instrument.ticker,
      timeframe: signal.signal.timeframe,
    });

    return NextResponse.json({
      success: true,
      signal: {
        type: signal.signal.type,
        timeframe: signal.signal.timeframe,
        quality: signal.signal.quality,
        ai_score: signal.signal.ai_score,
        ticker: signal.instrument.ticker,
        price: signal.instrument.current_price,
      },
      validity: {
        minutes: validityMinutes,
        expires_at: Date.now() + validityMinutes * 60 * 1000,
      },
      received_at: Date.now(),
    });
  } catch (error) {
    console.error('Error in POST /api/webhooks/signals:', error);

    audit.add({
      kind: 'signals',
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

// Block other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit signals.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit signals.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit signals.' },
    { status: 405 }
  );
}
