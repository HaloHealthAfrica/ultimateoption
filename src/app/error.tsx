'use client';

/**
 * Route segment error boundary (App Router)
 * Shows runtime errors instead of a blank page.
 */

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Always log the actual error to the browser console for debugging.
    // eslint-disable-next-line no-console
    console.error('App route error:', error);
  }, [error]);

  return (
    <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        Application error
      </h2>
      <p style={{ marginBottom: 12 }}>
        A runtime error occurred while rendering this page.
      </p>
      <pre
        style={{
          background: '#111',
          color: '#eee',
          padding: 12,
          borderRadius: 8,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {error.message}
        {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        {error.stack ? `\n\nstack:\n${error.stack}` : ''}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: 16,
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #333',
          background: '#1f2937',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}


