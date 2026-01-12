/**
 * Debug Authentication Endpoint
 * 
 * GET /api/webhooks/debug-auth?type=signals&key=1234
 * 
 * Tests webhook authentication without processing payload
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateWebhook } from '@/webhooks/security';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as 'signals' | 'saty-phase' | 'trend';
  const testKey = searchParams.get('key');
  
  if (!type || !['signals', 'saty-phase', 'trend'].includes(type)) {
    return NextResponse.json({
      error: 'Invalid type. Use: signals, saty-phase, or trend',
      example: '/api/webhooks/debug-auth?type=signals&key=1234'
    }, { status: 400 });
  }
  
  // Check environment variables
  const envVars = {
    WEBHOOK_SECRET_SIGNALS: process.env.WEBHOOK_SECRET_SIGNALS || 'NOT_SET',
    WEBHOOK_SECRET_SATY_PHASE: process.env.WEBHOOK_SECRET_SATY_PHASE || 'NOT_SET',
    WEBHOOK_SECRET_TREND: process.env.WEBHOOK_SECRET_TREND || 'NOT_SET',
  };
  
  // Test authentication
  const authResult = authenticateWebhook(request, 'test-body', type);
  
  return NextResponse.json({
    success: true,
    debug: {
      type,
      testKey,
      envVars,
      authentication: authResult,
      headers: {
        authorization: request.headers.get('authorization'),
        signature: request.headers.get('x-hub-signature-256'),
        customSignature: request.headers.get('x-signature'),
      },
      queryParams: {
        key: searchParams.get('key'),
        secret: searchParams.get('secret'),
        token: searchParams.get('token'),
      }
    }
  });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as 'signals' | 'saty-phase' | 'trend';
  
  if (!type || !['signals', 'saty-phase', 'trend'].includes(type)) {
    return NextResponse.json({
      error: 'Invalid type. Use: signals, saty-phase, or trend',
      example: '/api/webhooks/debug-auth?type=signals&key=1234'
    }, { status: 400 });
  }
  
  const raw = await request.text();
  
  // Check environment variables
  const envVars = {
    WEBHOOK_SECRET_SIGNALS: process.env.WEBHOOK_SECRET_SIGNALS || 'NOT_SET',
    WEBHOOK_SECRET_SATY_PHASE: process.env.WEBHOOK_SECRET_SATY_PHASE || 'NOT_SET',
    WEBHOOK_SECRET_TREND: process.env.WEBHOOK_SECRET_TREND || 'NOT_SET',
  };
  
  // Test authentication
  const authResult = authenticateWebhook(request, raw, type);
  
  return NextResponse.json({
    success: true,
    debug: {
      type,
      bodyLength: raw.length,
      envVars,
      authentication: authResult,
      headers: {
        authorization: request.headers.get('authorization'),
        signature: request.headers.get('x-hub-signature-256'),
        customSignature: request.headers.get('x-signature'),
        contentType: request.headers.get('content-type'),
      },
      queryParams: {
        key: searchParams.get('key'),
        secret: searchParams.get('secret'),
        token: searchParams.get('token'),
      }
    }
  });
}