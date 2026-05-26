'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Bell, BellRing, CheckCheck, Loader2, MessageCircle, AlertTriangle, User, Clock } from 'lucide-react';
import { apiFetch, cn, timeAgo } from '@/lib/utils';
import type { INotification } from '@/types';
import Pusher from 'pusher-js';

interface NotificationPaneProps {
  className?: string;
}

export function NotificationPane({ className }: NotificationPaneProps) {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<{ items: INotification[]; unreadCount: number }>('/api/notifications?limit=10');
    if (result.success && result.data) {
      setNotifications(Array.isArray(result.data) ? result.data : result.data.items || []);
      setUnreadCount(typeof result.data === 'object' && 'unreadCount' in result.data ? (result.data as { unreadCount: number }).unreadCount : 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Real-time subscription via Pusher
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
    });

    const channel = pusher.subscribe('erp-global');
    channel.bind('notification-created', (_data: unknown) => {
      // Refetch to get the latest list
      fetchNotifications();
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    await apiFetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    await apiFetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationIds: [id] }),
    });
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'discussion_mention':
      case 'discussion_reply':
      case 'discussion_created':
        return <MessageCircle className="w-3.5 h-3.5 text-blue-500" />;
      case 'task_due_soon':
      case 'task_overdue':
        return <Clock className="w-3.5 h-3.5 text-red-500" />;
      case 'task_assigned':
        return <User className="w-3.5 h-3.5 text-gray-600" />;
      case 'alert_created':
      case 'alert_acknowledged':
      case 'alert_resolved':
        return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
      case 'project_created':
        return <Bell className="w-3.5 h-3.5 text-green-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className={cn(
          'relative p-2 transition-colors rounded-sm',
          open ? 'bg-gray-100 text-black' : 'text-gray-500 hover:text-black hover:bg-gray-50'
        )}
        title="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold flex items-center justify-center rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-gray-200 shadow-xl z-50 max-h-[500px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] font-mono text-blue-600 hover:text-blue-800"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-mono text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={cn(
                    'relative flex items-start gap-3 px-4 py-3 transition-colors',
                    !notification.isRead ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                  )}
                >
                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="absolute left-2 top-4 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                  )}

                  <div className="flex-shrink-0 mt-0.5 ml-2">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        onClick={() => {
                          if (!notification.isRead) markRead(notification._id);
                          setOpen(false);
                        }}
                        className="block"
                      >
                        <p className="text-[11px] font-bold text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <p className="text-[11px] font-bold text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </>
                    )}
                    <p className="text-[9px] text-gray-400 font-mono mt-1">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>

                  {!notification.isRead && (
                    <button
                      type="button"
                      onClick={() => markRead(notification._id)}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 mt-0.5"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationPane;