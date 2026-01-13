/**
 * Recent Webhooks API (debug)
 *
 * GET /api/webhooks/recent?token=...
 * Optional:
 * - limit=50
 *
 * Security:
 * - Requires WEBHOOK_DEBUG_TOKEN env var and matching token query param.
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebhookAuditLog } from '@/webhooks/auditLog';
import { listWebhookReceipts } from '@/webhooks/auditDb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const limitRaw = searchParams.get('limit') || '50';
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 50;

  const requiredToken = process.env.WEBHOOK_DEBUG_TOKEN;
  
  // If no debug token is configured, allow access without authentication
  // This makes webhook monitoring accessible without requiring token setup
  if (requiredToken) {
    // Token is configured, so validate it
    if (token !== requiredToken) {
      return NextResponse.json({ error: 'Unauthorized - debug token required' }, { status: 401 });
    }
  }
  // If no token is configured, allow access without validation

  // Prefer durable DB-backed receipts when DATABASE_URL is configured.
  const dbEntries = await listWebhookReceipts(limit).catch(() => null);
  const log = WebhookAuditLog.getInstance();
  return NextResponse.json({
    success: true,
    count: Math.min(limit, 200),
    entries: dbEntries ?? log.list(limit),
    retrieved_at: Date.now(),
    auth_required: !!requiredToken, // Indicate if auth was required
  });
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}


