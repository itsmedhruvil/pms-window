'use client';

import { useState, useMemo, useCallback } from 'react';
import { Trash2, Plus, RefreshCw } from 'lucide-react';
import { cn, getDepartmentLabel, apiFetch } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { FilterDrawer, MobileFilterButton } from '@/components/ui/FilterDrawer';
import { CreateUserForm } from '@/components/forms/CreateUserForm';
import type { IUser } from '@/types';
import { Department, UserRole } from '@/types';
import { useDepartments } from '@/hooks/useDepartments';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]: 'Admin',
  [UserRole.DEPARTMENT_USER]: 'Dept User',
};

const ROLE_STYLE: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'bg-black text-white border-black',
  [UserRole.ADMIN]: 'bg-gray-800 text-white border-gray-800',
  [UserRole.DEPARTMENT_USER]: 'border-gray-300 text-gray-700',
};

export function UsersClient({
  initialUsers,
  currentUserId,
  isSuperAdmin,
}: {
  initialUsers: IUser[];
  currentUserId: string;
  isSuperAdmin: boolean;
}) {
  const departments = useDepartments();
  const [users, setUsers] = useState<IUser[]>(initialUsers);
  const [deptFilter, setDeptFilter] = useState<Department | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ role: UserRole; department: Department } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ message: string; error?: string } | null>(null);

  const activeFilterCount = useMemo(() => {
    return deptFilter !== 'all' ? 1 : 0;
  }, [deptFilter]);

  const handleUserCreated = (user: IUser) => {
    setUsers((prev) => [user, ...prev]);
    setUserModalOpen(false);
  };

  const filtered = users.filter((u) =>
    deptFilter === 'all' || u.department === deptFilter
  );

  const startEdit = (user: IUser) => {
    setEditingId(user._id);
    setEditForm({ role: user.role, department: user.department });
  };

  const saveEdit = async (userId: string) => {
    if (!editForm) return;
    setLoading(userId);

    const result = await apiFetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(editForm),
    });

    setLoading(null);
    if (result.success) {
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, ...editForm } : u))
      );
      setEditingId(null);
    }
  };

  const deactivateUser = async (userId: string) => {
    if (!confirm('Deactivate this user? All their pending tasks will be unassigned.')) return;
    setLoading(userId + 'del');

    const result = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });

    setLoading(null);
    if (result.success) {
      setUsers((prev) => prev.filter((u) => u._id !== userId));
    }
  };

  const syncFromClerk = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);

    try {
      const result = await apiFetch('/api/users/sync-clerk', { method: 'POST' });
      if (result.success) {
        setSyncResult({ message: 'Sync completed. Reloading...' });
        // Hard-reload the page to get fresh data from the server component
        setTimeout(() => window.location.reload(), 500);
      } else {
        setSyncResult({ message: result.error || 'Sync failed.', error: result.error });
      }
    } catch (err) {
      setSyncResult({ message: 'Failed to sync Clerk users.', error: String(err) });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-black text-gray-900">Users</h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {users.length} team member{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={syncFromClerk}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide border border-gray-300 text-gray-700 hover:border-gray-500 hover:text-black transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Clerk'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setUserModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide bg-black text-white hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New User
          </button>

          <div className="flex gap-2">
            {departments.map(({ name: dept, label }) => {
              const count = users.filter((u) => u.department === dept).length;
              return (
                <div key={dept} className="text-center px-3 py-1.5 border border-gray-200">
                  <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">
                    {label.split(' ')[0]}
                  </p>
                  <p className="text-sm font-black text-gray-900">{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div
          className={cn(
            'mb-4 px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wide border',
            syncResult.error
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-green-300 bg-green-50 text-green-700'
          )}
        >
          {syncResult.message}
        </div>
      )}

      {/* Filter — desktop */}
      <div className="hidden sm:flex gap-1.5 mb-4 items-center">
        {(['all', ...departments.map((department) => department.name)] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDeptFilter(d)}
            className={cn(
              'px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
              deptFilter === d
                ? 'bg-black text-white border-black'
                : 'border-gray-200 text-gray-500 hover:border-gray-400'
            )}
          >
            {d === 'all' ? 'All' : departments.find((department) => department.name === d)?.label.split(' ')[0] || getDepartmentLabel(d)}
          </button>
        ))}
      </div>

      {/* Mobile filter button */}
      <div className="flex sm:hidden mb-4">
        <MobileFilterButton
          onClick={() => setMobileFilterOpen(true)}
          activeCount={activeFilterCount}
        />
      </div>
      <FilterDrawer open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} title="User Filters">
        <div className="mb-5">
          <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-2">
            Department
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...departments.map((department) => department.name)] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className={cn(
                  'px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors',
                  deptFilter === d
                    ? 'bg-black text-white border-black'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400'
                )}
              >
                {d === 'all' ? 'All' : departments.find((department) => department.name === d)?.label.split(' ')[0] || getDepartmentLabel(d)}
              </button>
            ))}
          </div>
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setDeptFilter('all'); setMobileFilterOpen(false); }}
            className="w-full px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            Clear Filter
          </button>
        )}
      </FilterDrawer>

      {/* Users table */}
      <div className="erp-table-wrap border border-gray-200">
        <table className="erp-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
              {isSuperAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isEditing = editingId === user._id;
              const isCurrentUser = user._id === currentUserId;

              return (
                <tr key={user._id} className={cn(!user.isActive && 'opacity-50')}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-gray-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] text-white font-bold">
                          {user.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-xs flex items-center gap-1.5">
                          {user.name}
                          {isCurrentUser && (
                            <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wide">(you)</span>
                          )}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {isEditing && editForm ? (
                      <select
                        value={editForm.department}
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value as Department })}
                        className="text-[10px] font-mono border border-gray-300 px-1.5 py-1 focus:outline-none focus:border-black"
                      >
                        {departments.map((d) => (
                          <option key={d.name} value={d.name}>{d.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] font-mono text-gray-600 uppercase tracking-wide">
                        {departments.find((department) => department.name === user.department)?.label || getDepartmentLabel(user.department)}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing && editForm && isSuperAdmin ? (
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                        className="text-[10px] font-mono border border-gray-300 px-1.5 py-1 focus:outline-none focus:border-black"
                      >
                        {Object.values(UserRole).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn(
                        'inline-flex text-[10px] font-mono font-bold px-2 py-0.5 border uppercase tracking-wide',
                        ROLE_STYLE[user.role]
                      )}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={cn(
                      'text-[10px] font-mono uppercase',
                      user.isActive ? 'text-gray-600' : 'text-gray-400'
                    )}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isSuperAdmin && (
                    <td>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(user._id)}
                              disabled={loading === user._id}
                              className="text-[10px] font-mono font-bold px-2 py-1 bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                            >
                              {loading === user._id ? '...' : 'Save'}
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
                            {!isCurrentUser && (
                              <button
                                onClick={() => startEdit(user)}
                                className="text-[10px] font-mono text-gray-500 hover:text-black underline"
                              >
                                Edit
                              </button>
                            )}
                            {!isCurrentUser && user.isActive && (
                              <button
                                onClick={() => deactivateUser(user._id)}
                                disabled={loading === user._id + 'del'}
                                className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                title="Deactivate user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)} size="lg">
        <CreateUserForm onSuccess={handleUserCreated} onCancel={() => setUserModalOpen(false)} />
      </Modal>
    </div>
  );
}
