import DepartmentModel from '@/models/Department';
import { DEPARTMENT_LABELS, DEPARTMENT_SEQUENCE } from '@/types';
import type { Department } from '@/types';

export interface DepartmentOption {
  name: Department;
  label: string;
  abbreviation: string;
  sequence: number;
  isActive: boolean;
}

export async function getActiveDepartmentOptions(): Promise<DepartmentOption[]> {
  const departments = await DepartmentModel.find({ isActive: true })
    .select('name label abbreviation sequence isActive')
    .sort({ sequence: 1, label: 1 })
    .lean();

  if (departments.length > 0) {
    return departments.map((department) => ({
      name: department.name as Department,
      label: department.label,
      abbreviation: department.abbreviation,
      sequence: department.sequence,
      isActive: department.isActive,
    }));
  }

  return DEPARTMENT_SEQUENCE.map((name, sequence) => ({
    name,
    label: DEPARTMENT_LABELS[name] || formatDepartmentName(name),
    abbreviation: formatDepartmentAbbreviation(name),
    sequence,
    isActive: true,
  }));
}

export async function getActiveDepartmentNames(): Promise<Department[]> {
  return (await getActiveDepartmentOptions()).map((department) => department.name);
}

export function formatDepartmentName(department: string) {
  return DEPARTMENT_LABELS[department] || department.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDepartmentAbbreviation(department: string) {
  return department
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 6) || department.slice(0, 3).toUpperCase();
}
