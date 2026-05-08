import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TasksClient } from '../../TasksClient';
import { getAlerts, getTasks, serialize } from '@/lib/server-data';
import { AlertStatus, DEPARTMENT_SEQUENCE, Department, UserRole } from '@/types';
import type { ITask } from '@/types';

export const dynamic = 'force-dynamic';

export default async function DepartmentTasksPage(
  props: { params: Promise<{ department: string }> }
) {
  const params = await props.params;
  const department = params.department as Department;
  if (!DEPARTMENT_SEQUENCE.includes(department)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin && user.department !== department) {
    redirect(`/tasks/departments/${user.department}`);
  }

  const [rawTasks, rawAlerts] = await Promise.all([
    getTasks({
      isAdmin,
      department,
      assignedUserId: user._id.toString(),
      limit: 300,
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
        isAdmin={isAdmin}
        selectedDepartment={department}
      />
    </AppLayout>
  );
}
