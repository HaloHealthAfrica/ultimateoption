/**
 * Webhook Receipts API
 * 
 * GET endpoint for viewing webhook delivery logs.
 * Helps debug TradingView webhook delivery issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listWebhookReceipts } from '@/webhooks/auditDb';

/**
 * GET /api/webhooks/receipts
 * 
 * Returns recent webhook delivery attempts with status codes and error messages.
 * Useful for debugging TradingView webhook delivery issues.
 * 
 * Query parameters:
 * - limit: Number of recent receipts to return (default: 50, max: 200)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    
    const receipts = await listWebhookReceipts(limit);
    
    if (!receipts) {
      return NextResponse.json({
        error: 'Database not configured',
        message: 'DATABASE_URL environment variable not set',
        receipts: [],
      });
    }
    
    // Group by status for quick overview
    const summary = receipts.reduce((acc, receipt) => {
      const key = receipt.ok ? 'success' : 'failed';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return NextResponse.json({
      summary: {
        total: receipts.length,
        success: summary.success || 0,
        failed: summary.failed || 0,
        last_24h: receipts.filter(r => r.received_at > Date.now() - 24 * 60 * 60 * 1000).length,
      },
      receipts: receipts.map(receipt => ({
        ...receipt,
        received_at_formatted: new Date(receipt.received_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching webhook receipts:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}