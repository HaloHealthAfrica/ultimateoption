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
import { parseAndAdaptSignal } from '@/webhooks/signalAdapter';
import { calculateSignalValidityMinutes } from '@/webhooks/validityCalculator';
import { getTimeframeStore } from '@/webhooks/timeframeStore';
import { executionPublisher } from '@/events/eventBus';
import { WebhookAuditLog } from '@/webhooks/auditLog';
import { recordWebhookReceipt } from '@/webhooks/auditDb';
import { authenticateWebhook } from '@/webhooks/security';

/**
 * POST /api/webhooks/signals
 * 
 * Receives TradingView webhook with EnrichedSignal payload.
 * Accepts either:
 * - `{ "text": "<stringified EnrichedSignal JSON>" }` (legacy/testing wrapper), OR
 * - raw `EnrichedSignal` JSON object (recommended for TradingView).
 * 
 * Authentication:
 * - HMAC-SHA256 signature in x-hub-signature-256, x-signature, or signature header
 * - OR Bearer token in Authorization header
 * - Configured via WEBHOOK_SECRET_SIGNALS environment variable
 */
export async function POST(request: NextRequest) {
  const audit = WebhookAuditLog.getInstance();
  
  try {
    const raw = await request.text();
    
    // Capture headers for debugging (excluding sensitive ones)
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (!key.toLowerCase().includes('authorization') && !key.toLowerCase().includes('secret')) {
        headers[key] = value;
      }
    });
    
    // Authenticate webhook
    const authResult = authenticateWebhook(request, raw, 'signals');
    if (!authResult.authenticated) {
      const entry = {
        kind: 'signals',
        ok: false,
        status: 401,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: `Authentication failed: ${authResult.error}`,
        raw_payload: raw, // Store complete payload
        headers,
      } as const;
      audit.add(entry);
      await recordWebhookReceipt(entry);
      return NextResponse.json(
        { error: 'Unauthorized', details: authResult.error },
        { status: 401 }
      );
    }
    
    let body: unknown = raw;
    try {
      body = JSON.parse(raw);
    } catch {
      // Keep as string; we'll fail validation and return 400.
    }

    // Parse and validate the signal - try multiple formats
    let signal;
    let parseMethod = 'unknown';
    
    // First try: Expected format with "text" field
    if (body && typeof body === 'object' && 'text' in (body as Record<string, unknown>)) {
      const result = safeParseEnrichedSignal(body);
      if (result.success) {
        signal = result.data;
        parseMethod = 'text-wrapped';
      }
    }
    
    // Second try: Direct EnrichedSignal format
    if (!signal) {
      const result = EnrichedSignalSchema.safeParse(body);
      if (result.success) {
        signal = result.data;
        parseMethod = 'direct-enriched';
      }
    }
    
    // Third try: Flexible signal adapter (for TradingView format)
    if (!signal) {
      const result = parseAndAdaptSignal(body);
      if (result.success) {
        signal = result.data;
        parseMethod = 'adapted-flexible';
      }
    }
    
    // If all parsing attempts failed
    if (!signal) {
      const entry = {
        kind: 'signals',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Invalid signal payload - no valid format found',
        raw_payload: raw, // Store complete payload
        headers,
      } as const;
      audit.add(entry);
      await recordWebhookReceipt(entry);
      return NextResponse.json(
        { 
          error: 'Invalid signal payload',
          received_type: typeof body,
          message: 'Payload does not match any expected format (text-wrapped, direct-enriched, or flexible)',
          raw_sample: typeof body === 'string' ? body.substring(0, 200) : JSON.stringify(body).substring(0, 200),
        },
        { status: 400 }
      );
    }
    
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
      message: `Authenticated via ${authResult.method} (parsed as ${parseMethod})`,
      raw_payload: raw, // Store complete payload
      headers,
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
      authentication: {
        method: authResult.method,
        authenticated: true,
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
      raw_payload: raw, // Store complete payload
      headers,
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
