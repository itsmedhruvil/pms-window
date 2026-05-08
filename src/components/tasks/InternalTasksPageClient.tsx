'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClipboardList, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TaskStatusBadge } from '@/components/ui/badges';
import { formatDate, DEPARTMENT_LABELS, cn } from '@/lib/utils';
import type { ITask, Department } from '@/types';
import { TaskStatus } from '@/types';

interface InternalTasksPageClientProps {
  tasks: ITask[];
  activeAlertCount: number;
  isAdmin: boolean;
  userDepartment: Department;
}

export function InternalTasksPageClient({
  tasks,
  activeAlertCount,
  isAdmin,
  userDepartment
}: InternalTasksPageClientProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  // Group tasks by department
  const tasksByDepartment = tasks.reduce((acc, task) => {
    if (!acc[task.department]) {
      acc[task.department] = [];
    }
    acc[task.department].push(task);
    return acc;
  }, {} as Record<Department, ITask[]>);

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleBulkMarkDone = async () => {
    if (selectedTasks.size === 0) return;

    try {
      const updates = Array.from(selectedTasks).map(taskId => ({
        taskId,
        status: 'DONE' as const,
        completedAt: new Date(),
      }));

      const response = await fetch('/api/tasks/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) throw new Error('Failed to update tasks');

      // Refresh the page to get updated data
      window.location.reload();
    } catch (error) {
      console.error('Failed to bulk update tasks:', error);
      alert('Failed to update tasks. Please try again.');
    }
  };

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-black text-gray-900">Internal Tasks</h1>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              Department-wise internal tasks assigned by admin
            </p>
          </div>

          {isAdmin && selectedTasks.size > 0 && (
            <button
              onClick={handleBulkMarkDone}
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide bg-black text-white hover:bg-gray-800 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Mark Done ({selectedTasks.size})
            </button>
          )}
        </div>

        {Object.keys(tasksByDepartment).length === 0 ? (
          <div className="border border-dashed border-gray-200 p-16 text-center">
            <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-mono text-gray-400">No internal tasks</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(tasksByDepartment).map(([department, deptTasks]) => (
              <div key={department} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-gray-900">
                    {DEPARTMENT_LABELS[department as Department]}
                  </h2>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {deptTasks.length} task{deptTasks.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="overflow-hidden">
                  <table className="erp-table">
                    <thead>
                      <tr>
                        {isAdmin && <th className="w-12"></th>}
                        <th>Task</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>Assigned To</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptTasks.map((task) => {
                        const assignedUser = typeof task.assignedUser === 'object' && task.assignedUser !== null
                          ? task.assignedUser as { name: string; email: string }
                          : null;

                        return (
                          <tr
                            key={task._id}
                            className={cn(
                              'cursor-pointer transition-colors',
                              selectedTasks.has(task._id) ? 'bg-blue-50' : ''
                            )}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('[data-checkbox]')) return;
                              window.location.href = `/tasks/${task._id}`;
                            }}
                          >
                            {isAdmin && (
                              <td data-checkbox>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskSelection(task._id);
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
                            )}
                            <td>
                              <div className="flex items-center gap-2">
                                {task.status === TaskStatus.BLOCKED && (
                                  <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse flex-shrink-0" />
                                )}
                                <span className={cn(
                                  'font-medium text-gray-900',
                                  task.status === TaskStatus.BLOCKED && 'text-red-700'
                                )}>
                                  {task.title}
                                </span>
                              </div>
                              {task.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
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
                              {assignedUser ? (
                                <span className="text-[11px] text-gray-500">
                                  {assignedUser.name}
                                </span>
                              ) : (
                                <span className="text-gray-300">Unassigned</span>
                              )}
                            </td>
                            <td>
                              <span className="text-[10px] font-mono text-gray-400">View →</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}