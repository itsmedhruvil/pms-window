import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProjectsPageClient } from '@/components/projects/ProjectsPageClient';
import { getProjects, getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import type { IProject } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const params = await searchParams;
  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const initialTab = params.tab === 'previous' ? 'previous' : 'active';

  const [{ items: rawProjects }, rawAlerts] = await Promise.all([
    getProjects({ isAdmin, userId: user._id.toString(), limit: 100 }),
    getAlerts({ isAdmin, department: user.department, limit: 100 }),
  ]);

  const projects = serialize(rawProjects) as unknown as IProject[];
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <ProjectsPageClient
      projects={projects}
      activeAlertCount={activeAlertCount}
      isAdmin={isAdmin}
      initialTab={initialTab}
    />
  );
}