'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, ALERT_TYPE_LABEL, DEPARTMENT_LABELS, timeAgo, apiFetch } from '@/lib/utils';
import {
  AlertSeverityBadge,
  AlertStatusBadge,
} from '@/components/ui/badges';
import { CommentThread } from '@/components/comment/CommentThread';
import { useGlobalAlerts } from '@/hooks/useRealtime';
import type { IAlert, IUser } from '@/types';
import { AlertStatus, AlertType, Department } from '@/types';

interface AlertsClientProps {
  initialAlerts: IAlert[];
  isAdmin: boolean;
  currentUserId: string;
  currentUserDept: Department;
}

export function AlertsClient({ initialAlerts, isAdmin, currentUserId, currentUserDept }: AlertsClientProps) {
  const [alerts, setAlerts] = useState<IAlert[]>(initialAlerts);
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AlertType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Listen for new alerts globally
  useGlobalAlerts(useCallback((alert: IAlert) => {
    setAlerts((prev) => [alert, ...prev]);
  }, []));

  const filtered = alerts.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === AlertStatus.ACTIVE).length;

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    setActionLoading(alertId + action);
    const result = await apiFetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
    setActionLoading(null);

    if (result.success && result.data) {
      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? (result.data as IAlert) : a))
      );
    }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-gray-900">Alerts</h1>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 border border-red-300 text-red-700 text-xs font-mono font-bold">
                <AlertTriangle className="w-3 h-3 animate-pulse" />
                {activeCount} ACTIVE
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 font-mono">{alerts.length} total</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <Filter className="w-3.5 h-3.5 text-gray-400" />

        <div className="flex gap-1.5">
          {(['all', ...Object.values(AlertStatus)] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                statusFilter === s
                  ? s === 'all'
                    ? 'bg-black text-white border-black'
                    : s === AlertStatus.ACTIVE
                    ? 'bg-red-600 text-white border-red-700'
                    : 'bg-gray-800 text-white border-gray-800'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              )}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-200" />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AlertType | 'all')}
          className="text-[10px] font-mono border border-gray-200 px-2 py-1 focus:outline-none focus:border-black"
        >
          <option value="all">All Types</option>
          {Object.values(AlertType).map((t) => (
            <option key={t} value={t}>{ALERT_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-gray-200 p-16 text-center">
          <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-mono">No alerts match your filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => (
            <AlertRow
              key={alert._id}
              alert={alert}
              isExpanded={expandedId === alert._id}
              onToggle={() => setExpandedId(expandedId === alert._id ? null : alert._id)}
              onAcknowledge={() => handleAction(alert._id, 'acknowledge')}
              onResolve={() => handleAction(alert._id, 'resolve')}
              actionLoading={actionLoading}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              currentUserDept={currentUserDept}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  isExpanded,
  onToggle,
  onAcknowledge,
  onResolve,
  actionLoading,
  isAdmin,
  currentUserId,
  currentUserDept,
}: {
  alert: IAlert;
  isExpanded: boolean;
  onToggle: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
  actionLoading: string | null;
  isAdmin: boolean;
  currentUserId: string;
  currentUserDept: Department;
}) {
  const isActive = alert.status === AlertStatus.ACTIVE;
  const isAcknowledged = alert.status === AlertStatus.ACKNOWLEDGED;
  const hasAcknowledgedMe = alert.acknowledgedBy?.some(
    (id) => id.toString() === currentUserId
  );
  const canAcknowledge =
    isActive &&
    !hasAcknowledgedMe &&
    (isAdmin || alert.affectedDepartments.includes(currentUserDept));
  const canResolve = isAdmin && isAcknowledged;

  const raisedBy = typeof alert.raisedBy === 'object' && 'name' in alert.raisedBy
    ? (alert.raisedBy as { name: string }).name
    : 'Admin';

  const project = typeof alert.projectId === 'object' && 'projectTitle' in alert.projectId
    ? alert.projectId as { projectTitle: string; _id: string }
    : null;

  return (
    <div className={cn(
      'border transition-all',
      isActive
        ? 'border-red-300 bg-red-50/20 border-l-4 border-l-red-500'
        : isAcknowledged
        ? 'border-yellow-200 border-l-4 border-l-yellow-400'
        : 'border-gray-200 border-l-4 border-l-gray-300'
    )}>
      {/* Row header */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <AlertSeverityBadge severity={alert.severity} />
          <AlertStatusBadge status={alert.status} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-900">
              {ALERT_TYPE_LABEL[alert.type]}
            </span>
            {project && (
              <span className="text-[11px] text-gray-500 font-mono truncate">
                {project.projectTitle}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-600 mt-0.5 truncate">{alert.message}</p>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-gray-500 font-mono">by {raisedBy}</p>
            <p className="text-[10px] text-gray-400 font-mono">{timeAgo(alert.createdAt)}</p>
          </div>
          {isExpanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          <div className="px-4 py-4 space-y-4">
            {/* Full message */}
            <div className="border-l-2 border-gray-200 pl-3">
              <p className="text-xs text-gray-700 leading-relaxed">{alert.message}</p>
            </div>

            {/* Departments */}
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                Affected Departments
              </p>
              <div className="flex flex-wrap gap-1.5">
                {alert.affectedDepartments.map((dept) => (
                  <span
                    key={dept}
                    className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 uppercase tracking-wide"
                  >
                    {DEPARTMENT_LABELS[dept]}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-3">
              {canAcknowledge && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAcknowledge(); }}
                  disabled={actionLoading === alert._id + 'acknowledge'}
                  className="px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-black text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                >
                  {actionLoading === alert._id + 'acknowledge' ? '...' : 'Acknowledge Alert'}
                </button>
              )}
              {canResolve && (
                <button
                  onClick={(e) => { e.stopPropagation(); onResolve(); }}
                  disabled={actionLoading === alert._id + 'resolve'}
                  className="px-3 py-1.5 text-[11px] font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {actionLoading === alert._id + 'resolve' ? '...' : 'Mark Resolved'}
                </button>
              )}
              {hasAcknowledgedMe && isActive && (
                <span className="text-[11px] text-gray-500 font-mono italic">
                  ✓ You acknowledged this
                </span>
              )}
            </div>

            {/* Comment thread */}
            <div className="border border-gray-200 h-72">
              <CommentThread alertId={alert._id} currentUser={{ _id: currentUserId }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
