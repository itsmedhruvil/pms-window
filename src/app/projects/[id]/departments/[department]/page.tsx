import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TasksClient } from '@/app/tasks/TasksClient';
import { getProjectDetail, getAlerts, getProjects, serialize } from '@/lib/server-data';
import { AlertStatus, Department, UserRole } from '@/types';
import type { ITask, IProject } from '@/types';
import { getActiveDepartmentNames, formatDepartmentName } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export default async function ProjectDepartmentTasksPage(
  props: { params: Promise<{ id: string; department: string }> }
) {
  const params = await props.params;
  const { id: projectId, department: departmentSlug } = params;

  const department = departmentSlug as Department;
  const activeDepartments = await getActiveDepartmentNames();
  if (!activeDepartments.includes(department)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin && user.department !== department) {
    redirect(`/projects/${projectId}/departments/${user.department}`);
  }

  const [detail, rawProjects] = await Promise.all([
    getProjectDetail(projectId),
    getProjects({
      isAdmin,
      userId: user._id.toString(),
      limit: 200,
    }),
  ]);
  if (!detail) notFound();

  const { project, tasks: allTasks } = detail;

  // Filter tasks by department — pending-first so huge Done history
  // doesn't bloat initial load. Client lazy-loads Done via /api/tasks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deptTasks = (allTasks as any[]).filter((t: any) => t.department === department);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingDept = deptTasks.filter((t: any) => t.status !== 'done');
  const firstPage = pendingDept.slice(0, 50);
  const serializedTasks = serialize(firstPage) as unknown as ITask[];
  const pendingCount = pendingDept.length;
  const doneCount = deptTasks.length - pendingCount;
  const projectsResult = serialize(rawProjects) as unknown as {
    items: IProject[];
    total: number;
  };

  const rawAlerts = await getAlerts({ isAdmin, department: user.department, limit: 100 });
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <div className="min-h-screen bg-primary-50">
        {/* Breadcrumb header */}
        <div className="bg-white border-b border-primary-200 px-6 py-4">
          <div className="flex items-center gap-2 text-xs font-mono text-primary-400 mb-1">
            <Link href="/projects" className="hover:text-dark-500 transition-colors">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-dark-500 transition-colors truncate max-w-[200px]">{project.projectTitle}</Link>
            <span>/</span>
            <span className="text-dark-600 font-bold uppercase">{department}</span>
          </div>
          <h1 className="text-xl font-black text-dark-500 tracking-tight">
            {project.projectTitle} — {formatDepartmentName(department)} Tasks
          </h1>
          <p className="text-xs text-primary-500 font-mono mt-0.5">
            {pendingCount} pending · {doneCount} done in this department
          </p>
        </div>

        <div className="p-6">
          <TasksClient
            initialTasks={serializedTasks}
            isAdmin={isAdmin}
            selectedDepartment={department}
            allProjects={projectsResult.items}
            initialProjectFilter={projectId}
            initialPendingCount={pendingCount}
            initialDoneCount={doneCount}
            initialTotalCount={deptTasks.length}
            fetchScope={`projectId=${encodeURIComponent(projectId)}&department=${encodeURIComponent(department)}`}
          />
        </div>
      </div>
    </AppLayout>
  );
}
