'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { IAlert, ITask, ProjectStatus } from '@/types';

type EventHandlers = {
  onAlertCreated?: (alert: IAlert) => void;
  onAlertUpdated?: (alert: IAlert) => void;
  onTaskUpdated?: (task: ITask) => void;
  onProjectStatusChanged?: (data: { projectId: string; status: ProjectStatus; completionPercentage?: number }) => void;
  onCommentAdded?: (data: { comment: unknown; taskId?: string; alertId?: string }) => void;
};

/**
 * Centralized event bus for real-time data across the app.
 * Listens for custom DOM events dispatched by mutation points.
 * This is the actual implementation replacing the previous stub.
 */
export function useRealtime(channels: string[], handlers: EventHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const stableChannels = channels.join(',');
  const stableKeys = Object.keys(handlers).join(',');

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
  }, [stableChannels, stableKeys]);
}

export function useProjectRealtime(projectId: string, handlers: EventHandlers) {
  const channels = projectId
    ? [`project-${projectId}`, 'erp-global']
    : [];
  return useRealtime(channels, handlers);
}

export function useGlobalAlerts(onAlertCreated: (alert: IAlert) => void) {
  return useRealtime(['erp-global'], {
    onAlertCreated,
    onAlertUpdated: (alert) => {
      // Also trigger created callback for updates so the list stays in sync
      // This helps when alerts are acknowledged/resolved from other pages
      window.dispatchEvent(new CustomEvent('erp-alert-updated', { detail: alert }));
    },
  });
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