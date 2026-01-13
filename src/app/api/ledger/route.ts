/**
 * Ledger API
 * 
 * GET only - no writes allowed.
 * Returns ledger entries with filtering and pagination.
 * 
 * Requirements: 13.1, 13.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Query parameters schema
const QuerySchema = z.object({
  timeframe: z.string().optional(),
  quality: z.enum(['EXTREME', 'HIGH', 'MEDIUM']).optional(),
  decision: z.enum(['EXECUTE', 'WAIT', 'SKIP']).optional(),
  dte_bucket: z.enum(['0DTE', 'WEEKLY', 'MONTHLY', 'LEAP']).optional(),
  trade_type: z.enum(['SCALP', 'DAY', 'SWING', 'LEAP']).optional(),
  regime_volatility: z.enum(['LOW', 'NORMAL', 'HIGH', 'EXTREME']).optional(),
  from_date: z.coerce.number().optional(),
  to_date: z.coerce.number().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * GET /api/ledger
 * 
 * Query parameters:
 * - timeframe: Filter by signal timeframe
 * - quality: Filter by signal quality
 * - decision: Filter by decision type
 * - dte_bucket: Filter by DTE bucket
 * - trade_type: Filter by trade type
 * - regime_volatility: Filter by volatility regime
 * - from_date: Filter by start date (timestamp)
 * - to_date: Filter by end date (timestamp)
 * - limit: Max results (default 100, max 1000)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const params = QuerySchema.safeParse({
      timeframe: searchParams.get('timeframe') || undefined,
      quality: searchParams.get('quality') || undefined,
      decision: searchParams.get('decision') || undefined,
      dte_bucket: searchParams.get('dte_bucket') || undefined,
      trade_type: searchParams.get('trade_type') || undefined,
      regime_volatility: searchParams.get('regime_volatility') || undefined,
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
      limit: searchParams.get('limit') || 100,
      offset: searchParams.get('offset') || 0,
    });
    
    if (!params.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: params.error.issues },
        { status: 400 }
      );
    }
    
    // TODO: Implement actual ledger query when database is connected
    return NextResponse.json({
      data: [],
      pagination: {
        limit: params.data.limit,
        offset: params.data.offset,
        total: 0,
      },
      filters: params.data,
    });
  } catch {
    console.error('Error in GET /api/ledger:');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Block all other methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. This API is read-only.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. This API is read-only.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. This API is read-only.' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed. This API is read-only.' },
    { status: 405 }
  );
}
