/**
 * Trend Webhook API
 * 
 * POST endpoint for receiving multi-timeframe trend alignment webhooks.
 * Validates and processes incoming TrendWebhook payloads.
 * 
 * Requirements: 24.1, 24.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { TrendWebhookSchema, safeParseTrendWebhook, calculateTrendAlignment } from '@/types/trend';
import { TrendStore } from '@/trend/storage/trendStore';
import { WebhookAuditLog } from '@/webhooks/auditLog';
import { recordWebhookReceipt } from '@/webhooks/auditDb';
import { authenticateWebhook } from '@/webhooks/security';
import { parseAndAdaptTrend } from '@/webhooks/trendAdapter';

/**
 * POST /api/webhooks/trend
 * 
 * Receives TradingView webhook with TrendWebhook payload.
 * Accepts either:
 * - `{ "text": "<stringified TrendWebhook JSON>" }` (legacy/testing wrapper), OR
 * - raw `TrendWebhook` JSON object (recommended for TradingView).
 * 
 * Authentication:
 * - HMAC-SHA256 signature in x-hub-signature-256, x-signature, or signature header
 * - OR Bearer token in Authorization header
 * - Configured via WEBHOOK_SECRET_TREND environment variable
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
    const authResult = authenticateWebhook(request, raw, 'trend');
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    if (!authResult.authenticated) {
      const entry = {
        kind: 'trend',
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

    // Parse and validate the trend data
    // Try multiple formats:
    // 1. Legacy wrapper format: { text: "<json>" }
    // 2. TradingView format: { event, ticker, timeframes: { "3m": {...}, ... } }
    // 3. Canonical format: { ticker, timeframes: { tf3min: {...}, ... } }
    let result;
    
    if (body && typeof body === 'object' && 'text' in (body as Record<string, unknown>)) {
      // Legacy wrapper format
      result = safeParseTrendWebhook(body);
    } else {
      // Try TradingView format first (with adapter)
      const adaptResult = parseAndAdaptTrend(body);
      if (adaptResult.success) {
        result = { success: true, data: adaptResult.data };
      } else {
        // Fall back to canonical format
        result = TrendWebhookSchema.safeParse(body);
      }
    }
    
    if (!result.success) {
      const entry = {
        kind: 'trend',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Invalid trend payload',
        raw_payload: raw,
        headers,
      } as const;
      audit.add(entry);
      await recordWebhookReceipt(entry);
      
      // Format error details if available
      const errorDetails = result.error && typeof result.error === 'object' && 'issues' in result.error
        ? (result.error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          }))
        : undefined;
      
      return NextResponse.json(
        { 
          error: 'Invalid trend payload',
          received_type: typeof body,
          details: errorDetails,
        },
        { status: 400 }
      );
    }
    
    const trend = result.data;
    
    // Store trend in trend store with 1-hour TTL
    const trendStore = TrendStore.getInstance();
    trendStore.updateTrend(trend);
    
    // Calculate alignment metrics
    const alignment = calculateTrendAlignment(trend);
    
    const okEntry = {
      kind: 'trend',
      ok: true,
      status: 200,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      ticker: trend.ticker,
      message: `Authenticated via ${authResult.method}`,
      raw_payload: raw,
      headers,
    } as const;
    audit.add(okEntry);
    await recordWebhookReceipt(okEntry);

    return NextResponse.json({
      success: true,
      trend: {
        ticker: trend.ticker,
        exchange: trend.exchange,
        price: trend.price,
        timestamp: trend.timestamp,
      },
      alignment: {
        score: alignment.alignment_score,
        strength: alignment.strength,
        dominant_trend: alignment.dominant_trend,
        bullish_count: alignment.bullish_count,
        bearish_count: alignment.bearish_count,
        neutral_count: alignment.neutral_count,
        htf_bias: alignment.htf_bias,
        ltf_bias: alignment.ltf_bias,
      },
      storage: {
        ttl_minutes: 60,
        expires_at: Date.now() + 60 * 60 * 1000,
      },
      authentication: {
        method: authResult.method,
        authenticated: true,
      },
      received_at: Date.now(),
    });
  } catch (error) {
    console.error('Error in POST /api/webhooks/trend:', error);

    const errEntry = {
      kind: 'trend',
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

// Block other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit trend data.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit trend data.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit trend data.' },
    { status: 405 }
  );
}