'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { apiFetch, getDepartmentAbbreviation, getDepartmentLabel } from '@/lib/utils';
import { DEPARTMENT_SEQUENCE } from '@/types';
import type { Department } from '@/types';

export interface ClientDepartment {
  _id?: string;
  name: Department;
  label: string;
  abbreviation: string;
  sequence: number;
  isActive: boolean;
}

const fallbackDepartments: ClientDepartment[] = DEPARTMENT_SEQUENCE.map((name, sequence) => ({
  name,
  label: getDepartmentLabel(name),
  abbreviation: getDepartmentAbbreviation(name),
  sequence,
  isActive: true,
}));

/**
 * Cache the last successful department list in memory + localStorage.
 *
 * The previous implementation always initialised state with the six hard-coded
 * fallback departments and only added custom departments (Marketing, Admin, …)
 * after `/api/departments` resolved. Since AppLayout remounts on every route
 * change, those custom entries disappeared and flashed back in on every
 * navigation. A shared cache gives an instant, correct first render.
 */
const CACHE_KEY = 'pms-departments-cache-v1';
let moduleCache: ClientDepartment[] | null = null;
let inFlight: Promise<ClientDepartment[]> | null = null;
/** Guards against an older in-flight response overwriting a newer mutation. */
let cacheGeneration = 0;

/** useLayoutEffect on the client, useEffect during SSR (no SSR warning). */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function isDepartmentList(value: unknown): value is ClientDepartment[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as ClientDepartment).name === 'string' &&
        typeof (item as ClientDepartment).label === 'string'
    )
  );
}

function readStoredCache(): ClientDepartment[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDepartmentList(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredCache(departments: ClientDepartment[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(departments));
  } catch {
    // Storage can be unavailable (private mode/quota) — memory cache still works.
  }
}

function getInitialDepartments(): ClientDepartment[] {
  // Module cache is populated after the first fetch and survives route changes
  // within the same tab, so navigation never shows the fallback-only list.
  return moduleCache ?? readStoredCache() ?? fallbackDepartments;
}

/** Custom event name emitted when departments are created, updated, or deleted */
export const DEPARTMENTS_CHANGED_EVENT = 'erp-departments-changed';

/** Fire the departments-changed event so all hooks refetch */
export function notifyDepartmentsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED_EVENT));
  }
}

async function loadDepartmentsFromApi(): Promise<ClientDepartment[]> {
  try {
    const result = await apiFetch<ClientDepartment[]>('/api/departments');

    if (result.success && result.data && result.data.length > 0) {
      // The database is authoritative once it has departments. Do NOT merge
      // the hard-coded fallback here — doing so resurrected departments that
      // had been renamed/deleted in Settings on every fetch (the "flashing"
      // ghost entries). Fallbacks are only used when the DB is empty/unseeded.
      return [...result.data].sort(
        (a, b) => a.sequence - b.sequence || a.label.localeCompare(b.label)
      );
    }
  } catch {
    // Network error — fall through to cache/fallback.
  }
  return getInitialDepartments();
}

async function fetchDepartments(force = false): Promise<ClientDepartment[]> {
  if (force) {
    // After a create/update/delete the caller must not reuse an older
    // in-flight response that started before the mutation.
    const generation = ++cacheGeneration;
    inFlight = null;
    const data = await loadDepartmentsFromApi();
    if (generation === cacheGeneration) {
      moduleCache = data;
      writeStoredCache(data);
    }
    return data;
  }

  if (!inFlight) {
    const generation = cacheGeneration;
    inFlight = loadDepartmentsFromApi()
      .then((data) => {
        // A mutation may have completed while this request was in-flight.
        if (generation === cacheGeneration) {
          moduleCache = data;
          writeStoredCache(data);
        }
        return data;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useDepartments(includeInactive = false) {
  // Module cache is available on client-side remounts (normal navigation), so
  // custom departments render immediately. localStorage is applied in an
  // effect to avoid a server/client hydration mismatch on hard reloads.
  const [departments, setDepartments] = useState<ClientDepartment[]>(
    () => moduleCache ?? fallbackDepartments
  );

  // Apply the persisted list before paint on a hard reload so custom
  // departments never flash from the fallback-only list.
  useIsomorphicLayoutEffect(() => {
    const cached = readStoredCache();
    if (cached) setDepartments(cached);
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchDepartments().then((data) => {
      if (mounted) setDepartments(data);
    });

    // Listen for changes emitted after create/update/delete.
    const handleChange = () => {
      fetchDepartments(true).then((data) => {
        if (mounted) setDepartments(data);
      });
    };
    window.addEventListener(DEPARTMENTS_CHANGED_EVENT, handleChange);

    return () => {
      mounted = false;
      window.removeEventListener(DEPARTMENTS_CHANGED_EVENT, handleChange);
    };
  }, []);

  return useMemo(
    () => departments.filter((department) => includeInactive || department.isActive),
    [departments, includeInactive]
  );
}

/** Convenience export for components that need to manually trigger a refresh */
export { fetchDepartments, getInitialDepartments };
