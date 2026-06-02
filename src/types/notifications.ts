/**
 * In-app notification types for the PMS system.
 * These are displayed in the notification bell dropdown.
 */

export enum NotificationType {
  ALERT_CREATED = 'alert_created',
  ALERT_ACKNOWLEDGED = 'alert_acknowledged',
  ALERT_RESOLVED = 'alert_resolved',
  TASK_ASSIGNED = 'task_assigned',
  TASK_STATUS_CHANGED = 'task_status_changed',
  COMMENT_MENTION = 'comment_mention',
  DISCUSSION_REPLY = 'discussion_reply',
  DISCUSSION_CREATED = 'discussion_created',
}

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  timestamp: Date;
  read: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Notification event dispatched from the server or client.
 * Components listen for this event to update the notification bell.
 */
export interface NotificationEvent {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  metadata?: Record<string, unknown>;
}