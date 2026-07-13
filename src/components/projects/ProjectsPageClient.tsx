'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Calendar, Package, Search, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectStatusBadge, PriorityBadge } from '@/components/ui/badges';
import { formatDate, isOverdue, isDueSoon, cn } from '@/lib/utils';
import type { IProject } from '@/types';
import { ProjectStatus, Priority } from '@/types';

interface ProjectsPageClientProps {
  projects: IProject[];
  activeAlertCount: number;
  isAdmin: boolean;
}

export function ProjectsPageClient({ projects, activeAlertCount, isAdmin }: ProjectsPageClientProps) {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Filter and search projects
  const filtered = useMemo(() => {
    return projects.filter((project) => {
      // Status filter
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false;

      // Search filter (client name or project title)
      if (searchText.trim().length > 0) {
        const query = searchText.toLowerCase();
        return (
          project.projectTitle.toLowerCase().includes(query) ||
          project.clientName.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [projects, statusFilter, priorityFilter, searchText]);

  const activeFilters = [
    statusFilter !== 'all' ? 1 : 0,
    priorityFilter !== 'all' ? 1 : 0,
    searchText.trim() ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-primary-200">
          <div>
            <h1 className="text-xl font-black text-dark-500">Projects</h1>
            <p className="text-xs text-primary-500 font-mono mt-0.5">
              {filtered.length} of {projects.length} client order{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by project name or client..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-8 py-2 text-xs border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-400 hover:text-dark-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors bg-white hover:bg-primary-50"
            >
              <option value="all">All Status</option>
              <option value={ProjectStatus.PLANNING}>Planning</option>
              <option value={ProjectStatus.IN_PROGRESS}>In Progress</option>
              <option value={ProjectStatus.COMPLETED}>Completed</option>
              <option value={ProjectStatus.ON_HOLD}>On Hold</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors bg-white hover:bg-primary-50"
            >
              <option value="all">All Priority</option>
              <option value={Priority.LOW}>Low</option>
              <option value={Priority.MEDIUM}>Medium</option>
              <option value={Priority.HIGH}>High</option>
              <option value={Priority.CRITICAL}>Critical</option>
            </select>

            {/* Clear Filters */}
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setSearchText('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
                className="px-3 py-1.5 text-xs border border-primary-200 bg-white hover:bg-primary-50 text-primary-500 transition-colors font-mono"
              >
                Clear ({activeFilters})
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="border border-dashed border-primary-200 p-16 text-center">
            <Package className="w-8 h-8 text-primary-300 mx-auto mb-3" />
            <p className="text-sm font-mono text-primary-400">
              {searchText || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No projects match your filters'
                : 'No projects yet'}
            </p>
          </div>
        ) : (
          <div className="erp-table-wrap border border-primary-200">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Client / Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Progress</th>
                  <th>Products</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
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
                          <div className="min-w-0">
                            <Link
                              href={`/projects/${project._id}`}
                              className="font-semibold text-dark-500 hover:underline break-words"
                            >
                              {project.projectTitle}
                            </Link>
                            <p className="text-[10px] text-primary-500 break-words">{project.clientName}</p>
                          </div>
                        </div>
                      </td>
                      <td><ProjectStatusBadge status={project.status} size="sm" /></td>
                      <td><PriorityBadge priority={project.priority} size="sm" /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-primary-100 flex-shrink-0">
                            <div
                              className={cn('h-full', hasAlerts ? 'bg-red-400' : 'bg-dark-500')}
                              style={{ width: `${project.completionPercentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-dark-400 w-8 flex-shrink-0">
                            {project.completionPercentage}%
                          </span>
                        </div>
                      </td>
                      <td><span className="font-mono">{project.totalWindows}</span></td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {(overdue || dueSoon) && (
                            <Calendar className={cn('w-3 h-3', overdue ? 'text-red-500' : 'text-yellow-500')} />
                          )}
                          <span className={cn(
                            'font-mono text-[11px] whitespace-nowrap',
                            overdue ? 'text-red-600 font-bold' : dueSoon ? 'text-yellow-700' : 'text-dark-400'
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
