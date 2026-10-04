// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Error Boundary
// Catches React rendering errors and displays a graceful fallback UI
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI — receives error and reset callback */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return <DefaultErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

// ── Default Fallback ────────────────────────────────────────────────────────

interface DefaultErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, onReset }) => (
  <div className="error-boundary-fallback animate-fade-in">
    <div className="error-boundary-icon">⚡</div>
    <h2 className="error-boundary-title">Something went wrong</h2>
    <p className="error-boundary-message">{error.message}</p>
    <button
      className="error-boundary-btn"
      onClick={onReset}
    >
      Try Again
    </button>
  </div>
);

// ── Inline Error Display (non-boundary) ─────────────────────────────────────

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
}

export const InlineError: React.FC<InlineErrorProps> = ({ message, onRetry }) => (
  <div className="inline-error animate-fade-in" role="alert">
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '1.1rem' }}>⚠</span>
      <span>{message}</span>
    </div>
    {onRetry && (
      <button className="inline-error-retry" onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);
