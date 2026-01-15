/**
 * Phase 2.5 Metrics API
 * 
 * GET endpoint for system metrics and performance data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/phase25/services/service-factory';

const ENGINE_VERSION = '2.5.0';

/**
 * GET /api/phase25/webhooks/metrics
 * 
 * Returns system metrics and performance data.
 */
export async function GET(request: NextRequest) {
  try {
    const factory = ServiceFactory.getInstance();
    const orchestrator = factory.getOrchestrator();
    
    if (!orchestrator) {
      return NextResponse.json({
        success: false,
        message: 'Decision orchestrator not initialized',
        timestamp: Date.now()
      }, { status: 503 });
    }
    
    // Get metrics report
    const metricsReport = orchestrator.getMetricsReport();
    
    return NextResponse.json({
      success: true,
      ...metricsReport,
      engine: 'Phase 2.5 Decision Engine',
      version: ENGINE_VERSION,
      timestamp: Date.now()
    }, { status: 200 });
    
  } catch (error) {
    console.error('Metrics retrieval failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 });
  }
}
