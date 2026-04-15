'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { LayoutGrid, List, ExternalLink, Lock, AlertTriangle, Plus } from 'lucide-react';
import { cn, DEPARTMENT_LABELS, formatDate } from '@/lib/utils';
import { TaskStatusBadge } from '@/components/ui/badges';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { CommentThread } from '@/components/comment/CommentThread';
import { Modal } from '@/components/ui/Modal';
import { CreateTaskForm } from '@/components/forms/CreateTaskForm';
import type { ITask, IUser } from '@/types';
import { TaskStatus, Department } from '@/types';

interface TasksClientProps {
  initialTasks: ITask[];
  currentUser: Partial<IUser>;
  isAdmin: boolean;
}

export function TasksClient({ initialTasks, currentUser, isAdmin }: TasksClientProps) {
  const [tasks, setTasks] = useState<ITask[]>(initialTasks);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null);
  const [deptFilter, setDeptFilter] = useState<Department | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  const handleTaskCreated = useCallback((task: ITask) => {
    setTasks((prev) => [task, ...prev]);
    setTaskModalOpen(false);
  }, []);

  const filtered = tasks.filter((t) => {
    if (deptFilter !== 'all' && t.department !== deptFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  const handleTaskUpdate = useCallback((updated: ITask) => {
    setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    if (selectedTask?._id === updated._id) setSelectedTask(updated);
  }, [selectedTask]);

  const counts = {
    todo: tasks.filter((t) => t.status === TaskStatus.TODO).length,
    inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
    blocked: tasks.filter((t) => t.status === TaskStatus.BLOCKED).length,
    done: tasks.filter((t) => t.status === TaskStatus.DONE).length,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main panel */}
      <div className={cn('flex-1 flex flex-col overflow-hidden', selectedTask && 'lg:mr-96')}>
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h1 className="text-xl font-black text-gray-900">
                {isAdmin ? 'All Tasks' : 'My Tasks'}
              </h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {currentUser.department && !isAdmin ? DEPARTMENT_LABELS[currentUser.department] : 'All Departments'}
              </p>
            </div>

            <div className="flex items-center gap-2">
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

              <div className="flex border border-gray-200">
                <button
                  onClick={() => setView('list')}
                  className={cn(
                    'p-2 transition-colors',
                    view === 'list' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView('kanban')}
                  className={cn(
                    'p-2 transition-colors',
                    view === 'kanban' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
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

        {/* Filters */}
        {isAdmin && (
          <div className="flex-shrink-0 px-6 py-2.5 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value as Department | 'all')}
              className="text-[10px] font-mono border border-gray-200 px-2 py-1 bg-white focus:outline-none focus:border-black"
            >
              <option value="all">All Departments</option>
              {Object.values(Department).map((d) => (
                <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
              ))}
            </select>
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
            <span className="text-[10px] text-gray-500 font-mono ml-auto">
              {filtered.length} tasks
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {view === 'kanban' ? (
            <KanbanBoard
              tasks={filtered}
              canAssign={isAdmin}
              onTaskUpdate={handleTaskUpdate}
              canDrag={(task) => task.department === currentUser.department || isAdmin}
            />
          ) : (
            <TaskListView
              tasks={filtered}
              selectedTaskId={selectedTask?._id}
              onSelectTask={setSelectedTask}
            />
          )}
        </div>
      </div>

      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} size="lg">
        <CreateTaskForm onSuccess={handleTaskCreated} onCancel={() => setTaskModalOpen(false)} />
      </Modal>

      {/* Task detail slide-over */}
      {selectedTask && (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col animate-slide-in-right">
          {/* Slide-over header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <TaskStatusBadge status={selectedTask.status} size="sm" />
              <span className="text-xs font-bold text-gray-900 truncate">{selectedTask.title}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {selectedTask.projectId && (
                <Link
                  href={`/projects/${typeof selectedTask.projectId === 'object'
                    ? (selectedTask.projectId as { _id: string })._id
                    : selectedTask.projectId}`}
                  className="text-gray-400 hover:text-black transition-colors"
                  title="Open project"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-black text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Task meta */}
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 space-y-2">
            <p className="text-xs text-gray-600 leading-relaxed">{selectedTask.description}</p>
            <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
              <span className="uppercase">{DEPARTMENT_LABELS[selectedTask.department]}</span>
              {selectedTask.dueDate && (
                <span>Due {formatDate(selectedTask.dueDate)}</span>
              )}
            </div>
            {selectedTask.isLocked && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
                <Lock className="w-3 h-3" />
                Waiting for dependency to complete
              </div>
            )}
            {selectedTask.status === TaskStatus.BLOCKED && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-mono">
                <AlertTriangle className="w-3 h-3" />
                Blocked by active alert
              </div>
            )}
          </div>

          {/* Comment thread */}
          <div className="flex-1 overflow-hidden">
            <CommentThread taskId={selectedTask._id} currentUser={currentUser} />
          </div>
        </div>
      )}
    </div>
  );
}

function TaskListView({
  tasks,
  selectedTaskId,
  onSelectTask,
}: {
  tasks: ITask[];
  selectedTaskId?: string;
  onSelectTask: (task: ITask) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 p-16 text-center">
        <p className="text-sm text-gray-400 font-mono">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 overflow-hidden">
      <table className="erp-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Department</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Project</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const project = typeof task.projectId === 'object' && task.projectId !== null
              ? task.projectId as { _id: string; projectTitle: string }
              : null;

            return (
              <tr
                key={task._id}
                className={cn(
                  'cursor-pointer transition-colors',
                  selectedTaskId === task._id ? 'bg-gray-50' : '',
                  task.status === TaskStatus.BLOCKED ? 'bg-red-50/30' : '',
                  task.isLocked ? 'opacity-60' : ''
                )}
                onClick={() => onSelectTask(task)}
              >
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
                <td>
                  <span className="font-mono text-gray-500 uppercase text-[10px] tracking-wide">
                    {DEPARTMENT_LABELS[task.department]}
                  </span>
                </td>
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
                <td>
                  <span className="text-[10px] font-mono text-gray-400">Open →</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
