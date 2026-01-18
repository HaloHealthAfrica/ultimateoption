'use client';

import { useState, useEffect } from 'react';

interface WebhookTrace {
  id: string;
  timestamp: number;
  kind: string;
  symbol: string;
  status: 'success' | 'error' | 'processing';
  stages: {
    ingestion: StageInfo;
    routing: StageInfo;
    normalization: StageInfo;
    contextUpdate: StageInfo;
    decisionMaking: StageInfo;
    ledgerStorage: StageInfo;
    dashboardDisplay: StageInfo;
  };
  rawPayload?: unknown;
  decision?: unknown;
  errors?: string[];
}

interface StageInfo {
  status: 'pending' | 'success' | 'error' | 'skipped';
  timestamp?: number;
  duration?: number;
  message?: string;
  data?: unknown;
}

export default function WebhookTracker() {
  const [traces, setTraces] = useState<WebhookTrace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<WebhookTrace | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTraces();
    
    if (autoRefresh) {
      const interval = setInterval(fetchTraces, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchTraces() {
    setLoading(true);
    try {
      const response = await fetch('/api/webhooks/traces?limit=20');
      const data = await response.json();
      setTraces(data.traces || []);
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTraces = traces.filter(trace => {
    if (filter === 'all') return true;
    return trace.status === filter;
  });

  function getStageIcon(status: string) {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      case 'skipped': return '⊘';
      default: return '○';
    }
  }

  function getStageColor(status: string) {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      case 'skipped': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  }

  function formatDuration(ms?: number) {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleTimeString();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Webhook Tracker</h2>
          <p className="text-sm text-gray-400">
            Track webhooks from ingestion to dashboard display
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          
          <button
            onClick={fetchTraces}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'success', 'error'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-2 text-xs opacity-75">
                ({traces.filter(t => t.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Traces List */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Recent Webhooks ({filteredTraces.length})
          </h3>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredTraces.map((trace) => (
              <button
                key={trace.id}
                onClick={() => setSelectedTrace(trace)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedTrace?.id === trace.id
                    ? 'bg-blue-900/30 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {trace.status === 'success' ? '✅' : '❌'}
                      </span>
                      <span className="font-medium text-white">
                        {trace.symbol || 'Unknown'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                        {trace.kind}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {formatTimestamp(trace.timestamp)}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-400">
                      {Object.values(trace.stages).filter(s => s.status === 'success').length}/7 stages
                    </div>
                  </div>
                </div>

                {/* Mini progress bar */}
                <div className="flex gap-1 mt-2">
                  {Object.entries(trace.stages).map(([key, stage]) => (
                    <div
                      key={key}
                      className={`h-1 flex-1 rounded ${
                        stage.status === 'success' ? 'bg-green-500' :
                        stage.status === 'error' ? 'bg-red-500' :
                        stage.status === 'pending' ? 'bg-yellow-500' :
                        'bg-gray-600'
                      }`}
                      title={key}
                    />
                  ))}
                </div>
              </button>
            ))}
            
            {filteredTraces.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No webhooks found
              </div>
            )}
          </div>
        </div>

        {/* Detailed View */}
        <div className="bg-gray-800 rounded-lg p-4">
          {selectedTrace ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedTrace.symbol || 'Unknown Symbol'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {selectedTrace.kind} • {formatTimestamp(selectedTrace.timestamp)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedTrace.status === 'success'
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-red-900/30 text-red-400'
                }`}>
                  {selectedTrace.status}
                </span>
              </div>

              {/* Pipeline Stages */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Pipeline Stages</h4>
                
                {Object.entries(selectedTrace.stages).map(([stageName, stage], index) => (
                  <div key={stageName} className="relative">
                    {index > 0 && (
                      <div className="absolute left-3 -top-3 w-0.5 h-3 bg-gray-700" />
                    )}
                    
                    <div className={`flex items-start gap-3 p-3 rounded-lg ${
                      stage.status === 'error' ? 'bg-red-900/20' :
                      stage.status === 'success' ? 'bg-green-900/10' :
                      'bg-gray-900/50'
                    }`}>
                      <span className="text-xl">{getStageIcon(stage.status)}</span>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${getStageColor(stage.status)}`}>
                            {stageName.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          {stage.duration && (
                            <span className="text-xs text-gray-500">
                              {formatDuration(stage.duration)}
                            </span>
                          )}
                        </div>
                        
                        {stage.message && (
                          <p className="text-sm text-gray-400 mt-1">
                            {stage.message}
                          </p>
                        )}
                        
                        {stage.data && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">
                              View data
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-950 p-2 rounded overflow-x-auto">
                              {JSON.stringify(stage.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Errors */}
              {selectedTrace.errors && selectedTrace.errors.length > 0 && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2">Errors</h4>
                  <ul className="space-y-1">
                    {selectedTrace.errors.map((error, i) => (
                      <li key={i} className="text-sm text-red-300">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Decision Output */}
              {selectedTrace.decision && (
                <details className="bg-gray-900 rounded-lg p-4">
                  <summary className="text-sm font-medium text-gray-300 cursor-pointer">
                    Decision Output
                  </summary>
                  <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">
                    {JSON.stringify(selectedTrace.decision, null, 2)}
                  </pre>
                </details>
              )}

              {/* Raw Payload */}
              {selectedTrace.rawPayload && (
                <details className="bg-gray-900 rounded-lg p-4">
                  <summary className="text-sm font-medium text-gray-300 cursor-pointer">
                    Raw Webhook Payload
                  </summary>
                  <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">
                    {JSON.stringify(selectedTrace.rawPayload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a webhook to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
