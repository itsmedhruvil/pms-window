'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, X, Edit3, ChevronDown, ChevronRight, GripVertical, Layers } from 'lucide-react';
import { apiFetch, cn, DEPARTMENT_LABELS } from '@/lib/utils';
import { Department, DEPARTMENT_SEQUENCE, TaskFrequency } from '@/types';
import type { ITemplateGroup } from '@/types';

type TaskDraft = {
  department: Department;
  title: string;
  description: string;
  frequency: string;
};

type GroupDraft = {
  name: string;
  description: string;
  tasks: TaskDraft[];
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  project: 'Project',
  need_basis: 'Need Basis',
  project_recurring: 'Project Recurring',
};

const FREQUENCY_BADGES: Record<string, string> = {
  daily: 'bg-blue-100 text-blue-800',
  weekly: 'bg-purple-100 text-purple-800',
  monthly: 'bg-orange-100 text-orange-800',
  project: 'bg-green-100 text-green-800',
  need_basis: 'bg-gray-100 text-gray-800',
  project_recurring: 'bg-indigo-100 text-indigo-800',
};

const emptyTaskDraft: TaskDraft = {
  department: DEPARTMENT_SEQUENCE[0],
  title: '',
  description: '',
  frequency: TaskFrequency.PROJECT,
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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

  const toggleExpand = (groupId: string) => {
    setExpandedGroup((prev) => (prev === groupId ? null : groupId));
  };

  // ── Draft helpers ──────────────────────────────────────────────────────────
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
          frequency: t.frequency,
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

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const startEditing = (group: ITemplateGroup) => {
    setEditingId(group._id);
    setEditDraft({
      name: group.name,
      description: group.description,
      tasks: group.tasks.map((t) => ({
        department: t.department,
        title: t.title,
        description: t.description,
        frequency: t.frequency || 'project',
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
          frequency: t.frequency,
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

  // ── Task table component (shared for create & edit) ────────────────────────
  const TaskTable = ({
    tasks,
    onUpdate,
    onRemove,
    onAdd,
    readOnly = false,
  }: {
    tasks: TaskDraft[];
    onUpdate: (idx: number, key: keyof TaskDraft, value: string) => void;
    onRemove: (idx: number) => void;
    onAdd: () => void;
    readOnly?: boolean;
  }) => (
    <div className="border border-gray-200 overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[40px_140px_110px_1fr_40px] bg-gray-50 border-b border-gray-200 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
        <div className="px-3 py-2 text-center">#</div>
        <div className="px-3 py-2">Department</div>
        <div className="px-3 py-2">Frequency</div>
        <div className="px-3 py-2">Task</div>
        <div className="px-3 py-2"></div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-gray-100">
        {tasks.map((task, idx) => (
          <div key={idx} className="grid grid-cols-[40px_140px_110px_1fr_40px] gap-0 items-start">
            <div className="px-3 py-2.5 text-[10px] font-mono text-gray-400 text-center pt-3.5">
              {idx + 1}
            </div>
            <div className="px-2 py-1.5">
              <select
                value={task.department}
                onChange={(e) => onUpdate(idx, 'department', e.target.value)}
                disabled={readOnly}
                className={cn(
                  'w-full px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white',
                  readOnly && 'bg-gray-50 cursor-default'
                )}
              >
                {DEPARTMENT_SEQUENCE.map((d) => (
                  <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div className="px-2 py-1.5">
              <select
                value={task.frequency}
                onChange={(e) => onUpdate(idx, 'frequency', e.target.value)}
                disabled={readOnly}
                className={cn(
                  'w-full px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white',
                  readOnly && 'bg-gray-50 cursor-default'
                )}
              >
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="px-2 py-1.5">
              <input
                value={task.title}
                onChange={(e) => onUpdate(idx, 'title', e.target.value)}
                disabled={readOnly}
                className={cn(
                  'w-full px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white mb-1',
                  readOnly && 'bg-gray-50 cursor-default'
                )}
                placeholder="Task title"
              />
              <input
                value={task.description}
                onChange={(e) => onUpdate(idx, 'description', e.target.value)}
                disabled={readOnly}
                className={cn(
                  'w-full px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white',
                  readOnly && 'bg-gray-50 cursor-default'
                )}
                placeholder="Description"
              />
            </div>
            <div className="px-1 py-1.5 pt-3">
              {!readOnly && tasks.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove task"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add row button */}
      {!readOnly && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onAdd}
            className="text-[10px] font-mono text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add task
          </button>
        </div>
      )}
    </div>
  );

  const FrequencyBadge = ({ freq }: { freq: string }) => (
    <span className={cn(
      'inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-sm',
      FREQUENCY_BADGES[freq] || 'bg-gray-100 text-gray-800'
    )}>
      {FREQUENCY_LABELS[freq] || freq}
    </span>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900">Template Groups</h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              Groups of department-wise tasks assigned to window specifications when creating a project.
            </p>
          </div>
          <div className="text-right font-mono">
            <p className="text-2xl font-black text-gray-900">{groups.length}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Groups</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
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
              const isExpanded = expandedGroup === group._id;
              const depCount = new Set(group.tasks.map((t) => t.department)).size;
              const freqCounts = group.tasks.reduce((acc, t) => {
                const f = t.frequency || 'project';
                acc[f] = (acc[f] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return (
                <div key={group._id} className="border border-gray-200">
                  {/* Group header — always visible */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleExpand(group._id)}
                        className="p-0.5 text-gray-400 hover:text-gray-700"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{group.name}</h3>
                        {group.description && (
                          <p className="text-[11px] text-gray-500 font-mono truncate">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap">
                        {group.tasks.length} tasks · {depCount} dept
                      </span>
                      {!isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(group)}
                            className="p-1.5 text-gray-400 hover:text-black"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteGroup(group)}
                            className="p-1.5 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Frequency summary chips */}
                  {!isEditing && isExpanded && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500 font-bold">Frequency:</span>
                      {Object.entries(freqCounts).map(([freq, count]) => (
                        <FrequencyBadge key={freq} freq={freq} />
                      ))}
                      <span className="text-[9px] text-gray-400 font-mono ml-1">({Object.keys(freqCounts).length} types)</span>
                    </div>
                  )}

                  {/* Collapsible task details */}
                  {isExpanded && !isEditing && (
                    <div className="divide-y divide-gray-50">
                      {/* Task table view */}
                      <div className="">
                        {/* Table header */}
                        <div className="grid grid-cols-[40px_130px_100px_1fr] bg-gray-50/30 border-b border-gray-100 text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 px-3 py-1.5">
                          <div className="text-center">#</div>
                          <div>Dept</div>
                          <div>Freq</div>
                          <div>Task</div>
                        </div>
                        {group.tasks.map((task, idx) => (
                          <div key={idx} className="grid grid-cols-[40px_130px_100px_1fr] gap-0 items-center px-3 py-2 hover:bg-gray-50/50">
                            <div className="text-[10px] font-mono text-gray-400 text-center">{idx + 1}</div>
                            <div className="text-[10px] font-mono text-gray-700 uppercase tracking-wide">
                              {DEPARTMENT_LABELS[task.department]}
                            </div>
                            <div>
                              <FrequencyBadge freq={task.frequency || 'project'} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-gray-900 truncate">{task.title}</p>
                              <p className="text-[10px] text-gray-500 truncate">{task.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editing mode */}
                  {isEditing && (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
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
                      </div>

                      <TaskTable
                        tasks={editDraft.tasks}
                        onUpdate={updateEditTask}
                        onRemove={removeEditTask}
                        onAdd={addEditTask}
                      />

                      <div className="flex items-center justify-between">
                        <div />
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
                  )}
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

          <div className="space-y-4">
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

            <TaskTable
              tasks={draft.tasks}
              onUpdate={updateTaskInDraft}
              onRemove={removeTaskFromDraft}
              onAdd={addTaskToDraft}
            />

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-400">
                {draft.tasks.filter((t) => t.title.trim()).length} tasks defined
              </span>
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