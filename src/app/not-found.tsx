import Link from 'next/link';
import { Search, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 border-2 border-primary-200 flex items-center justify-center">
            <Search className="w-7 h-7 text-primary-300" />
          </div>
        </div>

        <div>
          <p className="text-5xl font-black text-primary-100 font-mono mb-3">404</p>
          <h1 className="text-sm font-bold text-dark-500 mb-1">Page not found</h1>
          <p className="text-xs text-primary-500 font-mono">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase bg-dark-500 text-white hover:bg-dark-600 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
