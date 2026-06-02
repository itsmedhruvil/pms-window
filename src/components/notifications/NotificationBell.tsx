'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';
import { NotificationType } from '@/types/notifications';
import { cn } from '@/lib/utils';

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.ALERT_CREATED:
    case NotificationType.ALERT_ACKNOWLEDGED:
    case NotificationType.ALERT_RESOLVED:
      return '🚨';
    case NotificationType.TASK_ASSIGNED:
      return '👤';
    case NotificationType.TASK_STATUS_CHANGED:
      return '📋';
    case NotificationType.COMMENT_MENTION:
      return '💬';
    case NotificationType.DISCUSSION_REPLY:
      return '💬';
    case NotificationType.DISCUSSION_CREATED:
      return '💡';
    default:
      return '🔔';
  }
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface NotificationBellProps {
  /**
   * Active alert count from the server (legacy badge count).
   * The unread notification count is managed internally.
   */
  serverActiveAlertCount?: number;
}

export function NotificationBell({ serverActiveAlertCount = 0 }: NotificationBellProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
  } = useInAppNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const totalCount = unreadCount + serverActiveAlertCount;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-1.5 text-gray-500 hover:text-black active:bg-gray-100 rounded-lg transition-colors',
          isOpen && 'bg-gray-100 text-black'
        )}
        aria-label={`Notifications${totalCount > 0 ? ` (${totalCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center leading-none ring-2 ring-white shadow-sm">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed lg:absolute top-14 lg:top-full right-2 lg:right-0 mt-0 lg:mt-1 w-[90vw] max-w-[420px] max-h-[70vh] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-[9px] font-mono text-blue-600 hover:text-blue-800 px-1.5 py-1 flex items-center gap-1"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[9px] font-mono text-gray-400 hover:text-red-600 px-1.5 py-1 flex items-center gap-1"
                    title="Clear all notifications"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-[10px] font-mono text-gray-400">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const isUnread = !notification.read;
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors relative group',
                        isUnread ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'
                      )}
                    >
                      {/* Unread indicator */}
                      {isUnread && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                      )}

                      {/* Icon */}
                      <span className="text-base flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-[11px] leading-tight',
                          isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                          {notification.body}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] font-mono text-gray-400">
                            {timeAgo(notification.timestamp)}
                          </span>
                          {notification.link && notification.link !== '/' && (
                            <a
                              href={notification.link}
                              onClick={() => markAsRead(notification.id)}
                              className="text-[8px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Open
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Mark as read"
                          >
                            <CheckCheck className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => dismiss(notification.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50/50 flex-shrink-0">
              <button
                type="button"
                onClick={() => { clearAll(); setIsOpen(false); }}
                className="text-[9px] font-mono text-gray-400 hover:text-red-600 w-full text-center"
              >
                Dismiss all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}