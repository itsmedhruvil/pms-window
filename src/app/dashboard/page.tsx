import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { getDashboardData } from '@/lib/server-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    data = await getDashboardData();
  } catch {
    // data stays null — shown as empty state below
  }

  return (
    <AppLayout activeAlertCount={data?.metrics?.activeAlertCount ?? 0}>
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Operations Dashboard</h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5">Real-time manufacturing workflow overview</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-mono">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">Welcome, {user.name}</p>
            </div>
          </div>
        </div>

        {data ? (
          <DashboardMetrics data={data} />
        ) : (
          <div className="border border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-500 font-mono">No data available yet.</p>
            <p className="text-xs text-gray-400 font-mono mt-1">Create your first project to see metrics here.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
