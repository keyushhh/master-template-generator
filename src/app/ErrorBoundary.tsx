import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors anywhere below it so a single bad slide can't
 *  white-screen the whole app - offers a reload instead of a dead page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          height: '100vh',
          fontFamily: 'var(--font-sans, sans-serif)',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: '#666', maxWidth: 420 }}>
          The app hit an unexpected error while rendering. Your deck is saved automatically as you
          go, so reloading should recover your work.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            height: 40,
            padding: '0 20px',
            fontSize: 13,
            fontWeight: 700,
            background: '#111827',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
