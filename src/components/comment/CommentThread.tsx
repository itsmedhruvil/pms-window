'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, Upload, Paperclip, X, Loader2, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { timeAgo, apiFetch } from '@/lib/utils';
import { dispatchDataChange } from '@/hooks/useRealtime';
import type { IComment, IUser, ICommentAttachment } from '@/types';

interface CommentThreadProps {
  taskId?: string;
  alertId?: string;
  currentUser: Partial<IUser>;
  availableUsers?: Partial<IUser>[];
}

export function CommentThread({ taskId, alertId, availableUsers: propUsers = [], currentUser }: CommentThreadProps) {
  const [comments, setComments] = useState<IComment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<Partial<IUser>[]>(propUsers);
  const [uploadedFiles, setUploadedFiles] = useState<ICommentAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchComments = useCallback(async () => {
    const params = taskId ? `taskId=${taskId}` : `alertId=${alertId}`;
    const result = await apiFetch<{ items: IComment[] }>(`/api/comments?${params}&limit=50`);
    if (result.success && result.data) {
      setComments(result.data.items);
    }
    setFetching(false);
  }, [alertId, taskId]);

  const fetchUsers = useCallback(async () => {
    if (propUsers.length > 0) return;
    const result = await apiFetch<Partial<IUser>[]>('/api/users');
    if (result.success && result.data) {
      setAvailableUsers(result.data);
    }
  }, [propUsers.length]);

  useEffect(() => {
    fetchComments();
    fetchUsers();
  }, [fetchComments, fetchUsers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

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
    if (!user._id || !user.name) return;
    const atIndex = content.lastIndexOf('@');
    const newContent = content.slice(0, atIndex) + `@${user.name} `;
    setContent(newContent);
    setMentions((prev) => [...new Set([...prev, user._id as string])]);
    setShowMentionDropdown(false);
    textareaRef.current?.focus();
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
            id: `${Date.now()}-${i}`,
            name: file.name,
            url: uploadData.data.url,
            type: file.type,
            size: file.size,
            uploadedAt: new Date(),
          });
        }
      } catch {
        // skip failed
      }
    }
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => setUploadedFiles((prev) => prev.filter((f) => f.id !== id));

  const handleSubmit = async () => {
    if (!content.trim() && uploadedFiles.length === 0) return;
    setLoading(true);

    const result = await apiFetch<IComment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        alertId,
        content: content.trim(),
        mentions,
        attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      }),
    });

    if (result.success && result.data) {
      setComments((prev) => [...prev, result.data!]);
      setContent('');
      setMentions([]);
      setUploadedFiles([]);
      // INSTANT: notify other pages of the new comment
      dispatchDataChange('comment', 'added', {
        comment: result.data,
        taskId,
        alertId,
      });
    }

    setLoading(false);
  };

  const filteredUsers = availableUsers.filter((u) =>
    u.name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col h-full border-t border-primary-100">
        {/* Thread header */}
        <div className="px-4 py-2 border-b border-primary-100 bg-primary-50">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary-500">
            Discussion Thread · {comments.length} messages
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {fetching && (
            <div className="flex items-center justify-center h-16">
              <span className="text-xs text-primary-400 font-mono">Loading...</span>
            </div>
          )}

          {!fetching && comments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-primary-400 font-mono">No messages yet. Start the discussion.</p>
            </div>
          )}

          {comments.map((comment) => (
            <CommentItem key={comment._id} comment={comment} onImagePreview={(url, name) => setPreviewImage({ url, name })} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-primary-200 p-3 bg-white relative">
          {showMentionDropdown && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-primary-200 shadow-lg z-10 max-h-32 overflow-y-auto">
              {filteredUsers.map((user) => (
                <button
                  key={user._id}
                  onClick={() => insertMention(user)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-primary-50 flex items-center gap-2 border-b border-primary-100 last:border-0"
                >
                  <span className="font-medium text-dark-500">{user.name}</span>
                  <span className="text-primary-400 font-mono text-[10px] uppercase">{user.department}</span>
                </button>
              ))}
            </div>
          )}

          {/* Pending file attachments */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {uploadedFiles.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-mono bg-primary-50 border border-primary-200 text-dark-600">
                  {f.type.startsWith('image/') ? (
                    <img src={f.url} alt={f.name} className="w-5 h-5 object-cover rounded" />
                  ) : (
                    <Paperclip className="w-3 h-3" />
                  )}
                  {f.name}
                  <button type="button" onClick={() => removeFile(f.id)} className="text-primary-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                placeholder="Add a comment... Use @name to mention"
                rows={2}
                className="w-full text-sm resize-none border border-primary-200 px-3 py-2 focus:outline-none focus:border-dark-500 transition-colors placeholder:text-primary-400 font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) handleSubmit();
                }}
              />
            </div>
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
              className="flex-shrink-0 p-2.5 text-primary-400 hover:text-dark-500 border border-primary-200 hover:border-dark-500 transition-colors disabled:opacity-40"
              title="Attach file"
            >
              {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && uploadedFiles.length === 0)}
              className="flex-shrink-0 p-2.5 bg-dark-500 text-white hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-primary-400 mt-1 font-mono">⌘+Enter to send · @name to mention · Attach files</p>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-dark-500/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-primary-200">
              <span className="text-xs font-mono font-bold text-dark-500 truncate max-w-[300px]">{previewImage.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  download={previewImage.name}
                  className="flex items-center gap-1 text-[10px] font-mono text-blue-600 hover:text-blue-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
                <button onClick={() => setPreviewImage(null)} className="text-primary-400 hover:text-white ml-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-[80vh] object-contain bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}

function CommentItem({ comment, onImagePreview }: { comment: IComment; onImagePreview: (url: string, name: string) => void }) {
  const author = typeof comment.author === 'object' ? comment.author as Partial<IUser> : null;
  const isSystemLog = comment.isSystemLog;

  if (isSystemLog) {
    return (
      <div className="flex items-start gap-2 py-1">
        <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3 h-3 text-primary-500" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-primary-500 italic font-mono">{comment.content}</p>
          <span className="text-[10px] text-primary-400">{timeAgo(comment.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-full bg-dark-500 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] text-white font-bold">
          {author?.name?.charAt(0).toUpperCase() || '?'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-bold text-dark-500">{author?.name || 'Unknown'}</span>
          <span className="text-[10px] font-mono text-primary-400 uppercase tracking-wide">
            {author?.department?.replace('_', ' ')}
          </span>
          <span className="text-[10px] text-primary-400 ml-auto">{timeAgo(comment.createdAt)}</span>
        </div>
        <div className="text-xs text-dark-600 leading-relaxed whitespace-pre-wrap">
          {renderContentWithMentions(comment.content)}
        </div>

        {/* Attachments */}
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {comment.attachments.map((att) => (
              <div key={att.id} className="group relative">
                {att.type.startsWith('image/') ? (
                  <div className="inline-flex flex-col items-start">
                    <button
                      onClick={() => onImagePreview(att.url, att.name)}
                      className="border border-primary-200 hover:border-dark-500 transition-colors overflow-hidden"
                    >
                      <img src={att.url} alt={att.name} className="w-20 h-20 object-cover" />
                    </button>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[9px] font-mono text-primary-400 truncate max-w-[80px]">{att.name}</span>
                      <a
                        href={att.url}
                        download={att.name}
                        className="text-[9px] font-mono text-blue-600 hover:text-blue-800"
                        title="Download"
                      >
                        <Download className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-mono bg-primary-50 border border-primary-200 text-dark-400 hover:border-dark-500 transition-colors"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{att.name}</span>
                    <Download className="w-2.5 h-2.5 text-primary-400 ml-1" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderContentWithMentions(content: string) {
  const parts = content.split(/(@\w+\s*\w*)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-dark-500 font-bold">
        {part}
      </span>
    ) : (
      part
    )
  );
}