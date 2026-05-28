'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Calendar, Package } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectStatusBadge, PriorityBadge } from '@/components/ui/badges';
import { formatDate, isOverdue, isDueSoon, cn } from '@/lib/utils';
import type { IProject } from '@/types';

interface ProjectsPageClientProps {
  projects: IProject[];
  activeAlertCount: number;
  isAdmin: boolean;
}

export function ProjectsPageClient({ projects, activeAlertCount, isAdmin }: ProjectsPageClientProps) {
  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-black text-gray-900">Projects</h1>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              {projects.length} client order{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="border border-dashed border-gray-200 p-16 text-center">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-mono text-gray-400">No projects yet</p>
          </div>
        ) : (
          <div className="erp-table-wrap border border-gray-200">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Client / Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Progress</th>
                  <th>Windows</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const overdue = isOverdue(project.deadline);
                  const dueSoon = isDueSoon(project.deadline);
                  const hasAlerts = (project.activeAlertIds?.length ?? 0) > 0;

                  return (
                    <tr key={project._id} className={cn('cursor-pointer', hasAlerts && 'bg-red-50/30 hover:bg-red-50/50')}>
                      <td>
                        <div className="flex items-center gap-2">
                          {hasAlerts && (
                            <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse flex-shrink-0" />
                          )}
                          <div>
                            <Link
                              href={`/projects/${project._id}`}
                              className="font-semibold text-gray-900 hover:underline"
                            >
                              {project.projectTitle}
                            </Link>
                            <p className="text-[10px] text-gray-500">{project.clientName}</p>
                          </div>
                        </div>
                      </td>
                      <td><ProjectStatusBadge status={project.status} size="sm" /></td>
                      <td><PriorityBadge priority={project.priority} size="sm" /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-100">
                            <div
                              className={cn('h-full', hasAlerts ? 'bg-red-400' : 'bg-black')}
                              style={{ width: `${project.completionPercentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-gray-600 w-8">
                            {project.completionPercentage}%
                          </span>
                        </div>
                      </td>
                      <td><span className="font-mono">{project.totalWindows}</span></td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {(overdue || dueSoon) && (
                            <Calendar className={cn('w-3 h-3', overdue ? 'text-red-500' : 'text-yellow-500')} />
                          )}
                          <span className={cn(
                            'font-mono text-[11px]',
                            overdue ? 'text-red-600 font-bold' : dueSoon ? 'text-yellow-700' : 'text-gray-600'
                          )}>
                            {formatDate(project.deadline)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
