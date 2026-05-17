'use client';

import { UserRole, Department } from '@/types';
import { DEPARTMENT_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]: 'Admin',
  [UserRole.DEPARTMENT_USER]: 'Department User',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Full system access. Can manage users, projects, tasks, alerts, and all configuration including template groups and role assignments.',
  [UserRole.ADMIN]: 'Broad management access. Can create and manage projects, view all tasks and alerts, manage users (except role changes to Super Admin).',
  [UserRole.DEPARTMENT_USER]: 'Department-scoped access. Can only see and work on tasks and alerts assigned to their specific department.',
};

interface PermissionRow {
  feature: string;
  description: string;
  superAdmin: string;
  admin: string;
  deptUser: string;
}

const PERMISSIONS: PermissionRow[] = [
  {
    feature: 'Dashboard',
    description: 'Overview metrics, project stats, task completion rates, alerts summary',
    superAdmin: 'Full view — all stats, bottlenecks, trends',
    admin: 'Full view — all stats, bottlenecks, trends',
    deptUser: 'View — only their department metrics',
  },
  {
    feature: 'Projects',
    description: 'View project list, search, filter by status/priority',
    superAdmin: 'View all projects',
    admin: 'View all projects',
    deptUser: 'View only assigned projects',
  },
  {
    feature: 'Create Project',
    description: 'Create new project with client info, total windows count, deadline. Window specifications added later via Excel upload',
    superAdmin: 'Full access — create projects with optional template group',
    admin: 'Full access — create projects with optional template group',
    deptUser: 'No access',
  },
  {
    feature: 'Project Detail',
    description: 'View project info, tasks, alerts. Upload Excel for window specifications. Edit project details',
    superAdmin: 'Full access — edit details, upload Excel, change status, reassign',
    admin: 'Full access — edit details, upload Excel, change status, reassign',
    deptUser: 'View only — cannot upload Excel or edit',
  },
  {
    feature: 'Department Tasks',
    description: `View tasks filtered by department (${Object.values(Department).length} departments)`,
    superAdmin: 'View all department task boards',
    admin: 'View all department task boards',
    deptUser: 'View only their own department tasks',
  },
  {
    feature: 'Task CRUD',
    description: 'Create, edit, delete, reassign tasks within a project or internal',
    superAdmin: 'Full access — all tasks',
    admin: 'Full access — all tasks',
    deptUser: 'Edit only own tasks — cannot delete or reassign',
  },
  {
    feature: 'Task Assignment',
    description: 'Assign users to tasks, reassign between team members',
    superAdmin: 'Can assign any user to any task',
    admin: 'Can assign any user to any task',
    deptUser: 'Cannot assign or reassign',
  },
  {
    feature: 'Internal Tasks',
    description: 'Create and manage internal (non-project) tasks',
    superAdmin: 'Full access',
    admin: 'Full access',
    deptUser: 'No access',
  },
  {
    feature: 'Template Groups',
    description: 'Manage reusable task template groups for window types',
    superAdmin: 'Full access — create, edit, delete',
    admin: 'Full access — create, edit, delete',
    deptUser: 'No access',
  },
  {
    feature: 'Alerts',
    description: 'Create, acknowledge, resolve alerts. View alert history',
    superAdmin: 'View all alerts, acknowledge & resolve any',
    admin: 'View all alerts, acknowledge & resolve any',
    deptUser: 'View only department alerts, create alerts, acknowledge own',
  },
  {
    feature: 'Users',
    description: 'View all users, manage roles, deactivate accounts',
    superAdmin: 'Full access — edit roles, deactivate any user',
    admin: 'Manage users (except cannot promote to Super Admin)',
    deptUser: 'No access',
  },
  {
    feature: 'Create Users',
    description: 'Invite new team members to the system',
    superAdmin: 'Can create users with any role',
    admin: 'Can create users (except Super Admin)',
    deptUser: 'No access',
  },
  {
    feature: 'Access Summary',
    description: 'View this roles & permissions reference page',
    superAdmin: 'Full view',
    admin: 'Full view',
    deptUser: 'Full view',
  },
];

const PERMISSION_CELL_STYLE: Record<string, string> = {
  'Full access': 'bg-green-50 text-green-800 border-green-200',
  'Full view': 'bg-green-50 text-green-800 border-green-200',
  'No access': 'bg-gray-100 text-gray-400 border-gray-200',
};

function getCellStyle(value: string): string {
  for (const [prefix, style] of Object.entries(PERMISSION_CELL_STYLE)) {
    if (value.startsWith(prefix)) return style;
  }
  if (value.startsWith('View')) return 'bg-blue-50 text-blue-800 border-blue-200';
  if (value.startsWith('Edit') || value.startsWith('Full')) return 'bg-green-50 text-green-800 border-green-200';
  if (value.startsWith('Can')) return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-white text-gray-600 border-gray-200';
}

export function AccessSummaryClient({
  currentRole,
  currentDepartment,
}: {
  currentRole: UserRole;
  currentDepartment: string;
}) {
  const currentRoleLabel = ROLE_LABELS[currentRole];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-5 border-b border-gray-200">
        <h1 className="text-xl font-black text-gray-900">Access Summary</h1>
        <p className="text-xs text-gray-500 font-mono mt-0.5">
          Role-based permissions reference — what each user type can see and do
        </p>
      </div>

      {/* Current user role badge */}
      <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200">
        <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Your Role</span>
        <span className={cn(
          'text-[11px] font-mono font-bold px-2 py-0.5 border uppercase tracking-wide',
          currentRole === UserRole.SUPER_ADMIN ? 'bg-black text-white border-black' :
          currentRole === UserRole.ADMIN ? 'bg-gray-800 text-white border-gray-800' :
          'border-gray-300 text-gray-700'
        )}>
          {currentRoleLabel}
        </span>
        {currentRole === UserRole.DEPARTMENT_USER && currentDepartment && (
          <span className="text-[10px] font-mono text-gray-500">
            ({DEPARTMENT_LABELS[currentDepartment as Department] || currentDepartment})
          </span>
        )}
      </div>

      {/* Role overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {Object.values(UserRole).map((role) => (
          <div
            key={role}
            className={cn(
              'border p-4',
              currentRole === role
                ? 'border-black ring-1 ring-black'
                : 'border-gray-200'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0.5 border uppercase tracking-wide',
                role === UserRole.SUPER_ADMIN ? 'bg-black text-white border-black' :
                role === UserRole.ADMIN ? 'bg-gray-800 text-white border-gray-800' :
                'border-gray-300 text-gray-700'
              )}>
                {ROLE_LABELS[role]}
              </span>
              {currentRole === role && (
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">(you)</span>
              )}
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>
        ))}
      </div>

      {/* Permissions table */}
      <div className="erp-table-wrap border border-gray-200">
        <table className="erp-table">
          <thead>
            <tr>
              <th className="w-48">Feature</th>
              <th>Description</th>
              <th className="w-48">Super Admin</th>
              <th className="w-48">Admin</th>
              <th className="w-48">Dept User</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((row) => (
              <tr key={row.feature}>
                <td>
                  <p className="font-medium text-gray-900 text-xs">{row.feature}</p>
                </td>
                <td>
                  <p className="text-[10px] text-gray-500 font-mono leading-relaxed">{row.description}</p>
                </td>
                {(['superAdmin', 'admin', 'deptUser'] as const).map((key) => (
                  <td key={key}>
                    <span className={cn(
                      'inline-block text-[10px] font-mono font-medium px-2 py-1 border leading-tight',
                      getCellStyle(row[key])
                    )}>
                      {row[key]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6">
        <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Legend</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-50 border border-green-200" />
          <span className="text-[10px] font-mono text-gray-600">Full / Edit access</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-50 border border-blue-200" />
          <span className="text-[10px] font-mono text-gray-600">View only</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-amber-50 border border-amber-200" />
          <span className="text-[10px] font-mono text-gray-600">Conditional / Can</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-gray-100 border border-gray-200" />
          <span className="text-[10px] font-mono text-gray-400">No access</span>
        </div>
      </div>
    </div>
  );
}
