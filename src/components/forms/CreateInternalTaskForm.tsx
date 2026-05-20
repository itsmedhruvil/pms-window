'use client';

import { useState } from 'react';
import { AlertCircle, Layers } from 'lucide-react';
import { apiFetch, DEPARTMENT_LABELS, cn } from '@/lib/utils';
import { Department } from '@/types';
import type { ITask, ITemplateGroup } from '@/types';

interface CreateInternalTaskFormProps {
  onSuccess?: (task: ITask) => void;
  onCancel: () => void;
  department?: Department;
  templateGroups?: ITemplateGroup[];
}

interface FormData {
  title: string;
  description: string;
  department: Department;
  dueDate: string;
  frequency: string;
}

export function CreateInternalTaskForm({ onSuccess, onCancel, department, templateGroups = [] }: CreateInternalTaskFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateGroupId, setSelectedTemplateGroupId] = useState('');
  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    department: department || Department.PRODUCTION,
    dueDate: '',
    frequency: 'daily',
  });

  // Filter template groups to only those with internal tasks
  const internalTemplateGroups = templateGroups.filter((g) =>
    g.tasks.some((t) => t.type === 'internal')
  );
  const selectedTemplateTask = selectedTemplateGroupId
    ? templateGroups
        .find((g) => g._id === selectedTemplateGroupId)
        ?.tasks.find((t) => t.type === 'internal')
    : null;

  const isValid =
    form.title.trim().length >= 3 &&
    form.description.trim().length >= 10;

  const handleTemplateSelect = (groupId: string) => {
    setSelectedTemplateGroupId(groupId);
    if (!groupId) {
      setForm({
        title: '',
        description: '',
        department: department || Department.PRODUCTION,
        dueDate: '',
        frequency: 'daily',
      });
      return;
    }

    const group = templateGroups.find((g) => g._id === groupId);
    if (!group || group.tasks.length === 0) return;

    const internalTasks = group.tasks.filter((t) => t.type === 'internal');
    if (internalTasks.length === 0) return;

    // Pre-fill with the first internal task
    const firstTask = internalTasks[0];
    setForm({
      title: firstTask.title,
      description: firstTask.description,
      department: firstTask.department as Department,
      dueDate: '',
      frequency: firstTask.frequency || 'daily',
    });
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<ITask>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Failed to create internal task');
      return;
    }

    onSuccess?.(result.data as ITask);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900">Create Internal Task</h2>
          <p className="text-xs text-gray-500 font-mono">Add a department-wide internal task.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Template Group Selector */}
      {internalTemplateGroups.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-700">
              Reference Task Template
            </span>
          </div>
          <p className="text-[10px] text-blue-600 font-mono mb-2">
            Select a template group to auto-fill task details from an existing template.
          </p>
          <select
            value={selectedTemplateGroupId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono border border-blue-200 focus:outline-none focus:border-blue-700 transition-colors bg-white"
          >
            <option value="">No template reference</option>
            {internalTemplateGroups.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name} ({g.tasks.filter((t) => t.type === 'internal').length} tasks)
              </option>
            ))}
          </select>
          {selectedTemplateTask && (
            <div className="mt-3 border border-blue-100 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">{selectedTemplateTask.title}</p>
              <p className="mt-1 text-xs text-gray-600">{selectedTemplateTask.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wide text-blue-700">
                <span>{DEPARTMENT_LABELS[selectedTemplateTask.department]}</span>
                <span>{selectedTemplateTask.frequency.replace('_', ' ')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {!selectedTemplateGroupId && (
          <>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
              Task Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
                placeholder="E.g. Review production schedules"
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
          </>
        )}

        <div className={cn('grid gap-4 sm:grid-cols-2', selectedTemplateGroupId && 'hidden')}>
          <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
            Department
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value as Department })}
              className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
            >
              {Object.entries(DEPARTMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

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

        <label className={cn('block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold', selectedTemplateGroupId && 'hidden')}>
          Frequency
          <select
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="need_basis">Need Basis</option>
            <option value="project">Project</option>
            <option value="project_recurring">Project Recurring</option>
          </select>
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
          {loading ? 'Creating…' : 'Create Internal Task'}
        </button>
      </div>
    </div>
  );
}
