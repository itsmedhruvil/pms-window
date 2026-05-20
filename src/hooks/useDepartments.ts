'use client';

import { useEffect, useMemo, useState } from 'react';
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

export function useDepartments(includeInactive = false) {
  const [departments, setDepartments] = useState<ClientDepartment[]>(fallbackDepartments);

  useEffect(() => {
    let mounted = true;

    apiFetch<Array<{
      _id: string;
      name: Department;
      label: string;
      abbreviation: string;
      sequence: number;
      isActive: boolean;
    }>>('/api/departments')
      .then((result) => {
        if (!mounted || !result.success || !result.data || result.data.length === 0) return;
        setDepartments(result.data);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return useMemo(
    () => departments.filter((department) => includeInactive || department.isActive),
    [departments, includeInactive]
  );
}
