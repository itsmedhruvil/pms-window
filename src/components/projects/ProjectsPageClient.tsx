'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Calendar, Search, X, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectStatusBadge, PriorityBadge } from '@/components/ui/badges';
import { FilterDrawer, MobileFilterButton } from '@/components/ui/FilterDrawer';
import { formatDate, isOverdue, isDueSoon, cn } from '@/lib/utils';
import type { IProject } from '@/types';
import { FactoryGroup, FACTORY_GROUP_LABELS, ProjectStatus, ProjectPriority } from '@/types';

interface ProjectsPageClientProps {
  projects: IProject[];
  activeAlertCount: number;
  isAdmin: boolean;
  initialTab?: 'active' | 'previous';
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

const FACTORY_GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Factory Groups' },
  { value: FactoryGroup.INSIDE, label: FACTORY_GROUP_LABELS[FactoryGroup.INSIDE] },
  { value: FactoryGroup.OUTSIDE, label: FACTORY_GROUP_LABELS[FactoryGroup.OUTSIDE] },
];

type SortField = 'projectTitle' | 'clientName' | 'status' | 'priority' | 'completionPercentage' | 'totalWindows' | 'deadline' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 10;

export function ProjectsPageClient({ projects, activeAlertCount, isAdmin, initialTab = 'active' }: ProjectsPageClientProps) {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [factoryGroupFilter, setFactoryGroupFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'active' | 'previous'>(initialTab);
  
  // Sync activeTab when initialTab prop changes (e.g. nav from sidebar)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('deadline');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input — reduces filtering lag and API-like feel
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const currentTabProjects = useMemo(() => {
    if (!isAdmin) return projects;
    const isPreviousProject = (project: IProject) =>
      project.status === ProjectStatus.COMPLETED || project.status === ProjectStatus.DISPATCHED;

    return activeTab === 'previous'
      ? projects.filter(isPreviousProject)
      : projects.filter((project) => !isPreviousProject(project));
  }, [projects, activeTab, isAdmin]);

  // Filter and search projects
  const filtered = useMemo(() => {
    return currentTabProjects.filter((project) => {
      // Status filter
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false;

      // Factory group filter (admin-only)
      if (factoryGroupFilter !== 'all') {
        if (!project.factoryGroups?.includes(factoryGroupFilter as FactoryGroup)) return false;
      }

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
  }, [currentTabProjects, statusFilter, priorityFilter, factoryGroupFilter, debouncedSearch]);

  // Sort projects
  const sorted = useMemo(() => {
    const sortedProjects = [...filtered];
    sortedProjects.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'projectTitle':
          aVal = a.projectTitle.toLowerCase();
          bVal = b.projectTitle.toLowerCase();
          break;
        case 'clientName':
          aVal = a.clientName.toLowerCase();
          bVal = b.clientName.toLowerCase();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'priority': {
          const priorityOrder: Record<string, number> = {
            [ProjectPriority.URGENT]: 4,
            [ProjectPriority.PRIORITY]: 3,
            [ProjectPriority.NECESSARY]: 2,
            [ProjectPriority.STANDARD]: 1,
          };
          aVal = priorityOrder[a.priority] || 0;
          bVal = priorityOrder[b.priority] || 0;
          break;
        }
        case 'completionPercentage':
          aVal = a.completionPercentage;
          bVal = b.completionPercentage;
          break;
        case 'totalWindows':
          aVal = a.totalWindows;
          bVal = b.totalWindows;
          break;
        case 'deadline':
          aVal = new Date(a.deadline).getTime();
          bVal = new Date(b.deadline).getTime();
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          aVal = a.projectTitle.toLowerCase();
          bVal = b.projectTitle.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedProjects;
  }, [filtered, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProjects = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, safePage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, priorityFilter, factoryGroupFilter, activeTab]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (priorityFilter !== 'all') count++;
    if (factoryGroupFilter !== 'all') count++;
    if (debouncedSearch.trim()) count++;
    return count;
  }, [statusFilter, priorityFilter, factoryGroupFilter, debouncedSearch]);

  const clearFilters = useCallback(() => {
    setSearchText('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setFactoryGroupFilter('all');
    setCurrentPage(1);
  }, []);

  // Compute stats for the filter chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of currentTabProjects) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [currentTabProjects]);

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of currentTabProjects) {
      counts[p.priority] = (counts[p.priority] || 0) + 1;
    }
    return counts;
  }, [currentTabProjects]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 inline ml-1 text-primary-300" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 inline ml-1 text-dark-500" />
      : <ArrowDown className="w-3 h-3 inline ml-1 text-dark-500" />;
  };

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <div className="p-6">
        <div className="flex flex-col gap-4 mb-6 pb-4 border-b border-primary-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-dark-500">Projects</h1>
              <p className="text-xs text-primary-500 font-mono mt-0.5">
                {sorted.length} of {currentTabProjects.length} order{currentTabProjects.length !== 1 ? 's' : ''}
              </p>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-[10px] text-blue-600 hover:text-blue-800 underline">
                Clear filters
              </button>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={cn(
                  'px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wide rounded border transition-colors',
                  activeTab === 'active'
                    ? 'bg-dark-500 text-white border-dark-500'
                    : 'bg-white text-primary-500 border-primary-200 hover:border-primary-400'
                )}
              >
                Active Projects ({projects.filter((project) => project.status !== ProjectStatus.COMPLETED && project.status !== ProjectStatus.DISPATCHED).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('previous')}
                className={cn(
                  'px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wide rounded border transition-colors',
                  activeTab === 'previous'
                    ? 'bg-dark-500 text-white border-dark-500'
                    : 'bg-white text-primary-500 border-primary-200 hover:border-primary-400'
                )}
              >
                Previous Work ({projects.filter((project) => project.status === ProjectStatus.COMPLETED || project.status === ProjectStatus.DISPATCHED).length})
              </button>
            </div>
          )}
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
                onClick={() => { setSearchText(''); setDebouncedSearch(''); setCurrentPage(1); }}
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
                All ({currentTabProjects.length})
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

            {isAdmin && (
              <select
                value={factoryGroupFilter}
                onChange={(e) => setFactoryGroupFilter(e.target.value)}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors bg-white"
              >
                {FACTORY_GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

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

          {isAdmin && (
            <div className="mb-5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-2">
                Factory Group
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FACTORY_GROUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFactoryGroupFilter(opt.value)}
                    className={cn(
                      'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                      factoryGroupFilter === opt.value ? 'bg-dark-500 text-white border-dark-500' : 'border-primary-200 text-primary-500'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </FilterDrawer>

        {/* Projects Table */}
        <div className="erp-table-wrap border border-primary-200">
          <table className="erp-table">
            <thead>
              <tr>
                <th>
                  <button onClick={() => handleSort('projectTitle')} className="inline-flex items-center gap-1 hover:text-dark-500">
                    Project <SortIcon field="projectTitle" />
                  </button>
                </th>
                <th>
                  <button onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-dark-500">
                    Status <SortIcon field="status" />
                  </button>
                </th>
                <th>
                  <button onClick={() => handleSort('priority')} className="inline-flex items-center gap-1 hover:text-dark-500">
                    Priority <SortIcon field="priority" />
                  </button>
                </th>
                <th>
                  <button onClick={() => handleSort('completionPercentage')} className="inline-flex items-center gap-1 hover:text-dark-500">
                    Progress <SortIcon field="completionPercentage" />
                  </button>
                </th>
                <th>
                  <button onClick={() => handleSort('totalWindows')} className="inline-flex items-center gap-1 hover:text-dark-500">
                    Windows <SortIcon field="totalWindows" />
                  </button>
                </th>
                <th>
                  <button onClick={() => handleSort('deadline')} className="inline-flex items-center gap-1 hover:text-dark-500">
                    Deadline <SortIcon field="deadline" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedProjects.map((project) => {
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
              {paginatedProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-primary-400 text-xs font-mono">
                    No projects found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-primary-200">
            <p className="text-[10px] font-mono text-primary-500">
              Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 border border-primary-200 text-primary-500 hover:border-dark-500 hover:text-dark-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<Array<number | '...'>>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-[10px] text-primary-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={cn(
                        'px-2.5 py-1 text-[10px] font-mono font-bold border transition-colors',
                        safePage === p
                          ? 'bg-dark-500 text-white border-dark-500'
                          : 'border-primary-200 text-primary-500 hover:border-dark-500 hover:text-dark-500'
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 border border-primary-200 text-primary-500 hover:border-dark-500 hover:text-dark-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}