/**
 * Learning Suggestions API
 * 
 * GET only - no writes allowed.
 * Returns learning suggestions with filtering.
 * 
 * Requirements: 13.1, 13.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Query parameters schema
const QuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'all']).default('PENDING'),
  parameter_type: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

/**
 * GET /api/learning/suggestions
 * 
 * Query parameters:
 * - status: Filter by suggestion status (PENDING, APPROVED, REJECTED, all)
 * - parameter_type: Filter by parameter type
 * - limit: Max results (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const params = QuerySchema.safeParse({
      status: searchParams.get('status') || 'PENDING',
      parameter_type: searchParams.get('parameter_type') || undefined,
      limit: searchParams.get('limit') || 50,
    });
    
    if (!params.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: params.error.issues },
        { status: 400 }
      );
    }
    
    // TODO: Implement actual suggestions retrieval when storage is connected
    return NextResponse.json({
      suggestions: [],
      total: 0,
      filters: {
        status: params.data.status,
        parameter_type: params.data.parameter_type,
      },
      summary: {
        pending: 0,
        approved: 0,
        rejected: 0,
      },
    });
  } catch {
    console.error('Error in GET /api/learning/suggestions:');
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
