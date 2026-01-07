'use client';

/**
 * Main Dashboard Page
 * Read-only dashboard for monitoring the options trading platform
 * 
 * Requirements: 14.6
 */

import { useState, useEffect, useCallback } from 'react';
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
 * Fetch dashboard data from APIs
 */
async function fetchDashboardData(): Promise<Partial<DashboardState>> {
  const results: Partial<DashboardState> = {};
  
  try {
    // Fetch current active signals
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
    }
    
    // Fetch decisions (includes latest decision)
    const decisionsRes = await fetch('/api/decisions?limit=1');
    if (decisionsRes.ok) {
      const decisionsData = await decisionsRes.json();
      if (decisionsData.decisions && decisionsData.decisions.length > 0) {
        results.decision = decisionsData.decisions[0];
      }
    }
    
    // Fetch ledger entries
    const ledgerRes = await fetch('/api/ledger?limit=100');
    if (ledgerRes.ok) {
      const ledgerData = await ledgerRes.json();
      results.ledgerEntries = ledgerData.entries || [];
    }
    
    // Fetch metrics
    const metricsRes = await fetch('/api/metrics');
    if (metricsRes.ok) {
      const metricsData = await metricsRes.json();
      results.metrics = metricsData.metrics || null;
    }
    
    // Fetch learning suggestions
    const suggestionsRes = await fetch('/api/learning/suggestions');
    if (suggestionsRes.ok) {
      const suggestionsData = await suggestionsRes.json();
      results.suggestions = suggestionsData.suggestions || [];
    }
    
    results.lastUpdated = Date.now();
    results.error = null;
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
    const data = await fetchDashboardData();
    setState(prev => ({ ...prev, ...data }));
    setIsLoading(false);
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
            {/* Top Row: Signals and Confluence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SignalMonitor 
                signals={state.signals} 
                onRefresh={refreshData}
              />
              <ConfluenceView 
                signals={state.signals}
                confluenceScore={state.confluenceScore}
                direction={state.direction}
              />
            </div>
            
            {/* Phase 1B Row: Phase Monitor and Trend Alignment */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PhaseMonitor />
              <TrendAlignment />
            </div>
            
            {/* Decision Breakdown */}
            <DecisionBreakdown result={state.decision} />
          </div>
        )}
        
        {activeTab === 'trades' && (
          <PaperTrades 
            entries={state.ledgerEntries}
            onRefresh={refreshData}
          />
        )}
        
        {activeTab === 'learning' && (
          <LearningInsights
            metrics={state.metrics}
            suggestions={state.suggestions}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'webhooks' && (
          <WebhookMonitor />
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
