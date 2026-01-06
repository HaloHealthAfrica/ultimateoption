/**
 * Test Scenario Execution API
 * 
 * Runs test scenarios by ID.
 * 
 * Requirements: 22.3, 22.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  ALL_SCENARIOS, 
  getScenarioById 
} from '../../../../../testing/scenarios/scenarios';
import { runScenario } from '../../../../../testing/scenarioRunner';

/**
 * POST /api/testing/scenarios/[id]
 * Run a specific test scenario
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scenario = getScenarioById(id);
    
    if (!scenario) {
      return NextResponse.json(
        { 
          error: 'Scenario not found',
          available: ALL_SCENARIOS.map(s => s.id),
        },
        { status: 404 }
      );
    }
    
    // Run the scenario
    const result = await runScenario(scenario, {
      stopOnFailure: false,
      defaultWaitMs: 100,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to run scenario',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/testing/scenarios/[id]
 * Get scenario details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scenario = getScenarioById(id);
    
    if (!scenario) {
      return NextResponse.json(
        { 
          error: 'Scenario not found',
          available: ALL_SCENARIOS.map(s => s.id),
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      expected_decision: scenario.expected_decision,
      tags: scenario.tags,
      step_count: scenario.steps.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get scenario' },
      { status: 500 }
    );
  }
}
