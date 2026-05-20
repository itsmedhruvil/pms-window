'use client';

import { cn, PROJECT_STATUS_STYLE, PROJECT_STATUS_LABEL, TASK_STATUS_STYLE, TASK_STATUS_LABEL, PRIORITY_STYLE, PRIORITY_LABEL, ALERT_SEVERITY_STYLE, ALERT_STATUS_LABEL, normalizeProjectPriority } from '@/lib/utils';
import { ProjectStatus, TaskStatus, ProjectPriority, AlertSeverity, AlertStatus } from '@/types';

interface BadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ProjectStatusBadge({ status, className, size = 'md' }: { status: ProjectStatus } & BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center border font-mono font-medium tracking-wide uppercase',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
      PROJECT_STATUS_STYLE[status],
      status === ProjectStatus.ON_HOLD && 'animate-pulse',
      className
    )}>
      {status === ProjectStatus.ON_HOLD && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
      )}
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

export function TaskStatusBadge({ status, className, size = 'md' }: { status: TaskStatus } & BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center border font-mono font-medium tracking-wide uppercase',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
      TASK_STATUS_STYLE[status],
      status === TaskStatus.BLOCKED && 'animate-pulse',
      className
    )}>
      {status === TaskStatus.BLOCKED && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
      )}
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority, className, size = 'md' }: { priority: ProjectPriority | string } & BadgeProps) {
  const normalizedPriority = normalizeProjectPriority(priority);

  return (
    <span className={cn(
      'inline-flex items-center border font-mono tracking-widest uppercase',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
      PRIORITY_STYLE[normalizedPriority],
      normalizedPriority === ProjectPriority.URGENT && 'animate-pulse',
      className
    )}>
      {normalizedPriority === ProjectPriority.URGENT && '⚠ '}
      {PRIORITY_LABEL[normalizedPriority]}
    </span>
  );
}

export function AlertSeverityBadge({ severity, className }: { severity: AlertSeverity } & BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center border text-xs px-2 py-1 font-mono font-bold tracking-widest uppercase',
      ALERT_SEVERITY_STYLE[severity],
      'animate-pulse',
      className
    )}>
      ▲ {severity}
    </span>
  );
}

export function AlertStatusBadge({ status, className }: { status: AlertStatus } & BadgeProps) {
  const styles: Record<AlertStatus, string> = {
    [AlertStatus.ACTIVE]: 'bg-red-600 text-white border-red-700',
    [AlertStatus.ACKNOWLEDGED]: 'bg-yellow-50 text-yellow-800 border-yellow-400',
    [AlertStatus.RESOLVED]: 'bg-gray-100 text-gray-600 border-gray-300',
  };
  return (
    <span className={cn(
      'inline-flex items-center border text-xs px-2 py-1 font-mono font-medium tracking-wide uppercase',
      styles[status],
      className
    )}>
      {ALERT_STATUS_LABEL[status]}
    </span>
  );
}
