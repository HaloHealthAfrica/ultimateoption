'use client';

import { useState } from 'react';

interface MigrationResult {
  success: boolean;
  message: string;
  details?: string;
  timestamp: number;
}

export default function MigrationPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  const authenticate = () => {
    // Simple password check (you can change this)
    if (password === 'migrate2025' || password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPassword('');
    } else {
      alert('Incorrect password');
    }
  };

  const runMigration = async () => {
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/run-migration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      setResult({
        success: response.ok,
        message: data.message || (response.ok ? 'Migration completed successfully' : 'Migration failed'),
        details: data.details || data.error,
        timestamp: Date.now(),
      });
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to run migration',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    } finally {
      setRunning(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="bg-white/5 rounded-xl border border-white/10 p-8">
            <h1 className="text-2xl font-bold mb-2">Database Migration</h1>
            <p className="text-white/60 mb-6">Enter password to access migration tools</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && authenticate()}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                  placeholder="Enter password"
                  autoFocus
                />
              </div>
              
              <button
                onClick={authenticate}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Authenticate
              </button>
            </div>

            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-200">
              <p className="font-semibold mb-1">Default Password:</p>
              <p className="font-mono">migrate2025</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Database Migration</h1>
          <p className="text-white/60">
            Run database migrations directly from the browser
          </p>
        </div>

        {/* Migration Info */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add gate_results Column</h2>
          
          <div className="space-y-3 text-sm text-white/80 mb-6">
            <p>This migration will:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Check if <code className="px-2 py-1 bg-black/40 rounded">gate_results</code> column exists</li>
              <li>Add <code className="px-2 py-1 bg-black/40 rounded">gate_results JSONB</code> column if missing</li>
              <li>Create GIN index for query performance</li>
              <li>Safe to run multiple times (idempotent)</li>
            </ul>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-200">
              <span className="font-semibold">Note:</span> This connects to your production database using the DATABASE_URL environment variable.
            </p>
          </div>

          <button
            onClick={runMigration}
            disabled={running}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              running
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {running ? 'Running Migration...' : 'Run Migration'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`rounded-xl border p-6 ${
              result.success
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className={`text-3xl ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? '✓' : '✗'}
              </span>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-1">
                  {result.success ? 'Migration Successful' : 'Migration Failed'}
                </h3>
                <p className="text-white/80">{result.message}</p>
              </div>
            </div>

            {result.details && (
              <div className="mt-4 p-4 bg-black/40 rounded-lg">
                <p className="text-sm font-mono text-white/70 whitespace-pre-wrap">
                  {result.details}
                </p>
              </div>
            )}

            <div className="mt-4 text-sm text-white/60">
              Completed at: {new Date(result.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {result?.success && (
          <div className="mt-6 bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold mb-4">Next Steps</h3>
            <ol className="space-y-3 text-sm text-white/80">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-white">1.</span>
                <span>
                  Go to{' '}
                  <a href="/webhook-tester" className="text-blue-400 hover:underline">
                    Webhook Tester
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-white">2.</span>
                <span>Click &quot;🔥 Perfect Setup&quot; preset</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-white">3.</span>
                <span>Click &quot;Send Staggered Test&quot;</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-white">4.</span>
                <span>
                  Check{' '}
                  <a href="/" className="text-blue-400 hover:underline">
                    Phase 2.5 Dashboard
                  </a>{' '}
                  for new decisions with gate results
                </span>
              </li>
            </ol>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 bg-white/5 rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold mb-4">About This Migration</h3>
          <div className="space-y-3 text-sm text-white/70">
            <p>
              The <code className="px-2 py-1 bg-black/40 rounded">gate_results</code> column stores Phase 2.5 gate scores:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Regime gate (30% weight) - Phase alignment and confidence</li>
              <li>Structural gate (10% weight) - Setup quality and risk/reward</li>
              <li>Market gate (15% weight) - Liquidity and execution conditions</li>
            </ul>
            <p className="mt-4">
              Without this column, decisions are calculated but not stored, causing the dashboard to show no data.
            </p>
          </div>
        </div>

        {/* Logout */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setAuthenticated(false)}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
