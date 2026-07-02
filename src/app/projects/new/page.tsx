import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { CreateProjectForm } from '@/components/forms/CreateProjectForm';
import { getAlerts } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin) redirect('/projects');

  const rawAlerts = await getAlerts({ isAdmin, limit: 100 });
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/projects"
            className="flex items-center gap-1 text-xs font-mono text-primary-500 hover:text-dark-500 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Projects
          </Link>
          <span className="text-primary-300">/</span>
          <span className="text-xs font-mono text-dark-500 font-bold">New Order</span>
        </div>

        <div className="mb-8 pb-4 border-b border-primary-200">
          <h1 className="text-xl font-black text-dark-500">Create Client Order</h1>
          <p className="text-xs text-primary-500 font-mono mt-1">
            A complete workflow will be auto-generated across all departments upon creation.
          </p>
        </div>

        <CreateProjectForm />
      </div>
    </AppLayout>
  );
}
