import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { getAlerts } from '@/lib/server-data';
import { AlertStatus, UserRole } from '@/types';
import { AccessSummaryClient } from './AccessSummaryClient';

export const dynamic = 'force-dynamic';

export default async function AccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const rawAlerts = await getAlerts({ isAdmin: true, limit: 100 });
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  const currentRole = user.role as UserRole;
  const currentDepartment = user.department as string;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <AccessSummaryClient
        currentRole={currentRole}
        currentDepartment={currentDepartment}
      />
    </AppLayout>
  );
}