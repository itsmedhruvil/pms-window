import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TasksClient } from '../../TasksClient';
import { getAlerts, getTasks, getProjects, serialize } from '@/lib/server-data';
import { AlertStatus, Department, UserRole } from '@/types';
import type { ITask, IProject } from '@/types';
import { getActiveDepartmentNames } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export default async function DepartmentTasksPage(
  props: { params: Promise<{ department: string }> }
) {
  const params = await props.params;
  const department = params.department as Department;
  const activeDepartments = await getActiveDepartmentNames();
  if (!activeDepartments.includes(department)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin && user.department !== department) {
    redirect(`/tasks/departments/${user.department}`);
  }

  const [rawTasks, rawAlerts, rawProjects] = await Promise.all([
    getTasks({
      isAdmin,
      department,
      assignedUserId: user._id.toString(),
      limit: 300,
    }),
    getAlerts({ isAdmin, department: user.department, limit: 100 }),
    getProjects({
      isAdmin,
      userId: user._id.toString(),
      limit: 200,
    }),
  ]);

  const tasks = serialize(rawTasks) as unknown as ITask[];
  const projectsResult = serialize(rawProjects) as unknown as {
    items: IProject[];
    total: number;
  };
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <TasksClient
        initialTasks={tasks}
        isAdmin={isAdmin}
        selectedDepartment={department}
        allProjects={projectsResult.items}
      />
    </AppLayout>
  );
}
