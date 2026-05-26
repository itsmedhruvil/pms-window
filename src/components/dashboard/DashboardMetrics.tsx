'use client';

import { AlertTriangle, TrendingUp, Clock, Layers, Zap, CheckCircle2, Ban, PlayCircle, Calendar as CalendarIcon } from 'lucide-react';
import { cn, getDepartmentLabel, ALERT_TYPE_LABEL } from '@/lib/utils';
import { Department, AlertType } from '@/types';
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

  const maxTrendCompleted = useMemo(() =>
    Math.max(...charts.completionTrend.map(d => d.completed), 1),
  [charts.completionTrend]);

  const topAlerts = useMemo(() =>
    Object.entries(metrics.alertFrequency)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3),
  [metrics.alertFrequency]);

  const now = new Date();
  const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build calendar grid
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const calendarDays: Array<{ day: number; completed?: number; isToday: boolean }> = [];

  // Pad start
  for (let i = 0; i < startPad; i++) {
    calendarDays.push({ day: 0, isToday: false });
  }

  // Build trend map
  const trendMap: Record<string, number> = {};
  charts.completionTrend.forEach(d => {
    const key = d.date.slice(8); // "YYYY-MM-DD" -> "DD"
    trendMap[String(Number(key))] = d.completed;
  });

  for (let d = 1; d <= totalDays; d++) {
    calendarDays.push({
      day: d,
      completed: trendMap[String(d)],
      isToday: d === now.getDate(),
    });
  }

  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Departments sorted by completion rate
  const sortedDepts = [...charts.tasksByDepartment].sort(
    (a, b) => (metrics.taskCompletionRate[b.department] || 0) - (metrics.taskCompletionRate[a.department] || 0)
  );

  return (
    <div className="space-y-6">
      {/* KPI Row — 4 compact cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
            <Layers className="w-3 h-3" />
            <span className="text-[9px] font-mono uppercase tracking-widest">Active</span>
          </div>
          <p className="text-2xl font-black font-mono text-gray-900">{metrics.totalActiveProjects}</p>
        </div>
        <div className="border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3 h-3 text-red-500" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-red-600">Overdue</span>
          </div>
          <p className="text-2xl font-black font-mono text-red-600">{metrics.overdueProjects}</p>
        </div>
        <div className="border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
            <TrendingUp className="w-3 h-3" />
            <span className="text-[9px] font-mono uppercase tracking-widest">Avg Time</span>
          </div>
          <p className="text-2xl font-black font-mono text-gray-900">{metrics.avgTaskCompletionTime}<span className="text-sm text-gray-400">h</span></p>
        </div>
        <div className={cn(
          'border p-3',
          metrics.activeAlertCount > 0 ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
        )}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className={cn('w-3 h-3', metrics.activeAlertCount > 0 ? 'text-red-500' : 'text-gray-300')} />
            <span className={cn('text-[9px] font-mono uppercase tracking-widest', metrics.activeAlertCount > 0 ? 'text-red-600' : 'text-gray-400')}>Alerts</span>
          </div>
          <p className={cn('text-2xl font-black font-mono', metrics.activeAlertCount > 0 ? 'text-red-600' : 'text-gray-300')}>
            {metrics.activeAlertCount}
          </p>
        </div>
      </div>

      {/* Bottleneck */}
      {metrics.bottleneckDepartment && (
        <div className="border border-red-300 bg-red-50 px-3 py-2 flex items-center gap-2">
          <Zap className="w-3 h-3 text-red-600 flex-shrink-0" />
          <span className="text-[10px] font-mono text-red-700">
            Bottleneck: <strong>{getDepartmentLabel(metrics.bottleneckDepartment)}</strong> — lowest completion rate
          </span>
        </div>
      )}

      {/* Main Grid: Calendar LEFT | Departments RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Calendar — takes 3 cols */}
        <div className="lg:col-span-3 border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-gray-700">{currentMonth}</span>
            <span className="text-[10px] font-mono text-gray-400 ml-auto">Darker = more completions</span>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-[8px] font-mono text-gray-400 text-center py-1 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-100">
            {calendarDays.map((day, i) => {
              if (day.day === 0) {
                return <div key={`pad-${i}`} className="bg-gray-50 min-h-[48px]" />;
              }
              const intensity = day.completed && maxTrendCompleted > 0 ? day.completed / maxTrendCompleted : 0;

              return (
                <div
                  key={day.day}
                  className={cn(
                    'min-h-[48px] p-1 flex flex-col items-center justify-center transition-all',
                    day.isToday ? 'ring-2 ring-black ring-inset bg-white' : 'bg-white'
                  )}
                >
                  <span className={cn(
                    'text-[10px] font-mono',
                    day.isToday ? 'font-black text-black' : 'text-gray-700'
                  )}>
                    {day.day}
                  </span>
                  {day.completed !== undefined && day.completed > 0 && (
                    <div className={cn(
                      'w-full mt-0.5 rounded-sm h-1',
                      intensity < 0.25 ? 'bg-gray-200' :
                      intensity < 0.5 ? 'bg-gray-400' :
                      intensity < 0.75 ? 'bg-gray-600' :
                      'bg-black'
                    )} />
                  )}
                  {day.completed !== undefined && day.completed > 0 && (
                    <span className="text-[7px] font-mono text-gray-400 mt-0.5">{day.completed}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 text-[8px] font-mono text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-200 rounded-sm" /> Light</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-400 rounded-sm" /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-600 rounded-sm" /> Heavy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-black rounded-sm" /> Most</span>
            <span className="ml-auto">{charts.completionTrend.reduce((s, d) => s + d.completed, 0)} tasks done this month</span>
          </div>
        </div>

        {/* Departments + Alerts — takes 2 cols */}
        <div className="lg:col-span-2 space-y-3">
          {/* Department completion */}
          <div className="border border-gray-200 p-3">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-2">
              Department Progress
            </h3>
            <div className="space-y-2">
              {sortedDepts.slice(0, 5).map(({ department: dept }) => {
                const rate = metrics.taskCompletionRate[dept] || 0;
                return (
                  <div key={dept}>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                      <span className="text-gray-700 truncate">{getDepartmentLabel(dept)}</span>
                      <span className={cn('font-bold', rate === 100 ? 'text-green-600' : rate < 30 ? 'text-red-500' : 'text-gray-900')}>
                        {rate}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 overflow-hidden">
                      <div
                        className={cn('h-full transition-all', rate === 100 ? 'bg-green-500' : rate < 30 ? 'bg-red-500' : 'bg-black')}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {sortedDepts.length > 5 && (
                <p className="text-[9px] font-mono text-gray-400">+{sortedDepts.length - 5} more departments</p>
              )}
            </div>
          </div>

          {/* Alert types mini */}
          <div className="border border-gray-200 p-3">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-2">
              Alerts by Type
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.values(AlertType).map((type) => {
                const count = metrics.alertFrequency[type] || 0;
                return (
                  <div key={type} className={cn(
                    'p-2 border text-center',
                    count > 0 ? 'border-red-200 bg-red-50/50' : 'border-gray-100'
                  )}>
                    <p className="text-[8px] font-mono text-gray-500 uppercase truncate">{ALERT_TYPE_LABEL[type]}</p>
                    <p className={cn('text-sm font-black font-mono', count > 0 ? 'text-red-600' : 'text-gray-300')}>{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Task breakdown bars */}
      <div className="border border-gray-200 p-3">
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
          {charts.tasksByDepartment.map(({ department: dept, done, inProgress, blocked, total }) => {
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
    </div>
  );
}