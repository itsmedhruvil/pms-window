'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus, CheckSquare, Square, Search, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn, getDepartmentLabel, formatDate, apiFetch, TASK_STATUS_LABEL } from '@/lib/utils';
import { TaskStatusBadge } from '@/components/ui/badges';
import { Modal } from '@/components/ui/Modal';
import { FilterDrawer, MobileFilterButton } from '@/components/ui/FilterDrawer';
import { CreateTaskForm } from '@/components/forms/CreateTaskForm';
import type { ITask, IProject } from '@/types';
import { TaskStatus, Department } from '@/types';
import { useRealtime } from '@/hooks/useRealtime';

type TaskView = 'pending' | 'done';

const PAGE_SIZE = 50;

interface TasksClientProps {
  initialTasks: ITask[];
  isAdmin: boolean;
  selectedDepartment?: Department;
  allProjects?: IProject[];
  initialProjectFilter?: string;
  initialStageFilter?: string;
  pageTitle?: string;
  showDepartmentColumn?: boolean;
  /** Server-side counts so tabs/pagination render without loading every doc */
  initialPendingCount?: number;
  initialDoneCount?: number;
  initialTotalCount?: number;
  /**
   * Extra query string scoping lazy fetches to this view,
   * e.g. `department=production` or `projectId=xxx`.
   * Done pages are fetched via `/api/tasks?${fetchScope}&status=done`.
   */
  fetchScope?: string;
}

interface TasksApiResponse {
  success: boolean;
  data: ITask[];
  error?: string;
  pagination?: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean };
}

export function TasksClient({
  initialTasks,
  isAdmin,
  selectedDepartment,
  allProjects = [],
  initialProjectFilter,
  initialStageFilter,
  pageTitle,
  showDepartmentColumn = true,
  initialPendingCount,
  initialDoneCount,
  initialTotalCount,
  fetchScope = '',
}: TasksClientProps) {
  // initialTasks is the FIRST page of PENDING tasks (server renders
  // pending-only by default for fast loading). Done tasks are fetched
  // lazily only when the user opens the Done tab.
  const [pendingTasks, setPendingTasks] = useState<ITask[]>(initialTasks);
  const [doneTasks, setDoneTasks] = useState<ITask[]>([]);
  const [doneLoaded, setDoneLoaded] = useState(false);
  const [doneLoadError, setDoneLoadError] = useState<string | null>(null);
  const [view, setView] = useState<TaskView>('pending');
  const [pendingCount, setPendingCount] = useState<number>(
    initialPendingCount ?? initialTasks.filter((t) => t.status !== TaskStatus.DONE).length
  );
  const [doneCount, setDoneCount] = useState<number>(
    initialDoneCount ?? initialTasks.filter((t) => t.status === TaskStatus.DONE).length
  );
  const [totalCount, setTotalCount] = useState<number>(
    initialTotalCount ?? initialTasks.length
  );
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(() =>
    Math.max(1, Math.ceil(((initialPendingCount ?? initialTasks.length) || 0) / PAGE_SIZE))
  );
  const [donePage, setDonePage] = useState(1);
  const [doneTotalPages, setDoneTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [loadingView, setLoadingView] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectFilter || 'all');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const withScope = useCallback(
    (params: string) => {
      const scope = fetchScope ? `${fetchScope}&` : '';
      return `/api/tasks?${scope}${params}`;
    },
    [fetchScope]
  );

  // Reset when navigating to a different server-rendered view
  useEffect(() => {
    setPendingTasks(initialTasks);
    setDoneTasks([]);
    setDoneLoaded(false);
    setDoneLoadError(null);
    setView('pending');
    setPendingCount(initialPendingCount ?? initialTasks.filter((t) => t.status !== TaskStatus.DONE).length);
    setDoneCount(initialDoneCount ?? initialTasks.filter((t) => t.status === TaskStatus.DONE).length);
    setTotalCount(initialTotalCount ?? initialTasks.length);
    setPendingPage(1);
    setPendingTotalPages(
      Math.max(1, Math.ceil(((initialPendingCount ?? initialTasks.length) || 0) / PAGE_SIZE))
    );
    setDonePage(1);
    setDoneTotalPages(1);
    setSelectedTasks(new Set());
    setSearchText('');
    setProjectFilter(initialProjectFilter || 'all');
  }, [initialTasks, initialPendingCount, initialDoneCount, initialTotalCount, initialProjectFilter, initialStageFilter]);

  /** Lazy-load DONE tasks only when the Done tab is opened. */
  const loadDoneView = useCallback(async () => {
    if (doneLoaded) return;
    setLoadingView(true);
    setDoneLoadError(null);
    try {
      const res = await apiFetch<ITask[]>(withScope(`status=done&page=1&limit=${PAGE_SIZE}`)) as unknown as TasksApiResponse;
      if (res.success && Array.isArray(res.data)) {
        setDoneTasks(res.data);
        setDoneLoaded(true);
        setDonePage(1);
        if (res.pagination) {
          setDoneTotalPages(Math.max(1, res.pagination.totalPages));
          setDoneCount(res.pagination.total);
        } else {
          setDoneTotalPages(Math.max(1, Math.ceil(res.data.length / PAGE_SIZE)));
        }
      } else {
        setDoneLoadError(res.error || 'Could not load completed tasks.');
      }
    } catch (err) {
      console.error('Failed to load done tasks:', err);
      setDoneLoadError(err instanceof Error ? err.message : 'Could not load completed tasks.');
    } finally {
      setLoadingView(false);
    }
  }, [doneLoaded, withScope]);

  const switchView = useCallback((next: TaskView) => {
    setView(next);
    setSelectedTasks(new Set());
    setStatusFilter('all');
    if (next === 'done') void loadDoneView();
  }, [loadDoneView]);

  /** Server-side pagination — appends the next page without a full reload. */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      if (view === 'pending') {
        const nextPage = pendingPage + 1;
        const res = await apiFetch<ITask[]>(withScope(`page=${nextPage}&limit=${PAGE_SIZE}`)) as unknown as TasksApiResponse;
        if (res.success && Array.isArray(res.data)) {
          setPendingTasks((prev) => [...prev, ...res.data]);
          setPendingPage(nextPage);
          if (res.pagination) {
            setPendingTotalPages(Math.max(1, res.pagination.totalPages));
            setPendingCount(res.pagination.total);
          }
        }
      } else {
        const nextPage = donePage + 1;
        const res = await apiFetch<ITask[]>(withScope(`status=done&page=${nextPage}&limit=${PAGE_SIZE}`)) as unknown as TasksApiResponse;
        if (res.success && Array.isArray(res.data)) {
          setDoneTasks((prev) => [...prev, ...res.data]);
          setDonePage(nextPage);
          if (res.pagination) {
            setDoneTotalPages(Math.max(1, res.pagination.totalPages));
            setDoneCount(res.pagination.total);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load more tasks:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, view, pendingPage, donePage, withScope]);

  const tasks = view === 'pending' ? pendingTasks : doneTasks;
  const hasMore = view === 'pending' ? pendingPage < pendingTotalPages : donePage < doneTotalPages;

  // Close project dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTaskCreated = useCallback((task: ITask) => {
    if (task.status === TaskStatus.DONE) {
      setDoneTasks((prev) => [task, ...prev]);
      setDoneCount((c) => c + 1);
    } else {
      setPendingTasks((prev) => [task, ...prev]);
      setPendingCount((c) => c + 1);
    }
    setTotalCount((c) => c + 1);
    setTaskModalOpen(false);
  }, []);

  // ── Hot reload ────────────────────────────────────────────────────────────
  // Mirrors of the loaded rows so the realtime handler can branch on the
  // current lists without depending on them (which would re-bind the listener
  // on every render).
  const pendingRef = useRef(pendingTasks);
  const doneRef = useRef(doneTasks);
  const doneLoadedRef = useRef(doneLoaded);
  const lastFocusRefreshRef = useRef(0);

  useEffect(() => { pendingRef.current = pendingTasks; }, [pendingTasks]);
  useEffect(() => { doneRef.current = doneTasks; }, [doneTasks]);
  useEffect(() => { doneLoadedRef.current = doneLoaded; }, [doneLoaded]);

  /**
   * A task mutated anywhere else in this session (task detail, bulk update,
   * project panel) is patched in place, and tasks crossing the Pending/Done
   * boundary are moved between the two lists with their counters kept honest.
   */
  useRealtime({
    onTaskUpdated: (updated) => {
      if (!updated?._id) return;
      const id = updated._id;
      const isDone = updated.status === TaskStatus.DONE;
      const inPending = pendingRef.current.some((t) => t._id === id);
      const inDone = doneRef.current.some((t) => t._id === id);

      if (inPending && isDone) {
        setPendingTasks((prev) => prev.filter((t) => t._id !== id));
        setPendingCount((c) => Math.max(0, c - 1));
        setDoneCount((c) => c + 1);
        if (doneLoadedRef.current) {
          setDoneTasks((prev) => (prev.some((t) => t._id === id) ? prev : [updated, ...prev]));
        }
        return;
      }

      if (inDone && !isDone) {
        setDoneTasks((prev) => prev.filter((t) => t._id !== id));
        setDoneCount((c) => Math.max(0, c - 1));
        setPendingCount((c) => c + 1);
        setPendingTasks((prev) => (prev.some((t) => t._id === id) ? prev : [updated, ...prev]));
        return;
      }

      if (inPending) setPendingTasks((prev) => prev.map((t) => (t._id === id ? updated : t)));
      if (inDone) setDoneTasks((prev) => prev.map((t) => (t._id === id ? updated : t)));
    },
  });

  /**
   * Re-fetch everything already loaded in the active view, so changes made by
   * other users land without a manual reload. Pages already appended by
   * "Load more" are requested in one go to keep the row set intact.
   */
  const refreshView = useCallback(async () => {
    if (loadingView || loadingMore) return;
    try {
      if (view === 'pending') {
        const limit = PAGE_SIZE * Math.max(1, pendingPage);
        const res = await apiFetch<ITask[]>(withScope(`page=1&limit=${limit}`)) as unknown as TasksApiResponse;
        if (res.success && Array.isArray(res.data)) {
          setPendingTasks(res.data);
          if (res.pagination) {
            setPendingCount(res.pagination.total);
            setPendingTotalPages(Math.max(1, Math.ceil(res.pagination.total / PAGE_SIZE)));
          }
        }
      } else if (doneLoaded) {
        const limit = PAGE_SIZE * Math.max(1, donePage);
        const res = await apiFetch<ITask[]>(withScope(`status=done&page=1&limit=${limit}`)) as unknown as TasksApiResponse;
        if (res.success && Array.isArray(res.data)) {
          setDoneTasks(res.data);
          if (res.pagination) {
            setDoneCount(res.pagination.total);
            setDoneTotalPages(Math.max(1, Math.ceil(res.pagination.total / PAGE_SIZE)));
          }
        }
      }
    } catch (err) {
      console.error('Failed to refresh tasks:', err);
    }
  }, [view, pendingPage, donePage, doneLoaded, loadingView, loadingMore, withScope]);

  // Refresh when the tab regains focus, throttled so alt-tabbing does not spam
  // the API.
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefreshRef.current < 5000) return;
      lastFocusRefreshRef.current = now;
      void refreshView();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshView]);

  const filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;

    // Project filter
    if (projectFilter !== 'all') {
      const projectId = typeof t.projectId === 'object' && t.projectId !== null
        ? (t.projectId as { _id: string })._id
        : t.projectId;
      if (projectId !== projectFilter) return false;
    }

    if (searchText.trim().length > 0) {
      const query = searchText.trim().toLowerCase();
      return (
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.department.toLowerCase().includes(query) ||
        (typeof t.projectId === 'object' && 'projectTitle' in t.projectId
          ? t.projectId.projectTitle.toLowerCase().includes(query)
          : false)
      );
    }
    return true;
  });

  const handleBulkUpdateStatus = async (status: TaskStatus) => {
    if (selectedTasks.size === 0 || bulkUpdating) return;
    setBulkUpdating(true);
    const selectedIds = new Set(selectedTasks);
    const selectedRecords = tasks.filter((task) => selectedIds.has(task._id));
    const movedCount = status === TaskStatus.DONE
      ? selectedRecords.filter((task) => task.status !== TaskStatus.DONE).length
      : selectedRecords.filter((task) => task.status === TaskStatus.DONE).length;
    const completedAt = status === TaskStatus.DONE ? new Date() : undefined;
    const updatedRecords = selectedRecords.map((task) => ({
      ...task,
      status,
      completedAt,
    }));

    try {
      const updates = Array.from(selectedIds).map(taskId => ({
        taskId,
        status,
        completedAt,
      }));

      const response = await fetch('/api/tasks/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) throw new Error('Failed to update tasks');

      if (status === TaskStatus.DONE) {
        setPendingTasks((prev) => prev.filter((task) => !selectedIds.has(task._id)));
        setPendingCount((count) => Math.max(0, count - movedCount));
        setDoneCount((count) => count + movedCount);
        setDoneTotalPages(Math.max(1, Math.ceil((doneCount + movedCount) / PAGE_SIZE)));
        setDoneTasks((prev) => [
          ...updatedRecords,
          ...prev.filter((task) => !selectedIds.has(task._id)),
        ]);
      } else {
        setDoneTasks((prev) => prev.filter((task) => !selectedIds.has(task._id)));
        setDoneCount((count) => Math.max(0, count - movedCount));
        setPendingCount((count) => count + movedCount);
        setPendingTotalPages(Math.max(1, Math.ceil((pendingCount + movedCount) / PAGE_SIZE)));
        setPendingTasks((prev) => [
          ...updatedRecords,
          ...prev.filter((task) => !selectedIds.has(task._id)),
        ]);
      }
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Failed to bulk update task status:', error);
      alert('Failed to update tasks. Please try again.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;
    if (!window.confirm(`Delete ${selectedTasks.size} selected task${selectedTasks.size === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/tasks/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: Array.from(selectedTasks) }),
      });

      if (!response.ok) throw new Error('Failed to delete tasks');

      const deletedIds = new Set(selectedTasks);
      if (view === 'pending') {
        setPendingTasks((prev) => prev.filter((task) => !deletedIds.has(task._id)));
        setPendingCount((c) => Math.max(0, c - deletedIds.size));
      } else {
        setDoneTasks((prev) => prev.filter((task) => !deletedIds.has(task._id)));
        setDoneCount((c) => Math.max(0, c - deletedIds.size));
      }
      setTotalCount((c) => Math.max(0, c - deletedIds.size));
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Failed to bulk delete tasks:', error);
      alert('Failed to delete tasks. Please try again.');
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === filtered.length && filtered.length > 0) {
      setSelectedTasks(new Set());
    } else {
      const allTaskIds = filtered.map(task => task._id);
      setSelectedTasks(new Set(allTaskIds));
    }
  };

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return allProjects;
    const q = projectSearch.toLowerCase();
    return allProjects.filter(
      (p) =>
        p.projectTitle.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q)
    );
  }, [allProjects, projectSearch]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (projectFilter !== 'all') count++;
    if (searchText.trim()) count++;
    return count;
  }, [statusFilter, projectFilter, searchText]);

  const selectedProjectName = projectFilter === 'all'
    ? 'All Projects'
    : allProjects.find((p) => p._id === projectFilter)?.projectTitle || 'All Projects';

  const title = pageTitle || (
    selectedDepartment
      ? `${getDepartmentLabel(selectedDepartment)} Tasks`
      : 'All Tasks'
  );

  return (
    <div className="flex min-h-[640px] overflow-hidden">
      {/* Main panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-primary-200">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h1 className="text-xl font-black text-dark-500">
                {title}
              </h1>
              <p className="text-xs text-primary-500 font-mono mt-0.5">
                {view === 'pending'
                  ? `${pendingCount} pending · ${doneCount} done — Done loads on demand`
                  : `${doneCount} completed task${doneCount === 1 ? '' : 's'}`}
              </p>
              {/* Pending / Done view toggle — Done is lazy-loaded for fast initial render */}
              <div className="flex items-center gap-2 mt-2">
                <div className="inline-flex rounded-sm border border-primary-200 bg-primary-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => switchView('pending')}
                    className={cn(
                      'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors',
                      view === 'pending' ? 'bg-dark-500 text-white' : 'text-primary-500 hover:text-dark-500'
                    )}
                  >
                    Pending ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('done')}
                    className={cn(
                      'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-colors flex items-center gap-1.5',
                      view === 'done' ? 'bg-dark-500 text-white' : 'text-primary-500 hover:text-dark-500'
                    )}
                  >
                    {loadingView && !doneLoaded ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    Done ({doneCount})
                  </button>
                </div>
                <span className="text-[10px] font-mono text-primary-400 hidden md:inline">
                  {totalCount} total · showing {filtered.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <details className="relative">
                  <summary className="flex list-none cursor-pointer items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide border border-primary-300 text-dark-500 hover:border-dark-500">
                    {bulkUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
                    Bulk Actions ({selectedTasks.size})
                    <ChevronDown className="w-3 h-3" />
                  </summary>
                  <div className="absolute right-0 top-full z-30 mt-1 min-w-48 border border-primary-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      disabled={selectedTasks.size === 0 || bulkUpdating}
                      onClick={(event) => {
                        void handleBulkUpdateStatus(TaskStatus.DONE);
                        event.currentTarget.closest('details')?.removeAttribute('open');
                      }}
                      className="block w-full px-3 py-2 text-left text-xs font-mono text-dark-500 hover:bg-primary-50 disabled:opacity-40"
                    >
                      Mark Done
                    </button>
                    <button
                      type="button"
                      disabled={selectedTasks.size === 0 || bulkUpdating}
                      onClick={(event) => {
                        void handleBulkUpdateStatus(TaskStatus.TODO);
                        event.currentTarget.closest('details')?.removeAttribute('open');
                      }}
                      className="block w-full px-3 py-2 text-left text-xs font-mono text-dark-500 hover:bg-primary-50 disabled:opacity-40"
                    >
                      Mark Pending
                    </button>
                    <button
                      type="button"
                      disabled={filtered.length === 0 || bulkUpdating}
                      onClick={(event) => {
                        toggleSelectAll();
                        event.currentTarget.closest('details')?.removeAttribute('open');
                      }}
                      className="block w-full border-t border-primary-100 px-3 py-2 text-left text-xs font-mono text-dark-500 hover:bg-primary-50 disabled:opacity-40"
                    >
                      {selectedTasks.size === filtered.length && filtered.length > 0
                        ? 'Deselect all visible'
                        : 'Select all visible'}
                    </button>
                  </div>
                </details>
              )}
              {selectedTasks.size > 0 && isAdmin && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete ({selectedTasks.size})
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide bg-dark-500 text-white hover:bg-dark-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Task
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-4 sm:px-6 py-2.5 border-b border-primary-100 flex flex-col gap-3 bg-primary-50">
          {/* Search + Mobile Filter button row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="w-4 h-4 text-primary-400 flex-shrink-0" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search tasks..."
                className="text-[10px] font-mono border border-primary-200 px-2 py-1 bg-white focus:outline-none focus:border-dark-500 w-full sm:w-64"
              />
            </div>

            {/* Desktop filters — hidden on mobile */}
            <div className="hidden sm:flex items-center gap-2">
              {/* Project filter dropdown with search */}
              {allProjects.length > 0 && (
                <div className="relative" ref={projectDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                    className="flex items-center gap-2 text-[10px] font-mono border border-primary-200 px-2 py-1 bg-white focus:outline-none focus:border-dark-500 whitespace-nowrap"
                  >
                    <span className="max-w-[140px] truncate">{selectedProjectName}</span>
                    <ChevronDown className="w-3 h-3 text-primary-400 flex-shrink-0" />
                  </button>

                  {projectDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-primary-200 shadow-lg z-50">
                      {/* Search within projects */}
                      <div className="p-2 border-b border-primary-100">
                        <div className="flex items-center gap-1.5">
                          <Search className="w-3 h-3 text-primary-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                            placeholder="Search projects..."
                            className="w-full text-[10px] font-mono border-0 focus:outline-none p-0 bg-transparent"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setProjectFilter('all');
                            setProjectDropdownOpen(false);
                            setProjectSearch('');
                          }}
                          className={cn(
                            'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-primary-50 transition-colors',
                            projectFilter === 'all' ? 'bg-primary-100 font-bold' : ''
                          )}
                        >
                          All Projects
                        </button>
                        {filteredProjects.map((project) => (
                          <button
                            key={project._id}
                            type="button"
                            onClick={() => {
                              setProjectFilter(project._id);
                              setProjectDropdownOpen(false);
                              setProjectSearch('');
                            }}
                            className={cn(
                              'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-primary-50 transition-colors',
                              projectFilter === project._id ? 'bg-primary-100 font-bold' : ''
                            )}
                          >
                            <span className="block truncate">{project.projectTitle}</span>
                            <span className="block text-[9px] text-primary-400 truncate">{project.clientName}</span>
                          </button>
                        ))}
                        {filteredProjects.length === 0 && (
                          <p className="px-3 py-3 text-[10px] text-primary-400 font-mono text-center">
                            No projects found
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
                className="text-[10px] font-mono border border-primary-200 px-2 py-1 bg-white focus:outline-none focus:border-dark-500"
              >
                <option value="all">{view === 'done' ? 'Done' : 'All Pending'}</option>
                {(view === 'pending'
                  ? [TaskStatus.TODO, TaskStatus.IN_PROGRESS]
                  : [] as TaskStatus[]
                ).map((s) => (
                  <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>

            {/* Mobile filter button */}
            <MobileFilterButton
              onClick={() => setMobileFilterOpen(true)}
              activeCount={activeFilterCount}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-primary-500 font-mono">
              {selectedTasks.size > 0 ? `${selectedTasks.size} selected • ` : ''}{filtered.length} tasks
            </span>
          </div>
        </div>

        {/* Mobile filter drawer */}
        <FilterDrawer open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} title="Task Filters">
          {/* Status filter */}
          <div className="mb-5">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...(view === 'pending'
                ? [TaskStatus.TODO, TaskStatus.IN_PROGRESS]
                : [] as TaskStatus[])] as Array<TaskStatus | 'all'>).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                    statusFilter === s
                      ? 'bg-dark-500 text-white border-dark-500'
                      : 'border-primary-200 text-primary-500 hover:border-primary-400'
                  )}
                >
                  {s === 'all' ? (view === 'done' ? 'Done' : 'All Pending') : TASK_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Project filter */}
          {allProjects.length > 0 && (
            <div className="mb-5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-2">
                Project
              </label>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                <button
                  onClick={() => { setProjectFilter('all'); setMobileFilterOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-primary-50 transition-colors',
                    projectFilter === 'all' ? 'bg-primary-100 font-bold' : ''
                  )}
                >
                  All Projects
                </button>
                {allProjects.map((project) => (
                  <button
                    key={project._id}
                    onClick={() => { setProjectFilter(project._id); setMobileFilterOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-primary-50 transition-colors',
                      projectFilter === project._id ? 'bg-primary-100 font-bold' : ''
                    )}
                  >
                    <span className="block truncate">{project.projectTitle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setProjectFilter('all');
                setSearchText('');
                setMobileFilterOpen(false);
              }}
              className="w-full px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </FilterDrawer>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {view === 'done' && !doneLoaded && loadingView ? (
            <div className="border border-dashed border-primary-200 p-16 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary-400" />
              <p className="text-sm text-primary-400 font-mono mt-2">Loading completed tasks…</p>
            </div>
          ) : view === 'done' && !doneLoaded && doneLoadError ? (
            <div className="border border-dashed border-red-200 p-10 text-center">
              <p className="text-sm text-red-600 font-mono">{doneLoadError}</p>
              <button
                type="button"
                onClick={() => void loadDoneView()}
                className="mt-3 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border border-primary-300 text-dark-500 hover:border-dark-500"
              >
                Retry
              </button>
            </div>
          ) : (
            <TaskListView
              tasks={filtered}
              selectedTasks={selectedTasks}
              onToggleSelection={toggleTaskSelection}
              onOpenTask={(task) => router.push(`/tasks/${task._id}`)}
              showDepartmentColumn={showDepartmentColumn}
              emptyLabel={view === 'done' ? 'No completed tasks yet' : 'No pending tasks — all clear'}
            />
          )}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border border-primary-200 text-dark-500 hover:border-dark-500 transition-colors disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {loadingMore
                  ? 'Loading…'
                  : view === 'pending'
                    ? `Load more pending (${pendingTasks.length} of ${pendingCount})`
                    : `Load more done (${doneTasks.length} of ${doneCount})`}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} size="lg">
        <CreateTaskForm
          department={selectedDepartment}
          onSuccess={handleTaskCreated}
          onCancel={() => setTaskModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function TaskListView({
  tasks,
  selectedTasks,
  onToggleSelection,
  onOpenTask,
  showDepartmentColumn = true,
  emptyLabel = 'No tasks found',
}: {
  tasks: ITask[];
  selectedTasks: Set<string>;
  onToggleSelection: (taskId: string) => void;
  onOpenTask: (task: ITask) => void;
  showDepartmentColumn?: boolean;
  emptyLabel?: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-primary-200 p-16 text-center">
        <p className="text-sm text-primary-400 font-mono">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="erp-table-wrap border border-primary-200">
          <table className="erp-table">
        <thead>
          <tr>
            <th className="w-10"></th>
            <th>Task</th>
            {showDepartmentColumn && <th>Department</th>}
            <th>Status</th>
            <th>End Date</th>
            <th>Project</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const project = typeof task.projectId === 'object' && task.projectId !== null
              ? task.projectId as { _id: string; projectTitle: string; clientName?: string }
              : null;

            return (
              <tr
                key={task._id}
                className={cn(
                  'cursor-pointer transition-colors',
                  task.isLocked ? 'opacity-60' : '',
                  selectedTasks.has(task._id) ? 'bg-blue-50' : ''
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[data-checkbox]')) return;
                  onOpenTask(task);
                }}
              >
                <td data-checkbox>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelection(task._id);
                    }}
                    className="flex items-center justify-center w-5 h-5"
                  >
                    {selectedTasks.has(task._id) ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-primary-300" />
                    )}
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {task.isLocked && <Lock className="w-3 h-3 text-primary-400 flex-shrink-0" />}
                    <span className={cn(
                      'font-medium text-dark-500',
                      task.isLocked && 'text-primary-500'
                    )}>
                      {task.title}
                    </span>
                  </div>
                </td>
                {showDepartmentColumn && (
                  <td>
                    <span className="font-mono text-primary-500 uppercase text-[10px] tracking-wide">
                      {getDepartmentLabel(task.department)}
                    </span>
                  </td>
                )}
                <td>
                  <TaskStatusBadge status={task.status} size="sm" />
                </td>
                <td>
                  {task.dueDate ? (
                    <span className={cn(
                      'font-mono text-[11px]',
                      new Date(task.dueDate) < new Date()
                        ? 'text-red-600 font-bold'
                        : 'text-dark-400'
                    )}>
                      {formatDate(task.dueDate)}
                    </span>
                  ) : (
                    <span className="text-primary-300">—</span>
                  )}
                </td>
                <td>
                  {project ? (
                    <span className="text-[11px] text-primary-500 truncate max-w-[120px] block">
                      {project.projectTitle}
                    </span>
                  ) : (
                    <span className="text-primary-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
