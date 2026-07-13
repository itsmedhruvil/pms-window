/**
 * client-data.ts
 *
 * Client-side data fetching with SWR for caching, deduplication,
 * and automatic revalidation. Used in 'use client' components.
 *
 * Import this instead of raw fetch/apiFetch for recurrent data needs.
 * Data is cached globally, deduplicated across components, and
 * auto-refreshes on focus/reconnect.
 *
 * Also includes in-app notification dispatching after successful mutations.
 *
 * ── Optimistic Updates ───────────────────────────────────────────────────
 * To make AJAX updates instant, all mutations use `populateCache` to
 * immediately update the SWR cache with the server response, skipping
 * the revalidation round-trip. This makes the UI feel instant while still
 * being correct (server is the single source of truth).
 */

import useSWR, { SWRConfiguration, mutate as swrMutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiFetch } from '@/lib/utils';
import { dispatchNotification } from '@/hooks/useInAppNotifications';
import { NotificationType } from '@/types/notifications';

// ── Generic fetcher ──────────────────────────────────────────────────────────

async function fetcher<T>(url: string): Promise<T> {
  const res = await apiFetch<T>(url);
  if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Request failed');
  return res.data as T;
}

// ── Default SWR config ───────────────────────────────────────────────────────

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,       // Reduced from 5000ms — faster dedup for instant UX
  errorRetryCount: 2,
  keepPreviousData: true,       // Show stale data while revalidating
};

// ── Keys ─────────────────────────────────────────────────────────────────────

const KEYS = {
  projects: (params?: string) => params ? `/api/projects?${params}` : '/api/projects',
  project: (id: string) => `/api/projects/${id}`,
  tasks: (params?: string) => params ? `/api/tasks?${params}` : '/api/tasks',
  task: (id: string) => `/api/tasks/${id}`,
  alerts: (params?: string) => params ? `/api/alerts?${params}` : '/api/alerts',
  departments: '/api/departments',
  dashboard: '/api/dashboard',
  usersList: '/api/users',
  discussions: (params?: string) => params ? `/api/discussions?${params}` : '/api/discussions',
  discussion: (id: string) => `/api/discussions/${id}`,
  comments: (params: string) => `/api/comments?${params}`,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useProjects(params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : '';
  return useSWR(KEYS.projects(query), fetcher, defaultConfig);
}

export function useProject(id: string) {
  return useSWR(id ? KEYS.project(id) : null, fetcher, defaultConfig);
}

export function useTasks(params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : '';
  return useSWR(KEYS.tasks(query), fetcher, defaultConfig);
}

export function useTask(id: string) {
  return useSWR(id ? KEYS.task(id) : null, fetcher, defaultConfig);
}

export function useAlerts(params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : '';
  return useSWR(KEYS.alerts(query), fetcher, defaultConfig);
}

export function useDepartments() {
  return useSWR(KEYS.departments, fetcher, {
    ...defaultConfig,
    dedupingInterval: 30000, // Departments change rarely — cache 30s
  });
}

export function useDashboard() {
  return useSWR(KEYS.dashboard, fetcher, {
    ...defaultConfig,
    revalidateOnFocus: true,
    refreshInterval: 30000, // Poll every 30s
  });
}

export function useUsers(params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : '';
  return useSWR(KEYS.usersList + (query ? `?${query}` : ''), fetcher, defaultConfig);
}

// ── Helpers for instant cache updates ────────────────────────────────────────

/**
 * Update an individual entity cache key with fresh data from the mutation
 * response. This avoids a full re-fetch round-trip.
 */
function setCache<T>(key: string, data: T): void {
  void swrMutate(key, data, { revalidate: false });
}

/**
 * Invalidate only list keys (pattern-matched) so they re-fetch in the
 * background. Used when we can't compute the new list state locally
 * (e.g. deletions or filter changes).
 */
function revalidateMatching(match: string): void {
  void swrMutate(
    (key: unknown) => typeof key === 'string' && key.startsWith(match),
    undefined,
    { revalidate: true }
  );
}

// ── Mutations (POST/PATCH/DELETE with instant cache updates) ──────────────────

export function useCreateProject() {
  return useSWRMutation(
    KEYS.projects(),
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(arg) });
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to create');
      return res.data;
    },
    {
      // INSTANT UPDATE: populate cache immediately with the API response,
      // skip revalidation since we have the fresh data right here.
      populateCache: true,
      revalidate: false,
      rollbackOnError: true,
    }
  );
}

export function useUpdateProject(id: string) {
  return useSWRMutation(
    KEYS.project(id),
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      const res = await apiFetch(url, { method: 'PATCH', body: JSON.stringify(arg) });
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to update');
      return res.data;
    },
    {
      populateCache: true,
      revalidate: false,
      rollbackOnError: true,
      onSuccess: (data: any) => {
        // Also update the projects list cache if we have the data
        if (data) {
          void swrMutate(
            (key: unknown) => typeof key === 'string' && key.startsWith('/api/projects') && !key.includes(data._id),
            undefined,
            { revalidate: true }
          );
        }
      },
    }
  );
}

export function useCreateTask() {
  return useSWRMutation(
    KEYS.tasks(),
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(arg) });
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to create');
      return res.data;
    },
    {
      populateCache: true,
      revalidate: false,
      rollbackOnError: true,
      onSuccess: (data: any) => {
        // Trigger in-app notification
        if (data) {
          dispatchNotification({
            type: NotificationType.TASK_STATUS_CHANGED,
            title: '📋 New Task Created',
            body: `Task "${data.title || 'New Task'}" has been created.`,
            link: data._id ? `/tasks/${data._id}` : '/tasks',
            metadata: { taskId: data._id },
          });
        }
      },
    }
  );
}

export function useCreateAlert() {
  return useSWRMutation(
    KEYS.alerts(),
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(arg) });
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to create');
      return res.data;
    },
    {
      populateCache: true,
      revalidate: false,
      rollbackOnError: true,
      onSuccess: (data: any) => {
        // In-app notification for alert creation
        if (data) {
          const alertTypeLabel = (data.type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const projectTitle = data.projectId && typeof data.projectId === 'object' && 'projectTitle' in data.projectId
            ? (data.projectId as any).projectTitle || 'Project'
            : 'Project';

          dispatchNotification({
            type: NotificationType.ALERT_CREATED,
            title: `🚨 ${alertTypeLabel} Alert Raised`,
            body: `Alert in "${projectTitle}": ${data.message?.slice(0, 150) || 'No details'}`,
            link: '/alerts',
            metadata: { alertId: data._id, projectId: typeof data.projectId === 'object' ? data.projectId?._id : data.projectId },
          });
        }
      },
    }
  );
}

export function useUpdateAlert() {
  return useSWRMutation(
    KEYS.alerts(),
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      // arg should contain { id, action }
      const { id, ...patchData } = arg as { id: string; [key: string]: unknown };
      const res = await apiFetch(`/api/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(patchData) });
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to update alert');
      return res.data;
    },
    {
      populateCache: true,
      revalidate: false,
      rollbackOnError: true,
      onSuccess: (data: any, key: string, config: any) => {
        const arg = config?.arg as Record<string, unknown>;
        const action = arg?.action as string;
        // In-app notification for alert acknowledge/resolve
        if (data) {
          const notificationType = action === 'acknowledge' ? NotificationType.ALERT_ACKNOWLEDGED : NotificationType.ALERT_RESOLVED;
          const title = action === 'acknowledge' ? '✅ Alert Acknowledged' : '✅ Alert Resolved';
          const alertTypeLabel = (data.type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

          dispatchNotification({
            type: notificationType,
            title: `${title}: ${alertTypeLabel}`,
            body: `Alert "${data.type?.replace(/_/g, ' ') || 'Alert'}" was ${action}ed.`,
            link: '/alerts',
            metadata: { alertId: data._id },
          });
        }
      },
    }
  );
}

export function useCreateComment() {
  return useSWRMutation(
    '/api/comments',
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(arg) });
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to create comment');
      return res.data;
    },
    {
      populateCache: true,
      revalidate: false,
      rollbackOnError: true,
      onSuccess: (data: any) => {
        // If comment has mentions, show notification
        if (data?.mentions && data.mentions.length > 0) {
          dispatchNotification({
            type: NotificationType.COMMENT_MENTION,
            title: `💬 ${data.author?.name || 'Someone'} mentioned you`,
            body: `${data.content?.slice(0, 100) || ''}${(data.content?.length || 0) > 100 ? '...' : ''}`,
            link: data.taskId ? `/tasks/${data.taskId}` : data.discussionId ? '/discussions' : '/',
            metadata: {
              taskId: data.taskId,
              alertId: data.alertId,
              discussionId: data.discussionId,
            },
          });
        }
      },
    }
  );
}

export function useUpdateTaskStatus() {
  return useSWRMutation(
    KEYS.tasks(),
    async (url: string, { arg }: { arg: { taskId: string; status: string; [key: string]: unknown } }) => {
      const { taskId, ...patchData } = arg;
      const res = await apiFetch(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(patchData) });
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to update task');
      return res.data;
    },
    {
      // Don't use populateCache for list keys — we manually update the specific task cache
      populateCache: false,
      revalidate: false,
      rollbackOnError: true,
      onSuccess: (data: any) => {
        // Trigger background revalidation on list keys so other pages catch up
        if (data?._id) {
          setCache(KEYS.task(data._id), data);
          void swrMutate(
            (k: unknown) => typeof k === 'string' && k.startsWith('/api/tasks') && !k.includes(data._id),
            undefined,
            { revalidate: true }
          );
        }
        // Dispatch data change event for legacy listeners
        if (data) {
          window.dispatchEvent(new CustomEvent('app-data-changed', {
            detail: { entity: 'task', action: 'updated', data },
          }));
        }
        // In-app notification
        if (data) {
          const projectTitle = data.projectId && typeof data.projectId === 'object' && 'projectTitle' in data.projectId
            ? (data.projectId as any).projectTitle || 'Project'
            : 'Project';
          const status = data.status || 'updated';

          dispatchNotification({
            type: NotificationType.TASK_STATUS_CHANGED,
            title: `📋 Task Status Changed: ${data.title || 'Task'}`,
            body: `"${data.title || 'Task'}" in "${projectTitle}" changed to "${status}".`,
            link: data._id ? `/tasks/${data._id}` : '/tasks',
            metadata: { taskId: data._id },
          });
        }
      },
    }
  );
}

// ── Manual cache invalidation (for deletions or bulk operations) ─────────────

export function invalidateProjects() {
  void swrMutate(
    (key: unknown) => typeof key === 'string' && key.startsWith('/api/projects'),
    undefined,
    { revalidate: true }
  );
}

export function invalidateTasks() {
  void swrMutate(
    (key: unknown) => typeof key === 'string' && key.startsWith('/api/tasks'),
    undefined,
    { revalidate: true }
  );
}

export function invalidateAlerts() {
  void swrMutate(
    (key: unknown) => typeof key === 'string' && key.startsWith('/api/alerts'),
    undefined,
    { revalidate: true }
  );
}

export function useDiscussions(params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : '';
  return useSWR(KEYS.discussions(query), fetcher, {
    ...defaultConfig,
    refreshInterval: 30000, // Poll every 30s for hot reload
  });
}

export function useDiscussion(id: string) {
  return useSWR(id ? KEYS.discussion(id) : null, fetcher, defaultConfig);
}

export function invalidateDiscussions() {
  void swrMutate(
    (key: unknown) => typeof key === 'string' && key.startsWith('/api/discussions'),
    undefined,
    { revalidate: true }
  );
}

export function invalidateComments() {
  void swrMutate(
    (key: unknown) => typeof key === 'string' && key.startsWith('/api/comments'),
    undefined,
    { revalidate: true }
  );
}

export function invalidateDashboard() {
  void swrMutate(KEYS.dashboard);
}

/**
 * Invalidate all caches manually (call after mutations that affect multiple resources)
 */
export function invalidateAll() {
  void swrMutate(
    () => true,
    undefined,
    { revalidate: false }
  );
}