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

  // Filter tasks by department
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deptTasks = allTasks.filter((t: any) => t.department === department);
  const serializedTasks = serialize(deptTasks) as unknown as ITask[];
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
      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mb-1">
            <Link href="/projects" className="hover:text-black transition-colors">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-black transition-colors truncate max-w-[200px]">{project.projectTitle}</Link>
            <span>/</span>
            <span className="text-gray-700 font-bold uppercase">{department}</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">
            {project.projectTitle} — {formatDepartmentName(department)} Tasks
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {deptTasks.length} task{deptTasks.length === 1 ? '' : 's'} in this department
          </p>
        </div>

        <div className="p-6">
          <TasksClient
            initialTasks={serializedTasks}
            isAdmin={isAdmin}
            selectedDepartment={department}
            allProjects={projectsResult.items}
            initialProjectFilter={projectId}
          />
        </div>
      </div>
    </AppLayout>
  );
}
