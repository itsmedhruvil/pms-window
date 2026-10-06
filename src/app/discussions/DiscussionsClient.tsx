'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MessageCircle, Send, Loader2, Search, Paperclip, X, Edit3, Trash2,
  Download, CheckCheck, Clock, Plus, ArrowLeft,
} from 'lucide-react';
import { apiFetch, cn, timeAgo } from '@/lib/utils';
import { uploadFilesFast } from '@/lib/fast-upload';
import type { ReactNode } from 'react';
import type { IDiscussion, IComment, IUser, IProject, ICommentAttachment } from '@/types';
import { UserRole } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useDiscussions, useComments } from '@/lib/client-data';

interface ExtendedDiscussion extends IDiscussion {
  unreadCount?: number;
  totalComments?: number;
  lastMessageAt?: string;
  lastReadAt?: string | null;
  lastMessage?: { content: string; authorName: string; createdAt: string | Date } | null;
}

interface DiscussionsClientProps {
  currentUser: Partial<IUser>;
}

// ── Reusable Avatar component ─────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function UserAvatar({ name, size = 'md', className }: { name?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };
  const color = AVATAR_COLORS[hashString(name || '?') % AVATAR_COLORS.length];
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white select-none',
      color,
      sizeClasses[size],
      className
    )}>
      {name?.charAt(0).toUpperCase() || '?'}
    </div>
  );
}

// ── SearchableSelect helper ──────────────────────────────────────────

type SearchableSelectProps<T extends { _id: string }> = {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  loading?: boolean;
  emptyText?: string;
  getSearchText: (item: T) => string;
  renderItem: (item: T) => ReactNode;
};

function SearchableSelect<T extends { _id: string }>({
  items, value, onChange, placeholder, loading, emptyText, getSearchText, renderItem,
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
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary-400 pointer-events-none" />
        <input
          type="text"
          value={visibleSearch}
          onChange={(e) => { setSearch(e.target.value); if (value) onChange(''); if (!showDropdown) setShowDropdown(true); }}
          onFocus={() => { setSearch(''); setShowDropdown(true); }}
          placeholder={loading ? 'Loading...' : placeholder}
          disabled={loading}
          className="w-full pl-8 pr-3 py-2 text-xs font-mono border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors bg-white disabled:bg-primary-50 disabled:cursor-not-allowed"
        />
        {value && (
          <button type="button" onClick={() => { onChange(''); setSearch(''); setShowDropdown(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-400 hover:text-dark-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-primary-200 shadow-lg max-h-48 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-4 text-center text-[10px] font-mono text-primary-400">{emptyText || 'No results'}</div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => { onChange(item._id); setSearch(''); setShowDropdown(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs hover:bg-primary-50 flex items-center gap-2 border-b border-primary-100 last:border-0 transition-colors',
                  value === item._id ? 'bg-primary-100 font-bold' : ''
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

// ── Date divider helper ───────────────────────────────────────────────

function formatMessageTime(date: Date | string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(date: Date | string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  if (startOfDay(d) === startOfDay(today)) return 'Today';
  if (startOfDay(d) === startOfDay(yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Main component ───────────────────────────────────────────────────

export function DiscussionsClient({ currentUser }: DiscussionsClientProps) {
  // ── SWR data ──────────────────────────────────────────────────────
  const { data: discussionsData, isLoading: loadingDiscussions, mutate: mutateDiscussions } = useDiscussions({ limit: '100' });
  const discussions = useMemo<ExtendedDiscussion[]>(
    () => (Array.isArray(discussionsData) ? discussionsData : []),
    [discussionsData]
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeDiscussion = useMemo(
    () => discussions.find((d) => d._id === activeId) || null,
    [discussions, activeId]
  );

  const { data: commentsData, isLoading: loadingComments, mutate: mutateComments } = useComments(
    activeId ? { discussionId: activeId, limit: '100' } : null
  );
  const comments = useMemo<IComment[]>(
    () => (commentsData && Array.isArray(commentsData.items) ? commentsData.items : []),
    [commentsData]
  );

  // ── Local UI state ────────────────────────────────────────────────
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<ICommentAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // New thread form
  const [showNewForm, setShowNewForm] = useState(false);
  const [projects, setProjects] = useState<IProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [newThread, setNewThread] = useState({ projectId: '', title: '', description: '' });
  const [creating, setCreating] = useState(false);

  // Edit thread modal
  const [editThread, setEditThread] = useState<{ _id: string; title: string; description: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation
  const [deleteThread, setDeleteThread] = useState<{ _id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Delete message (single chat bubble) confirmation
  const [deleteMessage, setDeleteMessage] = useState<{ _id: string } | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  // @mention state
  const [availableUsers, setAvailableUsers] = useState<Partial<IUser>[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Mobile: show list or chat
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // ── Data fetching (users + projects) ──────────────────────────────
  const fetchUsers = useCallback(async () => {
    const result = await apiFetch<Partial<IUser>[]>('/api/users');
    if (result.success && result.data) setAvailableUsers(result.data);
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    const result = await apiFetch<{ items: IProject[] }>('/api/projects?limit=100');
    if (result.success && result.data) setProjects(result.data.items || []);
    setLoadingProjects(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Auto-select first discussion once loaded ──────────────────────
  useEffect(() => {
    if (!activeId && discussions.length > 0) {
      setActiveId(discussions[0]._id);
    }
  }, [discussions, activeId]);

  // ── Mark as read when active changes ──────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    const markAsRead = async () => {
      await apiFetch('/api/discussions/read', {
        method: 'POST', body: JSON.stringify({ discussionId: activeId }),
      });
      // Update local unread count + refresh list
      mutateDiscussions();
    };
    markAsRead();
  }, [activeId, mutateDiscussions]);

  // ── Scroll to bottom on new comments ──────────────────────────────
  useEffect(() => {
    if (activeId && comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [activeId, comments.length]);

  // ── Realtime: listen for new comments/discussions ────────────────
  useEffect(() => {
    const handleDataChange = (e: Event) => {
      const detail = (e as CustomEvent<{ entity: string; action: string; data?: unknown }>).detail;
      if (!detail) return;
      if (detail.entity === 'comment' && detail.action === 'added') {
        const comment = detail.data as IComment;
        if (comment?.discussionId === activeId) {
          mutateComments();
        }
        mutateDiscussions();
      }
      if (detail.entity === 'discussion') {
        mutateDiscussions();
      }
    };
    window.addEventListener('app-data-changed', handleDataChange);
    return () => window.removeEventListener('app-data-changed', handleDataChange);
  }, [activeId, mutateComments, mutateDiscussions]);

  // ── File upload ──────────────────────────────────────────────────
  const handleFileUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingFile(true);
    setError(null);
    // Compresses images + uploads in parallel — old loop sent full-size
    // phone photos one-by-one and silently dropped failures.
    const { uploaded, failed } = await uploadFilesFast(files);
    setUploadedFiles((prev) => [...prev, ...uploaded.map((u) => u.attachment)]);
    if (failed.length > 0) {
      setError(
        failed.length === 1
          ? `Upload failed: ${failed[0].message}`
          : `${failed.length} uploads failed: ${failed.map((f) => f.message).join(' ')}`
      );
    }
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => setUploadedFiles((prev) => prev.filter((f) => f.id !== id));

  // ── @mention detection ───────────────────────────────────────────
  const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1) {
      const beforeAt = val.slice(0, atIndex);
      const lastChar = beforeAt.trim().slice(-1);
      if (atIndex === 0 || lastChar === '' || lastChar === '\n' || beforeAt.endsWith(' ')) {
        const query = val.slice(atIndex + 1);
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setShowMentionDropdown(true);
          setMentionStartIndex(atIndex);
          return;
        }
      }
    }
    setShowMentionDropdown(false);
  };

  const insertMention = (user: Partial<IUser>) => {
    if (!user._id || !user.name) return;
    const before = newMessage.slice(0, mentionStartIndex);
    const after = newMessage.slice(mentionStartIndex + 1 + mentionQuery.length);
    setNewMessage(`${before}@${user.name} ${after}`);
    setShowMentionDropdown(false);
    chatInputRef.current?.focus();
  };

  const filteredUsers = availableUsers.filter((u) =>
    u.name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // ── Edit thread ──────────────────────────────────────────────────
  const openEditModal = (discussion: IDiscussion) => {
    setEditThread({ _id: discussion._id, title: discussion.title, description: discussion.description || '' });
    setEditTitle(discussion.title);
    setEditDescription(discussion.description || '');
    setError(null);
  };

  const handleEditSave = async () => {
    if (!editThread || !editTitle.trim()) { setError('Title is required'); return; }
    setSavingEdit(true); setError(null);
    const result = await apiFetch<IDiscussion>(`/api/discussions/${editThread._id}`, {
      method: 'PUT', body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() }),
    });
    if (result.success && result.data) {
      mutateDiscussions();
      setEditThread(null);
    } else setError(result.error || 'Failed to update discussion');
    setSavingEdit(false);
  };

  // ── Delete thread ────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteThread) return;
    setDeleting(true); setError(null);
    const result = await apiFetch(`/api/discussions/${deleteThread._id}`, { method: 'DELETE' });
    if (result.success) {
      if (activeId === deleteThread._id) setActiveId(null);
      setDeleteThread(null);
      mutateDiscussions();
    } else setError(result.error || 'Failed to delete discussion');
    setDeleting(false);
  };

  // ── Delete single message ──────────────────────────────────────────
  const handleDeleteMessageConfirm = async () => {
    if (!deleteMessage) return;
    setDeletingMessage(true); setError(null);
    const result = await apiFetch(`/api/comments/${deleteMessage._id}`, { method: 'DELETE' });
    if (result.success) {
      setDeleteMessage(null);
      mutateComments();
      mutateDiscussions();
    } else setError(result.error || 'Failed to delete message');
    setDeletingMessage(false);
  };

  // ── Send message (optimistic) ────────────────────────────────────
  const handleSend = async () => {
    if (!activeId) return;
    if (!newMessage.trim() && uploadedFiles.length === 0) return;
    setSending(true); setError(null);

    const mentionedIds: string[] = [];
    let contentForMentionParsing = newMessage;
    const sortedUsers = [...availableUsers].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
    for (const u of sortedUsers) {
      if (!u.name || !u._id) continue;
      const escapedName = u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:^|\\s)@${escapedName}(?=\\s|$|[.,!?;:])`, 'i');
      const match = contentForMentionParsing.match(pattern);
      if (match) {
        mentionedIds.push(u._id);
        contentForMentionParsing = contentForMentionParsing.replace(match[0], ' ');
      }
    }

    // Optimistic temp comment
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: IComment = {
      _id: tempId,
      discussionId: activeId,
      content: newMessage.trim(),
      author: currentUser as IUser,
      mentions: mentionedIds,
      attachments: uploadedFiles,
      isSystemLog: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Optimistically add to UI
    mutateComments((current: any) => {
      const items = current?.items ? [...current.items, optimisticComment] : [optimisticComment];
      return { ...current, items, total: (current?.total || 0) + 1 };
    }, { revalidate: false });

    const result = await apiFetch<IComment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        discussionId: activeId,
        content: newMessage.trim(),
        mentions: mentionedIds,
        attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      }),
    });

    if (result.success && result.data) {
      // Replace temp with real comment
      mutateComments((current: any) => {
        const items = (current?.items || []).map((c: IComment) =>
          c._id === tempId ? result.data! : c
        );
        return { ...current, items };
      }, { revalidate: false });
      setNewMessage('');
      setUploadedFiles([]);
      setShowMentionDropdown(false);
      // Refresh list (unread counts, last message)
      mutateDiscussions();
      // Dispatch realtime event for other clients
      window.dispatchEvent(new CustomEvent('app-data-changed', {
        detail: { entity: 'comment', action: 'added', data: result.data },
      }));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    } else {
      // Rollback optimistic comment
      mutateComments((current: any) => {
        const items = (current?.items || []).filter((c: IComment) => c._id !== tempId);
        return { ...current, items };
      }, { revalidate: false });
      setError(result.error || 'Failed to send message');
    }
    setSending(false);
  };

  // ── Create thread ────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newThread.projectId || !newThread.title.trim()) { setError('Project and title are required'); return; }
    setCreating(true); setError(null);
    const result = await apiFetch<IDiscussion>('/api/discussions', {
      method: 'POST',
      body: JSON.stringify({
        projectId: newThread.projectId,
        title: newThread.title.trim(),
        description: newThread.description.trim(),
      }),
    });
    if (result.success && result.data) {
      setNewThread({ projectId: '', title: '', description: '' });
      setShowNewForm(false);
      setActiveId(result.data._id);
      setMobileView('chat');
      mutateDiscussions();
      window.dispatchEvent(new CustomEvent('app-data-changed', {
        detail: { entity: 'discussion', action: 'created', data: result.data },
      }));
    } else setError(result.error || 'Failed to create thread');
    setCreating(false);
  };

  const canModifyDiscussion = (discussion: IDiscussion) => {
    const starter = typeof discussion.startedBy === 'object' ? discussion.startedBy as Partial<IUser> : null;
    return currentUser.role === UserRole.ADMIN
      || currentUser.role === UserRole.SUPER_ADMIN
      || starter?._id === currentUser._id;
  };

  // ── Filtered discussions for search ──────────────────────────────
  const filteredDiscussions = useMemo(() => {
    if (!searchQuery.trim()) return discussions;
    const q = searchQuery.toLowerCase();
    return discussions.filter((d) => {
      const startedBy = typeof d.startedBy === 'object' ? (d.startedBy as Partial<IUser>) : null;
      const project = typeof d.projectId === 'object' ? (d.projectId as Partial<IProject>) : null;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (startedBy?.name || '').toLowerCase().includes(q) ||
        (project?.projectTitle || '').toLowerCase().includes(q)
      );
    });
  }, [discussions, searchQuery]);

  // ── Render helpers ───────────────────────────────────────────────
  const renderThreadList = () => (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-primary-100 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search discussions..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-primary-50 border border-transparent focus:outline-none focus:bg-white focus:border-primary-200 rounded-full transition-all placeholder:text-primary-400"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loadingDiscussions && discussions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-3" />
            <p className="text-xs font-mono text-primary-500">Loading discussions...</p>
          </div>
        ) : filteredDiscussions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <MessageCircle className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-dark-500 mb-1">
              {searchQuery ? 'No matches found' : 'No discussions yet'}
            </p>
            <p className="text-xs font-mono text-primary-400 mb-4">
              {searchQuery ? 'Try a different search' : 'Start a thread to collaborate'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => { setShowNewForm(true); fetchProjects(); }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                New Thread
              </button>
            )}
          </div>
        ) : (
          filteredDiscussions.map((discussion) => {
            const isActive = activeId === discussion._id;
            const startedBy = typeof discussion.startedBy === 'object' ? discussion.startedBy as Partial<IUser> : null;
            const project = typeof discussion.projectId === 'object' ? discussion.projectId as Partial<IProject> : null;
            const unreadCount = discussion.unreadCount || 0;
            // Use each discussion's OWN last message (from the server response),
            // never the shared `comments` array (which only holds the open thread).
            const lastMsg = discussion.lastMessage;
            const previewText = lastMsg
              ? `${lastMsg.authorName || 'Unknown'}: ${lastMsg.content}`
              : (discussion.description || 'No messages yet');

            return (
              <button
                key={discussion._id}
                type="button"
                onClick={() => { setActiveId(discussion._id); setMobileView('chat'); }}
                className={cn(
                  'w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-primary-50',
                  isActive ? 'bg-primary-50' : 'hover:bg-gray-50'
                )}
              >
                <div className="relative flex-shrink-0">
                  <UserAvatar name={startedBy?.name} size="md" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={cn(
                      'text-sm truncate',
                      unreadCount > 0 ? 'font-bold text-dark-500' : 'font-medium text-dark-500'
                    )}>
                      {discussion.title}
                    </h3>
                    <span className="text-[10px] font-mono text-primary-400 flex-shrink-0">
                      {timeAgo(discussion.lastMessageAt || discussion.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={cn(
                      'text-xs truncate flex-1 min-w-0',
                      unreadCount > 0 ? 'text-dark-600 font-medium' : 'text-primary-500'
                    )}>
                      {previewText}
                    </p>
                    {unreadCount > 0 && (
                      <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  {project?.projectTitle && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-medium truncate max-w-[160px]">
                        {project.projectTitle}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const renderChatHeader = () => {
    if (!activeDiscussion) return null;
    const startedBy = typeof activeDiscussion.startedBy === 'object' ? activeDiscussion.startedBy as Partial<IUser> : null;
    const project = typeof activeDiscussion.projectId === 'object' ? activeDiscussion.projectId as Partial<IProject> : null;
    const canModify = canModifyDiscussion(activeDiscussion);

    return (
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-primary-100 bg-white">
        <button
          type="button"
          onClick={() => setMobileView('list')}
          className="lg:hidden p-1.5 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
          aria-label="Back to list"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <UserAvatar name={startedBy?.name} size="md" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-dark-500 truncate">{activeDiscussion.title}</h2>
          <p className="text-[10px] font-mono text-primary-500 truncate">
            {startedBy?.name || 'Unknown'}
            {project?.projectTitle ? ` · ${project.projectTitle}` : ''}
          </p>
        </div>
        {canModify && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEditModal(activeDiscussion)}
              className="p-2 text-primary-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Edit thread"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteThread({ _id: activeDiscussion._id, title: activeDiscussion.title })}
              className="p-2 text-primary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Delete thread"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderChatWindow = () => {
    if (!activeDiscussion) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <MessageCircle className="w-10 h-10 text-blue-300" />
          </div>
          <h3 className="text-base font-bold text-dark-500 mb-1">Select a discussion</h3>
          <p className="text-xs font-mono text-primary-400 max-w-xs">
            Choose a thread from the list to start chatting, or create a new one.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 h-full">
        {renderChatHeader()}

        {/* Messages area — only this scrolls; header + composer stay fixed */}
        <div
          ref={messagesRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1 bg-[#e5ddd5]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        >
          {loadingComments && comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-3" />
              <p className="text-xs font-mono text-primary-500">Loading messages...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center mb-3 shadow-sm">
                <MessageCircle className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-xs font-mono text-primary-500">No messages yet. Say hello!</p>
            </div>
          ) : (
            <>
              {/* Date divider */}
              <div className="flex justify-center my-3">
                <span className="px-3 py-1 text-[10px] font-mono font-bold text-primary-500 bg-white/90 rounded-full shadow-sm">
                  {formatDayLabel(comments[0].createdAt)}
                </span>
              </div>

              {comments.map((msg, idx) => {
                const author = typeof msg.author === 'object' ? msg.author as Partial<IUser> : null;
                const isOwn = author?._id === currentUser._id;
                const isTemp = msg._id.startsWith('temp-');
                const showAvatar = idx === 0 || (
                  comments[idx - 1] && (
                    (typeof comments[idx - 1].author === 'object'
                      ? (comments[idx - 1].author as Partial<IUser>)?._id
                      : null) !== author?._id
                  )
                );
                const showDayDivider = idx > 0 && formatDayLabel(msg.createdAt) !== formatDayLabel(comments[idx - 1].createdAt);

                return (
                  <div key={msg._id}>
                    {showDayDivider && (
                      <div className="flex justify-center my-3">
                        <span className="px-3 py-1 text-[10px] font-mono font-bold text-primary-500 bg-white/90 rounded-full shadow-sm">
                          {formatDayLabel(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={cn(
                      'flex items-end gap-2 group',
                      isOwn ? 'flex-row-reverse' : ''
                    )}>
                      {/* Avatar */}
                      <div className={cn(
                        'flex-shrink-0 transition-opacity',
                        showAvatar ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      )}>
                        <UserAvatar name={author?.name} size="sm" />
                      </div>

                      {/* Message bubble */}
                      <div className={cn(
                        'flex-1 min-w-0 max-w-[75%]',
                        isOwn ? 'flex flex-col items-end' : ''
                      )}>
                        {showAvatar && (
                          <div className={cn(
                            'flex items-center gap-2 mb-0.5 px-1',
                            isOwn ? 'flex-row-reverse' : ''
                          )}>
                            <span className="text-[10px] font-semibold text-dark-500">{author?.name || 'Unknown'}</span>
                          </div>
                        )}

                        {/* Bubble content */}
                        <div className={cn(
                          'relative px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words shadow-sm group/bubble',
                          isOwn
                            ? 'bg-[#d9fdd3] rounded-lg rounded-tr-none'
                            : 'bg-white rounded-lg rounded-tl-none'
                        )}>
                          {msg.content}
                          {!isTemp && (author?._id === currentUser._id
                            || currentUser.role === UserRole.ADMIN
                            || currentUser.role === UserRole.SUPER_ADMIN) && (
                            <button
                              type="button"
                              onClick={() => setDeleteMessage({ _id: msg._id })}
                              title="Delete message"
                              className={cn(
                                'absolute -top-2 p-1 rounded-full bg-white border border-gray-200 text-primary-400 hover:text-red-600 hover:border-red-300 shadow-sm opacity-0 group-hover/bubble:opacity-100 focus:opacity-100 transition-all',
                                isOwn ? '-left-2' : '-right-2'
                              )}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          <div className={cn(
                            'flex items-center gap-1 mt-1 float-right ml-2',
                            isOwn ? 'text-[#35a13a]' : 'text-primary-400'
                          )}>
                            <span className="text-[9px] font-mono">{formatMessageTime(msg.createdAt)}</span>
                            {isOwn && (
                              isTemp ? (
                                <Clock className="w-3 h-3" />
                              ) : (
                                <CheckCheck className="w-3.5 h-3.5" />
                              )
                            )}
                          </div>
                        </div>

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={cn(
                            'flex flex-wrap gap-2 mt-1',
                            isOwn ? 'justify-end' : ''
                          )}>
                            {msg.attachments.map((att) => (
                              <div key={att.id} className="group/att">
                                {att.type.startsWith('image/') ? (
                                  <button
                                    onClick={() => setPreviewImage({ url: att.url, name: att.name })}
                                    className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-400 transition-colors shadow-sm"
                                  >
                                    <img src={att.url} alt={att.name} className="w-24 h-24 object-cover" />
                                  </button>
                                ) : (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono bg-white border border-gray-200 rounded-lg text-dark-400 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    <span className="truncate max-w-[100px]">{att.name}</span>
                                    <Download className="w-2.5 h-2.5 text-primary-400" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Chat input area — sticky to bottom of the chat pane, never scrolls away */}
        <div className="flex-shrink-0 sticky bottom-0 z-10 border-t border-gray-200 px-3 py-2.5 bg-gray-50 relative shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          {/* Uploaded files preview */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-gray-200">
              {uploadedFiles.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono bg-white border border-gray-200 rounded-lg text-dark-600 shadow-sm">
                  <Paperclip className="w-3 h-3" />
                  <span className="truncate max-w-[80px]">{f.name}</span>
                  <button type="button" onClick={() => removeFile(f.id)} className="text-primary-400 hover:text-red-500 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* @mention dropdown */}
          {showMentionDropdown && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
              <div className="px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-primary-400 bg-gray-50 border-b border-gray-100">
                Mention someone
              </div>
              {filteredUsers.map((user) => (
                <button
                  key={user._id}
                  onClick={() => insertMention(user)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center gap-2 border-b border-gray-50 last:border-0 transition-colors"
                >
                  <UserAvatar name={user.name} size="sm" />
                  <span className="font-medium text-dark-500">{user.name}</span>
                  <span className="text-primary-400 font-mono text-[9px] uppercase ml-auto">{user.department}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={chatInputRef}
                value={newMessage}
                onChange={handleChatInputChange}
                placeholder="Type a message... @name to mention"
                rows={1}
                className="w-full text-[13px] resize-none border border-gray-200 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-primary-400 bg-white"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
            </div>
            <div className="flex gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-2.5 text-primary-400 hover:text-blue-600 hover:bg-blue-50 rounded-full border border-gray-200 hover:border-blue-300 transition-all disabled:opacity-40 bg-white"
                title="Attach file"
              >
                {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || (!newMessage.trim() && uploadedFiles.length === 0)}
                className="p-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-all shadow-sm"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-white h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-5.5rem)] overflow-hidden">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-white border-b border-primary-200 flex-shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-dark-500 leading-tight">Discussions</h1>
              <p className="text-[10px] text-primary-500 font-mono">
                Chat threads for project collaboration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right mr-2">
              <p className="text-lg font-bold text-dark-500 leading-tight">{discussions.length}</p>
              <p className="text-[9px] font-mono uppercase tracking-wider text-primary-400">Threads</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowNewForm(!showNewForm); setError(null); if (!showNewForm) fetchProjects(); }}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wide rounded-lg transition-all duration-150',
                showNewForm ? 'bg-gray-100 text-dark-500 border border-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
              )}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{showNewForm ? 'Cancel' : 'New Thread'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-3 border border-red-200 bg-red-50/80 backdrop-blur-sm rounded-lg px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <p className="text-xs font-mono text-red-700">{error}</p>
        </div>
      )}

      {/* ── New thread form ───────────────────────────────────── */}
      {showNewForm && (
        <div className="mx-4 mt-3 mb-1 bg-white border border-primary-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200 flex-shrink-0">
          <div className="px-5 py-2.5 border-b border-primary-100 bg-gradient-to-r from-blue-50/50 to-transparent">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-primary-500 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Start a New Thread
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-primary-500">
                Project <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                items={projects}
                value={newThread.projectId}
                onChange={(id) => setNewThread((prev) => ({ ...prev, projectId: id }))}
                placeholder="Search projects..."
                loading={loadingProjects}
                emptyText="No projects found"
                getSearchText={(p: IProject) => `${p.projectTitle} ${p.clientName}`}
                renderItem={(p: IProject) => (
                  <>
                    <span className="font-medium text-dark-500 truncate">{p.projectTitle}</span>
                    <span className="text-primary-400 font-mono text-[10px] ml-auto truncate">{p.clientName}</span>
                  </>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-primary-500">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newThread.title}
                onChange={(e) => setNewThread((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Production planning discussion"
                className="w-full text-xs font-mono border border-primary-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-primary-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-primary-500">
                Description <span className="text-primary-400 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                value={newThread.description}
                onChange={(e) => setNewThread((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What's this thread about?"
                rows={2}
                className="w-full text-xs font-mono border border-primary-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none placeholder:text-primary-400"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newThread.title.trim() || !newThread.projectId}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                Start Thread
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main two-pane layout ──────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: Thread list */}
        <div className={cn(
          'w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 border-r border-primary-100 flex flex-col min-h-0',
          mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
        )}>
          {renderThreadList()}
        </div>

        {/* Right: Chat window */}
        <div className={cn(
          'flex-1 min-w-0 flex flex-col min-h-0',
          mobileView === 'list' ? 'hidden lg:flex' : 'flex'
        )}>
          {renderChatWindow()}
        </div>
      </div>

      {/* ── Edit Thread Modal ──────────────────────────────────── */}
      <Modal open={!!editThread} onClose={() => { if (!savingEdit) setEditThread(null); }} size="sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-dark-500">Edit Thread</h2>
            <button type="button" onClick={() => setEditThread(null)} className="text-primary-400 hover:text-dark-400 p-1 rounded-lg hover:bg-gray-100 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-primary-500 mb-1.5">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xs font-mono border border-primary-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-primary-500 mb-1.5">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full text-xs font-mono border border-primary-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-primary-200">
            <button
              type="button"
              onClick={() => setEditThread(null)}
              disabled={savingEdit}
              className="px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-lg border border-primary-300 text-dark-400 hover:border-dark-400 hover:text-dark-500 disabled:opacity-40 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={savingEdit || !editTitle.trim()}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-lg bg-dark-500 text-white hover:bg-dark-600 disabled:opacity-40 transition-all"
            >
              {savingEdit ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><Edit3 className="w-3 h-3" /> Save</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ──────────────────────────────── */}
      <Modal open={!!deleteThread} onClose={() => { if (!deleting) setDeleteThread(null); }} size="sm">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-dark-500">Delete Thread</h2>
              <p className="text-xs text-primary-500 font-mono">This action cannot be undone</p>
            </div>
          </div>
          <p className="text-xs font-mono text-dark-400 mb-6 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
            Are you sure you want to delete <strong className="text-dark-500">&ldquo;{deleteThread?.title}&rdquo;</strong>?
            All messages in this thread will also be permanently removed.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-primary-200">
            <button
              type="button"
              onClick={() => setDeleteThread(null)}
              disabled={deleting}
              className="px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-lg border border-primary-300 text-dark-400 hover:border-dark-400 hover:text-dark-500 disabled:opacity-40 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-all shadow-sm"
            >
              {deleting ? <><Loader2 className="w-3 h-3 animate-spin" /> Deleting...</> : <><Trash2 className="w-3 h-3" /> Delete</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Message Confirmation Modal (sticky to viewport bottom) ── */}
      <Modal open={!!deleteMessage} onClose={() => { if (!deletingMessage) setDeleteMessage(null); }} size="sm" className="md:mb-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-dark-500">Delete Message</h2>
              <p className="text-xs text-primary-500 font-mono">This action cannot be undone</p>
            </div>
          </div>
          <p className="text-xs font-mono text-dark-400 mb-6 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
            Are you sure you want to permanently delete this message?
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-primary-200">
            <button
              type="button"
              onClick={() => setDeleteMessage(null)}
              disabled={deletingMessage}
              className="px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-lg border border-primary-300 text-dark-400 hover:border-dark-400 hover:text-dark-500 disabled:opacity-40 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteMessageConfirm}
              disabled={deletingMessage}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-all shadow-sm"
            >
              {deletingMessage ? <><Loader2 className="w-3 h-3 animate-spin" /> Deleting...</> : <><Trash2 className="w-3 h-3" /> Delete</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Image Preview Modal ─────────────────────────────────────── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <span className="text-xs font-medium text-dark-500 truncate max-w-[300px]">{previewImage.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  download={previewImage.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
                <button onClick={() => setPreviewImage(null)} className="p-1.5 text-primary-400 hover:text-dark-500 hover:bg-gray-100 rounded-lg transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <img src={previewImage.url} alt={previewImage.name} className="max-w-full max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}