/**
 * Webhook Validation Endpoint
 * 
 * POST endpoint for validating webhook payloads without processing them.
 * Helps users test their webhook configurations before sending to production.
 * 
 * Priority 6: Webhook Validation Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectWebhookType, getDetectionSummary } from '@/webhooks/endpointDetector';
import { adaptFlexibleSignal } from '@/webhooks/signalAdapter';
import { parseAndAdaptSaty } from '@/webhooks/satyAdapter';
import { parseAndAdaptTrend } from '@/webhooks/trendAdapter';

/**
 * POST /api/webhooks/validate
 * 
 * Validates webhook payload without processing or storing it.
 * Returns detailed validation results with helpful feedback.
 * 
 * No authentication required - this is a testing/validation endpoint.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let rawBody = '';
  
  try {
    // Get raw body
    rawBody = await request.text();
    let body: unknown;
    
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({
        valid: false,
        error: 'Invalid JSON',
        message: 'Payload must be valid JSON',
        hint: 'Check that your JSON is properly formatted',
        received: rawBody.substring(0, 200) + (rawBody.length > 200 ? '...' : ''),
      }, { status: 400 });
    }
    
    // Validate Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid Content-Type',
        message: 'Content-Type must be application/json',
        received_content_type: contentType,
        hint: 'Set Content-Type header to application/json',
      }, { status: 400 });
    }
    
    // Validate JSON body exists
    if (!body || typeof body !== 'object') {
      return NextResponse.json({
        valid: false,
        error: 'Invalid payload',
        message: 'Request body must be a valid JSON object',
        received_type: typeof body,
      }, { status: 400 });
    }

    // Step 1: Detect webhook type
    const detection = detectWebhookType(body);
    const detectionSummary = getDetectionSummary(detection);

    // Step 2: Validate using appropriate adapter
    let validationResult: {
      valid: boolean;
      adapter: string;
      error?: string;
      details?: unknown;
      adaptations?: string[];
      data?: unknown;
    };

    if (detection.type === 'signals') {
      const adapterResult = adaptFlexibleSignal(body);
      
      if (adapterResult.success) {
        validationResult = {
          valid: true,
          adapter: 'signalAdapter',
          adaptations: adapterResult.adaptations,
          data: adapterResult.data,
        };
      } else {
        validationResult = {
          valid: false,
          adapter: 'signalAdapter',
          error: adapterResult.error,
        };
      }
    } else if (detection.type === 'saty-phase') {
      const adapterResult = parseAndAdaptSaty(body);
      
      if (adapterResult.success) {
        validationResult = {
          valid: true,
          adapter: 'satyAdapter',
          adaptations: adapterResult.adaptations,
          data: adapterResult.data,
        };
      } else {
        validationResult = {
          valid: false,
          adapter: 'satyAdapter',
          error: adapterResult.error,
          details: adapterResult.details,
        };
      }
    } else if (detection.type === 'trend') {
      const adapterResult = parseAndAdaptTrend(body);
      
      if (adapterResult.success) {
        validationResult = {
          valid: true,
          adapter: 'trendAdapter',
          data: adapterResult.data,
        };
      } else {
        validationResult = {
          valid: false,
          adapter: 'trendAdapter',
          error: adapterResult.error instanceof Error ? adapterResult.error.message : 'Validation failed',
          details: adapterResult.error,
        };
      }
    } else {
      // Unknown webhook type
      validationResult = {
        valid: false,
        adapter: 'none',
        error: 'Unable to determine webhook type',
        details: {
          confidence: detection.confidence,
          indicators: detection.indicators,
          suggestions: detection.suggestions,
        },
      };
    }

    // Step 3: Build response
    const processingTime = Date.now() - startTime;

    if (validationResult.valid) {
      return NextResponse.json({
        valid: true,
        message: 'Webhook payload is valid',
        detection: {
          type: detection.type,
          confidence: detection.confidence,
          correct_endpoint: detection.correctEndpoint,
          indicators: detection.indicators,
          summary: detectionSummary,
        },
        validation: {
          adapter: validationResult.adapter,
          adaptations: validationResult.adaptations,
          success: true,
        },
        next_steps: {
          endpoint: detection.correctEndpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_SECRET_TOKEN (or use HMAC signature)',
          },
          note: 'This validation endpoint does NOT process or store webhooks. Send to the correct endpoint above to process.',
        },
        processing_time_ms: processingTime,
        timestamp: Date.now(),
      }, { status: 200 });
    } else {
      return NextResponse.json({
        valid: false,
        message: 'Webhook payload validation failed',
        detection: {
          type: detection.type,
          confidence: detection.confidence,
          correct_endpoint: detection.correctEndpoint || 'unknown',
          indicators: detection.indicators,
          suggestions: detection.suggestions,
          summary: detectionSummary,
        },
        validation: {
          adapter: validationResult.adapter,
          error: validationResult.error,
          details: validationResult.details,
          success: false,
        },
        help: {
          documentation: 'https://github.com/yourusername/optionstrat/blob/main/WEBHOOK_FORMATS.md',
          hint: 'Check the validation.details for specific missing fields or format issues',
        },
        processing_time_ms: processingTime,
        timestamp: Date.now(),
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in POST /api/webhooks/validate:', error);
    
    return NextResponse.json({
      valid: false,
      error: 'Internal validation error',
      message: error instanceof Error ? error.message : 'Unknown error',
      hint: 'This is likely a server-side issue. Please report this error.',
    }, { status: 500 });
  }
}

/**
 * GET /api/webhooks/validate
 * 
 * Returns information about the validation endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/webhooks/validate',
    method: 'POST',
    description: 'Validates webhook payloads without processing or storing them',
    usage: {
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'Any webhook payload (signals, saty-phase, or trend)',
    },
    features: [
      'Auto-detects webhook type',
      'Validates payload structure',
      'Suggests correct endpoint',
      'Returns detailed error messages',
      'No authentication required',
      'Does NOT process or store webhooks',
    ],
    examples: {
      signals: {
        ticker: 'SPY',
        trend: 'BULLISH',
        score: 8.5,
      },
      saty_phase: {
        symbol: 'SPY',
        timeframe: '15',
        bias: 'BULLISH',
      },
      trend: {
        ticker: 'SPY',
        exchange: 'NASDAQ',
        price: 450.25,
        timeframes: {
          '3m': { dir: 'bullish', chg: true },
          '5m': { dir: 'bullish', chg: false },
        },
      },
    },
    documentation: 'https://github.com/yourusername/optionstrat/blob/main/WEBHOOK_FORMATS.md',
  }, { status: 200 });
}

// Block other methods
export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to validate webhooks or GET for endpoint info.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to validate webhooks or GET for endpoint info.' },
    { status: 405 }
  );
}
