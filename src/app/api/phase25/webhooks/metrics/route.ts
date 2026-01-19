/**
 * Phase 2.5 Metrics API
 * 
 * GET endpoint for system metrics and performance data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/phase25/services/service-factory';
import { getGlobalLedger } from '@/ledger/globalLedger';
import { calculateMetrics, getRollingMetrics, getMetricsByDTEBucket, calculateStreakStats } from '@/learning/metricsEngine';

const ENGINE_VERSION = '2.5.0';

/**
 * GET /api/phase25/webhooks/metrics
 * 
 * Returns system metrics and performance data.
 */
export async function GET(_request: NextRequest) {
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

    // Calculate paper trading performance metrics from ledger
    const ledger = await getGlobalLedger();
    const limit = parseInt(process.env.PHASE25_METRICS_LIMIT || '500', 10);
    const entries = await ledger.query({ limit: Number.isFinite(limit) ? limit : 500, offset: 0 });
    const metricsByDte = getMetricsByDTEBucket(entries);
    
    return NextResponse.json({
      success: true,
      ...metricsReport,
      paper_performance: {
        overall: calculateMetrics(entries),
        rolling: getRollingMetrics(entries),
        by_dte_bucket: Object.fromEntries(metricsByDte),
        streaks: calculateStreakStats(entries),
        sample_size: entries.length
      },
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
