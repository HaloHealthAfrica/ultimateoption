/**
 * Trend Webhook API
 * 
 * POST endpoint for receiving multi-timeframe trend alignment webhooks.
 * Validates and processes incoming TrendWebhook payloads.
 * 
 * Requirements: 24.1, 24.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeParseTrendWebhook, calculateTrendAlignment } from '@/types/trend';
import { TrendStore } from '@/trend/storage/trendStore';
import { WebhookAuditLog } from '@/webhooks/auditLog';

/**
 * POST /api/webhooks/trend
 * 
 * Receives TradingView webhook with TrendWebhook payload.
 * Payload should be JSON with a "text" field containing stringified trend data.
 */
export async function POST(request: NextRequest) {
  const audit = WebhookAuditLog.getInstance();
  try {
    const body = await request.json();
    
    // Parse and validate the trend data
    const result = safeParseTrendWebhook(body);
    
    if (!result.success) {
      audit.add({
        kind: 'trend',
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Invalid trend payload',
      });
      return NextResponse.json(
        { 
          error: 'Invalid trend payload',
          details: result.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
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
    
    audit.add({
      kind: 'trend',
      ok: true,
      status: 200,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      ticker: trend.ticker,
    });

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
      received_at: Date.now(),
    });
  } catch (error) {
    console.error('Error in POST /api/webhooks/trend:', error);

    audit.add({
      kind: 'trend',
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