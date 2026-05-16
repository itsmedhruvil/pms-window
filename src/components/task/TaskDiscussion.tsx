'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, AtSign, Link2, User, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { apiFetch, cn, ALERT_TYPE_LABEL, ALERT_SEVERITY_STYLE, DEPARTMENT_LABELS, timeAgo } from '@/lib/utils';
import { AlertType, AlertSeverity, Department, AlertStatus } from '@/types';
import type { IAlert, IComment, IUser, IProject } from '@/types';

interface TaskDiscussionProps {
  taskId: string;
  projectId: string;
  currentUser: Partial<IUser>;
  projectTitle?: string;
}

export function TaskDiscussion({ taskId, projectId, currentUser: _currentUser, projectTitle: _projectTitle }: TaskDiscussionProps) {
  const [discussions, setDiscussions] = useState<IAlert[]>([]);
  const [comments, setComments] = useState<Record<string, IComment[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedDiscussion, setExpandedDiscussion] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<Partial<IUser>[]>([]);
  const [showNewDiscussionForm, setShowNewDiscussionForm] = useState(false);
  const [discussionForm, setDiscussionForm] = useState({ message: '', severity: AlertSeverity.LOW });
  const [creatingDiscussion, setCreatingDiscussion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const newMsgRef = useRef<HTMLTextAreaElement>(null);

  // Fetch discussions (alerts of type DISCUSSION for this task)
  const fetchDiscussions = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<IAlert[]>(`/api/alerts?taskId=${taskId}&type=discussion&limit=50`);
    if (result.success && result.data) {
      const items = Array.isArray(result.data) ? result.data : [];
      setDiscussions(items);
      // Auto-expand the first unresolved discussion, or the first one
      const unresolved = items.find((a: IAlert) => a.status !== AlertStatus.RESOLVED);
      if (unresolved) {
        setExpandedDiscussion(unresolved._id);
      } else if (items.length > 0) {
        setExpandedDiscussion(items[0]._id);
      }
    }
    setLoading(false);
  }, [taskId]);

  // Fetch users for @mentions
  const fetchUsers = useCallback(async () => {
    const result = await apiFetch<Partial<IUser>[]>('/api/users');
    if (result.success && result.data) {
      setAvailableUsers(result.data);
    }
  }, []);

  useEffect(() => {
    fetchDiscussions();
    fetchUsers();
  }, [fetchDiscussions, fetchUsers]);

  // Fetch comments for a discussion
  const fetchComments = useCallback(async (alertId: string) => {
    const result = await apiFetch<{ items: IComment[] }>(`/api/comments?alertId=${alertId}&limit=100`);
    if (result.success && result.data && result.data.items) {
      setComments((prev) => ({ ...prev, [alertId]: result.data!.items }));
    }
  }, []);

  // When expanding a discussion, fetch its comments
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

  // Send a comment in a discussion thread
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
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } else {
      setError(result.error || 'Failed to send message');
    }

    setSending(false);
  };

  // Create a new discussion
  const handleCreateDiscussion = async () => {
    if (discussionForm.message.trim().length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }
    setCreatingDiscussion(true);
    setError(null);

    const result = await apiFetch<IAlert>('/api/alerts', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        taskId,
        type: AlertType.DISCUSSION,
        severity: discussionForm.severity,
        message: discussionForm.message.trim(),
        affectedDepartments: Object.values(Department),
      }),
    });

    if (result.success && result.data) {
      setDiscussions((prev) => [result.data!, ...prev]);
      setExpandedDiscussion(result.data._id);
      setDiscussionForm({ message: '', severity: AlertSeverity.LOW });
      setShowNewDiscussionForm(false);
      // Fetch comments for the new discussion
      fetchComments(result.data._id);
    } else {
      setError(result.error || 'Failed to create discussion');
    }

    setCreatingDiscussion(false);
  };

  // @mention detection
  const handleTextareaChange = (val: string, isNew: boolean = false) => {
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
    const val = showNewDiscussionForm ? discussionForm.message : newMessage;
    const atIndex = val.lastIndexOf('@');
    const newVal = val.slice(0, atIndex) + `@${user.name} `;
    if (showNewDiscussionForm) {
      setDiscussionForm((prev) => ({ ...prev, message: newVal }));
    } else {
      setNewMessage(newVal);
    }
    setShowMentionDropdown(false);
    newMsgRef.current?.focus();
  };

  const filteredUsers = availableUsers.filter((u) =>
    u.name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const resolveDiscussion = async (alertId: string) => {
    const result = await apiFetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: AlertStatus.RESOLVED }),
    });
    if (result.success) {
      setDiscussions((prev) =>
        prev.map((d) => (d._id === alertId ? { ...d, status: AlertStatus.RESOLVED } : d))
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-gray-500" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-gray-500">
            Discussion Threads · {discussions.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNewDiscussionForm(!showNewDiscussionForm);
            setError(null);
          }}
          className={cn(
            'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide transition-colors',
            showNewDiscussionForm
              ? 'bg-gray-200 text-gray-600'
              : 'bg-black text-white hover:bg-gray-800'
          )}
        >
          {showNewDiscussionForm ? 'Cancel' : 'New Thread'}
        </button>
      </div>

      {/* New discussion form */}
      {showNewDiscussionForm && (
        <div className="border-b border-gray-200 bg-blue-50/30 p-4 space-y-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={discussionForm.message}
              onChange={(e) => handleTextareaChange(e.target.value, true)}
              placeholder="Start a discussion... Use @name to mention someone"
              rows={3}
              className="w-full text-xs font-mono border border-gray-200 px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors resize-none placeholder:text-gray-400"
            />
            {showMentionDropdown && showNewDiscussionForm && filteredUsers.length > 0 && (
              <MentionDropdown
                users={filteredUsers}
                onSelect={insertMention}
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500 font-bold">Severity:</span>
              {[AlertSeverity.LOW, AlertSeverity.HIGH, AlertSeverity.CRITICAL].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setDiscussionForm((prev) => ({ ...prev, severity: sev }))}
                  className={cn(
                    'px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider border transition-colors',
                    discussionForm.severity === sev
                      ? sev === AlertSeverity.LOW
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : sev === AlertSeverity.CRITICAL
                          ? 'border-red-700 bg-red-600 text-white'
                          : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  )}
                >
                  {sev === AlertSeverity.LOW ? '● Low' : sev === AlertSeverity.HIGH ? '▲ High' : '▲ Critical'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreateDiscussion}
              disabled={creatingDiscussion || discussionForm.message.trim().length < 10}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creatingDiscussion ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <MessageCircle className="w-3 h-3" />
              )}
              Create Thread
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-[10px] font-mono text-red-600">
          {error}
        </div>
      )}

      {/* Discussions list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : discussions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
            <MessageCircle className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-xs font-mono text-gray-400">No discussions yet.</p>
            <p className="text-[10px] font-mono text-gray-400 mt-1">
              Start a thread to discuss task-related topics with your team.
            </p>
          </div>
        ) : (
          discussions.map((discussion) => {
            const isExpanded = expandedDiscussion === discussion._id;
            const discussionComments = comments[discussion._id] || [];
            const raisedBy = typeof discussion.raisedBy === 'object' ? discussion.raisedBy as Partial<IUser> : null;

            return (
              <div key={discussion._id} className="border-b border-gray-100 last:border-0">
                {/* Discussion header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(discussion._id)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors text-left"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
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
                    <div className="flex items-center gap-2 mb-0.5">
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
                    </div>
                    <p className="text-xs text-gray-900 font-medium line-clamp-2 mt-1">
                      {discussion.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-gray-400">
                      <span>{raisedBy?.name || 'Unknown'}</span>
                      {raisedBy?.department && (
                        <span className="uppercase">{DEPARTMENT_LABELS[raisedBy.department as Department]}</span>
                      )}
                      <span>·</span>
                      <span>{timeAgo(discussion.createdAt)}</span>
                      <span>·</span>
                      <span>{discussionComments.length} replies</span>
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

                {/* Expanded discussion thread */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/30">
                    {/* Comments */}
                    <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                      {discussionComments.length === 0 ? (
                        <p className="text-[10px] font-mono text-gray-400 text-center py-4">
                          No replies yet. Be the first to respond.
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
                                  <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wide">
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
                      <div ref={bottomRef} />
                    </div>

                    {/* Reply input */}
                    <div className="border-t border-gray-200 p-3 bg-white relative">
                      {showMentionDropdown && !showNewDiscussionForm && filteredUsers.length > 0 && (
                        <MentionDropdown
                          users={filteredUsers}
                          onSelect={insertMention}
                        />
                      )}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 relative">
                          <textarea
                            ref={newMsgRef}
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
          })
        )}
      </div>
    </div>
  );
}

// ── Mention dropdown ──────────────────────────────────────────────────────────
function MentionDropdown({
  users,
  onSelect,
}: {
  users: Partial<IUser>[];
  onSelect: (user: Partial<IUser>) => void;
}) {
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

// ── Render content with @mentions highlighted ─────────────────────────────────
function renderContent(content: string) {
  // Highlight @mentions
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