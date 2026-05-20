'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, ChevronRight,
  CheckSquare, Square, Users
} from 'lucide-react';
import { getDepartmentLabel, formatDate } from '@/lib/utils';
import {
  TaskStatusBadge
} from '@/components/ui/badges';
import { useProjectRealtime } from '@/hooks/useRealtime';
import type { IProject, ITask } from '@/types';
import { TaskStatus, Department } from '@/types';

interface WindowDetailProps {
  project: IProject;
  tasks: ITask[];
  windowIndex: number;
  isAdmin: boolean;
}

export function WindowDetail({ project, tasks: initialTasks, windowIndex, isAdmin }: WindowDetailProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const windowSpec = project.windowSpecifications[windowIndex];

  // Filter tasks for this specific window
  const windowTasks = tasks.filter(task =>
    task.title.includes(`${windowSpec.design}`) &&
    task.title.includes(`#${windowIndex + 1}`)
  );
  const departments = [...new Set(windowTasks.map((task) => task.department))] as Department[];

  // Group tasks by department
  const tasksByDepartment = departments.reduce((acc, dept) => {
    acc[dept] = windowTasks.filter(task => task.department === dept);
    return acc;
  }, {} as Record<Department, ITask[]>);

  // Calculate progress
  const completedTasks = windowTasks.filter(t => t.status === TaskStatus.DONE).length;
  const totalTasks = windowTasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Realtime updates
  useProjectRealtime(project._id, {
    onTaskUpdated: useCallback((updatedTask: ITask) => {
      setTasks((prev) => prev.map((t) => t._id === updatedTask._id ? updatedTask : t));
    }, []),
  });

  const handleBulkMarkDone = async () => {
    if (selectedTasks.size === 0) return;

    try {
      const updates = Array.from(selectedTasks).map(taskId => ({
        taskId,
        status: TaskStatus.DONE,
        completedAt: new Date(),
      }));

      const response = await fetch(`/api/tasks/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) throw new Error('Failed to update tasks');

      // Update local state
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

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const selectAllPending = () => {
    const pendingTasks = windowTasks
      .filter(task => task.status !== TaskStatus.DONE)
      .map(task => task._id);
    setSelectedTasks(new Set(pendingTasks));
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 mb-3">
          <Link
            href={`/projects/${project._id}`}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-mono">Back to Project</span>
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <span className="text-sm font-mono text-gray-400">Window {windowIndex + 1}</span>
        </div>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              {windowSpec.design} #{windowIndex + 1}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {windowSpec.width}×{windowSpec.height}mm • {windowSpec.glassType} • Quantity: {windowSpec.quantity}
            </p>
            {windowSpec.notes && (
              <p className="text-sm text-gray-500 mt-2 italic">{windowSpec.notes}</p>
            )}
          </div>

          <div className="text-right">
            <div className="text-3xl font-black font-mono text-gray-900">
              {progress}%
            </div>
            <div className="text-xs text-gray-500">
              {completedTasks}/{totalTasks} tasks completed
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-gray-100 rounded-full">
          <div
            className="h-full bg-black rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bulk actions */}
      {isAdmin && (
        <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-mono text-gray-600">
                {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={selectAllPending}
                className="text-xs font-mono text-blue-600 hover:text-blue-800 underline"
              >
                Select all pending
              </button>
            </div>
            {selectedTasks.size > 0 && (
              <button
                onClick={handleBulkMarkDone}
                className="flex items-center gap-2 px-4 py-2 text-sm font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                Mark as Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Department-wise task list */}
      <div className="p-6 space-y-6">
        {departments.map(department => {
          const deptTasks = tasksByDepartment[department];
          if (deptTasks.length === 0) return null;

          const deptCompleted = deptTasks.filter(t => t.status === TaskStatus.DONE).length;
          const deptProgress = Math.round((deptCompleted / deptTasks.length) * 100);

          return (
            <div key={department} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-gray-500" />
                    <h3 className="font-bold text-gray-900">{getDepartmentLabel(department)}</h3>
                    <span className="text-sm text-gray-500 font-mono">
                      {deptCompleted}/{deptTasks.length} tasks
                    </span>
                  </div>
                  <div className="text-sm font-mono text-gray-600">
                    {deptProgress}% complete
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-black rounded-full transition-all duration-500"
                    style={{ width: `${deptProgress}%` }}
                  />
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {deptTasks.map(task => (
                  <div key={task._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      {isAdmin && (
                        <button
                          onClick={() => toggleTaskSelection(task._id)}
                          className="mt-0.5 flex-shrink-0"
                        >
                          {selectedTasks.has(task._id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-300" />
                          )}
                        </button>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
                          <TaskStatusBadge status={task.status} />
                          {task.isLocked && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                        </div>

                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {task.assignedUser && (
                            <span>Assigned to: {typeof task.assignedUser === 'object' ? task.assignedUser.name : 'Unknown'}</span>
                          )}
                          {task.dueDate && (
                            <span>Due: {formatDate(task.dueDate)}</span>
                          )}
                          {task.completedAt && (
                            <span>Completed: {formatDate(task.completedAt)}</span>
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/tasks/${task._id}`}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
