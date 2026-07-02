'use client';

import Link from 'next/link';
import { AlertTriangle, Bell, Loader2, MessageCircle, CheckCircle2, Ban, PlayCircle } from 'lucide-react';
import { cn, timeAgo, getDepartmentLabel, ALERT_TYPE_LABEL } from '@/lib/utils';
import type { IAlert, IUser, IProject, Department } from '@/types';
import { AlertType } from '@/types';
import { useAlerts } from '@/lib/client-data';

interface DashboardCharts {
  tasksByDepartment: Array<{
    department: string;
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    todo: number;
    completionRate: number;
  }>;
  completionTrend: Array<{ date: string; completed: number; created: number }>;
  avgCompletionByDept: Record<string, number>;
}

interface DashboardMetricsData {
  metrics: {
    totalActiveProjects: number;
    projectsOnHold: number;
    projectsCompleted: number;
    projectsDispatched: number;
    overdueProjects: number;
    taskCompletionRate: Record<Department, number>;
    avgTaskCompletionTime: number;
    alertFrequency: Record<AlertType, number>;
    bottleneckDepartment: Department | null;
    activeAlertCount: number;
  };
  charts: DashboardCharts;
  overdueByDept?: Record<string, number>;
}

export function DashboardAlertsPane({
  data,
}: {
  data?: DashboardMetricsData | null;
}) {
  // SWR handles caching, deduplication, and 30s poll interval automatically
  const { data: alertData, error: alertError, isLoading: alertLoading, mutate: refreshAlerts } = useAlerts({ status: 'active', limit: '5' });

  const activeAlerts = Array.isArray(alertData) ? (alertData as IAlert[]) : (alertData as { items: IAlert[] })?.items || [];

  const loading = alertLoading;
  const error = alertError;

  const getAlertSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-400 bg-orange-50';
      default: return 'border-primary-300 bg-primary-50';
    }
  };

  // Department progress data
  const sortedDepts = data?.charts?.tasksByDepartment
    ? [...data.charts.tasksByDepartment].sort(
        (a, b) => (data.metrics.taskCompletionRate[b.department] || 0) - (data.metrics.taskCompletionRate[a.department] || 0)
      )
    : [];

  return (
    <div className="border border-primary-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-primary-200 bg-primary-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary-500">
              Active Alerts
            </span>
            {activeAlerts.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                {activeAlerts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => refreshAlerts()}
              className="text-[9px] font-mono text-primary-400 hover:text-dark-600 px-1.5 py-0.5"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[10px] font-mono text-primary-400">Failed to load</p>
          <button
            type="button"
            onClick={() => refreshAlerts()}
            className="mt-2 text-[9px] font-mono text-blue-600 hover:text-blue-800"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {/* Active alerts section */}
          {activeAlerts.length > 0 ? (
            <div>
              {activeAlerts.map((alert: IAlert) => {
                const project = typeof alert.projectId === 'object' ? alert.projectId as Partial<IProject> : null;
                const raisedBy = typeof alert.raisedBy === 'object' ? alert.raisedBy as Partial<IUser> : null;
                return (
                  <Link
                    key={alert._id}
                    href={`/alerts`}
                    className={cn(
                      'block px-4 py-2.5 transition-colors hover:bg-primary-50 border-l-2',
                      getAlertSeverityColor(alert.severity)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-dark-500 truncate">
                          {project?.projectTitle || 'Project'}
                        </p>
                        <p className="text-[9px] text-dark-400 mt-0.5 line-clamp-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[8px] font-mono text-primary-400">
                          <span className={cn(
                            'uppercase font-bold',
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'high' ? 'text-orange-600' : 'text-primary-500'
                          )}>
                            {alert.severity}
                          </span>
                          {raisedBy?.name && <span>· {raisedBy.name}</span>}
                          <span>· {timeAgo(alert.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Bell className="w-6 h-6 text-primary-300 mx-auto mb-2" />
              <p className="text-[10px] font-mono text-primary-400">No active alerts</p>
              <p className="text-[9px] font-mono text-primary-400 mt-0.5">Everything is looking good!</p>
            </div>
          )}
        </div>
      )}

      {/* Gap between alerts and dept progress */}
      <div className="h-3" />

      {/* Department Progress (moved here from DashboardMetrics) */}
      {data && sortedDepts.length > 0 && (
        <div className="px-4 py-3">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-2">
            Department Progress
          </h3>
          <div className="space-y-2">
            {sortedDepts.map(({ department: dept }) => {
              const rate = data.metrics.taskCompletionRate[dept] || 0;
              return (
                <div key={dept}>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                    <span className="text-dark-600 truncate">{getDepartmentLabel(dept)}</span>
                    <span className={cn('font-bold', rate === 100 ? 'text-green-600' : rate < 30 ? 'text-red-500' : 'text-dark-500')}>
                      {rate}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-primary-100 overflow-hidden">
                    <div
                      className={cn('h-full transition-all', rate === 100 ? 'bg-green-500' : rate < 30 ? 'bg-red-500' : 'bg-dark-500')}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts by Type (moved here from DashboardMetrics) */}
      {data && (
        <div className="px-4 py-3">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-2">
            Alerts by Type
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.values(AlertType).map((type) => {
              const count = data.metrics.alertFrequency[type] || 0;
              return (
                <div key={type} className={cn(
                  'p-2 border text-center',
                  count > 0 ? 'border-red-200 bg-red-50/50' : 'border-primary-100'
                )}>
                  <p className="text-[8px] font-mono text-primary-500 uppercase truncate">{ALERT_TYPE_LABEL[type]}</p>
                  <p className={cn('text-sm font-black font-mono', count > 0 ? 'text-red-600' : 'text-primary-300')}>{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer links */}
      <div className="px-4 py-2 border-t border-primary-200 bg-primary-50/50 flex items-center justify-between">
        <Link
          href="/alerts"
          className="text-[9px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          View all alerts
        </Link>
        <Link
          href="/discussions"
          className="text-[9px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <MessageCircle className="w-2.5 h-2.5" />
          Discussions
        </Link>
      </div>
    </div>
  );
}