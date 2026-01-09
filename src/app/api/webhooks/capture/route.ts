/**
 * Capture Webhook Endpoint
 * 
 * Simple endpoint to capture and log any webhook data for debugging
 */

import { NextRequest, NextResponse } from 'next/server';

type CaptureEntry = {
  id: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  headers: Record<string, string>;
  rawBody: string;
  parsedJson: unknown;
};

// In-memory storage (resets on redeploy/cold start)
let captures: CaptureEntry[] = [];

function isAuthorized(request: NextRequest): boolean {
  const key = process.env.WEBHOOK_CAPTURE_KEY;
  if (!key) return false;

  const qp = request.nextUrl.searchParams.get('key');
  if (qp && qp === key) return true;

  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token === key) return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Keep as null if not valid JSON
    }
    
    const logData = {
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      headers: Object.fromEntries(request.headers.entries()),
      rawBody: raw,
      parsedJson: parsed,
      bodyType: typeof parsed,
      bodyKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : null,
    };

    const entry: CaptureEntry = {
      id: Math.random().toString(36).slice(2, 11),
      timestamp: logData.timestamp,
      ip: logData.ip,
      userAgent: logData.userAgent,
      headers: logData.headers,
      rawBody: logData.rawBody,
      parsedJson: logData.parsedJson,
    };

    captures.unshift(entry);
    if (captures.length > 10) captures = captures.slice(0, 10);
    
    console.log('=== WEBHOOK CAPTURE ===');
    console.log(JSON.stringify(logData, null, 2));
    console.log('=======================');
    
    return NextResponse.json({
      success: true,
      message: 'Webhook captured successfully',
      received: {
        timestamp: logData.timestamp,
        ip: logData.ip,
        bodyType: logData.bodyType,
        bodyKeys: logData.bodyKeys,
        rawLength: raw.length,
      },
    });
  } catch (error) {
    console.error('Capture webhook error:', error);
    return NextResponse.json({
      error: 'Capture error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const keyIsSet = Boolean(process.env.WEBHOOK_CAPTURE_KEY);

  // If a key is configured, require auth to view captures.
  if (keyIsSet && !isAuthorized(request)) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Set ?key=... (or Authorization: Bearer ...) to view captured payloads.',
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    message: 'Webhook capture endpoint ready',
    usage: 'Send POST requests to capture webhook data',
    configured: {
      requires_key_to_view: keyIsSet,
    },
    count: captures.length,
    captures,
  });
}