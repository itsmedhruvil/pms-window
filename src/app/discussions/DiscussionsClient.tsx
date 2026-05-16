'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { MessageCircle, ChevronDown, ChevronUp, Send, Loader2, User, ExternalLink, Search } from 'lucide-react';
import { apiFetch, cn, DEPARTMENT_LABELS, DEPARTMENT_ABBR, timeAgo } from '@/lib/utils';
import { AlertType, AlertSeverity, Department, AlertStatus, DEPARTMENT_SEQUENCE } from '@/types';
import type { ReactNode } from 'react';
import type { IAlert, IComment, IUser, IProject, ITask } from '@/types';

interface DiscussionsClientProps {
  currentUser: Partial<IUser>;
}

// ── Module-level components (prevents re-mount on parent re-render) ────────

type SearchableSelectProps<T extends { _id: string }> = {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  loading?: boolean;
  emptyText?: string;
  disabled?: boolean;
  getSearchText: (item: T) => string;
  renderItem: (item: T) => ReactNode;
};

function SearchableSelect<T extends { _id: string }>({
  items,
  value,
  onChange,
  placeholder,
  loading,
  emptyText,
  disabled,
  getSearchText,
  renderItem,
}: SearchableSelectProps<T>) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((item) => item._id === value);
  const visibleSearch = selectedItem && !showDropdown ? getSearchText(selectedItem) : search;
  const filteredItems = items.filter((item) =>
    getSearchText(item).toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={visibleSearch}
          onChange={(e) => {
            setSearch(e.target.value);
            if (value) onChange('');
            if (!showDropdown) setShowDropdown(true);
          }}
          onFocus={() => {
            setSearch('');
            setShowDropdown(true);
          }}
          placeholder={loading ? 'Loading...' : placeholder}
          disabled={disabled || loading}
          className="w-full pl-8 pr-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setSearch('');
              setShowDropdown(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-4 text-center text-[10px] font-mono text-gray-400">
              {emptyText || 'No results'}
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => {
                  onChange(item._id);
                  setSearch('');
                  setShowDropdown(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-0 transition-colors',
                  value === item._id ? 'bg-gray-100 font-bold' : ''
                )}
              >
                {renderItem(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MentionDropdown({
  users,
  onSelect,
}: {
  users: Partial<IUser>[];
  onSelect: (user: Partial<IUser>) => void;
}) {
  if (users.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 shadow-lg z-10 max-h-32 overflow-y-auto">
      {users.map((user) => (
        <button
          key={user._id}
          onClick={() => onSelect(user)}
          className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
        >
          <User className="w-3 h-3 text-gray-400" />
          <span className="font-medium text-gray-900">{user.name}</span>
          <span className="text-gray-400 font-mono text-[9px] uppercase ml-auto">
            {user.department ? DEPARTMENT_LABELS[user.department as Department] : ''}
          </span>
        </button>
      ))}
    </div>
  );
}

function renderContent(content: string) {
  const parts = content.split(/(@\w+\s*\w*)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-blue-600 font-bold">
        {part}
      </span>
    ) : (
      part
    )
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function DiscussionsClient({ currentUser: _currentUser }: DiscussionsClientProps) {
  const [discussions, setDiscussions] = useState<IAlert[]>([]);
  const [comments, setComments] = useState<Record<string, IComment[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedDiscussion, setExpandedDiscussion] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Partial<IUser>[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // New discussion form state
  const [showNewDiscussionForm, setShowNewDiscussionForm] = useState(false);
  const [projects, setProjects] = useState<IProject[]>([]);
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [discussionForm, setDiscussionForm] = useState({
    projectId: '',
    taskId: '',
    severity: AlertSeverity.LOW as AlertSeverity,
    message: '',
    affectedDepartments: [] as Department[],
  });
  const [creatingDiscussion, setCreatingDiscussion] = useState(false);

  // Fetch all discussion-type alerts
  const fetchDiscussions = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<IAlert[]>(`/api/alerts?type=discussion&limit=100`);
    if (result.success && result.data) {
      const items = Array.isArray(result.data) ? result.data : [];
      setDiscussions(items);
      const unresolved = items.find((a: IAlert) => a.status !== AlertStatus.RESOLVED);
      if (unresolved) {
        setExpandedDiscussion(unresolved._id);
      } else if (items.length > 0) {
        setExpandedDiscussion(items[0]._id);
      }
    }
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    const result = await apiFetch<Partial<IUser>[]>('/api/users');
    if (result.success && result.data) {
      setAvailableUsers(result.data);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    const result = await apiFetch<{ items: IProject[] }>('/api/projects?limit=100');
    if (result.success && result.data) {
      setProjects(result.data.items || []);
    }
    setLoadingProjects(false);
  }, []);

  useEffect(() => {
    fetchDiscussions();
    fetchUsers();
  }, [fetchDiscussions, fetchUsers]);

  // Fetch tasks when project changes
  useEffect(() => {
    if (!discussionForm.projectId) {
      setTasks([]);
      return;
    }
    setLoadingTasks(true);
    apiFetch<ITask[]>(`/api/tasks?projectId=${discussionForm.projectId}&limit=200`)
      .then((result) => {
        if (result.success && result.data) {
          const items = Array.isArray(result.data) ? result.data : [];
          setTasks(items);
        }
      })
      .finally(() => setLoadingTasks(false));
  }, [discussionForm.projectId]);

  const fetchComments = useCallback(async (alertId: string) => {
    const result = await apiFetch<{ items: IComment[] }>(`/api/comments?alertId=${alertId}&limit=100`);
    if (result.success && result.data && result.data.items) {
      setComments((prev) => ({ ...prev, [alertId]: result.data!.items }));
    }
  }, []);

  const toggleExpand = (alertId: string) => {
    if (expandedDiscussion === alertId) {
      setExpandedDiscussion(null);
    } else {
      setExpandedDiscussion(alertId);
      if (!comments[alertId]) {
        fetchComments(alertId);
      }
    }
  };

  const handleSendComment = async (alertId: string) => {
    if (!newMessage.trim()) return;
    setSending(true);
    setError(null);

    const result = await apiFetch<IComment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        alertId,
        content: newMessage.trim(),
        mentions: [],
      }),
    });

    if (result.success && result.data) {
      setComments((prev) => ({
        ...prev,
        [alertId]: [...(prev[alertId] || []), result.data!],
      }));
      setNewMessage('');
    } else {
      setError(result.error || 'Failed to send message');
    }

    setSending(false);
  };

  const handleTextareaChange = (val: string, isNew?: boolean) => {
    if (isNew) {
      setDiscussionForm((prev) => ({ ...prev, message: val }));
    } else {
      setNewMessage(val);
    }
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1) {
      const query = val.slice(atIndex + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const insertMention = (user: Partial<IUser>) => {
    if (!user.name) return;
    if (showNewDiscussionForm) {
      const val = discussionForm.message;
      const atIndex = val.lastIndexOf('@');
      setDiscussionForm((prev) => ({ ...prev, message: val.slice(0, atIndex) + `@${user.name} ` }));
    } else {
      const atIndex = newMessage.lastIndexOf('@');
      setNewMessage(newMessage.slice(0, atIndex) + `@${user.name} `);
    }
    setShowMentionDropdown(false);
  };

  const filteredUsers = availableUsers.filter((u) =>
    u.name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const toggleDept = (dept: Department) => {
    setDiscussionForm((prev) => ({
      ...prev,
      affectedDepartments: prev.affectedDepartments.includes(dept)
        ? prev.affectedDepartments.filter((d) => d !== dept)
        : [...prev.affectedDepartments, dept],
    }));
  };

  const handleCreateDiscussion = async () => {
    if (!discussionForm.projectId) {
      setError('Please select a project');
      return;
    }
    if (discussionForm.message.trim().length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }
    if (discussionForm.affectedDepartments.length === 0) {
      setError('Select at least one affected department');
      return;
    }
    setCreatingDiscussion(true);
    setError(null);

    const body: Record<string, unknown> = {
      projectId: discussionForm.projectId,
      type: AlertType.DISCUSSION,
      severity: discussionForm.severity,
      message: discussionForm.message.trim(),
      affectedDepartments: discussionForm.affectedDepartments,
    };
    if (discussionForm.taskId) {
      body.taskId = discussionForm.taskId;
    }

    const result = await apiFetch<IAlert>('/api/alerts', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (result.success && result.data) {
      setDiscussions((prev) => [result.data!, ...prev]);
      setExpandedDiscussion(result.data._id);
      window.dispatchEvent(new CustomEvent('erp-alert-created', { detail: result.data }));
      setDiscussionForm({
        projectId: '',
        taskId: '',
        severity: AlertSeverity.LOW,
        message: '',
        affectedDepartments: [],
      });
      setShowNewDiscussionForm(false);
      fetchComments(result.data._id);
    } else {
      setError(result.error || 'Failed to create discussion');
    }

    setCreatingDiscussion(false);
  };

  const resolveDiscussion = async (alertId: string) => {
    const result = await apiFetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: AlertStatus.RESOLVED }),
    });
    if (result.success) {
      setDiscussions((prev) =>
        prev.map((d) => (d._id === alertId ? { ...d, status: AlertStatus.RESOLVED } : d))
      );
      window.dispatchEvent(new CustomEvent('erp-alert-resolved'));
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900">Discussions</h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              Start or browse task-level discussion threads.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right font-mono">
              <p className="text-2xl font-black text-gray-900">{discussions.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Threads</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowNewDiscussionForm(!showNewDiscussionForm);
                setError(null);
                if (!showNewDiscussionForm) fetchProjects();
              }}
              className={cn(
                'px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide transition-colors',
                showNewDiscussionForm
                  ? 'bg-gray-200 text-gray-600'
                  : 'bg-black text-white hover:bg-gray-800'
              )}
            >
              {showNewDiscussionForm ? 'Cancel' : 'New Thread'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-screen-xl mx-auto space-y-6">
        {error && (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-xs font-mono text-red-700">
            {error}
          </div>
        )}

        {/* New discussion form */}
        {showNewDiscussionForm && (
          <div className="border border-gray-200 bg-blue-50/20">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50/50">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
                Start a New Discussion
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Project selector — searchable */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Project <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  items={projects}
                  value={discussionForm.projectId}
                  onChange={(id) => {
                    setDiscussionForm((prev) => ({ ...prev, projectId: id, taskId: '' }));
                  }}
                  placeholder="Search projects..."
                  loading={loadingProjects}
                  emptyText="No projects found"
                  getSearchText={(p: IProject) => `${p.projectTitle} ${p.clientName}`}
                  renderItem={(p: IProject) => (
                    <>
                      <span className="font-medium text-gray-900 truncate">{p.projectTitle}</span>
                      <span className="text-gray-400 font-mono text-[10px] ml-auto truncate">{p.clientName}</span>
                    </>
                  )}
                />
              </div>

              {/* Task selector — searchable */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Task <span className="text-gray-400 font-normal normal-case">(optional)</span>
                </label>
                <SearchableSelect
                  key={discussionForm.projectId}
                  items={tasks}
                  value={discussionForm.taskId}
                  onChange={(id) => setDiscussionForm((prev) => ({ ...prev, taskId: id }))}
                  placeholder={!discussionForm.projectId ? 'Select a project first' : 'Search tasks...'}
                  disabled={!discussionForm.projectId}
                  loading={loadingTasks}
                  emptyText={discussionForm.projectId ? 'No tasks found' : 'Select a project first'}
                  getSearchText={(t: ITask) => `${t.title} ${t.department}`}
                  renderItem={(t: ITask) => (
                    <>
                      <span className="text-gray-500 font-mono text-[10px] font-bold uppercase w-12 flex-shrink-0">
                        [{DEPARTMENT_ABBR[t.department]}]
                      </span>
                      <span className="text-gray-900 truncate">{t.title}</span>
                    </>
                  )}
                />
              </div>

              {/* Severity */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Severity <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {[AlertSeverity.LOW, AlertSeverity.HIGH, AlertSeverity.CRITICAL].map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setDiscussionForm((prev) => ({ ...prev, severity: sev }))}
                      className={cn(
                        'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border transition-colors',
                        discussionForm.severity === sev
                          ? sev === AlertSeverity.LOW
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : sev === AlertSeverity.CRITICAL
                              ? 'border-red-700 bg-red-600 text-white'
                              : 'border-red-400 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      )}
                    >
                      {sev === AlertSeverity.LOW ? '● Info' : sev === AlertSeverity.HIGH ? '▲ High' : '▲ Critical'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Affected departments */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Affected Departments <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENT_SEQUENCE.map((dept) => {
                    const isSelected = discussionForm.affectedDepartments.includes(dept);
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleDept(dept)}
                        className={cn(
                          'px-2.5 py-1 text-[10px] font-mono border transition-colors',
                          isSelected
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        )}
                      >
                        {DEPARTMENT_LABELS[dept]}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setDiscussionForm((prev) => ({
                        ...prev,
                        affectedDepartments:
                          prev.affectedDepartments.length === DEPARTMENT_SEQUENCE.length
                            ? []
                            : [...DEPARTMENT_SEQUENCE],
                      }))
                    }
                    className="text-[10px] font-mono text-gray-500 hover:text-black underline px-1"
                  >
                    {discussionForm.affectedDepartments.length === DEPARTMENT_SEQUENCE.length
                      ? 'Clear all'
                      : 'All depts'}
                  </button>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Message <span className="text-red-500">*</span>
                  <span className="normal-case font-normal text-gray-400 ml-2">(min 10 chars)</span>
                </label>
                <div className="relative">
                  <textarea
                    value={discussionForm.message}
                    onChange={(e) => handleTextareaChange(e.target.value, true)}
                    placeholder="Describe your discussion topic... Use @name to mention someone"
                    rows={3}
                    className="w-full text-xs font-mono border border-gray-200 px-3 py-2 focus:outline-none focus:border-black transition-colors resize-none placeholder:text-gray-400"
                  />
                  {showMentionDropdown && showNewDiscussionForm && (
                    <MentionDropdown users={filteredUsers} onSelect={insertMention} />
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCreateDiscussion}
                  disabled={creatingDiscussion || discussionForm.message.trim().length < 10 || !discussionForm.projectId || discussionForm.affectedDepartments.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono font-bold bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingDiscussion ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <MessageCircle className="w-3 h-3" />
                  )}
                  Start Discussion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Discussions list */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : discussions.length === 0 ? (
          <div className="border border-dashed border-gray-200 p-12 text-center">
            <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-mono text-gray-400">No discussions yet.</p>
            <p className="text-xs font-mono text-gray-400 mt-1">
              Click &ldquo;New Thread&rdquo; to start one.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {discussions.map((discussion) => {
              const isExpanded = expandedDiscussion === discussion._id;
              const discussionComments = comments[discussion._id] || [];
              const raisedBy = typeof discussion.raisedBy === 'object' ? discussion.raisedBy as Partial<IUser> : null;
              const project = typeof discussion.projectId === 'object' ? discussion.projectId as Partial<IProject> : null;

              return (
                <div key={discussion._id} className="border border-gray-200">
                  <button
                    type="button"
                    onClick={() => toggleExpand(discussion._id)}
                    className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors text-left"
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                      discussion.severity === AlertSeverity.CRITICAL
                        ? 'bg-red-100'
                        : discussion.severity === AlertSeverity.HIGH
                          ? 'bg-orange-100'
                          : 'bg-blue-100'
                    )}>
                      <MessageCircle className={cn(
                        'w-4 h-4',
                        discussion.severity === AlertSeverity.CRITICAL
                          ? 'text-red-600'
                          : discussion.severity === AlertSeverity.HIGH
                            ? 'text-orange-600'
                            : 'text-blue-600'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn(
                          'px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-sm',
                          discussion.severity === AlertSeverity.LOW
                            ? 'bg-blue-100 text-blue-800'
                            : discussion.severity === AlertSeverity.HIGH
                              ? 'bg-red-100 text-red-800'
                              : 'bg-red-600 text-white'
                        )}>
                          {discussion.severity === AlertSeverity.LOW ? 'Info' : discussion.severity === AlertSeverity.HIGH ? 'High' : 'Critical'}
                        </span>
                        <span className={cn(
                          'px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded-sm',
                          discussion.status === AlertStatus.RESOLVED
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        )}>
                          {discussion.status === AlertStatus.RESOLVED ? 'Resolved' : 'Active'}
                        </span>
                        {discussion.affectedDepartments && discussion.affectedDepartments.length > 0 && (
                          <div className="flex items-center gap-1">
                            {discussion.affectedDepartments.map((d) => (
                              <span key={d} className="text-[8px] font-mono px-1 py-0.5 bg-gray-100 text-gray-600 uppercase tracking-wider rounded-sm">
                                {DEPARTMENT_ABBR[d]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {discussion.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-gray-400 flex-wrap">
                        <span>{raisedBy?.name || 'Unknown'}</span>
                        {raisedBy?.department && (
                          <span className="uppercase">{DEPARTMENT_LABELS[raisedBy.department as Department]}</span>
                        )}
                        <span>·</span>
                        <span>{timeAgo(discussion.createdAt)}</span>
                        <span>·</span>
                        <span>{discussionComments.length} replies</span>
                        {discussion.taskId && (
                          <>
                            <span>·</span>
                            <Link
                              href={`/tasks/${typeof discussion.taskId === 'string' ? discussion.taskId : discussion.taskId._id}`}
                              className="inline-flex items-center gap-1 text-gray-600 hover:text-black underline underline-offset-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View Task <ExternalLink className="w-3 h-3" />
                            </Link>
                          </>
                        )}
                        {project?.projectTitle && (
                          <span className="text-gray-400 truncate max-w-[200px]">
                            · {project.projectTitle}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 pt-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded discussion */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/30">
                      <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                        {discussionComments.length === 0 ? (
                          <p className="text-[10px] font-mono text-gray-400 text-center py-4">
                            No replies yet.
                          </p>
                        ) : (
                          discussionComments.map((comment) => {
                            const author = typeof comment.author === 'object' ? comment.author as Partial<IUser> : null;
                            return (
                              <div key={comment._id} className="flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-[9px] text-white font-bold">
                                    {author?.name?.charAt(0).toUpperCase() || '?'}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2 mb-0.5">
                                    <span className="text-[11px] font-bold text-gray-900">
                                      {author?.name || 'Unknown'}
                                    </span>
                                    <span className="text-[9px] font-mono text-gray-400 uppercase">
                                      {author?.department ? DEPARTMENT_LABELS[author.department as Department] : ''}
                                    </span>
                                    <span className="text-[9px] text-gray-400 ml-auto">
                                      {timeAgo(comment.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {renderContent(comment.content)}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Reply input */}
                      <div className="border-t border-gray-200 p-3 bg-white relative">
                        {showMentionDropdown && !showNewDiscussionForm && (
                          <MentionDropdown users={filteredUsers} onSelect={insertMention} />
                        )}
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <textarea
                              value={newMessage}
                              onChange={(e) => handleTextareaChange(e.target.value)}
                              placeholder="Reply... Use @name to mention someone"
                              rows={2}
                              className="w-full text-xs resize-none border border-gray-200 px-3 py-2 focus:outline-none focus:border-black transition-colors placeholder:text-gray-400 font-mono"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.metaKey) handleSendComment(discussion._id);
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleSendComment(discussion._id)}
                              disabled={sending || !newMessage.trim()}
                              className="p-2 bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            {discussion.status !== AlertStatus.RESOLVED && (
                              <button
                                onClick={() => resolveDiscussion(discussion._id)}
                                title="Mark as resolved"
                                className="p-2 text-gray-400 hover:text-green-600 border border-gray-200 hover:border-green-400 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1 font-mono">⌘+Enter to send</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
