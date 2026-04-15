import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isAfter, isBefore, addDays } from 'date-fns';
import {
  Department,
  ProjectStatus,
  ProjectPriority,
  TaskStatus,
  AlertType,
  AlertSeverity,
  AlertStatus,
  DEPARTMENT_LABELS,
} from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// DATE UTILITIES
// ============================================================

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'MMM d, yyyy · HH:mm');
}

export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function isOverdue(deadline: Date | string): boolean {
  return isBefore(new Date(deadline), new Date());
}

export function isDueSoon(deadline: Date | string, daysThreshold = 3): boolean {
  const d = new Date(deadline);
  return isAfter(d, new Date()) && isBefore(d, addDays(new Date(), daysThreshold));
}

// ============================================================
// STATUS LABELS & STYLES
// ============================================================

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  [ProjectStatus.NEW]: 'New',
  [ProjectStatus.IN_PRODUCTION]: 'In Production',
  [ProjectStatus.ON_HOLD]: 'On Hold',
  [ProjectStatus.COMPLETED]: 'Completed',
  [ProjectStatus.DISPATCHED]: 'Dispatched',
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  [ProjectStatus.NEW]: 'bg-gray-100 text-gray-800 border-gray-200',
  [ProjectStatus.IN_PRODUCTION]: 'bg-black text-white border-black',
  [ProjectStatus.ON_HOLD]: 'bg-red-50 text-red-700 border-red-300',
  [ProjectStatus.COMPLETED]: 'bg-gray-800 text-white border-gray-800',
  [ProjectStatus.DISPATCHED]: 'bg-gray-200 text-gray-700 border-gray-300',
};

export const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  [ProjectPriority.LOW]: 'Low',
  [ProjectPriority.MEDIUM]: 'Medium',
  [ProjectPriority.HIGH]: 'High',
  [ProjectPriority.URGENT]: 'URGENT',
};

export const PRIORITY_STYLE: Record<ProjectPriority, string> = {
  [ProjectPriority.LOW]: 'text-gray-500 border-gray-200',
  [ProjectPriority.MEDIUM]: 'text-gray-700 border-gray-400',
  [ProjectPriority.HIGH]: 'text-black border-black font-semibold',
  [ProjectPriority.URGENT]: 'text-red-600 border-red-500 font-bold',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'To Do',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.BLOCKED]: 'Blocked',
  [TaskStatus.DONE]: 'Done',
};

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'bg-gray-100 text-gray-600 border-gray-200',
  [TaskStatus.IN_PROGRESS]: 'bg-black text-white border-black',
  [TaskStatus.BLOCKED]: 'bg-red-50 text-red-700 border-red-400',
  [TaskStatus.DONE]: 'bg-gray-800 text-white border-gray-800',
};

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  [AlertType.DESIGN_CHANGE]: 'Design Change',
  [AlertType.CLIENT_ESCALATION]: 'Client Escalation',
  [AlertType.PRODUCTION_ISSUE]: 'Production Issue',
  [AlertType.MATERIAL_ISSUE]: 'Material Issue',
};

export const ALERT_SEVERITY_STYLE: Record<AlertSeverity, string> = {
  [AlertSeverity.HIGH]: 'bg-red-50 text-red-700 border-red-300',
  [AlertSeverity.CRITICAL]: 'bg-red-600 text-white border-red-700',
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  [AlertStatus.ACTIVE]: 'Active',
  [AlertStatus.ACKNOWLEDGED]: 'Acknowledged',
  [AlertStatus.RESOLVED]: 'Resolved',
};

// ============================================================
// DEPARTMENT UTILITIES
// ============================================================

export { DEPARTMENT_LABELS };

export const DEPARTMENT_ABBR: Record<Department, string> = {
  [Department.OFFICE_ADMIN]: 'OA',
  [Department.PURCHASE]: 'PUR',
  [Department.STORE]: 'STR',
  [Department.MARKETING]: 'MKT',
};

// ============================================================
// API FETCH HELPERS
// ============================================================

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || 'Request failed' };
    }
    return json;
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}
