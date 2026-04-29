import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TasksClient } from './TasksClient';
import { getTasks, getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import type { ITask } from '@/types';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

  const [rawTasks, rawAlerts] = await Promise.all([
    getTasks({
      isAdmin,
      department: user.department,
      assignedUserId: user._id.toString(),
      limit: 200,
    }),
    getAlerts({ isAdmin, department: user.department, limit: 100 }),
  ]);

  const tasks = serialize(rawTasks) as unknown as ITask[];
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <TasksClient
        initialTasks={tasks}
        currentUser={{
          _id: user._id.toString(),
          name: user.name,
          department: user.department,
          role: user.role,
        }}
        isAdmin={isAdmin}
      />
    </AppLayout>
  );
}
