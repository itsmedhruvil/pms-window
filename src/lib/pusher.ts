// Realtime is temporarily disabled. Keep these names exported so callers can
// continue to describe events without depending on a provider.
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

export async function triggerEvent(
  _channel: string,
  _event: string,
  _data: unknown,
): Promise<void> {
  return Promise.resolve();
}
