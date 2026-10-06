import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { SettingsClient } from './SettingsClient';
import { getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus, FactoryGroup } from '@/types';
import connectDB from '@/lib/db';
import DepartmentModel from '@/models/Department';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin) redirect('/dashboard');

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;

  await connectDB();
  const [rawDepartments, rawAlerts] = await Promise.all([
    DepartmentModel.find().select('-__v').sort({ sequence: 1 }).lean(),
    getAlerts({ isAdmin: true, limit: 100 }),
  ]);

  const departments = serialize(rawDepartments);
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <SettingsClient
        canManage={isSuperAdmin}
        initialDepartments={departments as unknown as Array<{
          _id: string;
          name: string;
          label: string;
          abbreviation: string;
          sequence: number;
          description: string;
          isActive: boolean;
          factoryGroup: FactoryGroup;
        }>}
      />
    </AppLayout>
  );
}