import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { UsersClient } from './UsersClient';
import { getUsers, getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import type { IUser } from '@/types';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin) redirect('/dashboard');

  const [rawUsers, rawAlerts] = await Promise.all([
    getUsers(),
    getAlerts({ isAdmin, limit: 100 }),
  ]);

  const users = serialize(rawUsers) as unknown as IUser[];
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <UsersClient
        initialUsers={users}
        currentUserId={user._id.toString()}
        isSuperAdmin={user.role === UserRole.SUPER_ADMIN}
      />
    </AppLayout>
  );
}
