/**
 * Debug Webhook Endpoint
 * 
 * Accepts any POST data and logs it for debugging TradingView webhook issues.
 * Use this temporarily to see what TradingView is actually sending.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    
    console.log('=== WEBHOOK DEBUG ===');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    console.log('Raw Body:', raw);
    console.log('Body Length:', raw.length);
    
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
      console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('JSON Parse Error:', e instanceof Error ? e.message : 'Unknown error');
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        headers: Object.fromEntries(request.headers.entries()),
        raw_body: raw,
        body_length: raw.length,
        parsed_json: parsed,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Debug endpoint error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}