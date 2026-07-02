'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

export function ErrorFallback({
  error,
  onReset,
  title = 'Something went wrong',
}: {
  error?: Error | null;
  onReset?: () => void;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] border border-red-200 bg-red-50/30 p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
      <h3 className="text-sm font-bold text-dark-500 mb-1">{title}</h3>
      {error?.message && (
        <p className="text-xs text-primary-500 font-mono mb-4 max-w-sm">{error.message}</p>
      )}
      {onReset && (
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold uppercase border border-primary-300 text-dark-600 hover:border-dark-500 hover:text-dark-500 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Try Again
        </button>
      )}
    </div>
  );
}

// Inline error for API failures
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border border-red-200 bg-red-50">
      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
      <span className="text-xs text-red-700 font-mono flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[10px] font-mono font-bold text-red-700 hover:text-red-900 uppercase tracking-wide flex-shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}
