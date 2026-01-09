'use client';

/**
 * Main Dashboard Page
 * Read-only dashboard for monitoring the options trading platform
 * 
 * Requirements: 14.6
 */

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { SignalMonitor } from '@/ui/components/SignalMonitor';
import { ConfluenceView } from '@/ui/components/ConfluenceView';
import { DecisionBreakdown } from '@/ui/components/DecisionBreakdown';
import { PaperTrades } from '@/ui/components/PaperTrades';
import { LearningInsights } from '@/ui/components/LearningInsights';
import PhaseMonitor from '@/components/dashboard/PhaseMonitor';
import TrendAlignment from '@/components/dashboard/TrendAlignment';
import WebhookMonitor from '@/components/dashboard/WebhookMonitor';
import { StoredSignal } from '@/webhooks/timeframeStore';
import { DecisionResult } from '@/types/decision';
import { LedgerEntry } from '@/types/ledger';
import { Metrics } from '@/learning/metricsEngine';
import { LearningSuggestion } from '@/learning/learningAdvisor';
import { SignalType } from '@/types/signal';

/**
 * Error Boundary Component for individual dashboard cells
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

function ErrorBoundary({ children, fallback, componentName = 'Component' }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      setHasError(true);
      setError(new Error(error.message));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setHasError(true);
      setError(new Error(event.reason));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (hasError) {
    return fallback || (
      <div className="bg-gray-900 rounded-xl p-6 border border-red-500/50">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-red-400">⚠️</span>
          <h3 className="text-lg font-bold text-red-400">{componentName} Error</h3>
        </div>
        <div className="text-gray-400 text-sm mb-3">
          {error?.message || 'An unexpected error occurred'}
        </div>
        <button
          onClick={() => {
            setHasError(false);
            setError(null);
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Safe Component Wrapper
 */
function SafeComponent({ 
  children, 
  componentName, 
  fallback 
}: { 
  children: ReactNode; 
  componentName: string;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary componentName={componentName} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ 
  title, 
  description, 
  action 
}: { 
  title: string; 
  description: string; 
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-8 text-center">
      <div className="text-gray-500 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Dashboard state interface
interface DashboardState {
  signals: Map<string, StoredSignal>;
  decision: DecisionResult | null;
  ledgerEntries: LedgerEntry[];
  metrics: Metrics | null;
  suggestions: LearningSuggestion[];
  confluenceScore: number;
  direction: SignalType | null;
  lastUpdated: number;
  error: string | null;
}

// Initial state
const initialState: DashboardState = {
  signals: new Map(),
  decision: null,
  ledgerEntries: [],
  metrics: null,
  suggestions: [],
  confluenceScore: 0,
  direction: null,
  lastUpdated: Date.now(),
  error: null,
};

interface SignalItem {
  timeframe: string;
  signal: StoredSignal['signal'];
  received_at: number;
  expires_at: number;
  validity_minutes: number;
}

/**
 * Fetch dashboard data from APIs with better error handling
 */
async function fetchDashboardData(): Promise<Partial<DashboardState>> {
  const results: Partial<DashboardState> = {};
  const errors: string[] = [];
  
  try {
    // Fetch current active signals
    try {
      const signalsRes = await fetch('/api/signals/current');
      if (signalsRes.ok) {
        const signalsData = await signalsRes.json();
        if (signalsData.signals) {
          // Convert array back to Map for component compatibility
          const signalsMap = new Map();
          signalsData.signals.forEach((item: SignalItem) => {
            signalsMap.set(item.timeframe, {
              signal: item.signal,
              received_at: item.received_at,
              expires_at: item.expires_at,
              validity_minutes: item.validity_minutes,
            });
          });
          results.signals = signalsMap;
          
          // Calculate confluence score if we have signals
          if (signalsMap.size > 0) {
            // Simple confluence calculation for display
            const weights = { '240': 0.40, '60': 0.25, '30': 0.15, '15': 0.10, '5': 0.07, '3': 0.03 };
            let totalWeight = 0;
            let direction: SignalType | null = null;
            
            for (const [tf, stored] of signalsMap) {
              const weight = weights[tf as keyof typeof weights] || 0;
              if (weight > 0) {
                totalWeight += weight;
                if (!direction) {
                  direction = stored.signal.signal.type;
                }
              }
            }
            
            results.confluenceScore = Math.round(totalWeight * 100);
            results.direction = direction;
          }
        }
      } else {
        errors.push(`Signals API: ${signalsRes.status}`);
      }
    } catch (err) {
      errors.push(`Signals: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // Fetch decisions (includes latest decision)
    try {
      const decisionsRes = await fetch('/api/decisions?limit=1');
      if (decisionsRes.ok) {
        const decisionsData = await decisionsRes.json();
        if (decisionsData.decisions && decisionsData.decisions.length > 0) {
          results.decision = decisionsData.decisions[0];
        }
      } else {
        errors.push(`Decisions API: ${decisionsRes.status}`);
      }
    } catch (err) {
      errors.push(`Decisions: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // Fetch ledger entries
    try {
      const ledgerRes = await fetch('/api/ledger?limit=100');
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        results.ledgerEntries = ledgerData.entries || [];
      } else {
        errors.push(`Ledger API: ${ledgerRes.status}`);
      }
    } catch (err) {
      errors.push(`Ledger: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // Fetch metrics
    try {
      const metricsRes = await fetch('/api/metrics');
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        results.metrics = metricsData.metrics || null;
      } else {
        errors.push(`Metrics API: ${metricsRes.status}`);
      }
    } catch (err) {
      errors.push(`Metrics: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // Fetch learning suggestions
    try {
      const suggestionsRes = await fetch('/api/learning/suggestions');
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        results.suggestions = suggestionsData.suggestions || [];
      } else {
        errors.push(`Learning API: ${suggestionsRes.status}`);
      }
    } catch (err) {
      errors.push(`Learning: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    results.lastUpdated = Date.now();
    results.error = errors.length > 0 ? `API Errors: ${errors.join(', ')}` : null;
  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Failed to fetch data';
  }
  
  return results;
}

/**
 * Main Dashboard Component
 */
export default function Dashboard() {
  const [state, setState] = useState<DashboardState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'learning' | 'webhooks'>('overview');
  
  // Refresh data
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDashboardData();
      setState(prev => ({ ...prev, ...data }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to refresh data',
        lastUpdated: Date.now()
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Initial load and periodic refresh
  useEffect(() => {
    refreshData();
    
    // Refresh every 5 seconds for real-time updates
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);
  
  // Format last updated time
  const formatLastUpdated = () => {
    const seconds = Math.floor((Date.now() - state.lastUpdated) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };
  
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Options Trading Platform</h1>
              <p className="text-gray-400 text-sm">Paper Trading Dashboard (Read-Only)</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-gray-400 text-sm">Loading...</span>
                </div>
              )}
              
              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${state.error ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-gray-400 text-sm">
                  {state.error ? 'Error' : 'Connected'}
                </span>
              </div>
              
              {/* Last Updated */}
              <span className="text-gray-500 text-sm">
                Updated {formatLastUpdated()}
              </span>
              
              {/* Refresh Button */}
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
              
              {/* Testing Link */}
              <a
                href="/testing"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Testing →
              </a>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex gap-1 mt-4">
            {(['overview', 'trades', 'learning', 'webhooks'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {/* Add indicators for data availability */}
                {tab === 'overview' && state.signals.size > 0 && (
                  <span className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block" />
                )}
                {tab === 'trades' && state.ledgerEntries.length > 0 && (
                  <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full inline-block" />
                )}
                {tab === 'learning' && (state.metrics || state.suggestions.length > 0) && (
                  <span className="ml-2 w-2 h-2 bg-purple-500 rounded-full inline-block" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>
      
      {/* Error Banner */}
      {state.error && (
        <div className="bg-red-500/20 border-b border-red-500/50 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <span className="text-red-400">⚠️</span>
            <span className="text-red-400">{state.error}</span>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Show empty state if no signals and no decision */}
            {state.signals.size === 0 && !state.decision && !isLoading && (
              <EmptyState
                title="No Trading Data Available"
                description="Waiting for TradingView signals and decision engine data. Make sure your webhooks are configured and sending data."
                action={{
                  label: "Refresh Data",
                  onClick: refreshData
                }}
              />
            )}
            
            {/* Show dashboard when we have data or are loading */}
            {(state.signals.size > 0 || state.decision || isLoading) && (
              <>
                {/* Top Row: Signals and Confluence */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SafeComponent componentName="Signal Monitor">
                    <SignalMonitor 
                      signals={state.signals} 
                      onRefresh={refreshData}
                    />
                  </SafeComponent>
                  <SafeComponent componentName="Confluence View">
                    <ConfluenceView 
                      signals={state.signals}
                      confluenceScore={state.confluenceScore}
                      direction={state.direction}
                    />
                  </SafeComponent>
                </div>
                
                {/* Phase 1B Row: Phase Monitor and Trend Alignment */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SafeComponent componentName="Phase Monitor">
                    <PhaseMonitor />
                  </SafeComponent>
                  <SafeComponent componentName="Trend Alignment">
                    <TrendAlignment />
                  </SafeComponent>
                </div>
                
                {/* Decision Breakdown */}
                <SafeComponent componentName="Decision Breakdown">
                  <DecisionBreakdown result={state.decision} />
                </SafeComponent>
              </>
            )}
          </div>
        )}
        
        {activeTab === 'trades' && (
          <SafeComponent componentName="Paper Trades">
            <PaperTrades 
              entries={state.ledgerEntries}
              onRefresh={refreshData}
            />
          </SafeComponent>
        )}
        
        {activeTab === 'learning' && (
          <SafeComponent componentName="Learning Insights">
            <LearningInsights
              metrics={state.metrics}
              suggestions={state.suggestions}
              onRefresh={refreshData}
            />
          </SafeComponent>
        )}

        {activeTab === 'webhooks' && (
          <SafeComponent componentName="Webhook Monitor">
            <WebhookMonitor />
          </SafeComponent>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              Paper Trading Only • No Real Money • No Live Execution
            </div>
            <div>
              Engine Version: {state.decision?.engine_version || 'N/A'}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
