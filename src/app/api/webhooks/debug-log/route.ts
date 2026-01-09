/**
 * Debug Log Webhook Endpoint
 * 
 * Stores webhook data for debugging and provides retrieval endpoint
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for debug data (will reset on deployment)
let debugLogs: Array<{
  id: string;
  timestamp: string;
  headers: Record<string, string>;
  raw_body: string;
  parsed_json: unknown;
  ip: string;
}> = [];

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Keep as null if not valid JSON
    }
    
    const logEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(request.headers.entries()),
      raw_body: raw,
      parsed_json: parsed,
      ip,
    };
    
    // Keep only last 10 entries
    debugLogs.unshift(logEntry);
    if (debugLogs.length > 10) {
      debugLogs = debugLogs.slice(0, 10);
    }
    
    console.log('=== WEBHOOK DEBUG LOG ===');
    console.log('IP:', ip);
    console.log('Raw Body:', raw);
    console.log('Parsed JSON:', parsed);
    console.log('========================');
    
    return NextResponse.json({
      success: true,
      logged: true,
      id: logEntry.id,
      timestamp: logEntry.timestamp,
    });
  } catch (error) {
    console.error('Debug log error:', error);
    return NextResponse.json({
      error: 'Debug log error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET() {
  return NextResponse.json({
    logs: debugLogs,
    count: debugLogs.length,
  });
}