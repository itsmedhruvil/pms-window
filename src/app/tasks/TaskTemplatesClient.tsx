'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import { apiFetch, cn, DEPARTMENT_LABELS } from '@/lib/utils';
import { Department, DEPARTMENT_SEQUENCE, ITaskTemplate } from '@/types';

interface TaskTemplatesClientProps {
  initialTemplates: ITaskTemplate[];
}

type Draft = {
  title: string;
  description: string;
  isActive: boolean;
};

const emptyDraft: Draft = {
  title: '',
  description: '',
  isActive: true,
};

export function TaskTemplatesClient({ initialTemplates }: TaskTemplatesClientProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [department, setDepartment] = useState<Department>(DEPARTMENT_SEQUENCE[0]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templatesByDepartment = useMemo(() => {
    return DEPARTMENT_SEQUENCE.reduce((acc, dept) => {
      acc[dept] = templates
        .filter((template) => template.department === dept)
        .sort((a, b) => a.sequence - b.sequence);
      return acc;
    }, {} as Record<Department, ITaskTemplate[]>);
  }, [templates]);

  const selectedTemplates = templatesByDepartment[department] ?? [];
  const activeCount = templates.filter((template) => template.isActive).length;

  const refreshTemplates = async () => {
    const result = await apiFetch<ITaskTemplate[]>('/api/task-templates');
    if (result.success && result.data) setTemplates(result.data);
  };

  const createTemplate = async () => {
    if (draft.title.trim().length < 3 || draft.description.trim().length < 10) {
      setError('Add a title and a description before saving.');
      return;
    }

    setSaving(true);
    setError(null);

    const result = await apiFetch<ITaskTemplate>('/api/task-templates', {
      method: 'POST',
      body: JSON.stringify({
        department,
        ...draft,
        title: draft.title.trim(),
        description: draft.description.trim(),
      }),
    });

    setSaving(false);
    if (!result.success || !result.data) {
      setError('Could not create template task.');
      return;
    }

    setTemplates((prev) => [...prev, result.data!]);
    setDraft(emptyDraft);
  };

  const startEditing = (template: ITaskTemplate) => {
    setEditingId(template._id);
    setEditingDraft({
      title: template.title,
      description: template.description,
      isActive: template.isActive,
    });
  };

  const updateTemplate = async (template: ITaskTemplate, patch: Partial<ITaskTemplate> = {}) => {
    setSaving(true);
    setError(null);

    const payload = {
      title: editingId === template._id ? editingDraft.title.trim() : template.title,
      description: editingId === template._id ? editingDraft.description.trim() : template.description,
      isActive: editingId === template._id ? editingDraft.isActive : template.isActive,
      department: template.department,
      sequence: template.sequence,
      ...patch,
    };

    const result = await apiFetch<ITaskTemplate>(`/api/task-templates/${template._id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!result.success || !result.data) {
      setError('Could not update template task.');
      return;
    }

    setTemplates((prev) => prev.map((item) => (item._id === template._id ? result.data! : item)));
    setEditingId(null);
  };

  const deleteTemplate = async (template: ITaskTemplate) => {
    if (!confirm(`Delete "${template.title}" from ${DEPARTMENT_LABELS[template.department]}?`)) return;

    setSaving(true);
    const result = await apiFetch(`/api/task-templates/${template._id}`, { method: 'DELETE' });
    setSaving(false);

    if (!result.success) {
      setError('Could not delete template task.');
      return;
    }

    setTemplates((prev) => prev.filter((item) => item._id !== template._id));
    await refreshTemplates();
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900">Task Templates</h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              Department-wise workflow tasks used when creating every new project.
            </p>
          </div>
          <div className="text-right font-mono">
            <p className="text-2xl font-black text-gray-900">{activeCount}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Active Tasks</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-6 p-6">
        <aside className="border border-gray-200 self-start">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
              Departments
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {DEPARTMENT_SEQUENCE.map((dept) => {
              const deptTemplates = templatesByDepartment[dept] ?? [];
              const isSelected = department === dept;

              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDepartment(dept)}
                  className={cn(
                    'w-full px-4 py-3 text-left transition-colors',
                    isSelected ? 'bg-black text-white' : 'hover:bg-gray-50 text-gray-700'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono font-bold uppercase tracking-wide">
                      {DEPARTMENT_LABELS[dept]}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5',
                        isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {deptTemplates.filter((item) => item.isActive).length}/{deptTemplates.length}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="space-y-5 min-w-0">
          {error && (
            <div className="border border-red-300 bg-red-50 px-4 py-3 text-xs font-mono text-red-700">
              {error}
            </div>
          )}

          <section className="border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-gray-900">
                  {DEPARTMENT_LABELS[department]}
                </h2>
                <p className="text-[11px] font-mono text-gray-500 mt-0.5">
                  These tasks are copied into new projects in this order.
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {selectedTemplates.map((template, index) => {
                const isEditing = editingId === template._id;

                return (
                  <div key={template._id} className={cn('p-4', !template.isActive && 'bg-gray-50 opacity-70')}>
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 border border-gray-200 flex items-center justify-center text-xs font-mono font-bold text-gray-500 flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-3">
                            <input
                              value={editingDraft.title}
                              onChange={(event) =>
                                setEditingDraft((prev) => ({ ...prev, title: event.target.value }))
                              }
                              className={inputClass}
                            />
                            <textarea
                              value={editingDraft.description}
                              onChange={(event) =>
                                setEditingDraft((prev) => ({ ...prev, description: event.target.value }))
                              }
                              rows={3}
                              className={inputClass}
                            />
                            <label className="inline-flex items-center gap-2 text-xs font-mono text-gray-600">
                              <input
                                type="checkbox"
                                checked={editingDraft.isActive}
                                onChange={(event) =>
                                  setEditingDraft((prev) => ({ ...prev, isActive: event.target.checked }))
                                }
                              />
                              Active in new projects
                            </label>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-gray-900">{template.title}</h3>
                              {template.isActive && <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />}
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mt-1">{template.description}</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateTemplate(template)}
                              disabled={saving}
                              className="p-2 text-gray-500 hover:text-black border border-gray-200"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-2 text-gray-500 hover:text-black border border-gray-200"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => updateTemplate(template, { isActive: !template.isActive })}
                              disabled={saving}
                              className="px-2 py-2 text-[10px] font-mono font-bold uppercase border border-gray-200 text-gray-500 hover:text-black"
                            >
                              {template.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditing(template)}
                              className="p-2 text-gray-500 hover:text-black border border-gray-200"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTemplate(template)}
                              className="p-2 text-gray-500 hover:text-red-600 border border-gray-200"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedTemplates.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-xs font-mono text-gray-400">No templates in this department yet.</p>
                </div>
              )}
            </div>
          </section>

          <section className="border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-gray-500" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
                Add Task Template
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-3">
              <div className="space-y-3">
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={`${DEPARTMENT_LABELS[department]} task title`}
                  className={inputClass}
                />
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="What needs to be done for this department..."
                  rows={3}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={createTemplate}
                disabled={saving}
                className="h-full min-h-24 bg-black text-white hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase tracking-wide"
              >
                <Plus className="w-4 h-4" />
                Add Template
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white placeholder:text-gray-400';
