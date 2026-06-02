'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, X, Edit3, ChevronDown, ChevronRight, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { apiFetch, cn, DEPARTMENT_LABELS } from '@/lib/utils';
import { Department, DEPARTMENT_SEQUENCE, TaskFrequency } from '@/types';
import type { ITemplateGroup } from '@/types';
import { useDepartments } from '@/hooks/useDepartments';

type TaskDraft = {
  department: Department;
  title: string;
  description: string;
  frequency: string;
  type: 'project' | 'internal';
  linkedToProduct?: boolean;
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
  type: 'project',
  linkedToProduct: false,
};

const emptyGroupDraft: GroupDraft = {
  name: '',
  description: '',
  tasks: [{ ...emptyTaskDraft }],
};

function reorderItems<T>(items: T[], fromIdx: number, toIdx: number) {
  if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= items.length || toIdx >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

// ── Module-level components (prevents re-mount on parent re-render) ────────

function DepartmentTabs({
  tasks,
  departments,
  activeTab,
  onTabChange,
}: {
  tasks: TaskDraft[];
  departments: Array<{ name: Department; label: string }>;
  activeTab: Department;
  onTabChange: (d: Department) => void;
}) {
  const counts = tasks.reduce((acc, t) => {
    acc[t.department] = (acc[t.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex border-b border-gray-200 overflow-x-auto">
      {departments.map(({ name: dept, label }) => {
        const count = counts[dept] || 0;
        const isActive = activeTab === dept;
        return (
          <button
            key={dept}
            type="button"
            onClick={() => onTabChange(dept)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-[11px] font-mono whitespace-nowrap border-b-2 transition-colors',
              isActive
                ? 'border-black text-black font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'px-1.5 py-0.5 text-[9px] rounded-sm font-bold',
                isActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TaskTable({
  tasks,
  departments,
  onUpdate,
  onRemove,
  onAdd,
  onMove,
  onReorder,
  readOnly = false,
  addLabel = 'Add task',
}: {
  tasks: TaskDraft[];
  departments: Array<{ name: Department; label: string }>;
  onUpdate: (idx: number, key: keyof TaskDraft, value: string) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  onMove?: (idx: number, direction: 'up' | 'down') => void;
  onReorder?: (fromIdx: number, toIdx: number) => void;
  readOnly?: boolean;
  addLabel?: string;
}) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  return (
    <div className="border border-gray-200 overflow-x-auto">
      {/* Table header */}
      <div className="grid grid-cols-[36px_64px_1fr_1fr_130px_90px_70px_90px_36px] min-w-[900px] bg-gray-50 border-b border-gray-200 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
        <div className="px-2 py-2 text-center">#</div>
        <div className="px-1 py-2 text-center">Move</div>
        <div className="px-3 py-2">Task Title</div>
        <div className="px-3 py-2">Description</div>
        <div className="px-3 py-2">Department</div>
        <div className="px-3 py-2">Type</div>
        <div className="px-3 py-2">Product</div>
        <div className="px-3 py-2">Frequency</div>
        <div className="px-2 py-2"></div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-gray-100 min-w-[700px]">
        {tasks.length === 0 && (
          <div className="px-4 py-8 text-center text-xs font-mono text-gray-400">
            No tasks in this view.
          </div>
        )}
        {tasks.map((task, idx) => (
          <div
            key={idx}
            onDragOver={(event) => {
              if (readOnly || !onReorder || draggedIdx === null || draggedIdx === idx) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (readOnly || !onReorder || draggedIdx === null || draggedIdx === idx) return;
              onReorder(draggedIdx, idx);
              setDraggedIdx(null);
            }}
            className={cn(
              'grid grid-cols-[36px_64px_1fr_1fr_130px_90px_70px_90px_36px] gap-0 items-start group transition-colors',
              draggedIdx === idx && 'bg-gray-50 opacity-60'
            )}
          >
            <div className="px-2 py-2.5 text-[10px] font-mono text-gray-400 text-center pt-3.5">
              {idx + 1}
            </div>
            {/* Reorder buttons */}
            <div className="px-1 py-1.5 flex items-center justify-center gap-1">
              {!readOnly && onReorder && tasks.length > 1 && (
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setDraggedIdx(idx);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(idx));
                  }}
                  onDragEnd={() => setDraggedIdx(null)}
                  className="p-1 text-gray-300 hover:text-gray-900 cursor-grab active:cursor-grabbing transition-colors"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
              )}
              {!readOnly && onMove && tasks.length > 1 && (
                <div className="flex flex-col items-center opacity-30 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onMove(idx, 'up')}
                    disabled={idx === 0}
                    className="p-0.5 text-gray-400 hover:text-gray-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(idx, 'down')}
                    disabled={idx === tasks.length - 1}
                    className="p-0.5 text-gray-400 hover:text-gray-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="px-2 py-1.5">
              <input
                value={task.title}
                onChange={(e) => onUpdate(idx, 'title', e.target.value)}
                disabled={readOnly}
                className={cn(
                  'w-full px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white',
                  readOnly && 'bg-gray-50 cursor-default'
                )}
                placeholder="Task title"
              />
            </div>
            <div className="px-2 py-1.5">
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
                {departments.map((d) => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </select>
            </div>
            {/* Type selector */}
            <div className="px-2 py-1.5">
              <select
                value={task.type || 'project'}
                onChange={(e) => onUpdate(idx, 'type', e.target.value)}
                disabled={readOnly}
                className={cn(
                  'w-full px-2 py-1.5 text-[10px] font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white',
                  readOnly && 'bg-gray-50 cursor-default'
                )}
              >
                <option value="project">Project</option>
                <option value="internal">Internal</option>
              </select>
            </div>
            {/* Linked to Product toggle */}
            <div className="px-2 py-1.5 flex items-center justify-center">
              {!readOnly ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={task.linkedToProduct === true}
                    onChange={(e) => onUpdate(idx, 'linkedToProduct', e.target.checked ? 'true' : 'false')}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    'w-7 h-4 rounded-full transition-colors peer-checked:bg-indigo-600 bg-gray-300',
                    'peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-indigo-300'
                  )}>
                    <div className={cn(
                      'w-3 h-3 bg-white rounded-full shadow-sm transition-transform mt-0.5',
                      task.linkedToProduct === true ? 'translate-x-[14px]' : 'translate-x-[2px]'
                    )} />
                  </div>
                </label>
              ) : (
                <span className={cn(
                  'text-[9px] font-mono uppercase',
                  task.linkedToProduct === true ? 'text-indigo-600 font-bold' : 'text-gray-400'
                )}>
                  {task.linkedToProduct === true ? 'Yes' : 'No'}
                </span>
              )}
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
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function ViewTaskTable({ tasks }: { tasks: ITemplateGroup['tasks'] }) {
  return (
    <div className="erp-table-wrap border border-gray-200">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[32px_1fr_1fr_90px] bg-gray-50 border-b border-gray-200 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
          <div className="px-2 py-2 text-center">#</div>
          <div className="px-3 py-2">Task</div>
          <div className="px-3 py-2">Description</div>
          <div className="px-3 py-2">Frequency</div>
        </div>
        <div className="divide-y divide-gray-100">
          {tasks.map((task, idx) => (
            <div key={idx} className="grid grid-cols-[32px_1fr_1fr_90px] gap-0 items-center px-2 py-2 hover:bg-gray-50/50">
              <div className="text-[10px] font-mono text-gray-400 text-center">{idx + 1}</div>
              <div className="min-w-0 px-1">
                <p className="text-[11px] font-medium text-gray-900 truncate">{task.title}</p>
              </div>
              <div className="min-w-0 px-1">
                <p className="text-[10px] text-gray-500 truncate">{task.description}</p>
              </div>
              <div className="px-1">
                <span className={cn(
                  'inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-sm',
                  FREQUENCY_BADGES[task.frequency || 'project'] || 'bg-gray-100 text-gray-800'
                )}>
                  {FREQUENCY_LABELS[task.frequency || 'project'] || task.frequency}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FrequencyBadge({ freq }: { freq: string }) {
  return (
    <span className={cn(
      'inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-sm',
      FREQUENCY_BADGES[freq] || 'bg-gray-100 text-gray-800'
    )}>
      {FREQUENCY_LABELS[freq] || freq}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function TemplateGroupsClient() {
  const departments = useDepartments();
  const [groups, setGroups] = useState<ITemplateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GroupDraft>(emptyGroupDraft);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<GroupDraft>(emptyGroupDraft);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editDepartmentTab, setEditDepartmentTab] = useState<Department>(DEPARTMENT_SEQUENCE[0]);
  const [viewDepartmentTab, setViewDepartmentTab] = useState<Department | null>(null);

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
    setViewDepartmentTab(null);
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
      if (key === 'linkedToProduct') {
        (tasks[idx] as any)[key] = value === 'true';
      } else {
        (tasks[idx] as any)[key] = value;
      }
      return { ...prev, tasks };
    });
  };

  const moveTaskInDraft = (idx: number, direction: 'up' | 'down') => {
    setDraft((prev) => {
      const tasks = [...prev.tasks];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= tasks.length) return prev;
      [tasks[idx], tasks[targetIdx]] = [tasks[targetIdx], tasks[idx]];
      return { ...prev, tasks };
    });
  };

  const reorderTasksInDraft = (fromIdx: number, toIdx: number) => {
    setDraft((prev) => ({
      ...prev,
      tasks: reorderItems(prev.tasks, fromIdx, toIdx),
    }));
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
          type: t.type,
          linkedToProduct: t.linkedToProduct === true,
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
    setEditDepartmentTab(departments[0]?.name || DEPARTMENT_SEQUENCE[0]);
    setEditDraft({
      name: group.name,
      description: group.description,
      tasks: group.tasks.map((t) => ({
        department: t.department,
        title: t.title,
        description: t.description,
        frequency: t.frequency || 'project',
        type: t.type || 'project',
        linkedToProduct: t.linkedToProduct === true,
      })),
    });
  };

  const addEditTask = (department: Department) => {
    setEditDraft((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { ...emptyTaskDraft, department }],
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
      if (key === 'linkedToProduct') {
        (tasks[idx] as any)[key] = value === 'true';
      } else {
        (tasks[idx] as any)[key] = value;
      }
      return { ...prev, tasks };
    });
  };

  const reorderEditTasksInDepartment = (department: Department, fromLocalIdx: number, toLocalIdx: number) => {
    setEditDraft((prev) => {
      const departmentTasks = prev.tasks.filter((task) => task.department === department);
      const reorderedDepartmentTasks = reorderItems(departmentTasks, fromLocalIdx, toLocalIdx);
      let departmentIdx = 0;
      const tasks = prev.tasks.map((task) => {
        if (task.department !== department) return task;
        const nextTask = reorderedDepartmentTasks[departmentIdx];
        departmentIdx += 1;
        return nextTask;
      });
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
          type: t.type,
          linkedToProduct: t.linkedToProduct === true,
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
              Groups of department-wise tasks assigned to window specifications when creating a project.
            </p>
          </div>
          <div className="text-right font-mono">
            <p className="text-2xl font-black text-gray-900">{groups.length}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Groups</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
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
          <div className="space-y-4">
            {groups.map((group) => {
              const isEditing = editingId === group._id;
              const isExpanded = expandedGroup === group._id;
              const depCount = new Set(group.tasks.map((t) => t.department)).size;
              const orderedDepartments = [
                ...departments,
                ...[...new Set(group.tasks.map((t) => t.department))]
                  .filter((department) => !departments.some((item) => item.name === department))
                  .map((name) => ({ name, label: DEPARTMENT_LABELS[name] || name })),
              ];
              const deptGroups = orderedDepartments
                .map((d) => ({
                  department: d.name,
                  label: d.label,
                  tasks: group.tasks.filter((t) => t.department === d.name),
                }))
                .filter((g) => g.tasks.length > 0);
              const freqCounts = group.tasks.reduce((acc, t) => {
                const f = t.frequency || 'project';
                acc[f] = (acc[f] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return (
                <div key={group._id} className="border border-gray-200">
                  {/* Group header — always visible */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
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
                    <div className="px-5 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500 font-bold">Frequency:</span>
                      {Object.keys(freqCounts).map((freq) => (
                        <FrequencyBadge key={freq} freq={freq} />
                      ))}
                      <span className="text-[9px] text-gray-400 font-mono ml-1">({Object.keys(freqCounts).length} types)</span>
                    </div>
                  )}

                  {/* View mode - collapsible with department tabs */}
                  {isExpanded && !isEditing && (
                    <div>
                      {/* Department tabs for view mode */}
                      {deptGroups.length > 1 && (
                        <div className="flex border-b border-gray-100 bg-gray-50/30 overflow-x-auto">
                          <button
                            type="button"
                            onClick={() => setViewDepartmentTab(null)}
                            className={cn(
                              'px-4 py-2 text-[10px] font-mono whitespace-nowrap border-b-2 transition-colors',
                              viewDepartmentTab === null
                                ? 'border-black text-black font-bold'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                            )}
                          >
                            All ({group.tasks.length})
                          </button>
                          {deptGroups.map((g) => (
                            <button
                              key={g.department}
                              type="button"
                              onClick={() => setViewDepartmentTab(g.department)}
                              className={cn(
                                'px-4 py-2 text-[10px] font-mono whitespace-nowrap border-b-2 transition-colors',
                                viewDepartmentTab === g.department
                                  ? 'border-black text-black font-bold'
                                  : 'border-transparent text-gray-500 hover:text-gray-800'
                              )}
                            >
                              {g.label} ({g.tasks.length})
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="p-4">
                        <ViewTaskTable
                          tasks={
                            viewDepartmentTab === null
                              ? group.tasks
                              : group.tasks.filter((t) => t.department === viewDepartmentTab)
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Editing mode with department tabs */}
                  {isEditing && (
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
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

                      {/* Department tabs for editing */}
                      <DepartmentTabs
                        tasks={editDraft.tasks}
                        departments={departments}
                        activeTab={editDepartmentTab}
                        onTabChange={setEditDepartmentTab}
                      />

                      {/* Task table filtered by selected department */}
                      <TaskTable
                        tasks={editDraft.tasks.filter((t) => t.department === editDepartmentTab)}
                        departments={departments}
                        onUpdate={(localIdx, key, value) => {
                          const globalTasks = editDraft.tasks.filter((t) => t.department === editDepartmentTab);
                          const globalIdx = editDraft.tasks.indexOf(globalTasks[localIdx]);
                          updateEditTask(globalIdx, key, value);
                        }}
                        onRemove={(localIdx) => {
                          const globalTasks = editDraft.tasks.filter((t) => t.department === editDepartmentTab);
                          const globalIdx = editDraft.tasks.indexOf(globalTasks[localIdx]);
                          removeEditTask(globalIdx);
                        }}
                        onAdd={() => addEditTask(editDepartmentTab)}
                        onMove={(localIdx, direction) => {
                          reorderEditTasksInDepartment(
                            editDepartmentTab,
                            localIdx,
                            direction === 'up' ? localIdx - 1 : localIdx + 1
                          );
                        }}
                        onReorder={(fromIdx, toIdx) => reorderEditTasksInDepartment(editDepartmentTab, fromIdx, toIdx)}
                        addLabel={`Add ${departments.find((item) => item.name === editDepartmentTab)?.label || DEPARTMENT_LABELS[editDepartmentTab] || editDepartmentTab} task`}
                      />

                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-mono text-gray-400">
                          {editDraft.tasks.filter((t) => t.title.trim()).length} tasks defined across{' '}
                          {new Set(editDraft.tasks.map((t) => t.department)).size} departments
                        </div>
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
        <div className="border-2 border-dashed border-gray-300 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-gray-500" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
              Create Template Group
            </h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
              departments={departments}
              onUpdate={updateTaskInDraft}
              onRemove={removeTaskFromDraft}
              onAdd={addTaskToDraft}
              onMove={moveTaskInDraft}
              onReorder={reorderTasksInDraft}
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
