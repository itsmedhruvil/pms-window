'use client';

import { useState } from 'react';
import { Play, CheckCircle2, Truck, AlertTriangle } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { ProjectStatus } from '@/types';
import type { IProject } from '@/types';

const TRANSITIONS: Record<ProjectStatus, { to: ProjectStatus; label: string; icon: React.ReactNode; style: string } | null> = {
  [ProjectStatus.NEW]: {
    to: ProjectStatus.IN_PRODUCTION,
    label: 'Start Production',
    icon: <Play className="w-3.5 h-3.5" />,
    style: 'bg-dark-500 text-white hover:bg-dark-600',
  },
  [ProjectStatus.IN_PRODUCTION]: {
    to: ProjectStatus.COMPLETED,
    label: 'Mark Complete',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    style: 'bg-dark-500 text-white hover:bg-dark-600',
  },
  [ProjectStatus.ON_HOLD]: {
    to: ProjectStatus.IN_PRODUCTION,
    label: 'Resume Production',
    icon: <Play className="w-3.5 h-3.5" />,
    style: 'border border-dark-500 text-dark-500 hover:bg-dark-500 hover:text-white',
  },
  [ProjectStatus.COMPLETED]: {
    to: ProjectStatus.DISPATCHED,
    label: 'Mark Dispatched',
    icon: <Truck className="w-3.5 h-3.5" />,
    style: 'bg-dark-600 text-white hover:bg-dark-600',
  },
  [ProjectStatus.DISPATCHED]: null,
};

interface ProjectStatusControlProps {
  project: IProject;
  hasActiveAlerts: boolean;
  onStatusChange?: (updated: IProject) => void;
}

export function ProjectStatusControl({
  project,
  hasActiveAlerts,
  onStatusChange,
}: ProjectStatusControlProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [note, setNote] = useState('');

  const transition = TRANSITIONS[project.status];

  if (!transition) return null;

  const isBlocked =
    (transition.to === ProjectStatus.IN_PRODUCTION && hasActiveAlerts) ||
    (transition.to === ProjectStatus.COMPLETED && project.completionPercentage < 100);

  const handleTransition = async () => {
    if (isBlocked) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<IProject>(`/api/projects/${project._id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: transition.to, note: note.trim() || undefined }),
    });

    setLoading(false);
    setNoteMode(false);
    setNote('');

    if (!result.success) {
      setError(typeof result.error === 'string' ? result.error : 'Status update failed');
      return;
    }

    if (result.data) onStatusChange?.(result.data);
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-start gap-2 p-2.5 border border-red-200 bg-red-50">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-700 font-mono">{error}</p>
        </div>
      )}

      {isBlocked && (
        <div className="flex items-start gap-2 p-2.5 border border-primary-200 bg-primary-50">
          <AlertTriangle className="w-3.5 h-3.5 text-primary-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-dark-400 font-mono">
            {hasActiveAlerts
              ? 'Resolve all active alerts before resuming production'
              : `${100 - project.completionPercentage}% of tasks remaining — complete all tasks first`}
          </p>
        </div>
      )}

      {noteMode ? (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`Optional note for "${transition.label}"...`}
            rows={2}
            className="w-full text-xs font-mono border border-primary-200 px-2.5 py-2 focus:outline-none focus:border-dark-500 resize-none placeholder:text-primary-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleTransition}
              disabled={loading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide transition-colors flex-1 justify-center',
                transition.style,
                (loading || isBlocked) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {loading ? (
                <span className="inline-block w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                transition.icon
              )}
              {loading ? 'Updating...' : transition.label}
            </button>
            <button
              onClick={() => { setNoteMode(false); setNote(''); }}
              className="px-3 py-1.5 text-[11px] font-mono border border-primary-200 text-dark-400 hover:border-primary-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleTransition}
            disabled={loading || isBlocked}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wide transition-colors',
              transition.style,
              (loading || isBlocked) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? (
              <span className="inline-block w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              transition.icon
            )}
            {loading ? 'Updating...' : transition.label}
          </button>
          <button
            onClick={() => setNoteMode(true)}
            disabled={isBlocked}
            className="text-[10px] font-mono text-primary-400 hover:text-dark-600 disabled:opacity-30 transition-colors"
            title="Add a note to this status change"
          >
            + Note
          </button>
        </div>
      )}
    </div>
  );
}
