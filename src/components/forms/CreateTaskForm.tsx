'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiFetch, cn, DEPARTMENT_LABELS } from '@/lib/utils';
import { Department } from '@/types';
import type { IProject, ITask } from '@/types';

interface CreateTaskFormProps {
  onSuccess?: (task: ITask) => void;
  onCancel: () => void;
  department?: Department;
  task?: ITask; // for editing
}

interface FormData {
  title: string;
  description: string;
  projectId: string;
  department: Department;
  dueDate: string;
}

export function CreateTaskForm({ onSuccess, onCancel, department, task }: CreateTaskFormProps) {
  const [projects, setProjects] = useState<IProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    title: task?.title || '',
    description: task?.description || '',
    projectId: typeof task?.projectId === 'string' ? task.projectId : task?.projectId?._id || '',
    department: department || task?.department || Department.PRODUCTION,
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
  });

  useEffect(() => {
    let mounted = true;

    apiFetch<{ items: IProject[] }>('/api/projects')
      .then((result) => {
        if (!mounted) return;
        if (!result.success) {
          setError(result.error || 'Failed to load projects');
          return;
        }
        setProjects(result.data?.items || []);
        setForm((current) => ({
          ...current,
          projectId: result.data?.items?.[0]?._id || current.projectId,
        }));
      })
      .catch(() => {
        if (!mounted) return;
        setError('Failed to load projects');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isValid =
    form.title.trim().length >= 3 &&
    form.description.trim().length >= 10 &&
    form.projectId;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    const url = task ? `/api/tasks/${task._id}` : '/api/tasks';
    const method = task ? 'PATCH' : 'POST';

    const result = await apiFetch<ITask>(url, {
      method,
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || `Failed to ${task ? 'update' : 'create'} task`);
      return;
    }

    onSuccess?.(result.data as ITask);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900">{task ? 'Edit Task' : 'Create New Task'}</h2>
          <p className="text-xs text-gray-500 font-mono">Add a task and assign it to a project and department.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4">
        <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
          Task Title
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
            placeholder="E.g. Review window specs for Block C"
          />
        </label>

        <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
          Description
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
            placeholder="Describe the task and expected outcome"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
            Project
            <select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
            >
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectTitle}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
            Department
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value as Department })}
              className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
            >
              {Object.entries(DEPARTMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
          Due Date
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!isValid || loading}
          onClick={handleSubmit}
          className={cn(
            'px-4 py-2 text-xs font-mono font-bold uppercase transition-colors disabled:opacity-50',
            'bg-black text-white hover:bg-gray-800'
          )}
        >
          {loading ? 'Creating…' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}
