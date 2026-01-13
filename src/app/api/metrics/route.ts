/**
 * Metrics API
 * 
 * GET only - no writes allowed.
 * Returns performance metrics with optional filtering.
 * 
 * Requirements: 13.1, 13.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Query parameters schema
const QuerySchema = z.object({
  window: z.enum(['30d', '60d', '90d', 'all']).default('90d'),
  trade_type: z.enum(['SCALP', 'DAY', 'SWING', 'LEAP']).optional(),
  dte_bucket: z.enum(['0DTE', 'WEEKLY', 'MONTHLY', 'LEAP']).optional(),
  quality: z.enum(['EXTREME', 'HIGH', 'MEDIUM']).optional(),
});

/**
 * GET /api/metrics
 * 
 * Query parameters:
 * - window: Time window (30d, 60d, 90d, all)
 * - trade_type: Filter by trade type
 * - dte_bucket: Filter by DTE bucket
 * - quality: Filter by signal quality
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const params = QuerySchema.safeParse({
      window: searchParams.get('window') || '90d',
      trade_type: searchParams.get('trade_type') || undefined,
      dte_bucket: searchParams.get('dte_bucket') || undefined,
      quality: searchParams.get('quality') || undefined,
    });
    
    if (!params.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: params.error.issues },
        { status: 400 }
      );
    }
    
    // TODO: Implement actual metrics calculation when database is connected
    return NextResponse.json({
      status: 'INSUFFICIENT_DATA',
      sample_size: 0,
      required: 30,
      window: params.data.window,
      filters: {
        trade_type: params.data.trade_type,
        dte_bucket: params.data.dte_bucket,
        quality: params.data.quality,
      },
      metrics: null,
    });
  } catch {
    console.error('Error in GET /api/metrics:');
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
