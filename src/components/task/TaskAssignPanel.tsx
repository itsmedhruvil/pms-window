'use client';

import { useState, useEffect } from 'react';
import { User, X, Check, Search } from 'lucide-react';
import { cn, DEPARTMENT_LABELS, apiFetch } from '@/lib/utils';
import type { ITask, IUser } from '@/types';

interface TaskAssignPanelProps {
  task: ITask;
  onAssigned?: (updatedTask: ITask) => void;
  onClose?: () => void;
}

export function TaskAssignPanel({ task, onAssigned, onClose }: TaskAssignPanelProps) {
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentAssignee = typeof task.assignedUser === 'object' && task.assignedUser !== null
    ? task.assignedUser as IUser
    : null;

  useEffect(() => {
    const fetch = async () => {
      const result = await apiFetch<IUser[]>(
        `/api/users?department=${task.department}`
      );
      if (result.success && result.data) {
        setUsers(result.data);
      }
      setLoading(false);
    };
    fetch();
  }, [task.department]);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const assign = async (userId: string | null) => {
    setAssigning(true);
    setError(null);

    const result = await apiFetch<ITask>(`/api/tasks/${task._id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });

    setAssigning(false);

    if (!result.success) {
      setError(typeof result.error === 'string' ? result.error : 'Assignment failed');
      return;
    }

    if (result.data) {
      onAssigned?.(result.data);
      onClose?.();
    }
  };

  return (
    <div className="bg-white border border-gray-200 shadow-xl w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wide text-gray-700">
            Assign Task
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Department tag */}
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="text-[10px] text-gray-500 font-mono">
          Showing <span className="font-bold text-gray-900">
            {DEPARTMENT_LABELS[task.department]}
          </span> department members
        </p>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 border border-gray-200 px-2 py-1.5">
          <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="flex-1 text-[11px] font-mono focus:outline-none placeholder:text-gray-400"
            autoFocus
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-100">
          <p className="text-[10px] text-red-700 font-mono">{error}</p>
        </div>
      )}

      {/* User list */}
      <div className="max-h-52 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-4 text-center">
            <span className="text-[11px] text-gray-400 font-mono">Loading...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <span className="text-[11px] text-gray-400 font-mono">No users found</span>
          </div>
        ) : (
          <>
            {/* Unassign option */}
            {currentAssignee && (
              <button
                onClick={() => assign(null)}
                disabled={assigning}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors"
              >
                <div className="w-6 h-6 border border-gray-300 flex items-center justify-center flex-shrink-0">
                  <X className="w-3 h-3 text-gray-400" />
                </div>
                <span className="text-[11px] font-mono text-gray-500 italic">
                  Unassign task
                </span>
              </button>
            )}

            {filteredUsers.map((u) => {
              const isAssigned = currentAssignee?._id === u._id;
              return (
                <button
                  key={u._id}
                  onClick={() => assign(u._id)}
                  disabled={assigning || isAssigned}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-gray-100 last:border-0',
                    isAssigned
                      ? 'bg-gray-50 cursor-default'
                      : 'hover:bg-gray-50'
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center flex-shrink-0',
                    isAssigned ? 'bg-black' : 'bg-gray-200'
                  )}>
                    <span className={cn(
                      'text-[10px] font-bold',
                      isAssigned ? 'text-white' : 'text-gray-600'
                    )}>
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono truncate">{u.email}</p>
                  </div>

                  {/* Assigned check */}
                  {isAssigned && <Check className="w-3.5 h-3.5 text-black flex-shrink-0" />}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Footer */}
      {assigning && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] text-gray-500 font-mono">Assigning...</p>
        </div>
      )}
    </div>
  );
}
