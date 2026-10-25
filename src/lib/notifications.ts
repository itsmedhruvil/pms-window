/**
 * notifications.ts
 *
 * Unified notification service that delivers notifications through both
 * channels:
 * - Firebase Cloud Messaging (push, when the user allowed notifications)
 * - MongoDB (in-app bell, always available and synced across devices)
 */

import connectDB from '@/lib/db';
import { isFcmConfigured, sendFcmPushToUsers } from '@/lib/firebase-admin';
import { NotificationType } from '@/types/notifications';

// ─── Notification Design Helpers ──────────────────────────────────────────────

export interface RichNotificationConfig {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  userIds: string[];
  /** Users that should never receive this notification (e.g. the actor). */
  excludeUserIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Emoji + accent colour for each notification type. The emoji is added to the
 * title in the bell and push payload, so titles stay consistent everywhere.
 */
export function getNotificationIcon(type: NotificationType): { emoji: string; hexColor: string } {
  switch (type) {
    case NotificationType.ALERT_CREATED:
      return { emoji: '🚨', hexColor: '#DC2626' };
    case NotificationType.ALERT_ACKNOWLEDGED:
      return { emoji: '👀', hexColor: '#D97706' };
    case NotificationType.ALERT_RESOLVED:
      return { emoji: '✅', hexColor: '#059669' };
    case NotificationType.TASK_ASSIGNED:
    case NotificationType.INTERNAL_TASK_ASSIGNED:
      return { emoji: '📋', hexColor: '#2563EB' };
    case NotificationType.TASK_STATUS_CHANGED:
      return { emoji: '🔄', hexColor: '#7C3AED' };
    case NotificationType.TASK_OVERDUE:
      return { emoji: '⏰', hexColor: '#DC2626' };
    case NotificationType.TASK_PENDING:
      return { emoji: '📋', hexColor: '#D97706' };
    case NotificationType.COMMENT_MENTION:
      return { emoji: '💬', hexColor: '#D97706' };
    case NotificationType.DISCUSSION_REPLY:
      return { emoji: '💬', hexColor: '#14B8A6' };
    case NotificationType.DISCUSSION_CREATED:
      return { emoji: '💡', hexColor: '#14B8A6' };
    case NotificationType.PROJECT_CREATED:
      return { emoji: '📦', hexColor: '#0891B2' };
    default:
      return { emoji: '🔔', hexColor: '#6B7280' };
  }
}

/** Prefix a title with its emoji unless the caller already included one. */
function withIcon(title: string, emoji: string): string {
  // \p{Extended_Pictographic} catches emoji already prepended by callers.
  return /^\p{Extended_Pictographic}/u.test(title.trim()) ? title : `${emoji} ${title}`;
}

/** Turn arbitrary metadata values into strings, as required by FCM. */
function toFcmData(metadata: Record<string, unknown> | undefined): Record<string, string> {
  if (!metadata) return {};
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    data[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return data;
}

// ─── Unified Dispatch ─────────────────────────────────────────────────────────

/**
 * Send a notification to multiple users via the in-app bell and (optionally)
 * push. In-app notifications are persisted to MongoDB so they survive
 * refreshes and are shared across devices.
 */
export async function notifyUsers(config: RichNotificationConfig): Promise<void> {
  const { type, title, body, link, metadata } = config;

  const excluded = new Set((config.excludeUserIds || []).map(String));
  const userIds = Array.from(new Set(config.userIds.map(String))).filter(
    (id) => id && !excluded.has(id)
  );

  if (userIds.length === 0) return;

  const icon = getNotificationIcon(type);
  const displayTitle = withIcon(title, icon.emoji);

  try {
    await connectDB();
    const NotificationModel = (await import('@/models/Notification')).default;

    await NotificationModel.insertMany(
      userIds.map((userId) => ({
        userId,
        type,
        title: displayTitle,
        body,
        link,
        read: false,
        dismissed: false,
        metadata: {
          ...(metadata || {}),
          icon: icon.emoji,
          color: icon.hexColor,
        },
      }))
    );
  } catch (error) {
    // The bell is the primary channel — never let persistence break the API.
    console.error('[notifications] Failed to persist in-app notification:', error);
  }

  // Push delivery only makes sense when the Admin SDK is configured.
  if (!isFcmConfigured()) return;

  try {
    await connectDB();
    const UserModel = (await import('@/models/User')).default;
    const users = await UserModel.find({
      _id: { $in: userIds },
      isActive: true,
      fcmToken: { $nin: ['', null] },
    })
      .select('fcmToken')
      .lean();

    const tokens = users
      .map((u: { fcmToken?: string | null }) => u.fcmToken)
      .filter((token: string | null | undefined): token is string => Boolean(token));

    if (tokens.length > 0) {
      await sendFcmPushToUsers(tokens, displayTitle, body, link, {
        type,
        icon: icon.emoji,
        color: icon.hexColor,
        ...toFcmData(metadata),
      });
    }
  } catch (error) {
    // Push failures must not affect the API response.
    console.error('[notifications] Push delivery failed:', error);
  }
}
