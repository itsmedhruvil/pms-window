// Stub for pusher - not implemented
export const triggerEvent = (..._args: unknown[]) => {
  // console.log('Pusher event:', _args);
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
};