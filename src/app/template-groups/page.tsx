import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TemplateGroupsClient } from './TemplateGroupsClient';
import { getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';

export const dynamic = 'force-dynamic';

export default async function TemplateGroupsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin) redirect('/projects');

  const rawAlerts = await getAlerts({ isAdmin, department: user.department, limit: 100 });
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <TemplateGroupsClient />
    </AppLayout>
  );
}