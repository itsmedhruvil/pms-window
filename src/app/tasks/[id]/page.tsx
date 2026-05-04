import { getCurrentUser } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TaskDetailClient } from './TaskDetailClient';
import { getAlerts, getTaskDetail, serialize } from '@/lib/server-data';
import { AlertStatus, UserRole } from '@/types';
import type { ITask } from '@/types';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const task = serialize(await getTaskDetail(params.id)) as unknown as ITask | null;
  if (!task) notFound();

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin && task.department !== user.department) notFound();

  const rawAlerts = await getAlerts({ isAdmin, department: user.department, limit: 100 });
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <TaskDetailClient
        initialTask={task}
        currentUser={{
          _id: user._id.toString(),
          name: user.name,
          department: user.department,
          role: user.role,
        }}
        canModify={isAdmin || task.department === user.department}
      />
    </AppLayout>
  );
}
