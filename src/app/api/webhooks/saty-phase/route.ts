/**
 * SATY Phase Webhook API
 * 
 * POST endpoint for receiving SATY phase webhooks.
 * Validates and processes incoming SatyPhaseWebhook payloads.
 * 
 * Requirements: 18.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SatyPhaseWebhookSchema, safeParseSatyPhaseWebhook } from '@/types/saty';
import { parseAndAdaptSaty } from '@/webhooks/satyAdapter';
import { PhaseStore } from '@/saty/storage/phaseStore';
import { executionPublisher } from '@/events/eventBus';
import { WebhookAuditLog } from '@/webhooks/auditLog';
import { recordWebhookReceipt } from '@/webhooks/auditDb';
import { authenticateWebhook } from '@/webhooks/security';

/**
 * POST /api/webhooks/saty-phase
 * 
 * Receives TradingView webhook with SatyPhaseWebhook payload.
 * Accepts either:
 * - `{ "text": "<stringified SatyPhaseWebhook JSON>" }` (legacy/testing wrapper), OR
 * - raw `SatyPhaseWebhook` JSON object (recommended for TradingView).
 * 
 * Authentication:
 * - HMAC-SHA256 signature in x-hub-signature-256, x-signature, or signature header
 * - OR Bearer token in Authorization header
 * - Configured via WEBHOOK_SECRET_SATY_PHASE environment variable
 */
export async function POST(request: NextRequest) {
  const audit = WebhookAuditLog.getInstance();
  let raw = '';
  
  // Collect headers for audit
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  try {
    raw = await request.text();
    
    // Authenticate webhook
    const authResult = authenticateWebhook(request, raw, 'saty-phase');
    
    if (!authResult.authenticated) {
      const entry = {
        kind: 'saty-phase',
        ok: false,
        status: 401,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: `Authentication failed: ${authResult.error}`,
        raw_payload: raw,
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
      // keep as string
    }

    // Check if this is actually a trend webhook sent to the wrong endpoint
    if (typeof raw === 'string' && raw.includes('Trend Change:')) {
      const entry = {
        kind: 'saty-phase',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Wrong endpoint: This appears to be a Trend webhook. Please send to /api/webhooks/trend instead.',
        raw_payload: raw,
        headers,
      } as const;
      audit.add(entry);
      await recordWebhookReceipt(entry);
      return NextResponse.json(
        { 
          error: 'Wrong endpoint',
          message: 'This appears to be a Trend webhook (contains "Trend Change:" header)',
          correct_endpoint: '/api/webhooks/trend',
          hint: 'Update your TradingView alert to send to the correct endpoint',
        },
        { status: 400 }
      );
    }

    // Check if payload has timeframes structure (trend webhook indicator)
    if (body && typeof body === 'object' && 'timeframes' in (body as Record<string, unknown>)) {
      const entry = {
        kind: 'saty-phase',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Wrong endpoint: Payload has "timeframes" structure (Trend webhook). Please send to /api/webhooks/trend instead.',
        raw_payload: raw,
        headers,
      } as const;
      audit.add(entry);
      await recordWebhookReceipt(entry);
      return NextResponse.json(
        { 
          error: 'Wrong endpoint',
          message: 'Payload structure matches Trend webhook (has "timeframes" field)',
          correct_endpoint: '/api/webhooks/trend',
          hint: 'Update your TradingView alert to send to the correct endpoint',
        },
        { status: 400 }
      );
    }

    // Parse and validate the phase - try multiple formats
    let phase;
    let parseMethod = 'unknown';
    let lastError: { method: string; error: unknown } | null = null;
    
    // First try: Expected format with "text" field
    if (body && typeof body === 'object' && 'text' in (body as Record<string, unknown>)) {
      const result = safeParseSatyPhaseWebhook(body);
      if (result.success) {
        phase = result.data;
        parseMethod = 'text-wrapped';
      } else {
        lastError = { method: 'text-wrapped', error: result.error };
      }
    }
    
    // Second try: Direct SatyPhaseWebhook format
    if (!phase) {
      const result = SatyPhaseWebhookSchema.safeParse(body);
      if (result.success) {
        phase = result.data;
        parseMethod = 'direct-saty';
      } else {
        lastError = { method: 'direct-saty', error: result.error };
      }
    }
    
    // Third try: Flexible SATY adapter (for TradingView format)
    if (!phase) {
      const result = parseAndAdaptSaty(body);
      if (result.success) {
        phase = result.data;
        parseMethod = 'adapted-flexible';
      } else {
        lastError = { method: 'adapted-flexible', error: result.error };
      }
    }
    
    // If all parsing attempts failed
    if (!phase) {
      const entry = {
        kind: 'saty-phase',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: `Invalid phase payload - tried ${lastError?.method || 'unknown'} last`,
        raw_payload: raw,
        headers,
      } as const;
      audit.add(entry);
      await recordWebhookReceipt(entry);

      const lastIssues =
        lastError?.error instanceof z.ZodError
          ? lastError.error.issues.slice(0, 5).map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            }))
          : undefined;

      return NextResponse.json(
        { 
          error: 'Invalid phase payload',
          received_type: typeof body,
          message: 'Payload does not match any expected format (text-wrapped, direct-saty, or flexible)',
          last_attempt: lastError?.method,
          lasterror: lastIssues,
          raw_sample: typeof body === 'string' ? body.substring(0, 200) : JSON.stringify(body).substring(0, 200),
        },
        { status: 400 }
      );
    }
    
    // Calculate decay time based on timeframe
    const decayMinutes = getDecayMinutes(phase.timeframe.chart_tf);
    
    // Store phase in phase store
    const phaseStore = PhaseStore.getInstance();
    phaseStore.updatePhase(phase);
    
    // Publish event for learning modules
    executionPublisher.phaseReceived(phase, phase.timeframe.event_tf, decayMinutes);

    const okEntry = {
      kind: 'saty-phase',
      ok: true,
      status: 200,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      symbol: phase.instrument.symbol,
      timeframe: phase.timeframe.chart_tf,
      message: `Authenticated via ${authResult.method} (parsed as ${parseMethod})`,
      raw_payload: raw,
      headers,
    } as const;
    audit.add(okEntry);
    await recordWebhookReceipt(okEntry);
    
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
      authentication: {
        method: authResult.method,
        authenticated: true,
      },
      received_at: Date.now(),
    });
  } catch (error) {
    console.error('Error in POST /api/webhooks/saty-phase:', error);

    const errEntry = {
      kind: 'saty-phase',
      ok: false,
      status: 500,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      message: error instanceof Error ? error.message : 'Unknown error',
      raw_payload: raw,
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
