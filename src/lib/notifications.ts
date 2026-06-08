/**
 * notifications.ts
 *
 * Unified notification service that sends both push notifications (via OneSignal)
 * AND persists in-app notifications to MongoDB so they survive across devices.
 *
 * Every notification type gets:
 * - Push notification via OneSignal (with action buttons, icons, grouping)
 * - MongoDB document for the in-app notification bell
 * - De-duplicated user targeting
 */

import connectDB from '@/lib/db';
import { sendRichPush, type OneSignalPayload } from '@/lib/onesignal';
import { NotificationType } from '@/types/notifications';

// ─── Notification Design Helpers ──────────────────────────────────────────────

interface RichNotificationConfig {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  userIds: string[];
  /**
   * For notifications that should go to all users of a role (e.g. admins).
   * Provide the role name for the target audience label.
   */
  targetAudience?: string;
  metadata?: Record<string, unknown>;
  /**
   * Optional: A larger image URL to include in the notification (big picture).
   */
  imageUrl?: string;
}

/**
 * Get the appropriate emoji + color-coded icon for each notification type.
 */
function getNotificationIcon(type: NotificationType): { emoji: string; hexColor: string; label: string } {
  switch (type) {
    case NotificationType.ALERT_CREATED:
      return { emoji: '🚨', hexColor: '#EF4444', label: 'Alert Raised' };
    case NotificationType.ALERT_ACKNOWLEDGED:
      return { emoji: '✅', hexColor: '#10B981', label: 'Alert Acknowledged' };
    case NotificationType.ALERT_RESOLVED:
      return { emoji: '🟢', hexColor: '#059669', label: 'Alert Resolved' };
    case NotificationType.TASK_ASSIGNED:
      return { emoji: '👤', hexColor: '#3B82F6', label: 'Task Assigned' };
    case NotificationType.TASK_STATUS_CHANGED:
      return { emoji: '📋', hexColor: '#8B5CF6', label: 'Task Updated' };
    case NotificationType.COMMENT_MENTION:
      return { emoji: '💬', hexColor: '#F59E0B', label: 'Mention' };
    case NotificationType.DISCUSSION_REPLY:
      return { emoji: '💬', hexColor: '#6366F1', label: 'Discussion Reply' };
    case NotificationType.DISCUSSION_CREATED:
      return { emoji: '💡', hexColor: '#14B8A6', label: 'New Discussion' };
    case NotificationType.PROJECT_CREATED:
      return { emoji: '📦', hexColor: '#0891B2', label: 'New Project' };
    case NotificationType.INTERNAL_TASK_ASSIGNED:
      return { emoji: '📋', hexColor: '#7C3AED', label: 'Internal Task Assigned' };
    case NotificationType.TASK_OVERDUE:
      return { emoji: '⏰', hexColor: '#DC2626', label: 'Task Overdue' };
    default:
      return { emoji: '🔔', hexColor: '#6B7280', label: 'Notification' };
  }
}

/**
 * Build a design-rich OneSignal push notification payload with:
 * - Action buttons for common workflows
 * - Thread grouping so notifications of same type are stacked
 * - Big picture / large icon support
 * - Prioritization (alert = high priority, other = normal)
 */
function buildRichPushPayload(config: RichNotificationConfig): OneSignalPayload {
  const { type, title, body, link, userIds, metadata, imageUrl } = config;
  const icon = getNotificationIcon(type);
  const targetUrl = link || '/';

  // Build action buttons based on notification type
  const webButtons: Array<{ id: string; text: string; icon?: string; url?: string }> = [
    { id: 'open', text: '🔍 Open', url: targetUrl },
  ];

  // Add type-specific actions
  switch (type) {
    case NotificationType.TASK_ASSIGNED:
      webButtons.push({ id: 'view-task', text: '📋 View Task', url: targetUrl });
      break;
    case NotificationType.INTERNAL_TASK_ASSIGNED:
      webButtons.push({ id: 'view-task', text: '📋 View Task', url: targetUrl });
      break;
    case NotificationType.ALERT_CREATED:
      webButtons.push({ id: 'view-alerts', text: '🚨 View Alerts', url: '/alerts' });
      break;
    case NotificationType.ALERT_ACKNOWLEDGED:
    case NotificationType.ALERT_RESOLVED:
      webButtons.push({ id: 'view-alerts', text: '✅ View Status', url: '/alerts' });
      break;
    case NotificationType.COMMENT_MENTION:
      webButtons.push({ id: 'reply', text: '💬 Reply', url: targetUrl });
      break;
    case NotificationType.DISCUSSION_REPLY:
    case NotificationType.DISCUSSION_CREATED:
      webButtons.push({ id: 'view-discussion', text: '💡 View Discussion', url: targetUrl });
      break;
    case NotificationType.TASK_STATUS_CHANGED:
      webButtons.push({ id: 'view-task', text: '📋 View Task', url: targetUrl });
      break;
    case NotificationType.PROJECT_CREATED:
      webButtons.push({ id: 'view-project', text: '📦 View Project', url: targetUrl });
      break;
    case NotificationType.TASK_OVERDUE:
      webButtons.push({ id: 'view-tasks', text: '⏰ View Tasks', url: targetUrl });
      break;
  }

  return {
    app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
    include_external_user_ids: userIds,
    headings: { en: title },
    contents: { en: body },
    subtitle: { en: icon.label },
    url: targetUrl,
    icon: '/icons/icon-192x192.png',
    web_url: targetUrl,
    launch_url: targetUrl,
    isAnyWeb: true,
    data: {
      url: targetUrl,
      click_action: targetUrl,
      route: targetUrl,
      type,
      icon: icon.emoji,
      color: icon.hexColor,
      imageUrl: imageUrl || undefined,
      ...(metadata || {}),
    },
    big_picture: imageUrl || undefined,
    chrome_web_image: imageUrl || undefined,
    web_buttons: webButtons,
    thread_id: `pms-${type}`,
    priority: type.startsWith('alert') || type === NotificationType.TASK_OVERDUE ? 10 : 5,
  };
}

// ─── Unified Dispatch ─────────────────────────────────────────────────────────

/**
 * Send a rich notification to multiple users via both push AND in-app channels.
 * In-app notifications are persisted to MongoDB.
 */
export async function notifyUsers(config: RichNotificationConfig): Promise<void> {
  const { type, title, body, link, userIds, metadata } = config;

  if (userIds.length === 0) return;

  // 1. Send DESIGN-RICH push notification via OneSignal (fire-and-forget)
  const richPayload = buildRichPushPayload(config);
  sendRichPush(richPayload).catch(() => {
    // Push failures are non-critical
  });

  // 2. Persist in-app notifications to MongoDB for each user
  try {
    await connectDB();
    const NotificationModel = (await import('@/models/Notification')).default;

    const icon = getNotificationIcon(type);
    const notificationDocs = userIds.map((userId) => ({
      userId,
      type,
      title: `${icon.emoji} ${title}`,
      body,
      link,
      read: false,
      dismissed: false,
      metadata: {
        ...(metadata || {}),
        icon: icon.emoji,
        color: icon.hexColor,
      },
    }));

    await NotificationModel.insertMany(notificationDocs);
  } catch {
    // Persistence failures are non-critical
  }
}

// ─── Notification Constants ───────────────────────────────────────────────────

export const NOTIFICATION_CHANNELS = {
  alert: {
    id: 'pms-alerts',
    description: 'Project alerts and warnings',
    importance: 'high' as const,
  },
  task: {
    id: 'pms-tasks',
    description: 'Task assignments and updates',
    importance: 'high' as const,
  },
  discussion: {
    id: 'pms-discussions',
    description: 'Discussion replies and mentions',
    importance: 'normal' as const,
  },
  mention: {
    id: 'pms-mentions',
    description: '@mentions in comments',
    importance: 'high' as const,
  },
};

// ─── Notification Helpers ─────────────────────────────────────────────────────

/**
 * Helper to mark the source of a notification for analytics.
 */
export interface NotificationSource {
  entityType: 'task' | 'alert' | 'project' | 'discussion' | 'comment';
  entityId: string;
  action: 'created' | 'updated' | 'assigned' | 'acknowledged' | 'resolved' | 'mentioned' | 'replied';
}

/**
 * Get a human-readable description of who should receive a notification.
 */
export function getAudienceLabel(count: number): string {
  if (count === 0) return 'No one';
  if (count === 1) return '1 user';
  return `${count} users`;
}

// Re-export for convenience
export { sendPushToOneSignalUsers } from '@/lib/onesignal';
export type { OneSignalPayload } from '@/lib/onesignal';