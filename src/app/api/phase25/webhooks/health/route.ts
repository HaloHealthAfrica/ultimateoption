/**
 * Phase 2.5 Health Check API
 * 
 * GET endpoint for health monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/phase25/services/service-factory';

const ENGINE_VERSION = '2.5.0';

/**
 * GET /api/phase25/webhooks/health
 * 
 * Basic health check endpoint.
 */
export async function GET(_request: NextRequest) {
  try {
    const factory = ServiceFactory.getInstance();
    // Create orchestrator if it doesn't exist (lazy initialization)
    const orchestrator = factory.getOrchestrator() || factory.createOrchestrator(false);
    
    const isReady = orchestrator.isReady();
    
    return NextResponse.json({
      status: isReady ? 'healthy' : 'degraded',
      engine: 'Phase 2.5 Decision Engine',
      version: ENGINE_VERSION,
      timestamp: Date.now(),
      uptime: process.uptime()
    }, { status: isReady ? 200 : 503 });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      engine: 'Phase 2.5 Decision Engine',
      version: ENGINE_VERSION,
      timestamp: Date.now()
    }, { status: 500 });
  }
}
