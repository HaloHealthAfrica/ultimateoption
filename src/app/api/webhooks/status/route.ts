/**
 * Webhook Status API
 * 
 * Shows recent webhook attempts with detailed error information
 */

import { NextRequest, NextResponse } from 'next/server';
import { listWebhookReceipts } from '@/webhooks/auditDb';

export async function GET(request: NextRequest) {
  try {
    const receipts = await listWebhookReceipts(20);
    
    if (!receipts) {
      return NextResponse.json({
        error: 'Database not configured',
        message: 'DATABASE_URL environment variable not set',
      });
    }
    
    // Group by success/failure
    const successful = receipts.filter(r => r.ok);
    const failed = receipts.filter(r => !r.ok);
    
    // Recent activity summary
    const last24h = receipts.filter(r => r.received_at > Date.now() - 24 * 60 * 60 * 1000);
    const lastHour = receipts.filter(r => r.received_at > Date.now() - 60 * 60 * 1000);
    
    return NextResponse.json({
      summary: {
        total_attempts: receipts.length,
        successful: successful.length,
        failed: failed.length,
        last_24h: last24h.length,
        last_hour: lastHour.length,
        last_attempt: receipts[0]?.received_at_formatted || 'None',
      },
      recent_failures: failed.slice(0, 10).map(r => ({
        time: r.received_at_formatted,
        kind: r.kind,
        status: r.status,
        message: r.message,
        ip: r.ip,
        ticker: r.ticker,
        symbol: r.symbol,
        timeframe: r.timeframe,
      })),
      recent_successes: successful.slice(0, 5).map(r => ({
        time: r.received_at_formatted,
        kind: r.kind,
        ticker: r.ticker,
        symbol: r.symbol,
        timeframe: r.timeframe,
      })),
      troubleshooting: {
        common_issues: [
          "Invalid JSON format - check TradingView alert message syntax",
          "Missing required fields - ensure all schema fields are present",
          "Authentication failure - check webhook URL includes ?key=YOUR_SECRET",
          "Wrong endpoint - signals vs saty-phase vs trend",
        ],
        debug_steps: [
          "1. Use /api/webhooks/debug endpoint to see raw data",
          "2. Check webhook URL includes authentication key",
          "3. Validate JSON format matches expected schema",
          "4. Test with curl to verify endpoint works",
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching webhook status:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}