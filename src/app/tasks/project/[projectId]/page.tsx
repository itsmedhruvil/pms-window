import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TasksClient } from '../../TasksClient';
import { getTasks, getAlerts, getProjects, serialize } from '@/lib/server-data';
import { AlertStatus, UserRole } from '@/types';
import type { ITask, IProject } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ProjectTasksPage(
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

  const [rawTasks, rawAlerts, rawProjects] = await Promise.all([
    getTasks({
      isAdmin,
      projectId: params.projectId,
      assignedUserId: user._id.toString(),
      limit: 500,
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

  const currentProject = projectsResult.items.find(
    (p: IProject) => p._id === params.projectId
  );

  if (!currentProject) notFound();

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <TasksClient
        initialTasks={tasks}
        isAdmin={isAdmin}
        allProjects={projectsResult.items}
        initialProjectFilter={params.projectId}
        pageTitle={`${currentProject.projectTitle} — Tasks`}
        showDepartmentColumn
      />
    </AppLayout>
  );
}