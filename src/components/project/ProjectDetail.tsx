'use client';

import { useState, useCallback } from 'react';
import {
  AlertTriangle, Calendar, Package, ChevronRight,
  CheckCircle2, Copy
} from 'lucide-react';
import { cn, DEPARTMENT_LABELS, formatDate, timeAgo, ALERT_TYPE_LABEL } from '@/lib/utils';
import {
  ProjectStatusBadge, PriorityBadge, TaskStatusBadge, AlertSeverityBadge, AlertStatusBadge
} from '@/components/ui/badges';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { CommentThread } from '@/components/comment/CommentThread';
import { useProjectRealtime } from '@/hooks/useRealtime';
import { ProjectStatusControl } from '@/components/project/ProjectStatusControl';
import { CreateAlertForm } from '@/components/forms/CreateAlertForm';
import { Modal } from '@/components/ui/Modal';
import type { IProject, ITask, IAlert, IUser } from '@/types';
import { TaskStatus, AlertStatus, DEPARTMENT_SEQUENCE } from '@/types';

interface ProjectDetailProps {
  project: IProject;
  tasks: ITask[];
  alerts: IAlert[];
  currentUser: Partial<IUser>;
  isAdmin: boolean;
}

type TabId = 'overview' | 'kanban' | 'alerts' | 'timeline';

export function ProjectDetail({ project: initialProject, tasks: initialTasks, alerts: initialAlerts, currentUser, isAdmin }: ProjectDetailProps) {
  const [project, setProject] = useState(initialProject);
  const [tasks, setTasks] = useState(initialTasks);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);

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

  const activeAlerts = alerts.filter((a) => a.status !== AlertStatus.RESOLVED);
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const hasActiveAlerts = activeAlerts.length > 0;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'kanban', label: 'Task Board', count: tasks.length },
    { id: 'alerts', label: 'Alerts', count: alerts.length },
    { id: 'timeline', label: 'Workflow' },
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
                  Raise Alert
                </button>
                <button
                  onClick={handleDuplicateProject}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Duplicate Project
                </button>
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
          <OverviewTab project={project} tasks={tasks} alerts={alerts} />
        )}
        {activeTab === 'kanban' && (
          <div className="h-[calc(100vh-300px)]">
            <KanbanBoard
              tasks={tasks}
              canAssign={isAdmin}
              onTaskUpdate={(updated) => {
                setTasks((prev) => prev.map((t) => t._id === updated._id ? updated : t));
                if (updated.status === TaskStatus.DONE) setSelectedTask(null);
              }}
              canDrag={(task) => {
                if (!currentUser.department) return false;
                return task.department === currentUser.department || isAdmin;
              }}
            />
          </div>
        )}
        {activeTab === 'alerts' && (
          <AlertsTab alerts={alerts} />
        )}
        {activeTab === 'timeline' && (
          <WorkflowTimeline tasks={tasks} />
        )}
      </div>

      {/* Task slide-over */}
      {selectedTask && (
        <TaskSlideOver
          task={selectedTask}
          currentUser={currentUser}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Raise Alert modal */}
      <Modal
        open={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        size="md"
      >
        <CreateAlertForm
          projectId={project._id}
          projectTitle={project.projectTitle}
          onSuccess={() => {
            setAlertModalOpen(false);
          }}
          onCancel={() => setAlertModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function OverviewTab({ project, tasks, alerts }: { project: IProject; tasks: ITask[]; alerts: IAlert[] }) {
  const activeAlerts = alerts.filter(a => a.status !== AlertStatus.RESOLVED);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Window specifications */}
      <div className="lg:col-span-2 space-y-4">
        <div className="border border-gray-200 p-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500 mb-3">
            Window Specifications
          </h3>
          <div className="space-y-2">
            {project.windowSpecifications?.map((spec, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0 text-xs">
                <span className="font-mono font-bold text-gray-900 w-6">#{i + 1}</span>
                <span className="text-gray-700 font-mono">{spec.width}×{spec.height}mm</span>
                <span className="text-gray-500">{spec.design}</span>
                <span className="text-gray-500">{spec.glassType}</span>
                <span className="ml-auto font-bold text-gray-900">×{spec.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alert summary */}
      <div className="space-y-4">
        {activeAlerts.length > 0 && (
          <div className="border border-red-200 bg-red-50 p-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              Active Alerts
            </h3>
            <div className="space-y-3">
              {activeAlerts.slice(0, 3).map((alert) => (
                <div key={alert._id} className="bg-white border border-red-200 p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertSeverityBadge severity={alert.severity} />
                  </div>
                  <p className="text-xs font-medium text-red-700">{ALERT_TYPE_LABEL[alert.type]}</p>
                  <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task summary by dept */}
        <div className="border border-gray-200 p-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500 mb-3">
            Progress by Department
          </h3>
          {DEPARTMENT_SEQUENCE.map((dept) => {
            const deptTasks = tasks.filter((t) => t.department === dept);
            const done = deptTasks.filter((t) => t.status === TaskStatus.DONE).length;
            const pct = deptTasks.length > 0 ? Math.round((done / deptTasks.length) * 100) : 0;
            return (
              <div key={dept} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono text-gray-600">{DEPARTMENT_LABELS[dept]}</span>
                  <span className="text-[11px] font-mono font-bold text-gray-900">{done}/{deptTasks.length}</span>
                </div>
                <div className="h-1 bg-gray-100">
                  <div className="h-full bg-black transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
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
                    <p className={cn(
                      'text-xs font-medium',
                      task.status === TaskStatus.DONE ? 'text-gray-500 line-through' :
                      task.status === TaskStatus.BLOCKED ? 'text-red-600' : 'text-gray-900'
                    )}>
                      {task.title}
                    </p>
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

function TaskSlideOver({ task, currentUser, onClose }: { task: ITask; currentUser: Partial<IUser>; onClose: () => void }) {
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-900">{task.title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-lg font-bold">×</button>
      </div>
      <div className="p-4 border-b border-gray-100">
        <TaskStatusBadge status={task.status} />
        <p className="text-xs text-gray-600 mt-2">{task.description}</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <CommentThread taskId={task._id} currentUser={currentUser} />
      </div>
    </div>
  );
}
