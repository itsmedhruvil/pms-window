'use client';

import { MessageCircle } from 'lucide-react';

// TaskDiscussion is deprecated — discussions are now standalone via /discussions page
// Discussions are managed through the Discussion model, not alerts.
export function TaskDiscussion() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <MessageCircle className="w-8 h-8 text-gray-300 mb-3" />
      <p className="text-xs font-mono text-gray-400">
        Discussions have moved to the Discussions page.
      </p>
      <p className="text-[10px] font-mono text-gray-400 mt-1">
        Use <strong>/discussions</strong> to start or browse threads.
      </p>
    </div>
  );
}