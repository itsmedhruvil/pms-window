import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { AlertsClient } from './AlertsClient';
import { getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import type { IAlert } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

  const rawAlerts = await getAlerts({
    isAdmin,
    department: user.department,
    limit: 100,
  });

  const alerts = serialize(rawAlerts) as unknown as IAlert[];
  const activeCount = alerts.filter((a) => a.status === AlertStatus.ACTIVE).length;

  return (
    <AppLayout activeAlertCount={activeCount}>
      <AlertsClient
        initialAlerts={alerts}
        isAdmin={isAdmin}
        currentUserId={user._id.toString()}
        currentUserDept={user.department}
      />
    </AppLayout>
  );
}
