'use client';

import { useEffect, useRef, useCallback } from 'react';
import PusherJS from 'pusher-js';
import { EVENTS } from '@/lib/pusher';
import type { IAlert, ITask, ProjectStatus } from '@/types';

type EventHandlers = {
  onAlertCreated?: (alert: IAlert) => void;
  onAlertUpdated?: (alert: IAlert) => void;
  onTaskUpdated?: (task: ITask) => void;
  onProjectStatusChanged?: (data: { projectId: string; status: ProjectStatus; completionPercentage?: number }) => void;
  onCommentAdded?: (data: { comment: unknown; taskId?: string; alertId?: string }) => void;
};

export function useRealtime(channels: string[], handlers: EventHandlers) {
  const pusherRef = useRef<PusherJS | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref updated without re-subscribing
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!channels.length) return;

    const pusher = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    pusherRef.current = pusher;

    const subscribedChannels = channels.map((channelName) => {
      const channel = pusher.subscribe(channelName);

      channel.bind(EVENTS.ALERT_CREATED, (data: IAlert) => {
        handlersRef.current.onAlertCreated?.(data);
      });

      channel.bind(EVENTS.ALERT_UPDATED, (data: IAlert) => {
        handlersRef.current.onAlertUpdated?.(data);
      });

      channel.bind(EVENTS.TASK_UPDATED, (data: ITask) => {
        handlersRef.current.onTaskUpdated?.(data);
      });

      channel.bind(EVENTS.PROJECT_STATUS_CHANGED, (data: { projectId: string; status: ProjectStatus }) => {
        handlersRef.current.onProjectStatusChanged?.(data);
      });

      channel.bind(EVENTS.COMMENT_ADDED, (data: unknown) => {
        handlersRef.current.onCommentAdded?.(data as { comment: unknown; taskId?: string; alertId?: string });
      });

      return channel;
    });

    return () => {
      subscribedChannels.forEach((ch) => ch.unbind_all());
      channels.forEach((name) => pusher.unsubscribe(name));
      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [channels.join(',')]);
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
