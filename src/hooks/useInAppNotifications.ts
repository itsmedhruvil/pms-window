'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationType, type InAppNotification, type NotificationEvent } from '@/types/notifications';
import { useUser } from '@clerk/nextjs';

const STORAGE_KEY = 'pms-in-app-notifications';
const MAX_NOTIFICATIONS = 50;

/**
 * Client-side hook for managing in-app notifications.
 * Notifications are stored in localStorage and dispatched via custom events.
 * This allows notifications to survive page refreshes within the same session.
 */
export function useInAppNotifications() {
  const { isSignedIn } = useUser();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const initializedRef = useRef(false);

  // Load persisted notifications on mount
  useEffect(() => {
    if (!isSignedIn || initializedRef.current) return;
    initializedRef.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as InAppNotification[];
        setNotifications(parsed);
        setUnreadCount(parsed.filter((n) => !n.read).length);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isSignedIn]);

  // Persist to localStorage whenever notifications change
  useEffect(() => {
    if (!isSignedIn) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // localStorage full or unavailable - silently fail
    }
  }, [notifications, isSignedIn]);

  // Listen for in-app notification events
  useEffect(() => {
    if (!isSignedIn) return;

    const handleNotificationEvent = (event: Event) => {
      const detail = (event as CustomEvent<NotificationEvent>).detail;
      if (!detail) return;

      const newNotification: InAppNotification = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: detail.type,
        title: detail.title,
        body: detail.body,
        link: detail.link,
        timestamp: new Date(),
        read: false,
        metadata: detail.metadata,
      };

      setNotifications((prev) => {
        const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
        return updated;
      });
      setUnreadCount((prev) => prev + 1);
    };

    window.addEventListener('pms-notification', handleNotificationEvent);
    return () => window.removeEventListener('pms-notification', handleNotificationEvent);
  }, [isSignedIn]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Mark a single notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      setUnreadCount(updated.filter((n) => !n.read).length);
      return updated;
    });
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true })) as InAppNotification[];
      setUnreadCount(0);
      return updated;
    });
  }, []);

  // Dismiss a single notification
  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      setUnreadCount(updated.filter((n) => !n.read).length);
      return updated;
    });
  }, []);

  return {
    notifications,
    unreadCount,
    clearAll,
    markAsRead,
    markAllAsRead,
    dismiss,
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