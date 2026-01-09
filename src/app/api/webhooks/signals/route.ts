/**
 * Signals Webhook API
 * 
 * POST endpoint for receiving TradingView signals.
 * Validates and processes incoming EnrichedSignal payloads.
 * 
 * Requirements: 1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnrichedSignalSchema, safeParseEnrichedSignal } from '@/types/signal';
import { calculateSignalValidityMinutes } from '@/webhooks/validityCalculator';
import { getTimeframeStore } from '@/webhooks/timeframeStore';
import { executionPublisher } from '@/events/eventBus';
import { WebhookAuditLog } from '@/webhooks/auditLog';
import { recordWebhookReceipt } from '@/webhooks/auditDb';

/**
 * POST /api/webhooks/signals
 * 
 * Receives TradingView webhook with EnrichedSignal payload.
 * Accepts either:
 * - `{ "text": "<stringified EnrichedSignal JSON>" }` (legacy/testing wrapper), OR
 * - raw `EnrichedSignal` JSON object (recommended for TradingView).
 */
export async function POST(request: NextRequest) {
  const audit = WebhookAuditLog.getInstance();
  try {
    const raw = await request.text();
    let body: unknown = raw;
    try {
      body = JSON.parse(raw);
    } catch {
      // Keep as string; we'll fail validation and return 400.
    }

    // Parse and validate the signal
    const result =
      body && typeof body === 'object' && 'text' in (body as Record<string, unknown>)
        ? safeParseEnrichedSignal(body)
        : EnrichedSignalSchema.safeParse(body);
    
    if (!result.success) {
      const entry = {
        kind: 'signals',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Invalid signal payload',
      } as const;
      audit.add(entry);
      await recordWebhookReceipt(entry);
      return NextResponse.json(
        { 
          error: 'Invalid signal payload',
          received_type: typeof body,
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
    
    const okEntry = {
      kind: 'signals',
      ok: true,
      status: 200,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      ticker: signal.instrument.ticker,
      timeframe: signal.signal.timeframe,
    } as const;
    audit.add(okEntry);
    await recordWebhookReceipt(okEntry);

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

    const errEntry = {
      kind: 'signals',
      ok: false,
      status: 500,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      message: error instanceof Error ? error.message : 'Unknown error',
    } as const;
    audit.add(errEntry);
    await recordWebhookReceipt(errEntry);
    
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
