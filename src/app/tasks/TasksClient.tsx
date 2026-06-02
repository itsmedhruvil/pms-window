'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertTriangle, Plus, CheckSquare, Square, Search, Trash2, ChevronDown } from 'lucide-react';
import { cn, getDepartmentLabel, formatDate } from '@/lib/utils';
import { TaskStatusBadge } from '@/components/ui/badges';
import { Modal } from '@/components/ui/Modal';
import { FilterDrawer, MobileFilterButton } from '@/components/ui/FilterDrawer';
import { CreateTaskForm } from '@/components/forms/CreateTaskForm';
import type { ITask, IProject } from '@/types';
import { TaskStatus, Department } from '@/types';

interface TasksClientProps {
  initialTasks: ITask[];
  isAdmin: boolean;
  selectedDepartment?: Department;
  allProjects?: IProject[];
  initialProjectFilter?: string;
  pageTitle?: string;
  showDepartmentColumn?: boolean;
}

export function TasksClient({
  initialTasks,
  isAdmin,
  selectedDepartment,
  allProjects = [],
  initialProjectFilter,
  pageTitle,
  showDepartmentColumn = true,
}: TasksClientProps) {
  const [tasks, setTasks] = useState<ITask[]>(initialTasks);
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
    setTasks((prev) => [task, ...prev]);
    setTaskModalOpen(false);
  }, []);

  // Update tasks when initialTasks changes (e.g. navigation with different data)
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

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

  const counts = {
    todo: tasks.filter((t) => t.status === TaskStatus.TODO).length,
    inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
    blocked: tasks.filter((t) => t.status === TaskStatus.BLOCKED).length,
    done: tasks.filter((t) => t.status === TaskStatus.DONE).length,
  };

  const handleBulkMarkDone = async () => {
    if (selectedTasks.size === 0) return;

    try {
      const updates = Array.from(selectedTasks).map(taskId => ({
        taskId,
        status: TaskStatus.DONE,
        completedAt: new Date(),
      }));

      const response = await fetch('/api/tasks/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) throw new Error('Failed to update tasks');

      setTasks(prev => prev.map(task =>
        selectedTasks.has(task._id)
          ? { ...task, status: TaskStatus.DONE, completedAt: new Date() }
          : task
      ));
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Failed to bulk update tasks:', error);
      alert('Failed to update tasks. Please try again.');
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

      setTasks(prev => prev.filter(task => !selectedTasks.has(task._id)));
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
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h1 className="text-xl font-black text-gray-900">
                {title}
              </h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {filtered.length} task{filtered.length === 1 ? '' : 's'} in list view
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedTasks.size > 0 && (
                <>
                  <button
                    onClick={handleBulkMarkDone}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide bg-black text-white hover:bg-gray-800 transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Mark Done ({selectedTasks.size})
                  </button>
                  {isAdmin && (
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete ({selectedTasks.size})
                    </button>
                  )}
                </>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide bg-black text-white hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Task
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 text-[11px] font-mono">
            {[
              { label: 'TODO', count: counts.todo, color: 'text-gray-600' },
              { label: 'IN PROGRESS', count: counts.inProgress, color: 'text-black font-bold' },
              { label: 'BLOCKED', count: counts.blocked, color: counts.blocked > 0 ? 'text-red-600 font-bold' : 'text-gray-400' },
              { label: 'DONE', count: counts.done, color: 'text-gray-500' },
            ].map(({ label, count, color }) => (
              <span key={label} className={color}>
                {count} {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 px-4 sm:px-6 py-2.5 border-b border-gray-100 flex flex-col gap-3 bg-gray-50">
          {/* Search + Mobile Filter button row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search tasks..."
                className="text-[10px] font-mono border border-gray-200 px-2 py-1 bg-white focus:outline-none focus:border-black w-full sm:w-64"
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
                    className="flex items-center gap-2 text-[10px] font-mono border border-gray-200 px-2 py-1 bg-white focus:outline-none focus:border-black whitespace-nowrap"
                  >
                    <span className="max-w-[140px] truncate">{selectedProjectName}</span>
                    <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  </button>

                  {projectDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 shadow-lg z-50">
                      {/* Search within projects */}
                      <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
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
                            'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-gray-50 transition-colors',
                            projectFilter === 'all' ? 'bg-gray-100 font-bold' : ''
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
                              'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-gray-50 transition-colors',
                              projectFilter === project._id ? 'bg-gray-100 font-bold' : ''
                            )}
                          >
                            <span className="block truncate">{project.projectTitle}</span>
                            <span className="block text-[9px] text-gray-400 truncate">{project.clientName}</span>
                          </button>
                        ))}
                        {filteredProjects.length === 0 && (
                          <p className="px-3 py-3 text-[10px] text-gray-400 font-mono text-center">
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
                className="text-[10px] font-mono border border-gray-200 px-2 py-1 bg-white focus:outline-none focus:border-black"
              >
                <option value="all">All Statuses</option>
                {Object.values(TaskStatus).map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
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
            <button
              onClick={toggleSelectAll}
              className="text-[10px] font-mono text-blue-600 hover:text-blue-800 underline"
            >
              {selectedTasks.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-[10px] text-gray-500 font-mono">
              {selectedTasks.size > 0 ? `${selectedTasks.size} selected • ` : ''}{filtered.length} tasks
            </span>
          </div>
        </div>

        {/* Mobile filter drawer */}
        <FilterDrawer open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} title="Task Filters">
          {/* Status filter */}
          <div className="mb-5">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...Object.values(TaskStatus)] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                    statusFilter === s
                      ? 'bg-black text-white border-black'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  )}
                >
                  {s === 'all' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Project filter */}
          {allProjects.length > 0 && (
            <div className="mb-5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-2">
                Project
              </label>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                <button
                  onClick={() => { setProjectFilter('all'); setMobileFilterOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-gray-50 transition-colors',
                    projectFilter === 'all' ? 'bg-gray-100 font-bold' : ''
                  )}
                >
                  All Projects
                </button>
                {allProjects.map((project) => (
                  <button
                    key={project._id}
                    onClick={() => { setProjectFilter(project._id); setMobileFilterOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-gray-50 transition-colors',
                      projectFilter === project._id ? 'bg-gray-100 font-bold' : ''
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
          <TaskListView
            tasks={filtered}
            selectedTasks={selectedTasks}
            onToggleSelection={toggleTaskSelection}
            onOpenTask={(task) => router.push(`/tasks/${task._id}`)}
            showDepartmentColumn={showDepartmentColumn}
          />
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
}: {
  tasks: ITask[];
  selectedTasks: Set<string>;
  onToggleSelection: (taskId: string) => void;
  onOpenTask: (task: ITask) => void;
  showDepartmentColumn?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 p-16 text-center">
        <p className="text-sm text-gray-400 font-mono">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="erp-table-wrap border border-gray-200">
          <table className="erp-table">
        <thead>
          <tr>
            <th className="w-10"></th>
            <th>Task</th>
            {showDepartmentColumn && <th>Department</th>}
            <th>Status</th>
            <th>Due Date</th>
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
                  task.status === TaskStatus.BLOCKED ? 'bg-red-50/30' : '',
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
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {task.isLocked && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                    {task.status === TaskStatus.BLOCKED && (
                      <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 animate-pulse" />
                    )}
                    <span className={cn(
                      'font-medium text-gray-900',
                      task.isLocked && 'text-gray-500',
                      task.status === TaskStatus.BLOCKED && 'text-red-700'
                    )}>
                      {task.title}
                    </span>
                  </div>
                </td>
                {showDepartmentColumn && (
                  <td>
                    <span className="font-mono text-gray-500 uppercase text-[10px] tracking-wide">
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
                        : 'text-gray-600'
                    )}>
                      {formatDate(task.dueDate)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td>
                  {project ? (
                    <span className="text-[11px] text-gray-500 truncate max-w-[120px] block">
                      {project.projectTitle}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
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
