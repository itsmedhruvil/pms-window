'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';

interface DepartmentItem {
  _id: string;
  name: string;
  label: string;
  abbreviation: string;
  sequence: number;
  description: string;
  isActive: boolean;
}

interface DepartmentForm {
  name: string;
  label: string;
  abbreviation: string;
  description: string;
}

const emptyForm: DepartmentForm = { name: '', label: '', abbreviation: '', description: '' };
const EMPTY_ROW_TEXT = 'No departments yet. Click \u201cAdd Department\u201d to create one.';

export function DepartmentsClient({ initialDepartments }: { initialDepartments: DepartmentItem[] }) {
  const [departments, setDepartments] = useState<DepartmentItem[]>(initialDepartments);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ label: string; abbreviation: string; description: string } | null>(null);

  const sorted = useMemo(() => [...departments].sort((a, b) => a.sequence - b.sequence), [departments]);

  const isFormValid = form.name.trim().length >= 2 && form.label.trim().length >= 2 && form.abbreviation.trim().length >= 1;

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
  };

  const startEdit = (dept: DepartmentItem) => {
    setEditingId(dept._id);
    setEditForm({ label: dept.label, abbreviation: dept.abbreviation, description: dept.description });
  };

  const saveEdit = async (deptId: string) => {
    if (!editForm) return;
    setLoading(deptId);

    const result = await apiFetch(`/api/departments/${deptId}`, {
      method: 'PATCH',
      body: JSON.stringify(editForm),
    });

    setLoading(null);

    if (result.success) {
      setDepartments((prev) =>
        prev.map((d) => (d._id === deptId ? { ...d, ...editForm } : d))
      );
      setEditingId(null);
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
  };

  const deleteDepartment = async (deptId: string) => {
    const dept = departments.find((d) => d._id === deptId);
    if (!dept) return;
    if (!confirm(`Delete "${dept.label}"? This cannot be undone.`)) return;

    setLoading(deptId + 'del');

    const result = await apiFetch(`/api/departments/${deptId}`, { method: 'DELETE' });

    setLoading(null);

    if (result.success) {
      setDepartments((prev) => prev.filter((d) => d._id !== deptId));
    } else {
      alert(result.error || 'Failed to delete department');
    }
  };

  const toggleActive = async (deptId: string, currentActive: boolean) => {
    setLoading(deptId + 'active');

    const result = await apiFetch(`/api/departments/${deptId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !currentActive }),
    });

    setLoading(null);

    if (result.success) {
      setDepartments((prev) =>
        prev.map((d) => (d._id === deptId ? { ...d, isActive: !currentActive } : d))
      );
    }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-black text-gray-900">Departments</h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {departments.length} department{departments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide bg-black text-white hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Department
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Departments table */}
      <div className="erp-table-wrap border border-gray-200">
        <table className="erp-table">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Name</th>
              <th>Label</th>
              <th>Abbreviation</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400 text-xs font-mono">
                  {EMPTY_ROW_TEXT}
                </td>
              </tr>
            )}
            {sorted.map((dept, index) => {
              const isEditing = editingId === dept._id;

              return (
                <tr key={dept._id} className={cn(!dept.isActive && 'opacity-50')}>
                  <td className="text-[10px] font-mono text-gray-400">{index + 1}</td>
                  <td>
                    <span className="text-[11px] font-mono text-gray-900 font-medium">
                      {dept.name}
                    </span>
                  </td>
                  <td>
                    {isEditing && editForm ? (
                      <input
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        className="text-[10px] font-mono border border-gray-300 px-1.5 py-1 w-28 focus:outline-none focus:border-black"
                      />
                    ) : (
                      <span className="text-[11px] font-mono text-gray-600">
                        {dept.label}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing && editForm ? (
                      <input
                        value={editForm.abbreviation}
                        onChange={(e) => setEditForm({ ...editForm, abbreviation: e.target.value })}
                        className="text-[10px] font-mono border border-gray-300 px-1.5 py-1 w-16 uppercase focus:outline-none focus:border-black"
                        maxLength={6}
                      />
                    ) : (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 border border-gray-300 uppercase">
                        {dept.abbreviation}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing && editForm ? (
                      <input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="text-[10px] font-mono border border-gray-300 px-1.5 py-1 w-40 focus:outline-none focus:border-black"
                      />
                    ) : (
                      <span className="text-[10px] font-mono text-gray-400">
                        {dept.description || '\u2014'}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive(dept._id, dept.isActive)}
                      disabled={loading === dept._id + 'active'}
                      className={cn(
                        'text-[10px] font-mono font-bold px-2 py-0.5 border transition-colors disabled:opacity-50',
                        dept.isActive
                          ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                          : 'border-gray-200 text-gray-400 hover:border-gray-400'
                      )}
                    >
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {/* Move up/down */}
                      <div className="flex flex-col gap-0.5 mr-1">
                        <button
                          onClick={() => moveDepartment(dept._id, 'up')}
                          disabled={index === 0}
                          className="text-gray-300 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveDepartment(dept._id, 'down')}
                          disabled={index === sorted.length - 1}
                          className="text-gray-300 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(dept._id)}
                            disabled={loading === dept._id}
                            className="text-[10px] font-mono font-bold px-2 py-1 bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                          >
                            {loading === dept._id ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-[10px] font-mono text-gray-500 hover:text-black px-2 py-1 border border-gray-200"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(dept)}
                            className="text-[10px] font-mono text-gray-500 hover:text-black underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteDepartment(dept._id)}
                            disabled={loading === dept._id + 'del'}
                            className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Delete department"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError(null); setForm(emptyForm); }} size="lg">
        <div className="space-y-6 p-6">
          <div>
            <h2 className="text-lg font-black text-gray-900">Add New Department</h2>
            <p className="text-xs text-gray-500 font-mono">Create a new department for the organization.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                Name (slug)
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. quality_assurance"
                  className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              </label>

              <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                Label
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. Quality Assurance"
                  className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                Abbreviation
                <input
                  value={form.abbreviation}
                  onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
                  placeholder="e.g. QA"
                  maxLength={6}
                  className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black uppercase"
                />
              </label>

              <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                Description
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the department"
                  className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => { setModalOpen(false); setError(null); setForm(emptyForm); }}
              className="px-4 py-2 text-xs font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isFormValid || submitting}
              onClick={handleCreate}
              className={cn(
                'px-4 py-2 text-xs font-mono font-bold uppercase transition-colors disabled:opacity-50',
                'bg-black text-white hover:bg-gray-800'
              )}
            >
              {submitting ? 'Creating...' : 'Create Department'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}