'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, BellRing, CheckCheck, Loader2, Clock, MessageCircle, User } from 'lucide-react';
import { apiFetch, cn, timeAgo } from '@/lib/utils';
import type { IAlert, INotification, IUser, IProject } from '@/types';

export function DashboardAlertsPane() {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState<IAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [notifResult, alertResult] = await Promise.all([
      apiFetch<{ items: INotification[]; unreadCount: number }>('/api/notifications?limit=5'),
      apiFetch<{ items: IAlert[] }>('/api/alerts?status=active&limit=5'),
    ]);

    if (notifResult.success && notifResult.data) {
      setNotifications(notifResult.data.items || []);
      setUnreadCount(notifResult.data.unreadCount || 0);
    }

    if (alertResult.success && alertResult.data) {
      const alertData = alertResult.data as unknown;
      setActiveAlerts(Array.isArray(alertData) ? alertData : (alertData as { items: IAlert[] }).items || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  const getAlertSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-400 bg-orange-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <div className="border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
              Alerts & Updates
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[9px] font-mono text-blue-600 hover:text-blue-800 px-1.5 py-0.5"
              >
                <CheckCheck className="w-2.5 h-2.5" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={fetchData}
              className="text-[9px] font-mono text-gray-400 hover:text-gray-700 px-1.5 py-0.5"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[10px] font-mono text-gray-400">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-2 text-[9px] font-mono text-blue-600 hover:text-blue-800"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {/* Active alerts section */}
          {activeAlerts.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-red-50/50 border-b border-red-100">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-red-600">
                  Active Alerts ({activeAlerts.length})
                </span>
              </div>
              {activeAlerts.map((alert) => {
                const project = typeof alert.projectId === 'object' ? alert.projectId as Partial<IProject> : null;
                const raisedBy = typeof alert.raisedBy === 'object' ? alert.raisedBy as Partial<IUser> : null;
                return (
                  <Link
                    key={alert._id}
                    href={`/alerts`}
                    className={cn(
                      'block px-4 py-2.5 transition-colors hover:bg-gray-50 border-l-2',
                      getAlertSeverityColor(alert.severity)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-900 truncate">
                          {project?.projectTitle || 'Project'}
                        </p>
                        <p className="text-[9px] text-gray-600 mt-0.5 line-clamp-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[8px] font-mono text-gray-400">
                          <span className={cn(
                            'uppercase font-bold',
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'high' ? 'text-orange-600' : 'text-gray-500'
                          )}>
                            {alert.severity}
                          </span>
                          {raisedBy?.name && <span>· {raisedBy.name}</span>}
                          <span>· {timeAgo(alert.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Notifications section */}
          {notifications.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-gray-500">
                  Recent Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
                </span>
              </div>
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={cn(
                    'relative flex items-start gap-3 px-4 py-2.5 transition-colors',
                    !notification.isRead ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                  )}
                >
                  {!notification.isRead && (
                    <div className="absolute left-2 top-3 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                  )}
                  <div className="flex-shrink-0 mt-0.5 ml-2">
                    <NotificationIcon type={notification.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        onClick={() => { if (!notification.isRead) markRead(notification._id); }}
                        className="block"
                      >
                        <p className="text-[10px] font-bold text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="text-[9px] text-gray-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <p className="text-[10px] font-bold text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="text-[9px] text-gray-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </>
                    )}
                    <p className="text-[8px] text-gray-400 font-mono mt-1">{timeAgo(notification.createdAt)}</p>
                  </div>
                  {!notification.isRead && (
                    <button
                      type="button"
                      onClick={() => markRead(notification._id)}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 mt-0.5"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeAlerts.length === 0 && notifications.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Bell className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-[10px] font-mono text-gray-400">No alerts or notifications</p>
              <p className="text-[9px] font-mono text-gray-400 mt-0.5">Everything is looking good!</p>
            </div>
          )}
        </div>
      )}

      {/* Footer links */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between">
        <Link
          href="/alerts"
          className="text-[9px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          View all alerts
        </Link>
        <Link
          href="/discussions"
          className="text-[9px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <MessageCircle className="w-2.5 h-2.5" />
          Discussions
        </Link>
      </div>
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'discussion_mention':
    case 'discussion_reply':
      return <MessageCircle className="w-3 h-3 text-blue-500" />;
    case 'task_due_soon':
    case 'task_overdue':
      return <Clock className="w-3 h-3 text-red-500" />;
    case 'task_assigned':
      return <User className="w-3 h-3 text-gray-600" />;
    case 'alert_created':
    case 'alert_acknowledged':
    case 'alert_resolved':
      return <AlertTriangle className="w-3 h-3 text-orange-500" />;
    default:
      return <BellRing className="w-3 h-3 text-gray-500" />;
  }
}