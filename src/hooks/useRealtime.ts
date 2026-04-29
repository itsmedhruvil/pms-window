'use client';

import type { IAlert, ITask, ProjectStatus } from '@/types';

type EventHandlers = {
  onAlertCreated?: (alert: IAlert) => void;
  onAlertUpdated?: (alert: IAlert) => void;
  onTaskUpdated?: (task: ITask) => void;
  onProjectStatusChanged?: (data: { projectId: string; status: ProjectStatus; completionPercentage?: number }) => void;
  onCommentAdded?: (data: { comment: unknown; taskId?: string; alertId?: string }) => void;
};

export function useRealtime(channels: string[], handlers: EventHandlers) {
  void channels;
  void handlers;
}

export function useProjectRealtime(projectId: string, handlers: EventHandlers) {
  const channels = projectId
    ? [`project-${projectId}`, 'erp-global']
    : [];
  return useRealtime(channels, handlers);
}

export function useGlobalAlerts(onAlertCreated: (alert: IAlert) => void) {
  return useRealtime(['erp-global'], { onAlertCreated });
}
