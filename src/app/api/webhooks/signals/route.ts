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

/**
 * POST /api/webhooks/signals
 * 
 * Receives TradingView webhook signals and processes them through Phase 2 decision engine.
 * Validates payload, builds market context, and returns decision output.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Initialize services
  const logger = new Logger();
  const tradierClient = new TradierClient();
  const twelveDataClient = new TwelveDataClient();
  const alpacaClient = new AlpacaClient();
  const marketContextBuilder = new MarketContextBuilder(
    tradierClient,
    twelveDataClient,
    alpacaClient,
    logger
  );
  const decisionEngine = new DecisionEngine();
  
  try {
    // Validate Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const body = await request.json();
    
    // Validate JSON body exists
    if (!body || typeof body !== 'object') {
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
      Date.now() - startTime
    );

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
      url: request.url,
      requestId
    });

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
