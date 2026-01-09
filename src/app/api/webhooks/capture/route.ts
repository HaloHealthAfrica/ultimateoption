/**
 * Capture Webhook Endpoint
 * 
 * Simple endpoint to capture and log any webhook data for debugging
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
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

export async function GET() {
  return NextResponse.json({
    message: 'Webhook capture endpoint ready',
    usage: 'Send POST requests to capture webhook data',
  });
}