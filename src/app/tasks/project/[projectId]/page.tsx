import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TasksClient } from '../../TasksClient';
import { getTasks, getTaskCounts, getAlerts, getProjects, serialize } from '@/lib/server-data';
import { AlertStatus, UserRole, STAGE_SEQUENCE, formatStageName } from '@/types';
import type { ITask, IProject } from '@/types';

export const dynamic = 'force-dynamic';

const FIRST_PAGE_SIZE = 50;

export default async function ProjectTasksPage(
  props: { params: Promise<{ projectId: string }>; searchParams: Promise<{ stage?: string }> }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const requestedStage = searchParams.stage;
  const stage = requestedStage && (
    requestedStage === 'uncategorized' ||
    STAGE_SEQUENCE.includes(requestedStage as (typeof STAGE_SEQUENCE)[number])
  ) ? requestedStage : undefined;
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

  const scope = {
    isAdmin,
    department: isAdmin ? undefined : user.department,
    projectId: params.projectId,
    assignedUserId: user._id.toString(),
    stage,
  };
  const [rawTasks, counts, rawAlerts, rawProjects] = await Promise.all([
    getTasks({ ...scope, page: 1, pageSize: FIRST_PAGE_SIZE }),
    getTaskCounts(scope),
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
        pageTitle={`${currentProject.projectTitle} — ${stage ? `${formatStageName(stage)} Tasks` : 'Tasks'}`}
        showDepartmentColumn
        initialPendingCount={counts.pending}
        initialDoneCount={counts.done}
        initialTotalCount={counts.total}
        fetchScope={`projectId=${encodeURIComponent(params.projectId)}${stage ? `&stage=${encodeURIComponent(stage)}` : ''}`}
        initialStageFilter={stage}
      />
    </AppLayout>
  );
}
