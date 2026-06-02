'use client';

import Link from 'next/link';
import { AlertTriangle, Bell, Loader2, MessageCircle } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import type { IAlert, IUser, IProject } from '@/types';
import { useAlerts } from '@/lib/client-data';

export function DashboardAlertsPane() {
  // SWR handles caching, deduplication, and 30s poll interval automatically
  const { data: alertData, error: alertError, isLoading: alertLoading, mutate: refreshAlerts } = useAlerts({ status: 'active', limit: '5' });

  const activeAlerts = Array.isArray(alertData) ? (alertData as IAlert[]) : (alertData as { items: IAlert[] })?.items || [];

  const loading = alertLoading;
  const error = alertError;

  const getAlertSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-400 bg-orange-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <div className="border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
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
              className="text-[9px] font-mono text-gray-400 hover:text-gray-700 px-1.5 py-0.5"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[10px] font-mono text-gray-400">Failed to load</p>
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
                      'block px-4 py-2.5 transition-colors hover:bg-gray-50 border-l-2',
                      getAlertSeverityColor(alert.severity)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-900 truncate">
                          {project?.projectTitle || 'Project'}
                        </p>
                        <p className="text-[9px] text-gray-600 mt-0.5 line-clamp-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[8px] font-mono text-gray-400">
                          <span className={cn(
                            'uppercase font-bold',
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'high' ? 'text-orange-600' : 'text-gray-500'
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
              <Bell className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-[10px] font-mono text-gray-400">No active alerts</p>
              <p className="text-[9px] font-mono text-gray-400 mt-0.5">Everything is looking good!</p>
            </div>
          )}
        </div>
      )}

      {/* Footer links */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between">
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