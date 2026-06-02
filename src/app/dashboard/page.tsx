import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { DashboardAlertsPane } from '@/components/dashboard/DashboardAlertsPane';
import { getDashboardData, serialize } from '@/lib/server-data';
import { UserRole } from '@/types';
import { getDepartmentLabel } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    data = serialize(await getDashboardData());
  } catch {
    // data stays null — shown as empty state below
  }

  return (
    <AppLayout activeAlertCount={data?.metrics?.activeAlertCount ?? 0}>
      <div className="p-4 sm:p-6">
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                {isAdmin ? 'Operations Dashboard' : `${user.department.charAt(0).toUpperCase() + user.department.slice(1)} Dashboard`}
              </h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {isAdmin ? 'Real-time manufacturing workflow overview' : 'Your department task overview'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-mono">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">Welcome, {user.name}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main metrics */}
          <div className="xl:col-span-3">
            {data ? (
              <DashboardMetrics
                data={{ metrics: data.metrics, charts: data.charts }}
                overdueByDept={data.overdueByDept}
                currentDepartment={isAdmin ? undefined : user.department}
              />
            ) : (
              <div className="border border-gray-200 p-12 text-center">
                <p className="text-sm text-gray-500 font-mono">No data available yet.</p>
                <p className="text-xs text-gray-400 font-mono mt-1">Create your first project to see metrics here.</p>
              </div>
            )}
          </div>

          {/* Alerts & Notifications pane with department progress + alerts by type */}
          <div className="xl:col-span-1">
            <DashboardAlertsPane data={data} />
          </div>
        </div>

        {/* Tasks by Department — full-width */}
        {data && data.charts.tasksByDepartment.length > 0 && (
          <div className="mt-6 border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Tasks by Department</span>
              </div>
              <div className="flex items-center gap-2 text-[8px] font-mono">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-black" /> Done</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-400" /> Active</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500" /> Blocked</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {data.charts.tasksByDepartment.map(({ department: dept, done, inProgress, blocked, total }) => {
                const donePct = total > 0 ? (done / total) * 100 : 0;
                const inProgPct = total > 0 ? (inProgress / total) * 100 : 0;
                const blockedPct = total > 0 ? (blocked / total) * 100 : 0;

                return (
                  <div key={dept}>
                    <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
                      <span className="text-gray-600">{getDepartmentLabel(dept)}</span>
                      <span className="text-gray-400">{done}/{total}</span>
                    </div>
                    <div className="h-4 bg-gray-100 overflow-hidden flex">
                      {blockedPct > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${blockedPct}%` }} />}
                      {inProgPct > 0 && <div className="h-full bg-gray-400 transition-all" style={{ width: `${inProgPct}%` }} />}
                      {donePct > 0 && <div className="h-full bg-black transition-all" style={{ width: `${donePct}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
