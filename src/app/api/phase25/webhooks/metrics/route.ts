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
    // Create orchestrator if it doesn't exist (lazy initialization)
    const orchestrator = factory.getOrchestrator() || factory.createOrchestrator(false);
    
    // Get metrics report
    const metricsReport = orchestrator.getMetricsReport();

    // Calculate paper trading performance metrics from ledger
    let paperPerformance = null;
    try {
      const ledger = await getGlobalLedger();
      const limit = parseInt(process.env.PHASE25_METRICS_LIMIT || '500', 10);
      // Fetch only EXECUTE decisions for performance metrics
      const entries = await ledger.query({ 
        limit: Number.isFinite(limit) ? limit : 500, 
        offset: 0,
        decision: 'EXECUTE'
      });
      
      // Filter to only entries with valid exit data
      const validEntries = entries.filter(e => e.exit && e.exit.pnl_net !== undefined);
      
      const metricsByDte = getMetricsByDTEBucket(validEntries);
      
      paperPerformance = {
        overall: calculateMetrics(validEntries),
        rolling: getRollingMetrics(validEntries),
        by_dte_bucket: Object.fromEntries(metricsByDte),
        streaks: calculateStreakStats(validEntries),
        sample_size: validEntries.length
      };
    } catch (ledgerError) {
      console.error('Failed to calculate paper performance:', ledgerError);
      // Continue without paper performance data
      paperPerformance = {
        overall: null,
        rolling: null,
        by_dte_bucket: {},
        streaks: null,
        sample_size: 0,
        error: ledgerError instanceof Error ? ledgerError.message : 'Unknown error'
      };
    }
    
    return NextResponse.json({
      success: true,
      ...metricsReport,
      paper_performance: paperPerformance,
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
