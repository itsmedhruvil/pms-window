'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Send, Loader2, User, Search, Upload, Paperclip, X, Edit3, Trash2, MailOpen, Mail, Download, AtSign, Image as ImageIcon, CheckCheck, Clock } from 'lucide-react';
import { apiFetch, cn, DEPARTMENT_LABELS, timeAgo } from '@/lib/utils';
import { Department } from '@/types';
import type { ReactNode } from 'react';
import type { IDiscussion, IComment, IUser, IProject, ICommentAttachment } from '@/types';
import { Modal } from '@/components/ui/Modal';

interface ExtendedDiscussion extends IDiscussion {
  unreadCount?: number;
  totalComments?: number;
  lastMessageAt?: string;
  lastReadAt?: string | null;
}

interface DiscussionsClientProps {
  currentUser: Partial<IUser>;
}

// ── Reusable Avatar component ─────────────────────────────────────────

function UserAvatar({ name, size = 'md', className }: { name?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[9px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };
  return (
    <div className={cn(
      'rounded-full bg-dark-500 flex items-center justify-center flex-shrink-0 font-bold text-white',
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

// ── Main component ───────────────────────────────────────────────────

export function DiscussionsClient({ currentUser }: DiscussionsClientProps) {
  const [discussions, setDiscussions] = useState<ExtendedDiscussion[]>([]);
  const [comments, setComments] = useState<Record<string, IComment[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<ICommentAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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

  // @mention state for chat
  const [availableUsers, setAvailableUsers] = useState<Partial<IUser>[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [activeDiscussionId, setActiveDiscussionId] = useState<string | null>(null);
  const chatInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const fetchDiscussions = useCallback(async () => {
    const result = await apiFetch<ExtendedDiscussion[]>('/api/discussions?limit=100');
    if (result.success && result.data) {
      const items = Array.isArray(result.data) ? result.data : [];
      setDiscussions(items);
    }
  }, []);

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

  // Fetch discussions on mount + poll every 30s
  useEffect(() => {
    setLoading(true);
    fetchDiscussions().finally(() => setLoading(false));
    fetchUsers();
    pollRef.current = setInterval(() => { fetchDiscussions(); }, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchDiscussions, fetchUsers]);

  const fetchComments = useCallback(async (discussionId: string) => {
    const result = await apiFetch<{ items: IComment[] }>(`/api/comments?discussionId=${discussionId}&limit=50`);
    if (result.success && result.data?.items) {
      setComments((prev) => ({ ...prev, [discussionId]: result.data!.items }));
    }
  }, []);

  const markAsRead = useCallback(async (discussionId: string) => {
    await apiFetch('/api/discussions/read', {
      method: 'POST', body: JSON.stringify({ discussionId }),
    });
    setDiscussions((prev) =>
      prev.map((d) => d._id === discussionId ? { ...d, unreadCount: 0 } : d)
    );
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setActiveDiscussionId(null);
      return;
    }
    setExpandedId(id);
    setActiveDiscussionId(id);
    if (!comments[id]) fetchComments(id);
    await markAsRead(id);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingFile(true);
    const newFiles: ICommentAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          newFiles.push({
            id: `${Date.now()}-${i}`, name: file.name, url: uploadData.data.url,
            type: file.type, size: file.size, uploadedAt: new Date(),
          });
        }
      } catch { /* skip */ }
    }
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => setUploadedFiles((prev) => prev.filter((f) => f.id !== id));

  // @mention detection
  const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>, discussionId: string) => {
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
    chatInputRefs.current[activeDiscussionId || '']?.focus();
  };

  const filteredUsers = availableUsers.filter((u) =>
    u.name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // Edit thread
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
      setDiscussions((prev) => prev.map((d) => d._id === editThread._id ? { ...result.data!, unreadCount: d.unreadCount } : d));
      setEditThread(null);
    } else setError(result.error || 'Failed to update discussion');
    setSavingEdit(false);
  };

  // Delete thread
  const handleDeleteConfirm = async () => {
    if (!deleteThread) return;
    setDeleting(true); setError(null);
    const result = await apiFetch(`/api/discussions/${deleteThread._id}`, { method: 'DELETE' });
    if (result.success) {
      setDiscussions((prev) => prev.filter((d) => d._id !== deleteThread._id));
      if (expandedId === deleteThread._id) setExpandedId(null);
      setDeleteThread(null);
    } else setError(result.error || 'Failed to delete discussion');
    setDeleting(false);
  };

  const handleSend = async (discussionId: string) => {
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

    const result = await apiFetch<IComment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        discussionId,
        content: newMessage.trim(),
        mentions: mentionedIds,
        attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      }),
    });

    if (result.success && result.data) {
      setComments((prev) => ({
        ...prev,
        [discussionId]: [...(prev[discussionId] || []), result.data!],
      }));
      setNewMessage('');
      setUploadedFiles([]);
      setShowMentionDropdown(false);
      fetchDiscussions();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } else setError(result.error || 'Failed to send message');
    setSending(false);
  };

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
      setDiscussions((prev) => [{ ...result.data!, unreadCount: 0 }, ...prev]);
      setExpandedId(result.data._id);
      setActiveDiscussionId(result.data._id);
      setNewThread({ projectId: '', title: '', description: '' });
      setShowNewForm(false);
      fetchComments(result.data._id);
      await markAsRead(result.data._id);
    } else setError(result.error || 'Failed to create thread');
    setCreating(false);
  };

  const canModifyDiscussion = (discussion: IDiscussion) => {
    const starter = typeof discussion.startedBy === 'object' ? discussion.startedBy as Partial<IUser> : null;
    return starter?._id === currentUser._id;
  };

  return (
    <div className="min-h-screen bg-gray-50/30">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-white border-b border-primary-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-dark-500">Discussions</h1>
                <p className="text-xs text-primary-500 font-mono mt-0.5">
                  Chat threads for project collaboration — use <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded text-[10px] font-semibold">@name</span> to mention
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-2xl font-bold text-dark-500">{discussions.length}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-primary-400">Threads</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowNewForm(!showNewForm); setError(null); if (!showNewForm) fetchProjects(); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wide rounded-lg transition-all duration-150',
                  showNewForm ? 'bg-gray-100 text-dark-500 border border-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                )}
              >
                <MessageCircle className="w-4 h-4" />
                {showNewForm ? 'Cancel' : 'New Thread'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Error banner ──────────────────────────────────── */}
        {error && (
          <div className="mb-4 border border-red-200 bg-red-50/80 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            <p className="text-xs font-mono text-red-700">{error}</p>
          </div>
        )}

        {/* ── New thread form ───────────────────────────────── */}
        {showNewForm && (
          <div className="mb-6 bg-white border border-primary-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="px-5 py-3 border-b border-primary-100 bg-gradient-to-r from-blue-50/50 to-transparent">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-primary-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Start a New Thread
              </h2>
            </div>
            <div className="p-5 space-y-4">
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

              <div className="flex justify-end pt-2">
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

        {/* ── Loading state ─────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-3" />
            <p className="text-xs font-mono text-primary-500">Loading discussions...</p>
          </div>
        ) : discussions.length === 0 ? (
          /* ── Empty state ─────────────────────────────────────── */
          <div className="border-2 border-dashed border-primary-200 rounded-2xl py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-base font-semibold text-dark-500 mb-1">No discussions yet</p>
            <p className="text-xs font-mono text-primary-400 mb-6">Start a thread to collaborate with your team</p>
            <button
              type="button"
              onClick={() => { setShowNewForm(true); fetchProjects(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              New Thread
            </button>
          </div>
        ) : (
          /* ── Thread list ─────────────────────────────────────── */
          <div className="space-y-3">
            {discussions.map((discussion) => {
              const isExpanded = expandedId === discussion._id;
              const msgs = comments[discussion._id] || [];
              const startedBy = typeof discussion.startedBy === 'object' ? discussion.startedBy as Partial<IUser> : null;
              const project = typeof discussion.projectId === 'object' ? discussion.projectId as Partial<IProject> : null;
              const mentionUsers = Array.isArray(discussion.mentions)
                ? discussion.mentions.map((m: any) => typeof m === 'object' ? m as Partial<IUser> : null).filter(Boolean)
                : [];
              const canModify = canModifyDiscussion(discussion);
              const unreadCount = discussion.unreadCount || 0;

              return (
                <div
                  key={discussion._id}
                  className={cn(
                    'bg-white border rounded-xl transition-all duration-150 overflow-hidden',
                    isExpanded ? 'border-blue-200 shadow-md' : 'border-primary-200 hover:border-primary-300 hover:shadow-sm',
                    unreadCount > 0 && !isExpanded ? 'border-l-4 border-l-blue-500 bg-blue-50/20' : ''
                  )}
                >
                  {/* ── Thread header ─────────────────────────── */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(discussion._id)}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/50"
                  >
                    <UserAvatar name={startedBy?.name} size="md" className={cn(
                      'mt-0.5 ring-2',
                      unreadCount > 0 ? 'ring-blue-200' : 'ring-gray-100'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={cn(
                          'text-sm leading-tight',
                          unreadCount > 0 ? 'font-bold text-dark-500' : 'font-semibold text-dark-500'
                        )}>
                          {discussion.title}
                        </h3>
                        {unreadCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full min-w-[20px] leading-none shadow-sm">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                      {discussion.description && (
                        <p className={cn(
                          'text-xs mt-1 line-clamp-1',
                          unreadCount > 0 ? 'text-dark-600' : 'text-primary-500'
                        )}>
                          {discussion.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-primary-400 flex-wrap">
                        <span className="font-medium text-dark-400">{startedBy?.name || 'Unknown'}</span>
                        {startedBy?.department && (
                          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                            {DEPARTMENT_LABELS[startedBy.department as Department]}
                          </span>
                        )}
                        <span className="text-primary-300">·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(discussion.createdAt)}
                        </span>
                        <span className="text-primary-300">·</span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-2.5 h-2.5" />
                          {msgs.length || discussion.totalComments || 0}
                        </span>
                        {project?.projectTitle && (
                          <>
                            <span className="text-primary-300">·</span>
                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-medium truncate max-w-[180px]">
                              {project.projectTitle}
                            </span>
                          </>
                        )}
                        {mentionUsers.length > 0 && (
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1">
                            <AtSign className="w-2 h-2" />
                            {mentionUsers.slice(0, 3).map((m) => (m as Partial<IUser>)?.name).filter(Boolean).join(', ')}
                            {mentionUsers.length > 3 && ` +${mentionUsers.length - 3}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 self-start mt-0.5">
                      {canModify && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEditModal(discussion); }}
                            className="p-1.5 text-primary-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit thread"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeleteThread({ _id: discussion._id, title: discussion.title }); }}
                            className="p-1.5 text-primary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete thread"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <div className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        isExpanded ? 'bg-blue-50 text-blue-600' : 'text-primary-400'
                      )}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* ── Expanded chat area ────────────────────── */}
                  {isExpanded && (
                    <div className="animate-in slide-in-from-top-1 duration-150">
                      <div className="border-t border-gray-100">
                        {/* Messages area */}
                        <div className="max-h-[500px] overflow-y-auto p-4 sm:p-5 space-y-4 bg-gray-50/50">
                          {msgs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                                <MessageCircle className="w-6 h-6 text-blue-400" />
                              </div>
                              <p className="text-xs font-mono text-primary-400">No messages yet. Be the first!</p>
                            </div>
                          ) : (
                            msgs.map((msg, idx) => {
                              const author = typeof msg.author === 'object' ? msg.author as Partial<IUser> : null;
                              const isOwn = author?._id === currentUser._id;
                              const showAvatar = idx === 0 || (
                                msgs[idx - 1] && (
                                  (typeof msgs[idx - 1].author === 'object'
                                    ? (msgs[idx - 1].author as Partial<IUser>)?._id
                                    : null) !== author?._id
                                )
                              );

                              return (
                                <div key={msg._id} className={cn(
                                  'flex items-start gap-3 group',
                                  isOwn ? 'flex-row-reverse' : ''
                                )}>
                                  {/* Avatar — only show if different author */}
                                  <div className={cn(
                                    'flex-shrink-0 transition-opacity',
                                    showAvatar ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                  )}>
                                    <UserAvatar name={author?.name} size="sm" />
                                  </div>

                                  {/* Message bubble */}
                                  <div className={cn(
                                    'flex-1 min-w-0 max-w-[80%]',
                                    isOwn ? 'flex flex-col items-end' : ''
                                  )}>
                                    {/* Author name + time */}
                                    {showAvatar && (
                                      <div className={cn(
                                        'flex items-center gap-2 mb-1',
                                        isOwn ? 'flex-row-reverse' : ''
                                      )}>
                                        <span className="text-[10px] font-semibold text-dark-500">{author?.name || 'Unknown'}</span>
                                        <span className="text-[9px] font-mono text-primary-400">{timeAgo(msg.createdAt)}</span>
                                      </div>
                                    )}

                                    {/* Bubble content */}
                                    <div className={cn(
                                      'rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words',
                                      isOwn
                                        ? 'bg-blue-600 text-white rounded-tr-sm'
                                        : 'bg-white border border-gray-200 rounded-tl-sm shadow-sm'
                                    )}>
                                      {msg.content}
                                    </div>

                                    {/* Attachments */}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                      <div className={cn(
                                        'flex flex-wrap gap-2 mt-2',
                                        isOwn ? 'justify-end' : ''
                                      )}>
                                        {msg.attachments.map((att) => (
                                          <div key={att.id} className="group/att">
                                            {att.type.startsWith('image/') ? (
                                              <button
                                                onClick={() => setPreviewImage({ url: att.url, name: att.name })}
                                                className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-400 transition-colors shadow-sm"
                                              >
                                                <img src={att.url} alt={att.name} className="w-20 h-20 object-cover" />
                                              </button>
                                            ) : (
                                              <a
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono bg-gray-50 border border-gray-200 rounded-lg text-dark-400 hover:border-blue-400 hover:bg-blue-50 transition-all"
                                              >
                                                <Paperclip className="w-3 h-3" />
                                                <span className="truncate max-w-[80px]">{att.name}</span>
                                                <Download className="w-2.5 h-2.5 text-primary-400" />
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={bottomRef} />
                        </div>

                        {/* ── Chat input area ─────────────────── */}
                        <div className="border-t border-gray-200 p-4 bg-white relative">
                          {/* Uploaded files preview */}
                          {uploadedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-100">
                              {uploadedFiles.map((f) => (
                                <span key={f.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono bg-gray-50 border border-gray-200 rounded-lg text-dark-600">
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
                            <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-36 overflow-y-auto">
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
                                ref={(el) => { chatInputRefs.current[discussion._id] = el; }}
                                value={expandedId === discussion._id ? newMessage : ''}
                                onChange={(e) => handleChatInputChange(e, discussion._id)}
                                placeholder="Type a message... @name to mention"
                                rows={2}
                                className="w-full text-xs resize-none border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-primary-400"
                                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(discussion._id); }}
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
                                className="p-2.5 text-primary-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-all disabled:opacity-40"
                                title="Attach file"
                              >
                                {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleSend(discussion._id)}
                                disabled={sending || (!newMessage.trim() && uploadedFiles.length === 0)}
                                className="p-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm"
                              >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <p className="text-[9px] text-primary-400 mt-2 font-mono flex items-center gap-2">
                            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[8px] font-bold">⌘+Enter</kbd>
                            <span>to send ·</span>
                            <span className="flex items-center gap-1"><AtSign className="w-2 h-2" /> name to mention</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Edit Thread Modal ──────────────────────────────────────── */}
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

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
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

      {/* ── Image Preview Modal ─────────────────────────────────────────────── */}
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