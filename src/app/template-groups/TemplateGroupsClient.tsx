'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, X, CheckCircle2, Edit3 } from 'lucide-react';
import { apiFetch, cn, DEPARTMENT_LABELS } from '@/lib/utils';
import { Department, DEPARTMENT_SEQUENCE } from '@/types';
import type { ITemplateGroup } from '@/types';

type TaskDraft = {
  department: Department;
  title: string;
  description: string;
};

type GroupDraft = {
  name: string;
  description: string;
  tasks: TaskDraft[];
};

const emptyTaskDraft: TaskDraft = {
  department: DEPARTMENT_SEQUENCE[0],
  title: '',
  description: '',
};

const emptyGroupDraft: GroupDraft = {
  name: '',
  description: '',
  tasks: [{ ...emptyTaskDraft }],
};

export function TemplateGroupsClient() {
  const [groups, setGroups] = useState<ITemplateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GroupDraft>(emptyGroupDraft);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<GroupDraft>(emptyGroupDraft);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<ITemplateGroup[]>('/api/template-groups');
    if (result.success && result.data) {
      setGroups(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const addTaskToDraft = () => {
    setDraft((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { ...emptyTaskDraft }],
    }));
  };

  const removeTaskFromDraft = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== idx),
    }));
  };

  const updateTaskInDraft = (idx: number, key: keyof TaskDraft, value: string) => {
    setDraft((prev) => {
      const tasks = [...prev.tasks];
      tasks[idx] = { ...tasks[idx], [key]: value };
      return { ...prev, tasks };
    });
  };

  const createGroup = async () => {
    if (draft.name.trim().length < 3) {
      setError('Group name must be at least 3 characters');
      return;
    }

    const validTasks = draft.tasks.filter((t) => t.title.trim() && t.description.trim());
    if (validTasks.length === 0) {
      setError('At least one task with title and description is required');
      return;
    }

    setSaving(true);
    setError(null);

    const result = await apiFetch<ITemplateGroup>('/api/template-groups', {
      method: 'POST',
      body: JSON.stringify({
        name: draft.name.trim(),
        description: draft.description.trim(),
        tasks: validTasks.map((t) => ({
          department: t.department,
          title: t.title.trim(),
          description: t.description.trim(),
        })),
      }),
    });

    setSaving(false);

    if (!result.success || !result.data) {
      setError(result.error || 'Failed to create template group');
      return;
    }

    setGroups((prev) => [result.data!, ...prev]);
    setDraft(emptyGroupDraft);
  };

  const startEditing = (group: ITemplateGroup) => {
    setEditingId(group._id);
    setEditDraft({
      name: group.name,
      description: group.description,
      tasks: group.tasks.map((t) => ({
        department: t.department,
        title: t.title,
        description: t.description,
      })),
    });
  };

  const addEditTask = () => {
    setEditDraft((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { ...emptyTaskDraft }],
    }));
  };

  const removeEditTask = (idx: number) => {
    setEditDraft((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== idx),
    }));
  };

  const updateEditTask = (idx: number, key: keyof TaskDraft, value: string) => {
    setEditDraft((prev) => {
      const tasks = [...prev.tasks];
      tasks[idx] = { ...tasks[idx], [key]: value };
      return { ...prev, tasks };
    });
  };

  const saveEdit = async (groupId: string) => {
    if (editDraft.name.trim().length < 3) {
      setError('Group name must be at least 3 characters');
      return;
    }

    const validTasks = editDraft.tasks.filter((t) => t.title.trim() && t.description.trim());
    if (validTasks.length === 0) {
      setError('At least one task with title and description is required');
      return;
    }

    setSaving(true);
    setError(null);

    const result = await apiFetch<ITemplateGroup>(`/api/template-groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editDraft.name.trim(),
        description: editDraft.description.trim(),
        tasks: validTasks.map((t) => ({
          department: t.department,
          title: t.title.trim(),
          description: t.description.trim(),
        })),
      }),
    });

    setSaving(false);

    if (!result.success || !result.data) {
      setError(result.error || 'Failed to update template group');
      return;
    }

    setGroups((prev) => prev.map((g) => (g._id === groupId ? result.data! : g)));
    setEditingId(null);
  };

  const deleteGroup = async (group: ITemplateGroup) => {
    if (!confirm(`Delete template group "${group.name}"?`)) return;

    const result = await apiFetch(`/api/template-groups/${group._id}`, { method: 'DELETE' });
    if (result.success) {
      setGroups((prev) => prev.filter((g) => g._id !== group._id));
    } else {
      setError(result.error || 'Failed to delete template group');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900">Template Groups</h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              Groups of department-wise tasks that can be assigned to window specifications when creating a project.
            </p>
          </div>
          <div className="text-right font-mono">
            <p className="text-2xl font-black text-gray-900">{groups.length}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Groups</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {error && (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-xs font-mono text-red-700">
            {error}
          </div>
        )}

        {/* Existing groups */}
        {loading ? (
          <div className="text-xs text-gray-400 font-mono">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="border border-dashed border-gray-200 p-12 text-center">
            <p className="text-sm font-mono text-gray-400">No template groups yet. Create one below.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const isEditing = editingId === group._id;
              const depCount = new Set(group.tasks.map((t) => t.department)).size;

              if (isEditing) {
                return (
                  <div key={group._id} className="border border-gray-200 p-4">
                    <div className="space-y-3">
                      <input
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-200 focus:outline-none focus:border-black"
                        placeholder="Group name"
                      />
                      <input
                        value={editDraft.description}
                        onChange={(e) => setEditDraft((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black"
                        placeholder="Description (optional)"
                      />

                      <div className="space-y-2">
                        {editDraft.tasks.map((task, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-3 border border-gray-100">
                            <div className="flex-1 grid grid-cols-[160px_1fr_1fr] gap-2">
                              <select
                                value={task.department}
                                onChange={(e) => updateEditTask(idx, 'department', e.target.value)}
                                className="px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black"
                              >
                                {DEPARTMENT_SEQUENCE.map((d) => (
                                  <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                                ))}
                              </select>
                              <input
                                value={task.title}
                                onChange={(e) => updateEditTask(idx, 'title', e.target.value)}
                                className="px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black"
                                placeholder="Task title"
                              />
                              <div className="flex gap-1">
                                <input
                                  value={task.description}
                                  onChange={(e) => updateEditTask(idx, 'description', e.target.value)}
                                  className="flex-1 px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black"
                                  placeholder="Description"
                                />
                                {editDraft.tasks.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeEditTask(idx)}
                                    className="p-1.5 text-gray-400 hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={addEditTask}
                          className="text-[10px] font-mono text-gray-500 hover:text-black flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add task
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-[10px] font-mono border border-gray-300 text-gray-600 hover:border-gray-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(group._id)}
                            disabled={saving}
                            className="px-3 py-1.5 text-[10px] font-mono bg-black text-white hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={group._id} className="border border-gray-200">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{group.name}</h3>
                      {group.description && (
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">{group.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-gray-400">
                        {group.tasks.length} tasks · {depCount} departments
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditing(group)}
                        className="p-1.5 text-gray-400 hover:text-black"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGroup(group)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.tasks.map((task, idx) => (
                      <div key={idx} className="px-4 py-2 flex items-center gap-3 text-xs">
                        <span className="text-[10px] font-mono text-gray-400 w-[90px] uppercase tracking-wide">
                          {DEPARTMENT_LABELS[task.department]}
                        </span>
                        <span className="font-medium text-gray-800">{task.title}</span>
                        <span className="text-gray-500 truncate">{task.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create new group */}
        <div className="border-2 border-dashed border-gray-300 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-gray-500" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
              Create Template Group
            </h2>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Group name (e.g. Standard Window)"
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black"
              />
              <input
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-2">
              {draft.tasks.map((task, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 border border-gray-100">
                  <div className="flex-1 grid grid-cols-[160px_1fr_1fr] gap-2">
                    <select
                      value={task.department}
                      onChange={(e) => updateTaskInDraft(idx, 'department', e.target.value)}
                      className="px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black"
                    >
                      {DEPARTMENT_SEQUENCE.map((d) => (
                        <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                      ))}
                    </select>
                    <input
                      value={task.title}
                      onChange={(e) => updateTaskInDraft(idx, 'title', e.target.value)}
                      className="px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black"
                      placeholder="Task title"
                    />
                    <div className="flex gap-1">
                      <input
                        value={task.description}
                        onChange={(e) => updateTaskInDraft(idx, 'description', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black"
                        placeholder="Description"
                      />
                      {draft.tasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTaskFromDraft(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addTaskToDraft}
                className="text-[10px] font-mono text-gray-500 hover:text-black flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add task
              </button>
              <button
                type="button"
                onClick={createGroup}
                disabled={saving}
                className="px-4 py-2 text-[10px] font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}