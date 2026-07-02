'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 border-2 border-primary-200 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-primary-400" />
          </div>
        </div>

        {/* Copy */}
        <div>
          <h1 className="text-lg font-black text-dark-500 mb-2">
            Something went wrong
          </h1>
          <p className="text-xs text-primary-500 font-mono leading-relaxed">
            An unexpected error occurred. The error has been logged.
            {error.digest && (
              <span className="block mt-1 text-primary-400">
                Error ID: {error.digest}
              </span>
            )}
          </p>
        </div>

        {/* Error message (dev only feel) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="border border-red-200 bg-red-50 p-3 text-left">
            <p className="text-[10px] font-mono font-bold text-red-700 uppercase tracking-wide mb-1">
              Dev Error
            </p>
            <p className="text-[11px] font-mono text-red-600 break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase border border-primary-300 text-dark-600 hover:border-dark-500 hover:text-dark-500 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase bg-dark-500 text-white hover:bg-dark-600 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
