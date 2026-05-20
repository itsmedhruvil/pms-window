import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { DepartmentsClient } from './DepartmentsClient';
import { getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import connectDB from '@/lib/db';
import DepartmentModel from '@/models/Department';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  if (!isSuperAdmin) redirect('/dashboard');

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
      <DepartmentsClient initialDepartments={departments as any} />
    </AppLayout>
  );
}