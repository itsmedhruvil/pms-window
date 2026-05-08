import { getCurrentUser } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { WindowDetail } from '@/components/project/WindowDetail';
import { getProjectDetail, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import type { IProject, ITask, IAlert } from '@/types';

export const dynamic = 'force-dynamic';

export default async function WindowDetailPage(props: {
  params: Promise<{ id: string; windowId: string }>
}) {
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

  const windowIndex = parseInt(params.windowId) - 1;
  if (windowIndex < 0 || windowIndex >= data.project.windowSpecifications.length) {
    notFound();
  }

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const activeAlertCount = data.alerts.filter((a) => a.status === AlertStatus.ACTIVE).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <WindowDetail
        project={data.project as IProject}
        tasks={data.tasks as ITask[]}
        windowIndex={windowIndex}
        isAdmin={isAdmin}
      />
    </AppLayout>
  );
}