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
          <div className="w-16 h-16 border-2 border-gray-200 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-gray-400" />
          </div>
        </div>

        {/* Copy */}
        <div>
          <h1 className="text-lg font-black text-gray-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-xs text-gray-500 font-mono leading-relaxed">
            An unexpected error occurred. The error has been logged.
            {error.digest && (
              <span className="block mt-1 text-gray-400">
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
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase border border-gray-300 text-gray-700 hover:border-black hover:text-black transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
