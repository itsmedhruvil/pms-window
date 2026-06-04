'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { AlertTriangle, Filter, ChevronDown, ChevronUp, Plus, Search, X, Check } from 'lucide-react';
import { FilterDrawer, MobileFilterButton } from '@/components/ui/FilterDrawer';
import { cn, ALERT_TYPE_LABEL, getDepartmentLabel, timeAgo, apiFetch } from '@/lib/utils';
import {
  AlertSeverityBadge,
  AlertStatusBadge,
} from '@/components/ui/badges';
import { CommentThread } from '@/components/comment/CommentThread';
import { CreateAlertForm } from '@/components/forms/CreateAlertForm';
import { Modal } from '@/components/ui/Modal';
import { dispatchDataChange } from '@/hooks/useRealtime';
import type { IAlert, IProject, ITask } from '@/types';
import { AlertStatus, AlertType, Department } from '@/types';

type CreateAlertStep = 'type' | 'project' | 'task' | 'form';

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
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [createAlertOpen, setCreateAlertOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateAlertStep>('type');
  const [alertTarget, setAlertTarget] = useState<'global' | 'project' | 'task' | null>(null);
  const [selectedProject, setSelectedProject] = useState<IProject | null>(null);
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null);

  // Search state
  const [projectSearch, setProjectSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [searchResults, setSearchResults] = useState<IProject[]>([]);
  const [taskResults, setTaskResults] = useState<ITask[]>([]);
  const [searching, setSearching] = useState(false);

  // Auto-refresh alert list via custom DOM events (dispatched by CreateAlertForm, handleAction, handleDelete)
  useEffect(() => {
    const handleAlertCreated = (e: Event) => {
      const alert = (e as CustomEvent<IAlert>).detail;
      if (!alert?._id) return;
      setAlerts((prev) => {
        if (prev.some((a) => a._id === alert._id)) return prev;
        return [alert, ...prev];
      });
    };

    const handleAlertUpdated = (e: Event) => {
      const alert = (e as CustomEvent<IAlert>).detail;
      if (!alert?._id) return;
      setAlerts((prev) => prev.map((a) => (a._id === alert._id ? alert : a)));
    };

    const handleAlertDeleted = (e: Event) => {
      const deleted = (e as CustomEvent<{ _id: string } | IAlert>).detail;
      const id = typeof deleted === 'object' && '_id' in deleted ? (deleted as IAlert)._id : '';
      if (!id) return;
      setAlerts((prev) => prev.filter((a) => a._id !== id));
    };

    window.addEventListener('erp-alert-created', handleAlertCreated);
    window.addEventListener('erp-alert-updated', handleAlertUpdated);
    window.addEventListener('erp-alert-deleted', handleAlertDeleted);
    return () => {
      window.removeEventListener('erp-alert-created', handleAlertCreated);
      window.removeEventListener('erp-alert-updated', handleAlertUpdated);
      window.removeEventListener('erp-alert-deleted', handleAlertDeleted);
    };
  }, []);

  const filtered = alerts.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === AlertStatus.ACTIVE).length;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (typeFilter !== 'all') count++;
    return count;
  }, [statusFilter, typeFilter]);

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    setActionLoading(alertId + action);
    const result = await apiFetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
    setActionLoading(null);

    if (result.success && result.data) {
      const updatedAlert = result.data as IAlert;
      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? updatedAlert : a))
      );
      if (updatedAlert.status === AlertStatus.RESOLVED) {
        window.dispatchEvent(new CustomEvent('erp-alert-resolved', { detail: updatedAlert }));
      }
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!window.confirm('Are you sure you want to delete this alert? This action cannot be undone.')) return;

    setActionLoading(alertId + 'delete');
    const result = await apiFetch(`/api/alerts/${alertId}`, {
      method: 'DELETE',
    });
    setActionLoading(null);

    if (result.success) {
      const deletedAlert = alerts.find((a) => a._id === alertId);
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
      if (deletedAlert?.status !== AlertStatus.RESOLVED) {
        window.dispatchEvent(new CustomEvent('erp-alert-deleted', { detail: deletedAlert }));
      }
    }
  };

  // ── Create Alert Flow ─────────────────────────────────────────────────────

  const resetCreateFlow = () => {
    setCreateStep('type');
    setAlertTarget(null);
    setSelectedProject(null);
    setSelectedTask(null);
    setProjectSearch('');
    setTaskSearch('');
    setSearchResults([]);
    setTaskResults([]);
    setCreateAlertOpen(false);
  };

  const handleSelectType = (target: 'global' | 'project' | 'task') => {
    setAlertTarget(target);
    if (target === 'global') {
      setCreateStep('form');
    } else if (target === 'project') {
      setCreateStep('project');
    } else {
      setCreateStep('project'); // Need to select project first for task alerts too
    }
  };

  const handleProjectSearch = useCallback(async (query: string) => {
    setProjectSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const result = await apiFetch<{ items: IProject[] }>(`/api/projects?search=${encodeURIComponent(query)}&limit=10`);
    if (result.success && result.data) {
      setSearchResults((result.data as any).items || []);
    }
    setSearching(false);
  }, []);

  const handleSelectProject = (project: IProject) => {
    setSelectedProject(project);
    setProjectSearch(project.projectTitle);
    setSearchResults([]);
    if (alertTarget === 'project') {
      setCreateStep('form');
    } else {
      // Task alert — fetch tasks for this project
      fetchTasksForProject(project._id);
      setCreateStep('task');
    }
  };

  const fetchTasksForProject = async (projectId: string) => {
    setSearching(true);
    const result = await apiFetch<ITask[]>(`/api/tasks?projectId=${projectId}&limit=200`);
    if (result.success && result.data) {
      setTaskResults(Array.isArray(result.data) ? result.data : []);
    }
    setSearching(false);
  };

  const handleSelectTask = (task: ITask) => {
    setSelectedTask(task);
    setTaskSearch(task.title);
    setCreateStep('form');
  };

  const handleCreateSuccess = () => {
    resetCreateFlow();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono">{alerts.length} total</span>
            <button
              onClick={() => { setCreateAlertOpen(true); setCreateStep('type'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Create Alert
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <Filter className="w-3.5 h-3.5 text-gray-400" />

        {/* Desktop filters */}
        <div className="hidden sm:flex items-center gap-3">
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

        {/* Mobile filter button */}
        <MobileFilterButton
          onClick={() => setMobileFilterOpen(true)}
          activeCount={activeFilterCount}
        />
      </div>

      {/* Mobile filter drawer */}
      <FilterDrawer open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} title="Alert Filters">
        <div className="mb-5">
          <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-2">
            Status
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...Object.values(AlertStatus)] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
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
        </div>

        <div className="mb-5">
          <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-2">
            Type
          </label>
          <div className="space-y-0.5">
            {(['all', ...Object.values(AlertType)] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setMobileFilterOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-gray-50 transition-colors',
                  typeFilter === t ? 'bg-gray-100 font-bold' : ''
                )}
              >
                {t === 'all' ? 'All Types' : ALERT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              setStatusFilter('all');
              setTypeFilter('all');
              setMobileFilterOpen(false);
            }}
            className="w-full px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </FilterDrawer>

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
              onDelete={() => handleDelete(alert._id)}
              actionLoading={actionLoading}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              currentUserDept={currentUserDept}
            />
          ))}
        </div>
      )}

      {/* ── Create Alert Modal (Multi-step) ──────────────────────────────── */}
      <Modal open={createAlertOpen} onClose={resetCreateFlow} size="md">
        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          {(['type', 'project', 'task', 'form'] as const).map((step, idx) => (
            <div key={step} className="flex items-center gap-2">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold',
                createStep === step
                  ? 'bg-red-600 text-white'
                  : ['type', 'project', 'task', 'form'].indexOf(createStep) >= idx
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-200 text-gray-500'
              )}>
                {['type', 'project', 'task', 'form'].indexOf(createStep) > idx ? <Check className="w-3 h-3" /> : idx + 1}
              </div>
              {idx < 3 && <div className={cn('w-6 h-px', ['type', 'project', 'task', 'form'].indexOf(createStep) > idx ? 'bg-gray-800' : 'bg-gray-200')} />}
            </div>
          ))}
        </div>

        {/* Step 1: Choose alert target type */}
        {createStep === 'type' && (
          <div className="p-5 space-y-4">
            <h2 className="text-lg font-black text-gray-900">What type of alert?</h2>
            <p className="text-xs text-gray-500 font-mono">Choose the scope of the alert you want to raise.</p>

            <div className="space-y-2">
              <button
                onClick={() => handleSelectType('global')}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900">Global Alert</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    Standalone alert not linked to any project or task. Affects selected departments.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleSelectType('project')}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900">Project Alert</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    Links to a specific project. Puts the project on hold and blocks affected department tasks.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleSelectType('task')}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900">Task Alert</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    Links to a specific task within a project. Puts the project on hold and blocks this task.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={resetCreateFlow}
                className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select project (for project or task alerts) */}
        {(createStep === 'project') && (
          <div className="p-5 space-y-4">
            <button
              onClick={() => setCreateStep('type')}
              className="text-[10px] font-mono text-gray-500 hover:text-black flex items-center gap-1"
            >
              ← Back
            </button>
            <h2 className="text-lg font-black text-gray-900">
              {alertTarget === 'task' ? 'Select Project (for Task Alert)' : 'Select Project'}
            </h2>
            <p className="text-xs text-gray-500 font-mono">Search for a project by name or client.</p>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => handleProjectSearch(e.target.value)}
                placeholder="Search projects (min 2 chars)..."
                className="w-full pl-9 pr-3 py-2.5 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
                autoFocus
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              )}
            </div>

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="border border-gray-200 max-h-60 overflow-y-auto divide-y divide-gray-100">
                {searchResults.map((project) => (
                  <button
                    key={project._id}
                    onClick={() => handleSelectProject(project)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{project.projectTitle}</p>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{project.clientName}</p>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{project.status?.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}

            {projectSearch.length >= 2 && searchResults.length === 0 && !searching && (
              <p className="text-xs text-gray-400 font-mono text-center py-4">No projects found matching &ldquo;{projectSearch}&rdquo;</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={resetCreateFlow}
                className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select task (for task alerts only) */}
        {(createStep === 'task') && (
          <div className="p-5 space-y-4">
            <button
              onClick={() => {
                setCreateStep('project');
                setSelectedProject(null);
                setProjectSearch('');
                setSearchResults([]);
                setTaskResults([]);
                setTaskSearch('');
              }}
              className="text-[10px] font-mono text-gray-500 hover:text-black flex items-center gap-1"
            >
              ← Back
            </button>
            <h2 className="text-lg font-black text-gray-900">Select Task</h2>
            <p className="text-xs text-gray-500 font-mono">
              Project: <span className="font-bold text-gray-900">{selectedProject?.projectTitle}</span>
            </p>

            {/* Task search/filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => {
                  setTaskSearch(e.target.value);
                }}
                placeholder="Filter tasks by title..."
                className="w-full pl-9 pr-3 py-2.5 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
                autoFocus
              />
            </div>

            {/* Task list */}
            {searching ? (
              <div className="flex items-center justify-center py-8">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              </div>
            ) : taskResults.length > 0 ? (
              <div className="border border-gray-200 max-h-60 overflow-y-auto divide-y divide-gray-100">
                {taskResults
                  .filter((t) => !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase()))
                  .map((task) => (
                    <button
                      key={task._id}
                      onClick={() => handleSelectTask(task)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{task.title}</p>
                        <p className="text-[10px] text-gray-500 font-mono truncate">{getDepartmentLabel(task.department)}</p>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{task.status?.replace(/_/g, ' ')}</span>
                    </button>
                  ))}
                {taskResults.filter((t) => !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase())).length === 0 && (
                  <p className="text-xs text-gray-400 font-mono text-center py-4">No tasks match your filter</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-mono text-center py-4">No tasks found for this project</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={resetCreateFlow}
                className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Alert form */}
        {createStep === 'form' && (
          <div>
            <div className="flex items-center gap-2 px-5 pt-1 pb-2">
              <button
                onClick={() => {
                  if (alertTarget === 'task' && selectedTask) {
                    setCreateStep('task');
                  } else if (alertTarget === 'project' || alertTarget === 'task') {
                    setCreateStep('project');
                  } else {
                    setCreateStep('type');
                  }
                }}
                className="text-[10px] font-mono text-gray-500 hover:text-black flex items-center gap-1"
              >
                ← Back
              </button>
            </div>
            <CreateAlertForm
              projectId={selectedProject?._id}
              projectTitle={selectedProject?.projectTitle}
              taskId={selectedTask?._id}
              defaultAffectedDepartments={selectedTask ? [selectedTask.department] : []}
              title={
                alertTarget === 'global'
                  ? 'Raise Global Alert'
                  : alertTarget === 'task'
                  ? 'Raise Task Alert'
                  : 'Raise Project Alert'
              }
              onSuccess={handleCreateSuccess}
              onCancel={resetCreateFlow}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

function AlertRow({
  alert,
  isExpanded,
  onToggle,
  onAcknowledge,
  onResolve,
  onDelete,
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
  onDelete: () => void;
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
                Acknowledgements
              </p>
              <div className="flex flex-wrap gap-1.5">
                {alert.affectedDepartments.map((dept) => {
                  const deptAcknowledged = Array.isArray(alert.acknowledgedBy)
                    ? alert.acknowledgedBy.some((ack) => {
                        if (typeof ack === 'object' && ack !== null && 'department' in ack) {
                          return (ack as { department: string }).department === dept;
                        }
                        return false;
                      })
                    : false;
                  return (
                    <span
                      key={dept}
                      className={cn(
                        'text-[10px] font-mono px-2 py-0.5 uppercase tracking-wide',
                        deptAcknowledged
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 border border-gray-200 text-gray-600'
                      )}
                    >
                      {deptAcknowledged ? '✓ ' : ''}{getDepartmentLabel(dept)}
                    </span>
                  );
                })}
              </div>
              {Array.isArray(alert.acknowledgedBy) && alert.acknowledgedBy.length > 0 && (
                <div className="mt-1.5 text-[10px] text-gray-400">
                  Acknowledged by: {alert.acknowledgedBy
                    .map((a) => {
                      if (typeof a === 'object' && a !== null && 'name' in a) {
                        const user = a as unknown as { name: string; department: string };
                        return `${user.name} (${(user.department || '').replace('_', ' ')})`;
                      }
                      return '';
                    })
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
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
              {isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  disabled={actionLoading === alert._id + 'delete'}
                  className="px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto"
                >
                  {actionLoading === alert._id + 'delete' ? '...' : 'Delete'}
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