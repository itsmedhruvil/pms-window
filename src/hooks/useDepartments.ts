'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

/** Custom event name emitted when departments are created, updated, or deleted */
export const DEPARTMENTS_CHANGED_EVENT = 'erp-departments-changed';

/** Fire the departments-changed event so all hooks refetch */
export function notifyDepartmentsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED_EVENT));
  }
}

async function fetchDepartments(): Promise<ClientDepartment[]> {
  try {
    const result = await apiFetch<Array<{
      _id: string;
      name: Department;
      label: string;
      abbreviation: string;
      sequence: number;
      isActive: boolean;
    }>>('/api/departments');

    if (result.success && result.data && result.data.length > 0) {
      return result.data;
    }
  } catch {
    // ignore network errors, fall through to fallback
  }
  return fallbackDepartments;
}

export function useDepartments(includeInactive = false) {
  const [departments, setDepartments] = useState<ClientDepartment[]>(fallbackDepartments);

  const refresh = useCallback(async () => {
    const data = await fetchDepartments();
    setDepartments(data);
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchDepartments().then((data) => {
      if (mounted) setDepartments(data);
    });

    // Listen for changes emitted after create/update/delete
    const handleChange = () => {
      fetchDepartments().then((data) => {
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
export { fetchDepartments };