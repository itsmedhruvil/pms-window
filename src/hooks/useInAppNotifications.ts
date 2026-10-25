'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationType, type InAppNotification } from '@/types/notifications';
import { useUser } from '@clerk/nextjs';
import { apiFetch } from '@/lib/utils';

/** Fallback polling interval. Push + window focus trigger instant refreshes. */
const POLL_INTERVAL = 30_000;
const MAX_NOTIFICATIONS = 50;

interface SerializedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Client-side hook for managing in-app notifications.
 *
 * The bell is backed by MongoDB (see /api/notifications) so notifications are
 * consistent across tabs and devices. Refreshes happen:
 * - on mount and when the tab becomes visible again
 * - after a foreground FCM message (the FCM provider emits `pms-notification`)
 * - on a low-frequency poll while the tab is visible
 */
export function useInAppNotifications() {
  const { isSignedIn } = useUser();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isSignedIn) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await apiFetch<{ items: SerializedNotification[]; unreadCount: number }>(
        `/api/notifications?limit=${MAX_NOTIFICATIONS}`
      );

      if (controller.signal.aborted || !res.success || !res.data) return;

      const mapped: InAppNotification[] = res.data.items.map((n) => ({
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
    } catch {
      // Network hiccups are expected; the next poll will retry.
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [isSignedIn]);

  // Initial fetch + polling (paused while the tab is hidden to save requests).
  useEffect(() => {
    if (!isSignedIn) return;

    setIsLoading(true);
    void fetchNotifications();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    }, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      abortRef.current?.abort();
    };
  }, [isSignedIn, fetchNotifications]);

  // Foreground push + client-side mutations both emit this event.
  useEffect(() => {
    if (!isSignedIn) return;

    const handleNotificationEvent = () => {
      void fetchNotifications();
    };

    window.addEventListener('pms-notification', handleNotificationEvent);
    return () => window.removeEventListener('pms-notification', handleNotificationEvent);
  }, [isSignedIn, fetchNotifications]);

  // Clear all notifications (marks dismissed on server)
  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'clear-all' }),
      });
    } catch {
      // Local state already cleared; next fetch reconciles with the server.
    }
  }, []);

  // Mark a single notification as read on the server
  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => {
      let wasUnread = false;
      const updated = prev.map((n) => {
        if (n.id !== id) return n;
        if (!n.read) wasUnread = true;
        return { ...n, read: true };
      });
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
      return updated;
    });

    try {
      await apiFetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'read' }),
      });
    } catch {
      // Server sync is best-effort; the next poll repairs state.
    }
  }, []);

  // Mark all as read on the server
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
    } catch {
      // Server sync is best-effort.
    }
  }, []);

  // Dismiss a single notification on the server
  const dismiss = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.read) setUnreadCount((count) => Math.max(0, count - 1));
      return prev.filter((n) => n.id !== id);
    });

    try {
      await apiFetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'dismiss' }),
      });
    } catch {
      // Server sync is best-effort.
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    clearAll,
    markAsRead,
    markAllAsRead,
    dismiss,
    refresh: fetchNotifications,
  };
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
    case NotificationType.INTERNAL_TASK_ASSIGNED:
      return '/internal-tasks';
    case NotificationType.TASK_PENDING:
      return metadata?.isInternal ? '/internal-tasks' : '/tasks';
    case NotificationType.TASK_OVERDUE:
      return metadata?.taskId ? `/tasks/${metadata.taskId}` : '/tasks';
    case NotificationType.COMMENT_MENTION:
      if (metadata?.taskId) return `/tasks/${metadata.taskId}`;
      if (metadata?.discussionId) return '/discussions';
      if (metadata?.alertId) return '/alerts';
      return '/';
    case NotificationType.DISCUSSION_REPLY:
    case NotificationType.DISCUSSION_CREATED:
      return metadata?.discussionId ? `/discussions?thread=${metadata.discussionId}` : '/discussions';
    default:
      return '/';
  }
}