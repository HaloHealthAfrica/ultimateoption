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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const limitRaw = searchParams.get('limit') || '50';
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 50;

  const requiredToken = process.env.WEBHOOK_DEBUG_TOKEN;
  if (!requiredToken) {
    return NextResponse.json(
      { error: 'WEBHOOK_DEBUG_TOKEN is not set on the server.' },
      { status: 500 }
    );
  }

  if (token !== requiredToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const log = WebhookAuditLog.getInstance();
  return NextResponse.json({
    success: true,
    count: Math.min(limit, 200),
    entries: log.list(limit),
    retrieved_at: Date.now(),
  });
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}


