import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TaskTemplatesClient } from './TaskTemplatesClient';
import { getTaskTemplates, getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import type { ITaskTemplate } from '@/types';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin) redirect('/projects');

  const [rawTemplates, rawAlerts] = await Promise.all([
    getTaskTemplates(),
    getAlerts({ isAdmin, department: user.department, limit: 100 }),
  ]);

  const templates = serialize(rawTemplates) as unknown as ITaskTemplate[];
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <TaskTemplatesClient initialTemplates={templates} />
    </AppLayout>
  );
}
