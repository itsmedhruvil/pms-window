import { getCurrentUser } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectDetail } from '@/components/project/ProjectDetail';
import { getProjectDetail, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import type { IProject, ITask, IAlert } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const raw = await getProjectDetail(params.id);
  if (!raw) notFound();

  // Serialize BSON → plain JSON before passing to Client Component
  const data = serialize(raw) as unknown as {
    project: IProject;
    tasks: ITask[];
    alerts: IAlert[];
  };

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const visibleTasks = isAdmin
    ? data.tasks
    : data.tasks.filter((task) => task.department === user.department);
  const visibleAlerts = isAdmin
    ? data.alerts
    : data.alerts.filter((alert) => alert.affectedDepartments.includes(user.department));
  const activeAlertCount = visibleAlerts.filter((a) => a.status === AlertStatus.ACTIVE).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <ProjectDetail
        project={data.project as IProject}
        tasks={visibleTasks as ITask[]}
        alerts={visibleAlerts as IAlert[]}
        isAdmin={isAdmin}
        currentUserDepartment={user.department}
      />
    </AppLayout>
  );
}
