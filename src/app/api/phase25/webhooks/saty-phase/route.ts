/**
 * Phase 2.5 SATY Phase Webhook API
 * 
 * POST endpoint for receiving SATY phase webhooks.
 * Uses Phase 2.5 decision orchestrator for processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/phase25/services/service-factory';
import { WebhookAuditLog } from '@/webhooks/auditLog';
import { recordWebhookReceipt } from '@/webhooks/auditDb';

const ENGINE_VERSION = '2.5.0';
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500
};

/**
 * POST /api/phase25/webhooks/saty-phase
 * 
 * Receives SATY phase webhooks and processes them through Phase 2.5 decision orchestrator.
 */
export async function POST(request: NextRequest) {
  const _startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Initialize audit logging
  const audit = WebhookAuditLog.getInstance();
  
  // Get orchestrator instance
  const factory = ServiceFactory.getInstance();
  const orchestrator = factory.getOrchestrator() || factory.createOrchestrator(false);
  
  // Capture headers for debugging
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
      
      // Handle text wrapper format (Phase 2 compatibility)
      if (body && typeof body === 'object' && 'text' in body) {
        const textField = (body as Record<string, unknown>).text;
        if (typeof textField === 'string') {
          try {
            body = JSON.parse(textField);
          } catch {
            // If text field isn't valid JSON, keep original body
          }
        }
      }
    } catch {
      const entry = {
        kind: 'saty-phase' as const,
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
        kind: 'saty-phase' as const,
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
        kind: 'saty-phase' as const,
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

    // Process webhook through Phase 2.5 orchestrator
    const result = await orchestrator.processWebhook(body);
    
    // Log webhook receipt
    const auditEntry = {
      kind: 'saty-phase' as const,
      ok: result.success,
      status: result.success ? 200 : 400,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      ticker: result.decision?.inputContext?.instrument?.symbol,
      message: `Phase 2.5: ${result.message} (${requestId})`,
      raw_payload: rawBody,
      headers,
    };
    audit.add(auditEntry);
    await recordWebhookReceipt(auditEntry);

    // Return response
    const statusCode = result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST;
    const response = NextResponse.json({
      ...result,
      engineVersion: ENGINE_VERSION,
      requestId,
      timestamp: Date.now()
    }, { status: statusCode });
    
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Engine-Version', ENGINE_VERSION);
    response.headers.set('X-Service', 'Phase25-Decision-Engine');
    
    return response;

  } catch (error) {
    console.error('SATY phase processing failed:', error);

    // Log error to audit system
    const errorEntry = {
      kind: 'saty-phase' as const,
      ok: false,
      status: 500,
      ip: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      message: error instanceof Error ? error.message : 'Unknown error',
      raw_payload: rawBody,
      headers,
    };
    audit.add(errorEntry);
    await recordWebhookReceipt(errorEntry);

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      engineVersion: ENGINE_VERSION,
      requestId,
      timestamp: Date.now()
    }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}

// Block other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit SATY phase data.' },
    { status: 405 }
  );
}
