'use client';

import { useEffect, useRef } from 'react';
import type { IAlert, ITask, ProjectStatus } from '@/types';

type EventHandlers = {
  onAlertCreated?: (alert: IAlert) => void;
  onAlertUpdated?: (alert: IAlert) => void;
  onTaskUpdated?: (task: ITask) => void;
  onProjectStatusChanged?: (data: { projectId: string; status: ProjectStatus; completionPercentage?: number }) => void;
  onCommentAdded?: (data: { comment: unknown; taskId?: string; alertId?: string }) => void;
};

/**
 * Local event bus for refreshing app data after mutations.
 */
export function useRealtime(handlers: EventHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleDataChange = (e: Event) => {
      const detail = (e as CustomEvent<{ entity: string; action: string; data?: unknown }>).detail;
      if (!detail) return;

      const { entity, action, data } = detail;
      const h = handlersRef.current;

      // Alert events
      if (entity === 'alert') {
        if (action === 'created' && h.onAlertCreated) {
          h.onAlertCreated(data as IAlert);
        } else if ((action === 'updated' || action === 'resolved') && h.onAlertUpdated) {
          h.onAlertUpdated(data as IAlert);
        }
      }

      // Task events
      if (entity === 'task' && action === 'updated' && h.onTaskUpdated) {
        h.onTaskUpdated(data as ITask);
      }

      // Project status events
      if (entity === 'project' && action === 'status_changed' && h.onProjectStatusChanged) {
        h.onProjectStatusChanged(data as { projectId: string; status: ProjectStatus; completionPercentage?: number });
      }

      // Comment events
      if (entity === 'comment' && action === 'added' && h.onCommentAdded) {
        h.onCommentAdded(data as { comment: unknown; taskId?: string; alertId?: string });
      }
    };

    window.addEventListener('app-data-changed', handleDataChange);
    return () => window.removeEventListener('app-data-changed', handleDataChange);
  }, []);
}

/**
 * Dispatch a data change event that all useRealtime hooks will pick up.
 * Call this at every mutation point (create, update, delete).
 */
export function dispatchDataChange(entity: string, action: string, data?: unknown): void {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent('app-data-changed', {
    detail: { entity, action, data },
    bubbles: true,
  });
  window.dispatchEvent(event);

  // Also dispatch legacy per-entity events for backward compatibility
  if (entity === 'alert') {
    const legacyEventName = action === 'created' ? 'erp-alert-created'
      : action === 'deleted' ? 'erp-alert-deleted'
      : 'erp-alert-updated';
    window.dispatchEvent(new CustomEvent(legacyEventName, { detail: data }));
  }

  // Dispatch page-level refresh events
  if (entity === 'task') {
    window.dispatchEvent(new CustomEvent('erp-task-updated', { detail: data }));
  }
  if (entity === 'project') {
    window.dispatchEvent(new CustomEvent('erp-project-updated', { detail: data }));
  }
}