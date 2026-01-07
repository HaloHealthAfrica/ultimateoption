/**
 * Current Signals API
 * 
 * GET endpoint for retrieving active signals from the timeframe store.
 * Returns all non-expired signals with their validity information.
 * 
 * Requirements: 13.1, 13.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTimeframeStore } from '@/webhooks/timeframeStore';

/**
 * GET /api/signals/current
 * 
 * Returns all active (non-expired) signals from the timeframe store.
 * Optional query parameters:
 * - ticker: Filter by specific ticker symbol
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    
    // Get timeframe store and active signals
    const timeframeStore = getTimeframeStore();
    const activeSignals = timeframeStore.getActiveSignals();
    
    // Convert Map to array and filter by ticker if specified
    const signalsArray = Array.from(activeSignals.entries()).map(([timeframe, stored]) => ({
      timeframe,
      signal: stored.signal,
      received_at: stored.received_at,
      expires_at: stored.expires_at,
      validity_minutes: stored.validity_minutes,
      remaining_ms: stored.expires_at - Date.now(),
    }));
    
    // Filter by ticker if specified
    const filteredSignals = ticker 
      ? signalsArray.filter(s => s.signal.instrument.ticker.toUpperCase() === ticker.toUpperCase())
      : signalsArray;
    
    // Sort by timeframe (descending - 4H first)
    const timeframeOrder = { '240': 6, '60': 5, '30': 4, '15': 3, '5': 2, '3': 1 };
    filteredSignals.sort((a, b) => {
      const aOrder = timeframeOrder[a.timeframe as keyof typeof timeframeOrder] || 0;
      const bOrder = timeframeOrder[b.timeframe as keyof typeof timeframeOrder] || 0;
      return bOrder - aOrder;
    });
    
    return NextResponse.json({
      success: true,
      signals: filteredSignals,
      count: filteredSignals.length,
      total_active: signalsArray.length,
      retrieved_at: Date.now(),
    });
  } catch (error) {
    console.error('Error in GET /api/signals/current:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Block other methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve current signals.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve current signals.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve current signals.' },
    { status: 405 }
  );
}