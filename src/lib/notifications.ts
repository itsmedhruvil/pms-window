/**
 * notifications.ts
 *
 * Unified notification service that sends both push notifications (via FCM)
 * AND persists in-app notifications to MongoDB so they survive across devices.
 *
 * Every notification type gets:
 * - Push notification via Firebase Cloud Messaging (FCM)
 * - MongoDB document for the in-app notification bell
 * - De-duplicated user targeting
 */

import connectDB from '@/lib/db';
import { sendFcmPushToUsers } from '@/lib/firebase-admin';
import { NotificationType } from '@/types/notifications';

type DeliverableNotificationType =
  | NotificationType.TASK_PENDING
  | NotificationType.PROJECT_CREATED
  | NotificationType.DISCUSSION_CREATED;

// ─── Notification Design Helpers ──────────────────────────────────────────────

interface RichNotificationConfig {
  type: DeliverableNotificationType;
  title: string;
  body: string;
  link: string;
  userIds: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Get the appropriate emoji + color-coded icon for each notification type.
 */
function getNotificationIcon(type: DeliverableNotificationType): { emoji: string; hexColor: string } {
  switch (type) {
    case NotificationType.DISCUSSION_CREATED:
      return { emoji: '💡', hexColor: '#14B8A6' };
    case NotificationType.PROJECT_CREATED:
      return { emoji: '📦', hexColor: '#0891B2' };
    case NotificationType.TASK_PENDING:
      return { emoji: '📋', hexColor: '#D97706' };
    default:
      return { emoji: '🔔', hexColor: '#6B7280' };
  }
}

// ─── Unified Dispatch ─────────────────────────────────────────────────────────

/**
 * Send a rich notification to multiple users via both push AND in-app channels.
 * In-app notifications are persisted to MongoDB.
 */
export async function notifyUsers(config: RichNotificationConfig): Promise<void> {
  const { type, title, body, link, userIds, metadata } = config;

  if (userIds.length === 0) return;

  // Persist first so foreground clients can immediately load the notification.
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

  // Send push notifications after persistence so clients can immediately refresh.
  try {
    await connectDB();
    const UserModel = (await import('@/models/User')).default;
    const users = await UserModel.find({
      _id: { $in: userIds },
      fcmToken: { $ne: '', $exists: true },
    }).select('fcmToken').lean();

    const tokens = users
      .map((u: { fcmToken?: string }) => u.fcmToken)
      .filter((token: string | undefined): token is string => Boolean(token));

    if (tokens.length > 0) {
      const icon = getNotificationIcon(type);
      const fcmData: Record<string, string> = {
        type,
        icon: icon.emoji,
        color: icon.hexColor,
        ...(metadata ? Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [key, String(value)])
        ) : {}),
      };
      await sendFcmPushToUsers(tokens, title, body, link, fcmData);
    }
  } catch {
    // Push failures are non-critical
  }
}
