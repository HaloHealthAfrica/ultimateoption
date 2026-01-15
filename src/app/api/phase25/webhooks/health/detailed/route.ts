/**
 * Phase 2.5 Detailed Health Check API
 * 
 * GET endpoint for detailed health monitoring with metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/phase25/services/service-factory';

const ENGINE_VERSION = '2.5.0';

/**
 * GET /api/phase25/webhooks/health/detailed
 * 
 * Detailed health check with system metrics.
 */
export async function GET(request: NextRequest) {
  try {
    const factory = ServiceFactory.getInstance();
    const orchestrator = factory.getOrchestrator();
    
    if (!orchestrator) {
      return NextResponse.json({
        status: 'unhealthy',
        message: 'Decision orchestrator not initialized',
        engine: 'Phase 2.5 Decision Engine',
        version: ENGINE_VERSION,
        timestamp: Date.now()
      }, { status: 503 });
    }
    
    // Get comprehensive health status
    const healthStatus = await orchestrator.getSystemHealthStatus();
    
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json({
      ...healthStatus,
      engine: 'Phase 2.5 Decision Engine',
      version: ENGINE_VERSION,
      uptime: process.uptime()
    }, { status: statusCode });
    
  } catch (error) {
    console.error('Detailed health check failed:', error);
    
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
