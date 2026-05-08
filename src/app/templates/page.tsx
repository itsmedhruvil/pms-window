import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { TemplateGroupsClient } from '../template-groups/TemplateGroupsClient';
import { getAlerts, serialize } from '@/lib/server-data';
import { UserRole, AlertStatus } from '@/types';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin) redirect('/projects');

  const rawAlerts = await getAlerts({ isAdmin, department: user.department, limit: 100 });
  const activeAlertCount = rawAlerts.filter(
    (a: { status: string }) => a.status === AlertStatus.ACTIVE
  ).length;

  return (
    <AppLayout activeAlertCount={activeAlertCount}>
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Templates</h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5">Manage task templates and template groups</p>
            </div>
          </div>
        </div>
        
        <TemplateGroupsClient />
      </div>
    </AppLayout>
  );
}