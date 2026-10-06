'use client';

import { useState, useMemo } from 'react';
import { Factory, Building2, Check, Loader2, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { notifyDepartmentsChanged } from '@/hooks/useDepartments';
import { FactoryGroup, FACTORY_GROUP_LABELS, DEPARTMENT_LABELS, STAGE_SEQUENCE, STAGE_LABELS, STAGE_TASK_CATEGORIES, formatStageName } from '@/types';

interface DepartmentItem {
  _id: string;
  name: string;
  label: string;
  abbreviation: string;
  sequence: number;
  description: string;
  isActive: boolean;
  factoryGroup: FactoryGroup;
}

interface DepartmentForm {
  name: string;
  label: string;
  abbreviation: string;
  description: string;
  factoryGroup: FactoryGroup;
}

interface SettingsClientProps {
  initialDepartments: DepartmentItem[];
  /** Only super admins may create/edit/delete/reorder departments (enforced by the API). */
  canManage: boolean;
}

const emptyForm: DepartmentForm = {
  name: '',
  label: '',
  abbreviation: '',
  description: '',
  factoryGroup: FactoryGroup.INSIDE,
};

export function SettingsClient({ initialDepartments, canManage }: SettingsClientProps) {
  const [departments, setDepartments] = useState<DepartmentItem[]>(initialDepartments);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Department management state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    label: string;
    abbreviation: string;
    description: string;
  } | null>(null);

  const sorted = useMemo(() => [...departments].sort((a, b) => a.sequence - b.sequence), [departments]);

  const insideCount = useMemo(
    () => departments.filter((d) => d.factoryGroup === FactoryGroup.INSIDE).length,
    [departments]
  );
  const outsideCount = useMemo(
    () => departments.filter((d) => d.factoryGroup === FactoryGroup.OUTSIDE).length,
    [departments]
  );

  const flashSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const changeFactoryGroup = async (dept: DepartmentItem, newGroup: FactoryGroup) => {
    if (dept.factoryGroup === newGroup) return;
    setSavingId(dept._id);
    setError(null);
    setSuccess(null);

    const result = await apiFetch(`/api/departments/${dept._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ factoryGroup: newGroup }),
    });

    setSavingId(null);

    if (result.success) {
      setDepartments((prev) =>
        prev.map((d) => (d._id === dept._id ? { ...d, factoryGroup: newGroup } : d))
      );
      flashSuccess(`"${dept.label}" is now ${FACTORY_GROUP_LABELS[newGroup]}`);
      notifyDepartmentsChanged();
    } else {
      setError(result.error || 'Failed to update department');
    }
  };

  const isFormValid =
    form.name.trim().length >= 2 &&
    form.label.trim().length >= 2 &&
    form.abbreviation.trim().length >= 1 &&
    (form.factoryGroup === FactoryGroup.INSIDE || form.factoryGroup === FactoryGroup.OUTSIDE);

  const handleCreate = async () => {
    if (!isFormValid) return;
    setSubmitting(true);
    setError(null);

    const result = await apiFetch<DepartmentItem>('/api/departments', {
      method: 'POST',
      body: JSON.stringify(form),
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Failed to create department');
      return;
    }

    setDepartments((prev) => [...prev, result.data as DepartmentItem]);
    setModalOpen(false);
    setForm(emptyForm);
    notifyDepartmentsChanged();
    flashSuccess('Department created');
  };

  const startEdit = (dept: DepartmentItem) => {
    setEditingId(dept._id);
    setEditForm({
      label: dept.label,
      abbreviation: dept.abbreviation,
      description: dept.description,
    });
  };

  const saveEdit = async (deptId: string) => {
    if (!editForm) return;
    setSavingId(deptId);
    setError(null);

    const result = await apiFetch(`/api/departments/${deptId}`, {
      method: 'PATCH',
      body: JSON.stringify(editForm),
    });

    setSavingId(null);

    if (result.success) {
      setDepartments((prev) =>
        prev.map((d) => (d._id === deptId ? { ...d, ...editForm } : d))
      );
      setEditingId(null);
      notifyDepartmentsChanged();
      flashSuccess('Department updated');
    } else {
      setError(result.error || 'Failed to update department');
    }
  };

  const moveDepartment = async (deptId: string, direction: 'up' | 'down') => {
    const idx = sorted.findIndex((d) => d._id === deptId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const dept = sorted[idx];
    const target = sorted[targetIdx];
    const deptSeq = dept.sequence;
    const targetSeq = target.sequence;

    setDepartments((prev) =>
      prev.map((d) => {
        if (d._id === deptId) return { ...d, sequence: targetSeq };
        if (d._id === target._id) return { ...d, sequence: deptSeq };
        return d;
      })
    );

    await Promise.all([
      apiFetch(`/api/departments/${deptId}`, {
        method: 'PATCH',
        body: JSON.stringify({ sequence: targetSeq }),
      }),
      apiFetch(`/api/departments/${target._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sequence: deptSeq }),
      }),
    ]);
    notifyDepartmentsChanged();
  };

  const toggleActive = async (deptId: string, currentActive: boolean) => {
    setSavingId(deptId);
    setError(null);

    const result = await apiFetch(`/api/departments/${deptId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !currentActive }),
    });

    setSavingId(null);

    if (result.success) {
      setDepartments((prev) =>
        prev.map((d) => (d._id === deptId ? { ...d, isActive: !currentActive } : d))
      );
      notifyDepartmentsChanged();
    } else {
      setError(result.error || 'Failed to update department');
    }
  };

  const deleteDepartment = async (deptId: string) => {
    const dept = departments.find((d) => d._id === deptId);
    if (!dept) return;
    if (
      !confirm(
        `Delete "${dept.label}"?\n\nAny tasks in this department will be deleted too. This cannot be undone.`
      )
    )
      return;

    setSavingId(deptId + 'del');
    setError(null);

    const result = await apiFetch<{ deletedTasks: number }>(`/api/departments/${deptId}`, {
      method: 'DELETE',
    });

    setSavingId(null);

    if (result.success) {
      setDepartments((prev) => prev.filter((d) => d._id !== deptId));
      notifyDepartmentsChanged();
      const deletedTasks = result.data?.deletedTasks ?? 0;
      flashSuccess(
        deletedTasks > 0
          ? `"${dept.label}" deleted with ${deletedTasks} task${deletedTasks === 1 ? '' : 's'}`
          : `"${dept.label}" deleted`
      );
    } else {
      setError(result.error || 'Failed to delete department');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-primary-200">
        <div>
          <h1 className="text-xl font-black text-dark-500">Settings</h1>
          <p className="text-xs text-primary-500 font-mono mt-0.5">
            Configure factory group assignments for departments
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="border border-primary-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-dark-500 flex items-center justify-center flex-shrink-0">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500">
              Inside Factory
            </p>
            <p className="text-lg font-black text-dark-500">{insideCount} department{insideCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="border border-primary-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-200 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-dark-500" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500">
              Outside Factory
            </p>
            <p className="text-lg font-black text-dark-500">{outsideCount} department{outsideCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded border border-green-200 bg-green-50 text-green-700 text-xs">
          {success}
        </div>
      )}

      {/* Departments */}
      <div className="border border-primary-200">
        <div className="px-4 py-3 border-b border-primary-200 bg-primary-50 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-dark-600">
              Departments
            </h2>
            <p className="text-[10px] text-primary-500 font-mono mt-0.5">
              Create, reorder, activate/deactivate departments and assign them to factory groups.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide bg-dark-500 text-white hover:bg-dark-600 transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Department
            </button>
          )}
        </div>

        {!canManage && (
          <div className="px-4 py-2 border-b border-primary-100 bg-primary-50/50 text-[10px] font-mono text-primary-500">
            Only super admins can modify departments.
          </div>
        )}

        <div className="divide-y divide-primary-100">
          {sorted.map((dept, index) => {
            const isEditing = editingId === dept._id;
            return (
            <div
              key={dept._id}
              className={cn('flex items-center justify-between gap-3 px-4 py-3', !dept.isActive && 'opacity-60')}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-mono font-bold text-dark-500">
                    {dept.abbreviation}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  {isEditing && editForm ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editForm.label}
                          onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                          placeholder="Label"
                          className="text-[11px] font-mono border border-primary-300 px-2 py-1 w-40 focus:outline-none focus:border-dark-500"
                        />
                        <input
                          value={editForm.abbreviation}
                          onChange={(e) => setEditForm({ ...editForm, abbreviation: e.target.value })}
                          placeholder="Abbr"
                          maxLength={6}
                          className="text-[10px] font-mono border border-primary-300 px-2 py-1 w-16 uppercase focus:outline-none focus:border-dark-500"
                        />
                      </div>
                      <input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Description"
                        className="text-[10px] font-mono border border-primary-300 px-2 py-1 w-full max-w-xs focus:outline-none focus:border-dark-500"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-dark-500 truncate">{dept.label}</p>
                      <p className="text-[10px] font-mono text-primary-400 truncate">
                        {dept.name}
                        {dept.description ? ` · ${dept.description}` : ''}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => changeFactoryGroup(dept, FactoryGroup.INSIDE)}
                  disabled={savingId === dept._id || !canManage}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors disabled:opacity-50',
                    dept.factoryGroup === FactoryGroup.INSIDE
                      ? 'bg-dark-500 text-white border-dark-500'
                      : 'border-primary-200 text-primary-500 hover:border-dark-500 hover:text-dark-500'
                  )}
                >
                  {savingId === dept._id ? (
                    <Loader2 className="w-3 h-3 inline animate-spin" />
                  ) : dept.factoryGroup === FactoryGroup.INSIDE ? (
                    <Check className="w-3 h-3 inline mr-1" />
                  ) : null}
                  Inside
                </button>
                <button
                  type="button"
                  onClick={() => changeFactoryGroup(dept, FactoryGroup.OUTSIDE)}
                  disabled={savingId === dept._id || !canManage}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors disabled:opacity-50',
                    dept.factoryGroup === FactoryGroup.OUTSIDE
                      ? 'bg-primary-200 text-dark-600 border-primary-300'
                      : 'border-primary-200 text-primary-500 hover:border-dark-500 hover:text-dark-500'
                  )}
                >
                  {savingId === dept._id ? (
                    <Loader2 className="w-3 h-3 inline animate-spin" />
                  ) : dept.factoryGroup === FactoryGroup.OUTSIDE ? (
                    <Check className="w-3 h-3 inline mr-1" />
                  ) : null}
                  Outside
                </button>

                {canManage && (
                  <>
                    <div className="flex flex-col gap-0.5 ml-1">
                      <button
                        type="button"
                        onClick={() => moveDepartment(dept._id, 'up')}
                        disabled={index === 0}
                        className="text-primary-300 hover:text-dark-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDepartment(dept._id, 'down')}
                        disabled={index === sorted.length - 1}
                        className="text-primary-300 hover:text-dark-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleActive(dept._id, dept.isActive)}
                      disabled={savingId === dept._id}
                      className={cn(
                        'text-[10px] font-mono font-bold px-2 py-1 border transition-colors disabled:opacity-50',
                        dept.isActive
                          ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                          : 'border-primary-200 text-primary-400 hover:border-primary-400'
                      )}
                    >
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </button>

                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(dept._id)}
                          disabled={savingId === dept._id}
                          className="text-[10px] font-mono font-bold px-2 py-1.5 bg-dark-500 text-white hover:bg-dark-600 disabled:opacity-50"
                        >
                          {savingId === dept._id ? '...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-[10px] font-mono text-primary-500 hover:text-dark-500 px-2 py-1.5 border border-primary-200"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(dept)}
                          className="text-[10px] font-mono text-primary-500 hover:text-dark-500 underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDepartment(dept._id)}
                          disabled={savingId === dept._id + 'del'}
                          className="text-primary-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Delete department"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="px-4 py-8 text-center text-primary-400 text-xs font-mono">
              No departments found. Click &ldquo;Add Department&rdquo; to create one.
            </div>
          )}
        </div>
      </div>
{/* Stages & Task Categorization */}
      <div className="mt-6 border border-primary-200">
        <div className="px-4 py-3 border-b border-primary-200 bg-primary-50 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-dark-600">
              Stages & Task Categorization
            </h2>
            <p className="text-[10px] text-primary-500 font-mono mt-0.5">
              Master task list grouped by workflow stage. Project view shows Stage Progress by this categorization.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {STAGE_SEQUENCE.map((stage, index) => {
            const tasks = STAGE_TASK_CATEGORIES.filter((c) => c.stage === stage);
            const departmentsPresent = [...new Set(tasks.map((c) => c.department))];
            return (
              <div key={stage} className="border border-primary-100 rounded-lg">
                <div className="flex items-center justify-between px-4 py-2.5 bg-primary-50/50 border-b border-primary-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-sm bg-dark-500 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-dark-600">
                      {STAGE_LABELS[stage] || formatStageName(stage)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-primary-500">
                    {tasks.length} tasks · {departmentsPresent.length} departments
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-primary-100/60">
                  {tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white px-3 py-2">
                      <span className="text-[9px] font-mono text-dark-400 mt-0.5 shrink-0">
                        {DEPARTMENT_LABELS[task.department] || task.department}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-dark-500 leading-tight">{task.title}</p>
                        <p className="text-[10px] text-primary-400 font-mono mt-0.5 line-clamp-2">{task.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Department modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setError(null);
          setForm(emptyForm);
        }}
        size="lg"
      >
        <div className="space-y-6 p-6">
          <div>
            <h2 className="text-sm font-black text-dark-500 uppercase tracking-widest">Add Department</h2>
            <p className="text-[10px] font-mono text-primary-400 mt-1">
              Create a new department and assign it to a factory group.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
              Name (slug)
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. quality_assurance"
                className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
              />
            </label>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
              Label
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Quality Assurance"
                className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
              Abbreviation
              <input
                value={form.abbreviation}
                onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
                placeholder="e.g. QA"
                maxLength={6}
                className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500 uppercase"
              />
            </label>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
              Description
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the department"
                className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
              />
            </label>
          </div>

          <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
            Factory Group
            <select
              value={form.factoryGroup}
              onChange={(e) => setForm({ ...form, factoryGroup: e.target.value as FactoryGroup })}
              className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
            >
              <option value="inside">Inside Factory</option>
              <option value="outside">Outside Factory</option>
            </select>
          </label>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-primary-200">
            <button
              type="button"
              onClick={() => { setModalOpen(false); setError(null); setForm(emptyForm); }}
              className="px-4 py-2 text-xs font-mono font-bold uppercase border border-primary-300 text-dark-400 hover:border-dark-400"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isFormValid || submitting}
              onClick={handleCreate}
              className="px-4 py-2 text-xs font-mono font-bold uppercase transition-colors disabled:opacity-50 bg-dark-500 text-white hover:bg-dark-600"
            >
              {submitting ? 'Creating...' : 'Create Department'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}