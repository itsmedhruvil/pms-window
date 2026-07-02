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
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return format(parsed, 'MMM d, yyyy');
}

export function formatDateTime(date: Date | string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return format(parsed, 'MMM d, yyyy · HH:mm');
}

export function timeAgo(date: Date | string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'unknown time';
  return formatDistanceToNow(parsed, { addSuffix: true });
}

export function isOverdue(deadline: Date | string): boolean {
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  return isBefore(parsed, new Date());
}

export function isDueSoon(deadline: Date | string, daysThreshold = 3): boolean {
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
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
  [ProjectStatus.NEW]: 'bg-primary-100 text-dark-600 border-primary-200',
  [ProjectStatus.IN_PRODUCTION]: 'bg-dark-500 text-white border-dark-500',
  [ProjectStatus.ON_HOLD]: 'bg-red-50 text-red-700 border-red-300',
  [ProjectStatus.COMPLETED]: 'bg-dark-600 text-white border-dark-600',
  [ProjectStatus.DISPATCHED]: 'bg-primary-200 text-dark-600 border-primary-300',
};

export const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  [ProjectPriority.STANDARD]: 'Standard',
  [ProjectPriority.NECESSARY]: 'Necessary',
  [ProjectPriority.PRIORITY]: 'Priority',
  [ProjectPriority.URGENT]: 'Urgent',
};

export const PRIORITY_STYLE: Record<ProjectPriority, string> = {
  [ProjectPriority.STANDARD]: 'text-primary-500 border-primary-200',
  [ProjectPriority.NECESSARY]: 'text-dark-600 border-primary-400',
  [ProjectPriority.PRIORITY]: 'text-dark-500 border-dark-500 font-semibold',
  [ProjectPriority.URGENT]: 'text-red-600 border-red-500 font-bold',
};

export function normalizeProjectPriority(priority: ProjectPriority | string | undefined): ProjectPriority {
  switch (priority) {
    case ProjectPriority.STANDARD:
    case 'low':
      return ProjectPriority.STANDARD;
    case ProjectPriority.PRIORITY:
    case 'high':
      return ProjectPriority.PRIORITY;
    case ProjectPriority.URGENT:
      return ProjectPriority.URGENT;
    case ProjectPriority.NECESSARY:
    case 'medium':
    default:
      return ProjectPriority.NECESSARY;
  }
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'To Do',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.BLOCKED]: 'Blocked',
  [TaskStatus.DONE]: 'Done',
};

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'bg-primary-100 text-dark-400 border-primary-200',
  [TaskStatus.IN_PROGRESS]: 'bg-dark-500 text-white border-dark-500',
  [TaskStatus.BLOCKED]: 'bg-red-50 text-red-700 border-red-400',
  [TaskStatus.DONE]: 'bg-dark-600 text-white border-dark-600',
};

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  [AlertType.DESIGN_CHANGE]: 'Design Change',
  [AlertType.CLIENT_ESCALATION]: 'Client Escalation',
  [AlertType.PRODUCTION_ISSUE]: 'Production Issue',
  [AlertType.MATERIAL_ISSUE]: 'Material Issue',
};

export const ALERT_SEVERITY_STYLE: Record<AlertSeverity, string> = {
  [AlertSeverity.LOW]: 'bg-blue-50 text-blue-700 border-blue-300',
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

export const DEPARTMENT_ABBR: Record<string, string> = {
  [Department.PRODUCTION]: 'PROD',
  [Department.PURCHASE]: 'PUR',
  [Department.OPERATIONS]: 'OPS',
  [Department.ACCOUNTS]: 'ACC',
  [Department.STORE]: 'STR',
  [Department.SITE]: 'SITE',
};

export function getDepartmentLabel(department: string | undefined) {
  return department ? DEPARTMENT_LABELS[department] || department.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '';
}

export function getDepartmentAbbreviation(department: string | undefined) {
  if (!department) return '';
  return DEPARTMENT_ABBR[department] || department
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 6) || department.slice(0, 3).toUpperCase();
}

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

    const contentType = res.headers.get('content-type') || '';
    const json = contentType.includes('application/json')
      ? await res.json()
      : { success: false, error: await res.text() };

    if (!res.ok) {
      return { success: false, error: json.error || `Request failed (${res.status})` };
    }
    return json;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
