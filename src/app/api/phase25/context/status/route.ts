/**
 * Phase 2.5 Context Status API
 *
 * Returns completeness status and latest persisted context snapshot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/phase25/services/service-factory';
import { getLatestPhase25ContextSnapshot } from '@/phase25/utils/contextDb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;

    const factory = ServiceFactory.getInstance();
    const orchestrator = factory.getOrchestrator() || factory.createOrchestrator(false);
    const status = orchestrator.getContextStatus();
    const snapshot = await getLatestPhase25ContextSnapshot(symbol);

    return NextResponse.json({
      status,
      snapshot,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error in GET /api/phase25/context/status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
