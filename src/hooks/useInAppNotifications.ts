'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationType, type InAppNotification, type NotificationEvent } from '@/types/notifications';
import { useUser } from '@clerk/nextjs';
import { apiFetch } from '@/lib/utils';

const POLL_INTERVAL = 30000; // 30 seconds
const MAX_NOTIFICATIONS = 50;

/**
 * Client-side hook for managing in-app notifications.
 * Fetches from MongoDB-backed API and falls back to localStorage.
 * Polls periodically to stay in sync across tabs/devices.
 */
export function useInAppNotifications() {
  const { isSignedIn, user } = useUser();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!isSignedIn) return;

    // Abort any in-flight request
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    fetchAbortRef.current = new AbortController();

    try {
      const res = await apiFetch<{
        data: Array<{
          id: string;
          type: string;
          title: string;
          body: string;
          link: string;
          timestamp: string;
          read: boolean;
          dismissed: boolean;
          metadata?: Record<string, unknown>;
        }>;
        unreadCount: number;
      }>('/api/notifications?limit=50');

      if (res.success && res.data) {
        const mapped: InAppNotification[] = res.data.data.map((n) => ({
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          body: n.body,
          link: n.link,
          timestamp: new Date(n.timestamp),
          read: n.read,
          metadata: n.metadata,
        }));

        setNotifications(mapped);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Silently handle fetch errors
    }
  }, [isSignedIn]);

  // Initial fetch + setup polling
  useEffect(() => {
    if (!isSignedIn) return;

    fetchNotifications();

    // Poll for new notifications
    pollingRef.current = setInterval(fetchNotifications, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, [isSignedIn, fetchNotifications]);

  // Listen for real-time notification events (from client mutations)
  useEffect(() => {
    if (!isSignedIn) return;

    const handleNotificationEvent = async (_event: Event) => {
      // Re-fetch from API when a new notification is dispatched client-side
      await fetchNotifications();
    };

    window.addEventListener('pms-notification', handleNotificationEvent);
    return () => window.removeEventListener('pms-notification', handleNotificationEvent);
  }, [isSignedIn, fetchNotifications]);

  // Clear all notifications (marks dismissed on server)
  const clearAll = useCallback(async () => {
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'clear-all' }),
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // Silently handle
    }
  }, []);

  // Mark a single notification as read on the server
  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'read' }),
      });
      setNotifications((prev) => {
        const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        setUnreadCount(updated.filter((n) => !n.read).length);
        return updated;
      });
    } catch {
      // Silently handle
    }
  }, []);

  // Mark all as read on the server
  const markAllAsRead = useCallback(async () => {
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      setNotifications((prev) => {
        const updated = prev.map((n) => ({ ...n, read: true })) as InAppNotification[];
        setUnreadCount(0);
        return updated;
      });
    } catch {
      // Silently handle
    }
  }, []);

  // Dismiss a single notification on the server
  const dismiss = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'dismiss' }),
      });
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== id);
        setUnreadCount(updated.filter((n) => !n.read).length);
        return updated;
      });
    } catch {
      // Silently handle
    }
  }, []);

  return {
    notifications,
    unreadCount,
    clearAll,
    markAsRead,
    markAllAsRead,
    dismiss,
    refresh: fetchNotifications,
  };
}

/**
 * Dispatch an in-app notification event.
 * Call this from API routes or client-side code to show a notification.
 */
export function dispatchNotification(notification: NotificationEvent): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('pms-notification', {
    detail: notification,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

/**
 * Get the appropriate link for a notification type
 */
export function getNotificationLink(type: NotificationType, metadata?: Record<string, unknown>): string {
  switch (type) {
    case NotificationType.ALERT_CREATED:
    case NotificationType.ALERT_ACKNOWLEDGED:
    case NotificationType.ALERT_RESOLVED:
      return '/alerts';
    case NotificationType.TASK_ASSIGNED:
    case NotificationType.TASK_STATUS_CHANGED:
      return metadata?.taskId ? `/tasks/${metadata.taskId}` : '/tasks';
    case NotificationType.COMMENT_MENTION:
      if (metadata?.taskId) return `/tasks/${metadata.taskId}`;
      if (metadata?.discussionId) return '/discussions';
      if (metadata?.alertId) return '/alerts';
      return '/';
    case NotificationType.DISCUSSION_REPLY:
    case NotificationType.DISCUSSION_CREATED:
      return '/discussions';
    default:
      return '/';
  }
}