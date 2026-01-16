/**
 * Admin API: Test Ledger
 * 
 * GET /api/admin/test-ledger
 * 
 * Tests the ledger by creating a test entry and reading it back
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { getGlobalLedger } = await import('@/ledger/globalLedger');
    const ledger = await getGlobalLedger();
    
    // Create a test entry
    const testEntry = {
      engine_version: '2.5.0-test',
      signal: {
        signal: {
          type: 'LONG' as const,
          timeframe: '15',
          quality: 'EXTREME' as const,
          ai_score: 9.5,
          timestamp: Date.now(),
          bar_time: new Date().toISOString(),
        },
        instrument: {
          ticker: 'TEST',
          exchange: 'NASDAQ',
          current_price: 100,
        },
      },
      decision: 'SKIP' as const,
      decision_reason: 'Test entry',
      decision_breakdown: {
        final_multiplier: 1.0,
      },
      confluence_score: 50,
      regime: {
        volatility: 'NORMAL' as const,
        trend: 'NEUTRAL' as const,
        liquidity: 'NORMAL' as const,
        iv_rank: 50,
      },
    };
    
    // Try to append
    const created = await ledger.append(testEntry);
    
    // Try to query
    const entries = await ledger.query({ limit: 5 });
    
    return NextResponse.json({
      success: true,
      message: 'Ledger test successful',
      created_id: created.id,
      total_entries: entries.length,
      entries: entries.map(e => ({
        id: e.id,
        decision: e.decision,
        ticker: e.signal?.instrument?.ticker,
        created_at: e.created_at,
      })),
    });
    
  } catch (error) {
    console.error('Ledger test error:', error);
    return NextResponse.json(
      { 
        error: 'Ledger test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
