/**
 * client-data.ts
 *
 * Client-side data fetching with SWR for caching, deduplication,
 * and automatic revalidation. Used in 'use client' components.
 *
 * Import this instead of raw fetch/apiFetch for recurrent data needs.
 * Data is cached globally, deduplicated across components, and
 * auto-refreshes on focus/reconnect.
 */

import useSWR, { SWRConfiguration, mutate as swrMutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiFetch } from '@/lib/utils';

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
  dedupingInterval: 5000,    // Dedupe requests within 5s
  errorRetryCount: 2,
  keepPreviousData: true,    // Show stale data while revalidating
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
  notifications: '/api/notifications?limit=10',
  usersList: '/api/users',
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

export function useNotifications() {
  return useSWR(KEYS.notifications, fetcher, {
    ...defaultConfig,
    refreshInterval: 30000, // Poll every 30s
  });
}

export function useUsers(params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : '';
  return useSWR(KEYS.usersList + (query ? `?${query}` : ''), fetcher, defaultConfig);
}

// ── Mutations (POST/PATCH/DELETE with cache invalidation) ────────────────────

export function useCreateProject() {
  return useSWRMutation(
    KEYS.projects(),
    async (url: string, { arg }: { arg: Record<string, unknown> }) => {
      const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(arg) });
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to create');
      return res.data;
    },
    { onSuccess: () => { invalidateProjects(); } }
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
    { onSuccess: () => { swrMutate(KEYS.project(id)); invalidateProjects(); } }
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
    { onSuccess: () => { invalidateTasks(); } }
  );
}

// ── Manual cache invalidation ────────────────────────────────────────────────

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
