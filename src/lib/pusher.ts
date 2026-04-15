import Pusher from 'pusher';
import PusherJS from 'pusher-js';

// Server-side Pusher instance
let pusherServer: Pusher | null = null;

export function getPusherServer(): Pusher {
  if (!pusherServer) {
pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'your_app_id',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || 'your_pusher_key',
  secret: process.env.PUSHER_SECRET || 'your_pusher_secret',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
  useTLS: true,
});
  }
  return pusherServer;
}

// Channel naming conventions
export const CHANNELS = {
  project: (projectId: string) => `project-${projectId}`,
  global: 'erp-global',
  department: (dept: string) => `dept-${dept}`,
};

// Event names
export const EVENTS = {
  ALERT_CREATED: 'alert_created',
  ALERT_UPDATED: 'alert_updated',
  TASK_UPDATED: 'task_updated',
  PROJECT_STATUS_CHANGED: 'project_status_changed',
  COMMENT_ADDED: 'comment_added',
};

// Trigger helper
export async function triggerEvent(channel: string, event: string, data: unknown): Promise<void> {
  try {
    const pusher = getPusherServer();
    await pusher.trigger(channel, event, data);
  } catch (error) {
    console.error('[Pusher Error]', error);
  }
}

// Client-side hook helper
export function createPusherClient(): PusherJS {
  return new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  });
}
