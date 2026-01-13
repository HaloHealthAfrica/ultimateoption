/**
 * Phase 2 Signals Webhook API
 * 
 * POST endpoint for receiving TradingView signals.
 * Uses Phase 2 decision engine for processing.
 * 
 * Requirements: 1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { Normalizer } from '@/phase2/services/normalizer';
import { DecisionEngine } from '@/phase2/engine/decision-engine';
import { MarketContextBuilder } from '@/phase2/services/market-context-builder';
import { TradierClient } from '@/phase2/providers/tradier-client';
import { TwelveDataClient } from '@/phase2/providers/twelvedata-client';
import { AlpacaClient } from '@/phase2/providers/alpaca-client';
import { Logger } from '@/phase2/services/logger';
import { ENGINE_VERSION } from '@/phase2/types';
import { HTTP_STATUS } from '@/phase2/constants/gates';
import { WebhookAuditLog } from '@/webhooks/auditLog';
import { recordWebhookReceipt } from '@/webhooks/auditDb';

/**
 * POST /api/webhooks/signals
 * 
 * Receives TradingView webhook signals and processes them through Phase 2 decision engine.
 * Validates payload, builds market context, and returns decision output.
 */
export async function POST(request: NextRequest) {
  const _startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Initialize audit logging
  const audit = WebhookAuditLog.getInstance();
  
  // Initialize services
  const logger = new Logger();
  const tradierClient = new TradierClient(logger);
  const twelveDataClient = new TwelveDataClient(logger);
  const alpacaClient = new AlpacaClient(logger);
  const marketContextBuilder = new MarketContextBuilder(
    logger,
    tradierClient,
    twelveDataClient,
    alpacaClient
  );
  const decisionEngine = new DecisionEngine();
  
  // Capture headers for debugging (excluding sensitive ones)
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (!key.toLowerCase().includes('authorization') && !key.toLowerCase().includes('secret')) {
      headers[key] = value;
    }
  });
  
  let rawBody = '';
  
  try {
    // Get raw body for audit logging
    rawBody = await request.text();
    let body: unknown;
    
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Log parsing failure
      const entry = {
        kind: 'signals' as const,
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Invalid JSON payload',
        raw_payload: rawBody,
        headers,
      };
      audit.add(entry);
      await recordWebhookReceipt(entry);
      
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Validate Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const entry = {
        kind: 'signals' as const,
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Content-Type must be application/json',
        raw_payload: rawBody,
        headers,
      };
      audit.add(entry);
      await recordWebhookReceipt(entry);
      
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    
    // Validate JSON body exists
    if (!body || typeof body !== 'object') {
      const entry = {
        kind: 'signals' as const,
        ok: false,
        status: 400,
        ip: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        message: 'Request body must be valid JSON',
        raw_payload: rawBody,
        headers,
      };
      audit.add(entry);
      await recordWebhookReceipt(entry);
      
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Use normalizer for validation and normalization
    const context = Normalizer.normalizeSignal(body);
    
    logger.info('Signal normalized successfully', {
      requestId,
      symbol: context.indicator.symbol,
      type: context.indicator.signalType,
      aiScore: context.indicator.aiScore
    });

    // Build market context
    const marketResult = await marketContextBuilder.buildMarketContext(context.indicator.symbol);
    const marketContext = marketResult.context;
    
    // Create complete decision context
    const completeContext = {
      ...context,
      market: marketContext
    };

    // Process decision through decision engine
    const decisionOutput = decisionEngine.makeDecision(completeContext);
    
    // Log decision event
    logger.logDecisionEvent(
      completeContext,
      decisionOutput,
      Date.now() - _startTime
    );

    // Log successful webhook receipt
    const successEntry = {
      kind: 'signals' as const,
      ok: true,
      status: 200,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      ticker: context.indicator.symbol,
      message: `Phase 2 decision: ${decisionOutput.decision} (${requestId})`,
      raw_payload: rawBody,
      headers,
    };
    audit.add(successEntry);
    await recordWebhookReceipt(successEntry);

    // Add response headers
    const response = NextResponse.json(decisionOutput, { status: HTTP_STATUS.OK });
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Engine-Version', ENGINE_VERSION);
    response.headers.set('X-Service', 'Phase2-Decision-Engine');
    
    return response;

  } catch (error) {
    logger.logError('Signal processing failed', error as Error, {
      method: request.method,
      path: request.url,
      requestId
    });

    // Log error to audit system
    const errorEntry = {
      kind: 'signals' as const,
      ok: false,
      status: 400,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      message: error instanceof Error ? error.message : 'Unknown error',
      raw_payload: rawBody,
      headers,
    };
    audit.add(errorEntry);
    await recordWebhookReceipt(errorEntry);

    return NextResponse.json({
      error: 'Invalid signal payload',
      type: 'VALIDATION_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: error instanceof Error ? error.message : 'Unknown error',
      engineVersion: ENGINE_VERSION,
      requestId
    }, { status: HTTP_STATUS.BAD_REQUEST });
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
