'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot } from 'lucide-react';
import { cn, timeAgo, apiFetch } from '@/lib/utils';
import type { IComment, IUser } from '@/types';

interface CommentThreadProps {
  taskId?: string;
  alertId?: string;
  currentUser: Partial<IUser>;
  availableUsers?: Partial<IUser>[];
}

export function CommentThread({ taskId, alertId, currentUser, availableUsers: propUsers = [] }: CommentThreadProps) {
  const [comments, setComments] = useState<IComment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<Partial<IUser>[]>(propUsers);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = async () => {
    const params = taskId ? `taskId=${taskId}` : `alertId=${alertId}`;
    const result = await apiFetch<{ items: IComment[] }>(`/api/comments?${params}&limit=50`);
    if (result.success && result.data) {
      setComments(result.data.items);
    }
    setFetching(false);
  };

  // Load users for @mention if not provided as props
  const fetchUsers = async () => {
    if (propUsers.length > 0) return;
    const result = await apiFetch<Partial<IUser>[]>('/api/users');
    if (result.success && result.data) {
      setAvailableUsers(result.data);
    }
  };

  useEffect(() => {
    fetchComments();
    fetchUsers();
  }, [taskId, alertId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    // Detect @mention
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

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);

    const result = await apiFetch<IComment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        alertId,
        content: content.trim(),
        mentions,
      }),
    });

    if (result.success && result.data) {
      setComments((prev) => [...prev, result.data!]);
      setContent('');
      setMentions([]);
    }

    setLoading(false);
  };

  const filteredUsers = availableUsers.filter((u) =>
    u.name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-t border-gray-100">
      {/* Thread header */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-gray-500">
          Discussion Thread · {comments.length} messages
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {fetching && (
          <div className="flex items-center justify-center h-16">
            <span className="text-xs text-gray-400 font-mono">Loading...</span>
          </div>
        )}

        {!fetching && comments.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400 font-mono">No messages yet. Start the discussion.</p>
          </div>
        )}

        {comments.map((comment) => (
          <CommentItem key={comment._id} comment={comment} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 bg-white relative">
        {showMentionDropdown && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 shadow-lg z-10 max-h-32 overflow-y-auto">
            {filteredUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => insertMention(user)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
              >
                <span className="font-medium text-gray-900">{user.name}</span>
                <span className="text-gray-400 font-mono text-[10px] uppercase">{user.department}</span>
              </button>
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
              className="w-full text-sm resize-none border border-gray-200 px-3 py-2 focus:outline-none focus:border-black transition-colors placeholder:text-gray-400 font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) handleSubmit();
              }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className="flex-shrink-0 p-2.5 bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 font-mono">⌘+Enter to send</p>
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: IComment }) {
  const author = typeof comment.author === 'object' ? comment.author as Partial<IUser> : null;
  const isSystemLog = comment.isSystemLog;

  if (isSystemLog) {
    return (
      <div className="flex items-start gap-2 py-1">
        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3 h-3 text-gray-500" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-gray-500 italic font-mono">{comment.content}</p>
          <span className="text-[10px] text-gray-400">{timeAgo(comment.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] text-white font-bold">
          {author?.name?.charAt(0).toUpperCase() || '?'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-bold text-gray-900">{author?.name || 'Unknown'}</span>
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">
            {author?.department?.replace('_', ' ')}
          </span>
          <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(comment.createdAt)}</span>
        </div>
        <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
          {renderContentWithMentions(comment.content)}
        </div>
      </div>
    </div>
  );
}

function renderContentWithMentions(content: string) {
  const parts = content.split(/(@\w+\s*\w*)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-black font-bold">
        {part}
      </span>
    ) : (
      part
    )
  );
}
