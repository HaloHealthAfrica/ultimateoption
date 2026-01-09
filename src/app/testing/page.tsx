'use client';

/**
 * Testing Dashboard Page
 * Quick action buttons, scenario list, and results viewer
 * 
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6
 */

import { useState } from 'react';
import { ALL_SCENARIOS, TestScenario } from '@/testing/scenarios/scenarios';

interface ScenarioRunResult {
  scenarioId: string;
  scenarioName: string;
  success: boolean;
  error?: string;
  failedSteps?: number;
  totalLatency: number;
  steps: {
    stepIndex: number;
    type: string;
    success: boolean;
    durationMs: number;
    status?: number;
    message?: string;
  }[];
}

type ScenarioApiResponse =
  | {
      scenario_id: string;
      scenario_name: string;
      success: boolean;
      failed_steps: number;
      total_duration_ms: number;
      step_results: Array<{
        step_index: number;
        step_type: string;
        description: string;
        success: boolean;
        duration_ms: number;
        webhook_result?: { status: number; error?: string; response?: unknown };
        error?: string;
      }>;
    }
  | { error: string; message?: string; available?: string[] };

/**
 * Scenario Card Component
 */
function ScenarioCard({ scenario, onRun, isRunning, result }: {
  scenario: TestScenario; onRun: () => void; isRunning: boolean; result?: ScenarioRunResult;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-medium">{scenario.name}</h3>
          <p className="text-gray-400 text-sm">{scenario.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`px-2 py-1 rounded text-xs ${result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {result.success ? 'PASSED' : 'FAILED'}
            </span>
          )}
          <button onClick={onRun} disabled={isRunning}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded text-sm">
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500 text-xs">Expected:</span>
        <span className={`px-2 py-0.5 rounded text-xs ${
          scenario.expected_decision === 'EXECUTE' ? 'bg-green-500/20 text-green-400' :
          scenario.expected_decision === 'SKIP' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
        }`}>{scenario.expected_decision}</span>
        <span className="text-gray-500 text-xs">{scenario.steps.length} steps</span>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {scenario.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">{tag}</span>
        ))}
      </div>
      <button onClick={() => setExpanded(!expanded)} className="text-blue-400 text-sm hover:underline">
        {expanded ? 'Hide Details' : 'Show Details'}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          {result?.error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded p-2">
              {result.error}
            </div>
          )}
          {scenario.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 w-6">{i + 1}.</span>
              <span className={`px-2 py-0.5 rounded text-xs ${step.type === 'SIGNAL' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {step.type}
              </span>
              <span className="text-gray-400">
                {step.type === 'SIGNAL' ? `${(step.data as { signal: { type: string; timeframe: string; quality: string } })?.signal?.type} ${(step.data as { signal: { timeframe: string } })?.signal?.timeframe} ${(step.data as { signal: { quality: string } })?.signal?.quality}` : step.description}
              </span>
            </div>
          ))}

          {result?.steps?.length ? (
            <div className="pt-3 mt-3 border-t border-gray-700 space-y-2">
              <div className="text-xs text-gray-500">
                Last run: {result.success ? 'PASSED' : 'FAILED'} • {result.totalLatency}ms • failed steps: {result.failedSteps ?? 0}
              </div>
              {result.steps.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 text-xs bg-gray-900/40 border border-gray-700 rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-6">{s.stepIndex + 1}.</span>
                    <span className={`px-2 py-0.5 rounded ${s.success ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                      {s.type}
                    </span>
                    <span className="text-gray-400">{s.message || ''}</span>
                  </div>
                  <div className="text-gray-500">
                    {typeof s.status === 'number' ? `HTTP ${s.status}` : ''} {s.durationMs}ms
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Testing Dashboard Page Component
 */
export default function TestingPage() {
  const [results, setResults] = useState<Map<string, ScenarioRunResult>>(new Map());
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filteredScenarios = filter === 'all' 
    ? ALL_SCENARIOS 
    : ALL_SCENARIOS.filter(s => s.tags.includes(filter));

  const allTags = Array.from(new Set(ALL_SCENARIOS.flatMap(s => s.tags)));

  const runScenario = async (scenario: TestScenario) => {
    setRunningScenario(scenario.id);
    const start = Date.now();
    
    try {
      const response = await fetch(`/api/testing/scenarios/${scenario.id}`, { method: 'POST' });
      const data = (await response.json()) as ScenarioApiResponse;

      if (!response.ok) {
        const errText =
          'error' in data && data.error
            ? `${data.error}${'message' in data && data.message ? `: ${data.message}` : ''}`
            : `Request failed (${response.status})`;
        setResults(prev => new Map(prev).set(scenario.id, {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          success: false,
          error: errText,
          failedSteps: 0,
          steps: [],
          totalLatency: Date.now() - start,
        }));
        return;
      }
      
      const ok = data as Exclude<ScenarioApiResponse, { error: string }>;
      const mappedSteps = (ok.step_results || []).map((s) => ({
        stepIndex: s.step_index,
        type: s.step_type,
        success: s.success,
        durationMs: s.duration_ms,
        status: s.webhook_result?.status,
        message: s.description || s.error || s.webhook_result?.error,
      }));
      
      setResults(prev => new Map(prev).set(scenario.id, {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        success: ok.success ?? false,
        failedSteps: ok.failed_steps ?? 0,
        steps: mappedSteps,
        totalLatency: Date.now() - start,
      }));
    } catch {
      setResults(prev => new Map(prev).set(scenario.id, {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        success: false,
        error: 'Failed to run scenario (network/client error)',
        failedSteps: 0,
        steps: [],
        totalLatency: Date.now() - start,
      }));
    }
    
    setRunningScenario(null);
  };

  const runAllScenarios = async () => {
    for (const scenario of filteredScenarios) {
      await runScenario(scenario);
    }
  };

  const passedCount = Array.from(results.values()).filter(r => r.success).length;
  const failedCount = Array.from(results.values()).filter(r => !r.success).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Testing Dashboard</h1>
              <p className="text-gray-400 text-sm">Run scenarios and view results</p>
            </div>
            <div className="flex items-center gap-4">
              <a href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                ← Dashboard
              </a>
              <button onClick={runAllScenarios} disabled={runningScenario !== null}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg text-sm">
                Run All
              </button>
            </div>
          </div>
        </div>
      </header>

      {results.size > 0 && (
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <span className="text-gray-400">Results:</span>
            <span className="text-green-400">{passedCount} passed</span>
            <span className="text-red-400">{failedCount} failed</span>
            <span className="text-gray-500">{filteredScenarios.length - results.size} pending</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            All ({ALL_SCENARIOS.length})
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setFilter(tag)}
              className={`px-3 py-1 rounded text-sm ${filter === tag ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {tag}
            </button>
          ))}
        </div>

        <div className="grid gap-4">
          {filteredScenarios.map(scenario => (
            <ScenarioCard key={scenario.id} scenario={scenario} onRun={() => runScenario(scenario)}
              isRunning={runningScenario === scenario.id} result={results.get(scenario.id)} />
          ))}
        </div>
      </main>
    </div>
  );
}
