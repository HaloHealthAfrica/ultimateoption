/**
 * Test Scenarios List API
 * 
 * Lists all available test scenarios.
 * 
 * Requirements: 22.2
 */

import { NextResponse } from 'next/server';
import { ALL_SCENARIOS } from '../../../../testing/scenarios/scenarios';

/**
 * GET /api/testing/scenarios
 * List all available test scenarios
 */
export async function GET() {
  const scenarios = ALL_SCENARIOS.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    expected_decision: s.expected_decision,
    tags: s.tags,
    step_count: s.steps.length,
  }));
  
  return NextResponse.json({
    total: scenarios.length,
    scenarios,
  });
}
