'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, ALERT_TYPE_LABEL, formatDateTime, timeAgo, apiFetch } from '@/lib/utils';
import { AlertSeverityBadge, AlertStatusBadge } from '@/components/ui/badges';
import type { IAlert } from '@/types';
import { AlertStatus } from '@/types';

interface AlertSidebarProps {
  alerts: IAlert[];
  onAlertAction?: () => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

export function AlertSidebar({ alerts, onAlertAction, currentUserId, isAdmin }: AlertSidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const activeAlerts = alerts.filter(a => a.status !== AlertStatus.RESOLVED);

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    setLoading(alertId + action);
    try {
      await apiFetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      onAlertAction?.();
    } finally {
      setLoading(null);
    }
  };

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-80 border-l border-gray-200 bg-white z-40 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-red-100 bg-red-50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse" />
          <span className="text-sm font-bold font-mono text-red-700 tracking-wide uppercase">
            Active Alerts
          </span>
        </div>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold">
          {activeAlerts.length}
        </span>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {activeAlerts.map((alert) => (
          <AlertCard
            key={alert._id}
            alert={alert}
            isExpanded={expanded === alert._id}
            onToggle={() => setExpanded(expanded === alert._id ? null : alert._id)}
            onAcknowledge={() => handleAction(alert._id, 'acknowledge')}
            onResolve={() => handleAction(alert._id, 'resolve')}
            loading={loading}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

function AlertCard({
  alert,
  isExpanded,
  onToggle,
  onAcknowledge,
  onResolve,
  loading,
  currentUserId,
  isAdmin,
}: {
  alert: IAlert;
  isExpanded: boolean;
  onToggle: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
  loading: string | null;
  currentUserId?: string;
  isAdmin?: boolean;
}) {
  const isCritical = alert.severity === 'critical';
  const hasAcknowledged = alert.acknowledgedBy?.some(
    (id) => id.toString() === currentUserId
  );

  return (
    <div className={cn(
      'border-b border-gray-100 transition-colors',
      isCritical ? 'border-l-4 border-l-red-600' : 'border-l-4 border-l-red-400'
    )}>
      {/* Alert header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertSeverityBadge severity={alert.severity} />
              <AlertStatusBadge status={alert.status} />
            </div>
            <p className="text-xs font-semibold text-gray-900 truncate">
              {ALERT_TYPE_LABEL[alert.type]}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {typeof alert.projectId === 'object' && 'projectTitle' in alert.projectId
                ? (alert.projectId as { projectTitle: string }).projectTitle
                : 'Project'}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-700 leading-relaxed border-l-2 border-gray-200 pl-2">
            {alert.message}
          </p>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className="font-mono">RAISED BY</span>
              <span className="font-medium text-gray-700">
                {typeof alert.raisedBy === 'object' && 'name' in alert.raisedBy
                  ? (alert.raisedBy as { name: string }).name
                  : 'Admin'}
              </span>
            </div>
            <div className="text-[11px] text-gray-400">
              {timeAgo(alert.createdAt)}
            </div>
          </div>

          {/* Affected departments */}
          <div className="flex flex-wrap gap-1">
            {alert.affectedDepartments.map((dept) => (
              <span key={dept} className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 uppercase tracking-wide">
                {dept.replace('_', ' ')}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {alert.status === AlertStatus.ACTIVE && !hasAcknowledged && (
              <button
                onClick={onAcknowledge}
                disabled={loading === alert._id + 'acknowledge'}
                className="flex-1 text-[11px] font-mono font-bold py-1.5 px-2 border border-black text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50 uppercase tracking-wide"
              >
                {loading === alert._id + 'acknowledge' ? '...' : 'Acknowledge'}
              </button>
            )}
            {isAdmin && alert.status === AlertStatus.ACKNOWLEDGED && (
              <button
                onClick={onResolve}
                disabled={loading === alert._id + 'resolve'}
                className="flex-1 text-[11px] font-mono font-bold py-1.5 px-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 uppercase tracking-wide"
              >
                {loading === alert._id + 'resolve' ? '...' : 'Resolve'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
