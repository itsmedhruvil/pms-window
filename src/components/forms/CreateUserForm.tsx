'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiFetch, cn } from '@/lib/utils';
import { Department, UserRole } from '@/types';
import type { IUser } from '@/types';
import { useDepartments } from '@/hooks/useDepartments';

interface CreateUserFormProps {
  onSuccess?: (user: IUser) => void;
  onCancel: () => void;
}

interface FormData {
  email: string;
  name: string;
  role: UserRole;
  department: Department;
}

export function CreateUserForm({ onSuccess, onCancel }: CreateUserFormProps) {
  const departments = useDepartments();
  const [form, setForm] = useState<FormData>({
    email: '',
    name: '',
    role: UserRole.DEPARTMENT_USER,
    department: departments[0]?.name || Department.PRODUCTION,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    form.email.trim().length > 0 &&
    form.name.trim().length >= 2;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<IUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Failed to create user');
      return;
    }

    onSuccess?.(result.data as IUser);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-black text-dark-500">Create New User</h2>
        <p className="text-xs text-primary-500 font-mono">Add a new team member and assign their role and department.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4">
        <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="name@example.com"
            className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
          />
        </label>

        <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
          Full Name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Priya Singh"
            className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
            >
              {Object.values(UserRole).map((role) => (
                <option key={role} value={role}>
                  {role.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[11px] uppercase tracking-[0.2em] text-primary-500 font-bold">
            Department
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value as Department })}
              className="mt-2 w-full border border-primary-200 px-3 py-2 text-sm focus:outline-none focus:border-dark-500"
            >
              {departments.map((department) => (
                <option key={department.name} value={department.name}>
                  {department.label}
                </option>
              ))}
            </select>
          </label>
        </div>
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
          {loading ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </div>
  );
}
