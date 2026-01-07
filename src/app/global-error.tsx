'use client';

/**
 * Global app error boundary (covers errors outside specific segments).
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          Global application error
        </h2>
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
      </body>
    </html>
  );
}



