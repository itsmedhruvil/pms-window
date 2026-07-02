'use client';

import { useState } from 'react';
import { AlertCircle, Layers, Plus, FileText, Check } from 'lucide-react';
import { apiFetch, DEPARTMENT_LABELS, cn } from '@/lib/utils';
import { Department } from '@/types';
import type { ITask, ITemplateGroup } from '@/types';
import { useDepartments } from '@/hooks/useDepartments';

interface CreateInternalTaskFormProps {
  onSuccess?: (task: ITask) => void;
  onCancel: () => void;
  department?: Department;
  templateGroups?: ITemplateGroup[];
}

type Mode = 'simple' | 'import';

interface FormData {
  title: string;
  description: string;
  department: Department;
  dueDate: string;
  frequency: string;
}

export function CreateInternalTaskForm({ onSuccess, onCancel, department, templateGroups = [] }: CreateInternalTaskFormProps) {
  const departments = useDepartments();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mode toggle
  const [mode, setMode] = useState<Mode>('simple');

  // Simple task form
  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    department: department || departments[0]?.name || Department.PRODUCTION,
    dueDate: '',
    frequency: 'daily',
  });

  // Import template state
  const [importGroupId, setImportGroupId] = useState('');
  const [importCount, setImportCount] = useState(0);

  // Filter template groups to only those with internal tasks
  const internalTemplateGroups = templateGroups.filter((g) =>
    g.tasks.some((t) => t.type === 'internal')
  );
  const selectedGroup = importGroupId
    ? templateGroups.find((g) => g._id === importGroupId)
    : null;
  const internalTasksInGroup = selectedGroup?.tasks.filter((t) => t.type === 'internal') || [];

  const isValid =
    form.title.trim().length >= 3 &&
    form.description.trim().length >= 10;

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

  const handleImport = async () => {
    if (!selectedGroup || internalTasksInGroup.length === 0) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    let created = 0;
    let failed = 0;

    // Create tasks one by one
    for (const task of internalTasksInGroup) {
      const result = await apiFetch<ITask>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          department: task.department,
          frequency: task.frequency || 'daily',
          dueDate: '',
        }),
      });

      if (result.success) {
        created++;
      } else {
        failed++;
      }
    }

    setLoading(false);

    if (created > 0) {
      setSuccess(`Successfully imported ${created} task${created > 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}!`);
      setImportCount(created);
      // Trigger a reload by dispatching the event
      window.dispatchEvent(new CustomEvent('app-data-changed', {
        detail: { entity: 'task', action: 'created' },
      }));
      // Close modal after a brief delay
      setTimeout(() => {
        onCancel();
      }, 1500);
    } else {
      setError('Failed to import tasks. Please try again.');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-dark-500">Create Internal Task</h2>
          <p className="text-xs text-primary-500 font-mono">Add department-wide internal tasks.</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setMode('simple'); setError(null); setSuccess(null); }}
          className={cn(
            'flex items-center gap-2 px-4 py-3 border text-xs font-mono font-bold uppercase tracking-wide transition-colors',
            mode === 'simple'
              ? 'border-dark-500 bg-dark-500 text-white'
              : 'border-primary-200 text-dark-400 hover:border-primary-400'
          )}
        >
          <Plus className="w-4 h-4" />
          Simple Task
        </button>
        <button
          type="button"
          onClick={() => { setMode('import'); setError(null); setSuccess(null); }}
          className={cn(
            'flex items-center gap-2 px-4 py-3 border text-xs font-mono font-bold uppercase tracking-wide transition-colors',
            mode === 'import'
              ? 'border-dark-500 bg-dark-500 text-white'
              : 'border-primary-200 text-dark-400 hover:border-primary-400'
          )}
        >
          <Layers className="w-4 h-4" />
          Import Template
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 border border-green-200 bg-green-50 text-green-700 text-xs">
          <Check className="w-4 h-4" />
          <span>{success}</span>
        </div>
      )}

      {/* ── SIMPLE MODE ─────────────────────────────────────────────── */}
      {mode === 'simple' && (
        <>
          <div className="grid gap-4">
            <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
              Task Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
                placeholder="E.g. Review production schedules"
              />
            </label>

            <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
                placeholder="Describe the task and expected outcome"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
                Department
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value as Department })}
                  className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
                >
                  {departments.map((department) => (
                    <option key={department.name} value={department.name}>{department.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
                Due Date
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
                />
              </label>
            </div>

            <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
              Frequency
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
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

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-primary-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-mono font-bold uppercase border border-primary-300 text-dark-400 hover:border-dark-400"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isValid || loading}
              onClick={handleSubmit}
              className={cn(
                'px-4 py-2 text-xs font-mono font-bold uppercase transition-colors disabled:opacity-50',
                'bg-dark-500 text-white hover:bg-dark-600'
              )}
            >
              {loading ? 'Creating...' : 'Create Internal Task'}
            </button>
          </div>
        </>
      )}

      {/* ── IMPORT MODE ─────────────────────────────────────────────── */}
      {mode === 'import' && (
        <div className="space-y-4">
          {internalTemplateGroups.length === 0 ? (
            <div className="border border-dashed border-primary-200 p-10 text-center">
              <Layers className="w-8 h-8 text-primary-300 mx-auto mb-3" />
              <p className="text-sm font-mono text-primary-400">No template groups with internal tasks available.</p>
              <p className="text-[10px] font-mono text-primary-400 mt-1">
                Create a template group with internal-type tasks first.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-dark-400 font-mono">
                Select a template group to import all internal tasks at once.
              </p>

              <div className="space-y-2">
                {internalTemplateGroups.map((group) => {
                  const internalTasks = group.tasks.filter((t) => t.type === 'internal');
                  const departmentsInGroup = [...new Set(internalTasks.map((t) => t.department))];
                  const isSelected = importGroupId === group._id;

                  return (
                    <button
                      key={group._id}
                      type="button"
                      onClick={() => setImportGroupId(group._id)}
                      className={cn(
                        'w-full text-left border p-4 transition-colors',
                        isSelected
                          ? 'border-dark-500 bg-primary-50'
                          : 'border-primary-200 hover:border-primary-400 hover:bg-primary-50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-dark-500">{group.name}</p>
                          {group.description && (
                            <p className="text-xs text-primary-500 font-mono mt-0.5 truncate">{group.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-primary-500">
                            <span className="font-bold text-dark-600">{internalTasks.length} task{internalTasks.length > 1 ? 's' : ''}</span>
                            <span className="text-primary-300">·</span>
                            <span>{departmentsInGroup.length} department{departmentsInGroup.length > 1 ? 's' : ''}</span>
                            <span className="text-primary-300">·</span>
                            <span className="truncate">
                              {departmentsInGroup.map((d) =>
                                departments.find((dept) => dept.name === d)?.label || d
                              ).join(', ')}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-dark-500 flex-shrink-0" />
                        )}
                      </div>

                      {/* Show tasks preview */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-primary-200 space-y-1">
                          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-1">
                            Tasks to import:
                          </p>
                          {internalTasks.map((t, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-[11px]">
                              <FileText className="w-3 h-3 text-primary-400 flex-shrink-0" />
                              <span className="text-dark-600 truncate">{t.title}</span>
                              <span className="text-[9px] font-mono text-primary-400 ml-auto flex-shrink-0">
                                {departments.find((dept) => dept.name === t.department)?.label || t.department}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-primary-200">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-mono font-bold uppercase border border-primary-300 text-dark-400 hover:border-dark-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!importGroupId || loading || !internalTasksInGroup.length}
                  onClick={handleImport}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase transition-colors disabled:opacity-50',
                    'bg-dark-500 text-white hover:bg-dark-600'
                  )}
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      Import {internalTasksInGroup.length} Task{internalTasksInGroup.length > 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}