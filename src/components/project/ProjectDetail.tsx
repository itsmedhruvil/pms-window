'use client';

import { useState, useCallback, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  AlertTriangle, Calendar, Package, ChevronRight,
  CheckCircle2, Copy, Trash2
} from 'lucide-react';
import { apiFetch } from '@/lib/utils';
import { cn, DEPARTMENT_LABELS, formatDate, timeAgo, ALERT_TYPE_LABEL } from '@/lib/utils';
import {
  ProjectStatusBadge, PriorityBadge, TaskStatusBadge, AlertSeverityBadge, AlertStatusBadge
} from '@/components/ui/badges';
import { CommentThread } from '@/components/comment/CommentThread';
import { useProjectRealtime } from '@/hooks/useRealtime';
import { ProjectStatusControl } from '@/components/project/ProjectStatusControl';
import { TasksClient } from '@/app/tasks/TasksClient';
import { CreateAlertForm } from '@/components/forms/CreateAlertForm';
import { Modal } from '@/components/ui/Modal';
import type { IProject, ITask, IAlert, IUser } from '@/types';
import { TaskStatus, AlertStatus, DEPARTMENT_SEQUENCE, Department } from '@/types';

// Component to display windows in a grid
function ProjectWindowsTab({ windows, tasks, projectId }: { windows: any[]; tasks: ITask[]; projectId: string }) {
  if (!windows || windows.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-400 font-mono">No windows defined for this project</p>
      </div>
    );
  }

  // Group tasks by window (based on title containing window design and quantity)
  const getWindowTasks = (windowSpec: any, index: number) => {
    return tasks.filter(task =>
      task.title.includes(`${windowSpec.design}`) &&
      task.title.includes(`#${index + 1}`)
    );
  };

  const getWindowProgress = (windowTasks: ITask[]) => {
    if (windowTasks.length === 0) return 0;
    const completedTasks = windowTasks.filter(task => task.status === TaskStatus.DONE).length;
    return Math.round((completedTasks / windowTasks.length) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Project Windows</h2>
        <span className="text-sm text-gray-500 font-mono">
          {windows.length} window type{windows.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {windows.map((windowSpec, index) => {
          const windowTasks = getWindowTasks(windowSpec, index);
          const progress = getWindowProgress(windowTasks);
          const completedTasks = windowTasks.filter(t => t.status === TaskStatus.DONE).length;
          const totalTasks = windowTasks.length;

          return (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer bg-white"
              onClick={() => {
                // Navigate to window view - we'll implement this route
                window.location.href = `/projects/${projectId}/windows/${index + 1}`;
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {windowSpec.design} #{index + 1}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    {windowSpec.width}×{windowSpec.height}mm × {windowSpec.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black font-mono text-gray-900">
                    {progress}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {completedTasks}/{totalTasks} tasks
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full mb-3">
                <div
                  className="h-full bg-black rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Window details */}
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Glass:</span>
                  <span className="font-mono">{windowSpec.glassType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quantity:</span>
                  <span className="font-mono">{windowSpec.quantity}</span>
                </div>
                {windowSpec.notes && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 italic">{windowSpec.notes}</p>
                  </div>
                )}
              </div>

              {/* Task status indicators */}
              <div className="flex gap-1 mt-3">
                {windowTasks.slice(0, 5).map((task, taskIndex) => (
                  <div
                    key={task._id}
                    className={cn(
                      'w-2 h-2 rounded-full',
                      task.status === TaskStatus.DONE ? 'bg-green-500' :
                      task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                      task.status === TaskStatus.BLOCKED ? 'bg-red-500' :
                      'bg-gray-300'
                    )}
                    title={`${task.title} - ${task.status}`}
                  />
                ))}
                {windowTasks.length > 5 && (
                  <div className="w-2 h-2 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-[8px] text-gray-500 font-mono">+</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ProjectDetailProps {
  project: IProject;
  tasks: ITask[];
  alerts: IAlert[];
  isAdmin: boolean;
}

type TabId = 'overview' | 'tasks' | 'alerts';

export function ProjectDetail({ project: initialProject, tasks: initialTasks, alerts: initialAlerts, isAdmin }: ProjectDetailProps) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [tasks, setTasks] = useState(initialTasks);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [activeTaskDepartment, setActiveTaskDepartment] = useState<Department | 'all'>('all');
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openProjectTasks = useCallback((department: Department | 'all') => {
    setActiveTaskDepartment(department);
    setActiveTab('tasks');
  }, []);

  const handleExcelUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const result = await apiFetch(`/api/projects/${project._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ excelSheetName: sheetName, excelRows: rows }),
    });

    if (result.success && result.data) {
      setProject(result.data as IProject);
    }
  };

  // Realtime updates
  useProjectRealtime(project._id, {
    onTaskUpdated: useCallback((updatedTask: ITask) => {
      setTasks((prev) => prev.map((t) => t._id === updatedTask._id ? updatedTask : t));
    }, []),
    onAlertCreated: useCallback((alert: IAlert) => {
      setAlerts((prev) => [alert, ...prev]);
    }, []),
    onAlertUpdated: useCallback((updatedAlert: IAlert) => {
      setAlerts((prev) => prev.map((a) => a._id === updatedAlert._id ? updatedAlert : a));
    }, []),
    onProjectStatusChanged: useCallback((data: { projectId: string; status: IProject['status']; completionPercentage?: number }) => {
      setProject((prev) => ({
        ...prev,
        status: data.status,
        completionPercentage: data.completionPercentage ?? prev.completionPercentage,
      }));
    }, []),
  });

  const handleDuplicateProject = async () => {
    try {
      const response = await fetch(`/api/projects/${project._id}/duplicate`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        // Redirect to the new project or refresh
        window.location.href = `/projects/${data.data.project._id}`;
      }
    } catch (error) {
      console.error('Failed to duplicate project:', error);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Delete this project? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const result = await apiFetch(`/api/projects/${project._id}`, {
      method: 'DELETE',
    });

    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(typeof result.error === 'string' ? result.error : 'Failed to delete project');
      return;
    }

    router.push('/projects');
  };

  const activeAlerts = alerts.filter((a) => a.status !== AlertStatus.RESOLVED);
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const hasActiveAlerts = activeAlerts.length > 0;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks', count: tasks.length },
    { id: 'alerts', label: 'Alerts', count: alerts.length },
  ];

  return (
    <div className={cn(
      'min-h-screen bg-white',
      hasActiveAlerts && 'border-t-4 border-t-red-500'
    )}>
      {/* Alert banner */}
      {hasActiveAlerts && (
        <div className="bg-red-600 text-white px-6 py-2 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-mono font-bold">
            {activeAlerts.length} OPEN ALERT{activeAlerts.length > 1 ? 'S' : ''} - PROJECT ON HOLD
          </span>
        </div>
      )}

      {/* Project header */}
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                {project.clientName}
              </span>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <span className="text-xs font-mono text-gray-400">Project</span>
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              {project.projectTitle}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
          </div>

          {/* Progress ring / completion */}
          <div className="flex-shrink-0 text-right space-y-3">
            <div>
              <div className="text-3xl font-black font-mono text-gray-900">
                {project.completionPercentage}%
              </div>
              <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wide">
                Complete
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {completedTasks}/{tasks.length} tasks
              </div>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <ProjectStatusControl
                  project={project}
                  hasActiveAlerts={hasActiveAlerts}
                  onStatusChange={(updated) => setProject(updated)}
                />
                <button
                  onClick={() => setAlertModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-red-400 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Raise Global Alert
                </button>
                <button
                  onClick={handleDuplicateProject}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Duplicate Project
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-red-400 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3 h-3" />
                  {isDeleting ? 'Deleting…' : 'Delete Project'}
                </button>
                {deleteError && (
                  <p className="text-xs font-mono text-red-600">{deleteError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 bg-gray-100 w-full">
          <div
            className={cn(
              'h-full transition-all duration-700',
              hasActiveAlerts ? 'bg-red-500' : 'bg-black'
            )}
            style={{ width: `${project.completionPercentage}%` }}
          />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-mono">Due {formatDate(project.deadline)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Package className="w-3.5 h-3.5" />
            <span className="font-mono">{project.totalWindows} windows</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-xs font-mono font-bold uppercase tracking-wide border-b-2 transition-colors flex items-center gap-1.5',
                activeTab === tab.id
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  tab.id === 'alerts' && alerts.filter(a => a.status === AlertStatus.ACTIVE).length > 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            project={project}
            tasks={tasks}
            alerts={alerts}
            onOpenTasks={openProjectTasks}
            onUploadExcel={handleExcelUpload}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksClient
            initialTasks={activeTaskDepartment === 'all'
              ? tasks
              : tasks.filter((task) => task.department === activeTaskDepartment)}
            isAdmin={isAdmin}
            selectedDepartment={activeTaskDepartment === 'all' ? undefined : activeTaskDepartment}
          />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab alerts={alerts} />
        )}
      </div>

      {/* Raise Alert modal */}
      <Modal
        open={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        size="md"
      >
        <CreateAlertForm
          projectId={project._id}
          projectTitle={project.projectTitle}
          title="Raise Global Alert"
          onSuccess={() => {
            setAlertModalOpen(false);
          }}
          onCancel={() => setAlertModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function OverviewTab({ project, tasks, alerts, onOpenTasks, onUploadExcel }: {
  project: IProject;
  tasks: ITask[];
  alerts: IAlert[];
  onOpenTasks: (department: Department | 'all') => void;
  onUploadExcel: (file: File) => Promise<void>;
}) {
  const activeAlerts = alerts.filter(a => a.status !== AlertStatus.RESOLVED);
  const headers = project.excelRows?.[0] ? Object.keys(project.excelRows[0]) : [];

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onUploadExcel(file);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-gray-900">Excel Upload</h3>
              <p className="text-xs text-gray-500 font-mono mt-1">
                Upload a spreadsheet and render the first sheet directly in the project overview.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wide border border-gray-200 rounded-full cursor-pointer hover:bg-gray-50">
              Upload File
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>

          {project.excelRows && project.excelRows.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="min-w-full text-left text-xs font-mono">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="px-3 py-2 font-semibold text-gray-600 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {project.excelRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {headers.map((header) => (
                        <td key={`${rowIndex}-${header}`} className="px-3 py-2 align-top text-gray-700">
                          {row[header] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
              No spreadsheet uploaded yet. Upload an Excel file to preview data here.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Project Overview</p>
                <h3 className="text-lg font-black text-gray-900">{project.projectTitle}</h3>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-gray-900">{project.totalWindows}</p>
                <p className="text-[10px] font-mono uppercase tracking-wide text-gray-500">windows</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="rounded-2xl bg-white p-3 border border-gray-100">
                <p className="text-[10px] uppercase tracking-widest text-gray-400">Completion</p>
                <p className="mt-2 font-black text-gray-900">{project.completionPercentage}%</p>
              </div>
              <div className="rounded-2xl bg-white p-3 border border-gray-100">
                <p className="text-[10px] uppercase tracking-widest text-gray-400">Due</p>
                <p className="mt-2 font-black text-gray-900">{formatDate(project.deadline)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Alerts</p>
                <h3 className="text-sm font-black text-gray-900">Active incidents</h3>
              </div>
              <button
                type="button"
                onClick={() => onOpenTasks('all')}
                className="text-[10px] font-mono uppercase tracking-wide text-blue-600 hover:text-blue-800"
              >
                View all tasks
              </button>
            </div>
            {activeAlerts.length > 0 ? (
              <div className="space-y-3">
                {activeAlerts.slice(0, 3).map((alert) => (
                  <div key={alert._id} className="rounded-2xl border border-red-100 bg-red-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-red-700">{ALERT_TYPE_LABEL[alert.type]}</p>
                      <AlertSeverityBadge severity={alert.severity} />
                    </div>
                    <p className="mt-2 text-xs text-gray-700">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No active alerts on this project.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Department Progress</p>
            <h3 className="text-lg font-black text-gray-900">Task completion by team</h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenTasks('all')}
            className="text-[10px] font-mono uppercase tracking-wide text-black border border-black px-3 py-2 rounded-full hover:bg-black hover:text-white transition-colors"
          >
            View All
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DEPARTMENT_SEQUENCE.map((dept) => {
            const deptTasks = tasks.filter((t) => t.department === dept);
            const done = deptTasks.filter((t) => t.status === TaskStatus.DONE).length;
            const pct = deptTasks.length > 0 ? Math.round((done / deptTasks.length) * 100) : 0;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => onOpenTasks(dept)}
                className="group rounded-3xl border border-gray-200 p-4 text-left hover:border-black hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-gray-500">{DEPARTMENT_LABELS[dept]}</p>
                    <p className="mt-1 text-lg font-black text-gray-900">{pct}%</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-mono uppercase text-gray-600">
                    {done}/{deptTasks.length}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-black transition-all" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AlertsTab({ alerts }: { alerts: IAlert[] }) {
  return (
    <div className="space-y-4 max-w-3xl">
      {alerts.length === 0 && (
        <div className="border border-dashed border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 font-mono">No alerts for this project</p>
        </div>
      )}
      {alerts.map((alert) => (
        <AlertRow key={alert._id} alert={alert} />
      ))}
    </div>
  );
}

// Duplicate ProjectWindowsTab removed – the component is defined earlier in the file.

function AlertRow({ alert }: { alert: IAlert }) {
  const [showComments, setShowComments] = useState(false);
  const raisedBy = typeof alert.raisedBy === 'object' ? alert.raisedBy as { name: string } : null;

  return (
    <div className={cn(
      'border p-4',
      alert.status === AlertStatus.ACTIVE ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertSeverityBadge severity={alert.severity} />
            <AlertStatusBadge status={alert.status} />
            <span className="text-xs font-mono text-gray-500">{ALERT_TYPE_LABEL[alert.type]}</span>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{alert.message}</p>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500 font-mono">
            <span>Raised by {raisedBy?.name || 'Admin'}</span>
            <span>{timeAgo(alert.createdAt)}</span>
          </div>
        </div>
        <button
          onClick={() => setShowComments(!showComments)}
          className="text-[11px] font-mono text-gray-500 hover:text-black border border-gray-200 px-2 py-1 uppercase tracking-wide flex-shrink-0"
        >
          Discussion
        </button>
      </div>

      {showComments && (
        <div className="mt-4 border-t border-gray-200 h-64">
          <CommentThread alertId={alert._id} currentUser={{}} />
        </div>
      )}
    </div>
  );
}

function WorkflowTimeline({ tasks }: { tasks: ITask[] }) {
  return (
    <div className="max-w-2xl space-y-1">
      {DEPARTMENT_SEQUENCE.map((dept, deptIdx) => {
        const deptTasks = tasks.filter((t) => t.department === dept).sort((a, b) => a.sequence - b.sequence);
        return (
          <div key={dept} className="border border-gray-200">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-gray-700">
                {deptIdx + 1}. {DEPARTMENT_LABELS[dept]}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {deptTasks.map((task) => (
                <div key={task._id} className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  task.isLocked && 'opacity-50'
                )}>
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    task.status === TaskStatus.DONE ? 'bg-black border-black' :
                    task.status === TaskStatus.IN_PROGRESS ? 'border-black' :
                    task.status === TaskStatus.BLOCKED ? 'bg-red-100 border-red-400' :
                    'border-gray-300'
                  )}>
                    {task.status === TaskStatus.DONE && (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    )}
                    {task.status === TaskStatus.BLOCKED && (
                      <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/tasks/${task._id}`}
                      className={cn(
                      'text-xs font-medium',
                      task.status === TaskStatus.DONE ? 'text-gray-500 line-through' :
                      task.status === TaskStatus.BLOCKED ? 'text-red-600' : 'text-gray-900'
                    )}>
                      {task.title}
                    </Link>
                  </div>
                  <TaskStatusBadge status={task.status} size="sm" />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
