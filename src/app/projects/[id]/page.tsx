import { getCurrentUser } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectDetail } from '@/components/project/ProjectDetail';
import { getProjectDetail, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import type { IProject, ITask, IAlert } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage(props: { params: any }) {
  const { params } = props;
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
  const activeAlertCount = data.alerts.filter((a) => a.status === AlertStatus.ACTIVE).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <ProjectDetail
        project={data.project as IProject}
        tasks={data.tasks as ITask[]}
        alerts={data.alerts as IAlert[]}
        currentUser={{
          _id: user._id.toString(),
          name: user.name,
          department: user.department,
          role: user.role,
        }}
        isAdmin={isAdmin}
      />
    </AppLayout>
  );
}
