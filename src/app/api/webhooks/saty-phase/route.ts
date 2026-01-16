/**
 * SATY Phase Webhook API
 * 
 * POST endpoint for receiving SATY phase webhooks.
 * Validates and processes incoming SatyPhaseWebhook payloads.
 * 
 * Requirements: 18.1
 */

import { NextRequest, NextResponse } from 'next/server';
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

    // Parse and validate the phase - try multiple formats with enhanced adapter
    const adapterResult = parseAndAdaptSaty(body);
    
    if (!adapterResult.success) {
      const entry = {
        kind: 'saty-phase',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: `Invalid phase payload: ${adapterResult.error}`,
        raw_payload: raw,
        headers,
      } as const;
      audit.add(entry);
      await recordWebhookReceipt(entry);

      return NextResponse.json(
        { 
          error: 'Invalid phase payload',
          message: adapterResult.error,
          details: adapterResult.details,
          hint: 'Check the sample_minimal_payload in details for minimum required fields',
        },
        { status: 400 }
      );
    }
    
    const phase = adapterResult.data;
    const adaptations = adapterResult.adaptations || [];
    const parseMethod = adaptations.length > 0 ? adaptations[0] : 'standard';
    
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
      message: `Authenticated via ${authResult.method} (${parseMethod})${adaptations.length > 1 ? ` - ${adaptations.slice(1).join(', ')}` : ''}`,
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
      adaptations: adaptations.length > 0 ? adaptations : undefined,
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
