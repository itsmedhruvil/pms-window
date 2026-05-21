'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Send, Loader2, User, Search, Upload, Paperclip, X } from 'lucide-react';
import { apiFetch, cn, DEPARTMENT_LABELS, timeAgo } from '@/lib/utils';
import { Department } from '@/types';
import type { ReactNode } from 'react';
import type { IDiscussion, IComment, IUser, IProject, ICommentAttachment } from '@/types';

interface DiscussionsClientProps {
  currentUser: Partial<IUser>;
}

// ── Helper components ──────────────────────────────────────────────

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
  items,
  value,
  onChange,
  placeholder,
  loading,
  emptyText,
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
          disabled={loading}
          className="w-full pl-8 pr-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setSearch(''); setShowDropdown(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-4 text-center text-[10px] font-mono text-gray-400">{emptyText || 'No results'}</div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => { onChange(item._id); setSearch(''); setShowDropdown(false); }}
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

// ── Main component ─────────────────────────────────────────────────

export function DiscussionsClient({ currentUser }: DiscussionsClientProps) {
  const [discussions, setDiscussions] = useState<IDiscussion[]>([]);
  const [comments, setComments] = useState<Record<string, IComment[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<ICommentAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // New thread form
  const [showNewForm, setShowNewForm] = useState(false);
  const [projects, setProjects] = useState<IProject[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Partial<IUser>[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [newThread, setNewThread] = useState({
    projectId: '',
    title: '',
    description: '',
    mentionIds: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  const fetchDiscussions = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<IDiscussion[]>('/api/discussions?limit=100');
    if (result.success && result.data) {
      const items = Array.isArray(result.data) ? result.data : [];
      setDiscussions(items);
    }
    setLoading(false);
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

  useEffect(() => { fetchDiscussions(); fetchUsers(); }, [fetchDiscussions, fetchUsers]);

  const fetchComments = useCallback(async (discussionId: string) => {
    const result = await apiFetch<{ items: IComment[] }>(`/api/comments?discussionId=${discussionId}&limit=100`);
    if (result.success && result.data?.items) {
      setComments((prev) => ({ ...prev, [discussionId]: result.data!.items }));
    }
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!comments[id]) fetchComments(id);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const newFiles: ICommentAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = () => {
          newFiles.push({
            id: `${Date.now()}-${i}`,
            name: file.name,
            url: reader.result as string,
            type: file.type,
            size: file.size,
            uploadedAt: new Date(),
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => setUploadedFiles((prev) => prev.filter((f) => f.id !== id));

  const handleSend = async (discussionId: string) => {
    if (!newMessage.trim() && uploadedFiles.length === 0) return;
    setSending(true);
    setError(null);

    const result = await apiFetch<IComment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        discussionId,
        content: newMessage.trim(),
        mentions: [],
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
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } else {
      setError(result.error || 'Failed to send message');
    }
    setSending(false);
  };

  const toggleMentionUser = (user: Partial<IUser>) => {
    if (!user._id) return;
    setNewThread((prev) => ({
      ...prev,
      mentionIds: prev.mentionIds.includes(user._id!)
        ? prev.mentionIds.filter((id) => id !== user._id)
        : [...prev.mentionIds, user._id!],
    }));
  };

  const handleCreate = async () => {
    if (!newThread.projectId || !newThread.title.trim()) {
      setError('Project and title are required');
      return;
    }
    setCreating(true);
    setError(null);

    const result = await apiFetch<IDiscussion>('/api/discussions', {
      method: 'POST',
      body: JSON.stringify({
        projectId: newThread.projectId,
        title: newThread.title.trim(),
        description: newThread.description.trim(),
        mentions: newThread.mentionIds,
      }),
    });

    if (result.success && result.data) {
      setDiscussions((prev) => [result.data!, ...prev]);
      setExpandedId(result.data._id);
      setNewThread({ projectId: '', title: '', description: '', mentionIds: [] });
      setShowNewForm(false);
      fetchComments(result.data._id);
    } else {
      setError(result.error || 'Failed to create thread');
    }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <h1 className="text-xl font-black text-gray-900">Discussions</h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              Chat threads for project discussions. Mention <strong>@users</strong> to notify them.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right font-mono">
              <p className="text-2xl font-black text-gray-900">{discussions.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Threads</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowNewForm(!showNewForm); setError(null); if (!showNewForm) fetchProjects(); }}
              className={cn(
                'px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide transition-colors',
                showNewForm ? 'bg-gray-200 text-gray-600' : 'bg-black text-white hover:bg-gray-800'
              )}
            >
              {showNewForm ? 'Cancel' : 'New Thread'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-xl space-y-6 p-4 sm:p-6">
        {error && (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-xs font-mono text-red-700">{error}</div>
        )}

        {/* New thread form */}
        {showNewForm && (
          <div className="border border-gray-200 bg-gray-50">
            <div className="px-5 py-3 border-b border-gray-200 bg-white">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">Start a New Thread</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Project */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
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
                      <span className="font-medium text-gray-900 truncate">{p.projectTitle}</span>
                      <span className="text-gray-400 font-mono text-[10px] ml-auto truncate">{p.clientName}</span>
                    </>
                  )}
                />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newThread.title}
                  onChange={(e) => setNewThread((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Production planning discussion"
                  className="w-full text-xs font-mono border border-gray-200 px-3 py-2 focus:outline-none focus:border-black transition-colors placeholder:text-gray-400"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Description <span className="text-gray-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={newThread.description}
                  onChange={(e) => setNewThread((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="What's this thread about?"
                  rows={2}
                  className="w-full text-xs font-mono border border-gray-200 px-3 py-2 focus:outline-none focus:border-black transition-colors resize-none placeholder:text-gray-400"
                />
              </div>

              {/* Mention users */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Mention Users (they get notified + can see history)
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableUsers.map((u) => (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => toggleMentionUser(u)}
                      className={cn(
                        'px-2.5 py-1 text-[10px] font-mono border transition-colors',
                        newThread.mentionIds.includes(u._id!)
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      )}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !newThread.title.trim() || !newThread.projectId}
                  className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono font-bold bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
                  Start Thread
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Threads list */}
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>
        ) : discussions.length === 0 ? (
          <div className="border border-dashed border-gray-200 p-12 text-center">
            <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-mono text-gray-400">No discussions yet.</p>
            <p className="text-xs font-mono text-gray-400 mt-1">Click &ldquo;New Thread&rdquo; to start one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {discussions.map((discussion) => {
              const isExpanded = expandedId === discussion._id;
              const msgs = comments[discussion._id] || [];
              const startedBy = typeof discussion.startedBy === 'object' ? discussion.startedBy as Partial<IUser> : null;
              const project = typeof discussion.projectId === 'object' ? discussion.projectId as Partial<IProject> : null;

              return (
                <div key={discussion._id} className="border border-gray-200">
                  {/* Thread header */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(discussion._id)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50/50"
                  >
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <MessageCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">{discussion.title}</h3>
                      {discussion.description && (
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{discussion.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-gray-400 flex-wrap">
                        <span>{startedBy?.name || 'Unknown'}</span>
                        {startedBy?.department && <span className="uppercase">{DEPARTMENT_LABELS[startedBy.department as Department]}</span>}
                        <span>·</span>
                        <span>{timeAgo(discussion.createdAt)}</span>
                        <span>·</span>
                        <span>{msgs.length} message{msgs.length === 1 ? '' : 's'}</span>
                        {project?.projectTitle && (
                          <span className="truncate max-w-[200px] font-medium text-gray-600">📁 {project.projectTitle}</span>
                        )}
                        {discussion.mentions.length > 0 && (
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            {discussion.mentions.map((m: any) => (m as Partial<IUser>)?.name).filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>

                  {/* Expanded chat */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {/* Messages */}
                      <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
                        {msgs.length === 0 ? (
                          <p className="text-[10px] font-mono text-gray-400 text-center py-6">No messages yet. Say something!</p>
                        ) : (
                          msgs.map((msg) => {
                            const author = typeof msg.author === 'object' ? msg.author as Partial<IUser> : null;
                            return (
                              <div key={msg._id} className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-[10px] text-white font-bold">{author?.name?.charAt(0).toUpperCase() || '?'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2 mb-0.5">
                                    <span className="text-[11px] font-bold text-gray-900">{author?.name || 'Unknown'}</span>
                                    <span className="text-[9px] font-mono text-gray-400 uppercase">{author?.department ? DEPARTMENT_LABELS[author.department as Department] : ''}</span>
                                    <span className="text-[9px] text-gray-400 ml-auto">{timeAgo(msg.createdAt)}</span>
                                  </div>
                                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                  {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {msg.attachments.map((att) => (
                                        <a
                                          key={att.id}
                                          href={att.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-mono bg-gray-50 border border-gray-200 text-gray-600 hover:border-black transition-colors"
                                        >
                                          {att.type.startsWith('image/') ? (
                                            <img src={att.url} alt={att.name} className="w-5 h-5 object-cover rounded" />
                                          ) : (
                                            <Paperclip className="w-3 h-3" />
                                          )}
                                          {att.name}
                                        </a>
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

                      {/* Input */}
                      <div className="border-t border-gray-200 p-3 bg-white">
                        {uploadedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {uploadedFiles.map((f) => (
                              <span key={f.id} className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-mono bg-gray-50 border border-gray-200 text-gray-700">
                                <Paperclip className="w-3 h-3" />
                                {f.name}
                                <button type="button" onClick={() => removeFile(f.id)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 relative">
                            <textarea
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type a message..."
                              rows={2}
                              className="w-full text-xs resize-none border border-gray-200 px-3 py-2 focus:outline-none focus:border-black transition-colors placeholder:text-gray-400 font-mono"
                              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSend(discussion._id); }}
                            />
                          </div>
                          <div className="flex gap-1">
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
                              className="p-2 text-gray-400 hover:text-black border border-gray-200 hover:border-black transition-colors"
                              title="Attach file"
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSend(discussion._id)}
                              disabled={sending || (!newMessage.trim() && uploadedFiles.length === 0)}
                              className="p-2 bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1 font-mono">⌘+Enter to send · Attach files with paperclip</p>
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