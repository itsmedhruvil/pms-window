import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { InternalTasksPageClient } from '@/components/tasks/InternalTasksPageClient';
import { getTasks, getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus, TaskStatus } from '@/types';
import type { ITask, IAlert } from '@/types';

export const dynamic = 'force-dynamic';

export default async function InternalTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

  const [rawTasks, rawAlerts] = await Promise.all([
    getTasks({
      isAdmin,
      assignedUserId: user._id.toString(),
      department: user.department,
      status: TaskStatus.TODO,
      // Only show internal tasks (not project tasks)
      projectId: null,
      limit: 100,
    }),
    getAlerts({ isAdmin, department: user.department, limit: 100 }),
  ]);

  const tasks = serialize(rawTasks) as unknown as ITask[];
  const alerts = serialize(rawAlerts) as unknown as IAlert[];
  const activeAlertCount = alerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <InternalTasksPageClient
      tasks={tasks}
      activeAlertCount={activeAlertCount}
      isAdmin={isAdmin}
      userDepartment={user.department}
    />
  );
}