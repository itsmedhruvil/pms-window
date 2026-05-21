'use client';

import { AlertTriangle, TrendingUp, Clock, Layers, Zap, CheckCircle2, Ban, PlayCircle } from 'lucide-react';
import { cn, getDepartmentLabel, ALERT_TYPE_LABEL } from '@/lib/utils';
import { Department, AlertType, TaskStatus } from '@/types';
import { useMemo } from 'react';

interface DashboardMetricsData {
  metrics: {
    totalActiveProjects: number;
    projectsOnHold: number;
    projectsCompleted: number;
    projectsDispatched: number;
    overdueProjects: number;
    taskCompletionRate: Record<Department, number>;
    avgTaskCompletionTime: number;
    alertFrequency: Record<AlertType, number>;
    bottleneckDepartment: Department | null;
    activeAlertCount: number;
  };
  charts: {
    tasksByDepartment: Array<{
      department: string;
      total: number;
      done: number;
      inProgress: number;
      blocked: number;
      todo: number;
      completionRate: number;
    }>;
    completionTrend: Array<{ date: string; completed: number; created: number }>;
    avgCompletionByDept: Record<string, number>;
  };
}

export function DashboardMetrics({ data }: { data: DashboardMetricsData }) {
  const { metrics, charts } = data;

  // Find max completion for scaling bars
  const maxCompletion = useMemo(() =>
    Math.max(...charts.tasksByDepartment.map(d => d.total), 1),
  [charts.tasksByDepartment]);

  // Trend: find max daily completed for scaling
  const maxTrendCompleted = useMemo(() =>
    Math.max(...charts.completionTrend.map(d => d.completed), 1),
  [charts.completionTrend]);

  // Top 3 alert types
  const topAlerts = useMemo(() =>
    Object.entries(metrics.alertFrequency)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3),
  [metrics.alertFrequency]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Active Projects"
          value={metrics.totalActiveProjects}
          icon={<Layers className="w-4 h-4" />}
          variant="default"
        />
        <MetricCard
          label="On Hold"
          value={metrics.projectsOnHold}
          icon={<AlertTriangle className="w-4 h-4" />}
          variant={metrics.projectsOnHold > 0 ? 'alert' : 'default'}
          subtext={metrics.activeAlertCount > 0 ? `${metrics.activeAlertCount} active alerts` : undefined}
        />
        <MetricCard
          label="Overdue"
          value={metrics.overdueProjects}
          icon={<Clock className="w-4 h-4" />}
          variant={metrics.overdueProjects > 0 ? 'alert' : 'default'}
        />
        <MetricCard
          label="Avg Completion"
          value={`${metrics.avgTaskCompletionTime}h`}
          icon={<TrendingUp className="w-4 h-4" />}
          variant="default"
          subtext="per task"
        />
      </div>

      {/* Bottleneck Banner */}
      {metrics.bottleneckDepartment && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-3 animate-pulse">
          <Zap className="w-4 h-4 text-red-600 flex-shrink-0" />
          <div>
            <span className="text-xs font-mono font-bold text-red-700 uppercase tracking-wide">
              Bottleneck Detected:
            </span>
            <span className="text-xs text-red-700 ml-2">
              {getDepartmentLabel(metrics.bottleneckDepartment)} department has the most blocked tasks
              with the lowest completion rate.
            </span>
          </div>
        </div>
      )}

      {/* Task Breakdown — CSS Bar Chart */}
      <div className="border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 font-mono">Tasks by Department</h3>
            <p className="text-[11px] text-gray-500 font-mono">Breakdown by status</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-black" /> Done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> Active</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Blocked</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" /> Todo</span>
          </div>
        </div>
        <div className="space-y-3">
          {charts.tasksByDepartment.map(({ department: dept, done, inProgress, blocked, todo, total }) => {
            const donePct = total > 0 ? (done / total) * 100 : 0;
            const inProgPct = total > 0 ? (inProgress / total) * 100 : 0;
            const blockedPct = total > 0 ? (blocked / total) * 100 : 0;
            const todoPct = total > 0 ? (todo / total) * 100 : 0;

            return (
              <div key={dept} className="group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-medium text-gray-700 uppercase tracking-wide">
                    {getDepartmentLabel(dept)}
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    {done}/{total} <span className="text-gray-300">done</span>
                  </span>
                </div>
                {/* Stacked bar */}
                <div className="h-6 bg-gray-100 overflow-hidden flex transition-all group-hover:shadow-sm">
                  {todoPct > 0 && (
                    <div
                      className="h-full bg-gray-200 transition-all duration-500"
                      style={{ width: `${todoPct}%` }}
                      title={`Todo: ${todo}`}
                    />
                  )}
                  {inProgPct > 0 && (
                    <div
                      className="h-full bg-gray-400 transition-all duration-500"
                      style={{ width: `${inProgPct}%` }}
                      title={`In Progress: ${inProgress}`}
                    />
                  )}
                  {blockedPct > 0 && (
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${blockedPct}%` }}
                      title={`Blocked: ${blocked}`}
                    />
                  )}
                  {donePct > 0 && (
                    <div
                      className="h-full bg-black transition-all duration-500"
                      style={{ width: `${donePct}%` }}
                      title={`Done: ${done}`}
                    />
                  )}
                </div>
                {/* Mini counts */}
                <div className="flex gap-3 mt-1 text-[9px] font-mono text-gray-400">
                  {blocked > 0 && <span className="text-red-500">{blocked} blocked</span>}
                  {inProgress > 0 && <span className="text-gray-500">{inProgress} active</span>}
                  {todo > 0 && <span>{todo} pending</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Trend — CSS Calendar Heatmap */}
      <div className="border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 font-mono">Completion Trend</h3>
            <p className="text-[11px] text-gray-500 font-mono">Last 14 days — darker = more completions</p>
          </div>
        </div>
        <div className="grid grid-cols-14 gap-1.5">
          {charts.completionTrend.map((day, i) => {
            const intensity = maxTrendCompleted > 0 ? day.completed / maxTrendCompleted : 0;
            const dayName = new Date(day.date).toLocaleDateString('en', { weekday: 'short' });
            const dayNum = new Date(day.date).getDate();

            return (
              <div key={i} className="flex flex-col items-center gap-1 group">
                <div
                  className={cn(
                    'w-full aspect-square flex items-center justify-center text-[9px] font-mono font-bold transition-all duration-300 group-hover:scale-110',
                    intensity === 0 ? 'bg-gray-100 text-gray-300' :
                    intensity < 0.25 ? 'bg-gray-300 text-gray-500' :
                    intensity < 0.5 ? 'bg-gray-500 text-white' :
                    intensity < 0.75 ? 'bg-gray-700 text-white' :
                    'bg-black text-white'
                  )}
                >
                  {day.completed > 0 ? day.completed : ''}
                </div>
                <span className="text-[8px] font-mono text-gray-400">{dayName}</span>
                <span className="text-[8px] font-mono text-gray-300">{dayNum}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Department Completion Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {charts.tasksByDepartment.map(({ department: dept }) => {
          const rate = metrics.taskCompletionRate[dept] || 0;
          return (
            <div key={dept} className="border border-gray-200 p-4 hover:border-gray-400 transition-colors group">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">
                {getDepartmentLabel(dept)}
              </p>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-2xl font-black font-mono text-gray-900 group-hover:text-black transition-colors">
                  {rate}%
                </span>
                <span className="text-xs text-gray-500 mb-0.5">complete</span>
              </div>
              <div className="h-2 bg-gray-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-700 ease-out',
                    rate === 100 ? 'bg-green-600' : rate > 60 ? 'bg-black' : rate > 30 ? 'bg-gray-500' : 'bg-red-500'
                  )}
                  style={{ width: `${rate}%` }}
                />
              </div>
              {/* Sparkline dots */}
              <div className="flex gap-1 mt-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      rate / 100 > (i + 1) / 5 ? 'bg-black' : 'bg-gray-200'
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Frequency */}
      <div className="border border-gray-200 p-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500 mb-3">
          Alert Frequency by Type
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.values(AlertType).map((type) => {
            const count = metrics.alertFrequency[type] || 0;
            return (
              <div key={type} className={cn(
                'p-3 border transition-colors',
                count > 0
                  ? 'border-red-200 bg-red-50/50 hover:border-red-400'
                  : 'border-gray-100 hover:border-gray-300'
              )}>
                <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">
                  {ALERT_TYPE_LABEL[type]}
                </p>
                <p className={cn(
                  'text-xl font-black font-mono',
                  count > 0 ? 'text-red-600' : 'text-gray-300'
                )}>
                  {count}
                </p>
                {/* Alert bar */}
                <div className="h-1 bg-gray-100 mt-2 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      count > 0 ? 'bg-red-500' : 'bg-transparent'
                    )}
                    style={{ width: `${Math.min(count * 10, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Top alert types summary */}
        {topAlerts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-[10px] font-mono text-gray-500">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            Most frequent: {topAlerts.map(([type, count]) =>
              `${ALERT_TYPE_LABEL[type as AlertType]} (${count})`
            ).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  variant,
  subtext,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant: 'default' | 'alert';
  subtext?: string;
}) {
  return (
    <div className={cn(
      'border p-4 transition-colors',
      variant === 'alert' && (typeof value === 'number' ? value > 0 : true)
        ? 'border-red-300 bg-red-50 hover:bg-red-100'
        : 'border-gray-200 bg-white hover:border-gray-400'
    )}>
      <div className={cn(
        'flex items-center gap-2 mb-2',
        variant === 'alert' && (typeof value === 'number' ? value > 0 : true)
          ? 'text-red-600'
          : 'text-gray-500'
      )}>
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <p className={cn(
        'text-3xl font-black font-mono',
        variant === 'alert' && (typeof value === 'number' ? value > 0 : true)
          ? 'text-red-700'
          : 'text-gray-900'
      )}>
        {value}
      </p>
      {subtext && (
        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{subtext}</p>
      )}
    </div>
  );
}