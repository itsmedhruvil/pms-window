import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export const triggerEvent = (channel: string, event: string, data: unknown) => {
  try {
    pusher.trigger(channel, event, data);
  } catch (err) {
    console.error('[Pusher] Error triggering event:', err);
  }
};

export const CHANNELS = {
  project: (id: string) => `project-${id}`,
  global: 'erp-global',
};

export const EVENTS = {
  TASK_UPDATED: 'task-updated',
  ALERT_CREATED: 'alert-created',
  ALERT_UPDATED: 'alert-updated',
  PROJECT_STATUS_CHANGED: 'project-status-changed',
  COMMENT_ADDED: 'comment-added',
  NOTIFICATION_CREATED: 'notification-created',
};