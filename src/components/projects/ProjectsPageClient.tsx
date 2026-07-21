'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Calendar, Package, Search, X, Filter, ChevronDown } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectStatusBadge, PriorityBadge } from '@/components/ui/badges';
import { FilterDrawer, MobileFilterButton } from '@/components/ui/FilterDrawer';
import { formatDate, isOverdue, isDueSoon, cn } from '@/lib/utils';
import type { IProject } from '@/types';
import { ProjectStatus, ProjectPriority } from '@/types';

interface ProjectsPageClientProps {
  projects: IProject[];
  activeAlertCount: number;
  isAdmin: boolean;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: ProjectStatus.NEW, label: 'New' },
  { value: ProjectStatus.IN_PRODUCTION, label: 'In Production' },
  { value: ProjectStatus.ON_HOLD, label: 'On Hold' },
  { value: ProjectStatus.COMPLETED, label: 'Completed' },
  { value: ProjectStatus.DISPATCHED, label: 'Dispatched' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Priority' },
  { value: ProjectPriority.STANDARD, label: 'Standard' },
  { value: ProjectPriority.NECESSARY, label: 'Necessary' },
  { value: ProjectPriority.PRIORITY, label: 'Priority' },
  { value: ProjectPriority.URGENT, label: 'Urgent' },
];

export function ProjectsPageClient({ projects, activeAlertCount, isAdmin }: ProjectsPageClientProps) {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input — reduces filtering lag and API-like feel
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 150); // 150ms debounce — feels instant but avoids lag on large lists
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Filter and search projects
  const filtered = useMemo(() => {
    return projects.filter((project) => {
      // Status filter
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false;

      // Search filter (client name, project title, tags, address)
      if (debouncedSearch.trim().length > 0) {
        const query = debouncedSearch.toLowerCase();
        return (
          project.projectTitle.toLowerCase().includes(query) ||
          project.clientName.toLowerCase().includes(query) ||
          (project.address && project.address.toLowerCase().includes(query)) ||
          (project.tags && project.tags.some((tag) => tag.toLowerCase().includes(query))) ||
          (project.productTypes && project.productTypes.some((pt) => pt.toLowerCase().includes(query))) ||
          project._id.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [projects, statusFilter, priorityFilter, debouncedSearch]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (priorityFilter !== 'all') count++;
    if (debouncedSearch.trim()) count++;
    return count;
  }, [statusFilter, priorityFilter, debouncedSearch]);

  const clearFilters = useCallback(() => {
    setSearchText('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
  }, []);

  // Compute stats for the filter chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [projects]);

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.priority] = (counts[p.priority] || 0) + 1;
    }
    return counts;
  }, [projects]);

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-primary-200">
          <div>
            <h1 className="text-xl font-black text-dark-500">Projects</h1>
            <p className="text-xs text-primary-500 font-mono mt-0.5">
              {filtered.length} of {projects.length} order{projects.length !== 1 ? 's' : ''}
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="ml-2 text-[10px] text-blue-600 hover:text-blue-800 underline">
                  Clear filters
                </button>
              )}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-3">
          {/* Search Input with debounce */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by project name, client, ID, address, or tags..."
              value={searchText}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-8 py-2.5 text-xs border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors"
            />
            {searchText && (
              <button
                onClick={() => { setSearchText(''); setDebouncedSearch(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-400 hover:text-dark-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Desktop Filter Controls */}
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            {/* Status quick filters as colored chips */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                  statusFilter === 'all'
                    ? 'bg-dark-500 text-white border-dark-500'
                    : 'border-primary-200 text-primary-500 hover:border-primary-400'
                )}
              >
                All ({projects.length})
              </button>
              {STATUS_OPTIONS.filter((o) => o.value !== 'all').map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    'px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                    statusFilter === opt.value
                      ? opt.value === ProjectStatus.ON_HOLD
                        ? 'bg-amber-500 text-white border-amber-600'
                        : opt.value === ProjectStatus.COMPLETED
                        ? 'bg-dark-600 text-white border-dark-600'
                        : opt.value === ProjectStatus.DISPATCHED
                        ? 'bg-dark-500 text-white border-dark-500'
                        : 'bg-blue-600 text-white border-blue-700'
                      : 'border-primary-200 text-primary-500 hover:border-primary-400'
                  )}
                >
                  {opt.label} {statusCounts[opt.value] ? `(${statusCounts[opt.value]})` : ''}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-primary-200 mx-1" />

            {/* Priority select */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors bg-white"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}{opt.value !== 'all' && priorityCounts[opt.value] ? ` (${priorityCounts[opt.value]})` : ''}
                </option>
              ))}
            </select>

            {/* Clear button */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide border border-primary-200 text-primary-500 hover:border-primary-400 hover:text-dark-500 transition-colors"
              >
                <X className="w-3 h-3 inline mr-1" />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Mobile filter button */}
          <div className="flex sm:hidden">
            <MobileFilterButton onClick={() => setMobileFilterOpen(true)} activeCount={activeFilterCount} />
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        <FilterDrawer open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} title="Project Filters">
          <div className="mb-5">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                  statusFilter === 'all' ? 'bg-dark-500 text-white border-dark-500' : 'border-primary-200 text-primary-500'
                )}
              >
                All
              </button>
              {STATUS_OPTIONS.filter((o) => o.value !== 'all').map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                    statusFilter === opt.value ? 'bg-dark-500 text-white border-dark-500' : 'border-primary-200 text-primary-500'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-2">
              Priority
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setPriorityFilter('all')}
                className={cn(
                  'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                  priorityFilter === 'all' ? 'bg-dark-500 text-white border-dark-500' : 'border-primary-200 text-primary-500'
                )}
              >
                All
              </button>
              {PRIORITY_OPTIONS.filter((o) => o.value !== 'all').map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriorityFilter(opt.value)}
                  className={cn(
                    'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                    priorityFilter === opt.value ? 'bg-dark-500 text-white border-dark-500' : 'border-primary-200 text-primary-500'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="w-full px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide border border-red-300 text-red-600 hover:bg-red-50 transition-colors">
              Clear All Filters
            </button>
          )}
        </FilterDrawer>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="border border-dashed border-primary-200 p-16 text-center">
            <Package className="w-8 h-8 text-primary-300 mx-auto mb-3" />
            <p className="text-sm font-mono text-primary-400">
              {activeFilterCount > 0
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