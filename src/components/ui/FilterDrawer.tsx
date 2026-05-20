'use client';

import { useEffect, useRef } from 'react';
import { Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function FilterDrawer({ open, onClose, title = 'Filters', children }: FilterDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <>
      {/* Trigger button is rendered by parent using MobileFilterButton */}

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer panel — slides from right */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-white border-l border-gray-200 shadow-2xl z-50 transform transition-transform duration-200 lg:hidden',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-700">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-black transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto h-[calc(100%-48px)]">
          {children}
        </div>
      </div>
    </>
  );
}

export function MobileFilterButton({
  onClick,
  activeCount = 0,
}: {
  onClick: () => void;
  activeCount?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors relative"
    >
      <Filter className="w-3 h-3" />
      Filters
      {activeCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black text-white text-[8px] font-bold rounded-full flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}