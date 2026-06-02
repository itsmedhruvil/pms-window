'use client';

import { AlertTriangle, TrendingUp, Clock, Layers, Zap, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, getDepartmentLabel } from '@/lib/utils';
import { Department } from '@/types';
import { useMemo, useState } from 'react';

interface DashboardMetricsData {
  metrics: {
    totalActiveProjects: number;
    projectsOnHold: number;
    projectsCompleted: number;
    projectsDispatched: number;
    overdueProjects: number;
    taskCompletionRate: Record<Department, number>;
    avgTaskCompletionTime: number;
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

export function DashboardMetrics({
  data,
  overdueByDept = {},
  currentDepartment,
}: {
  data: DashboardMetricsData;
  overdueByDept?: Record<string, number>;
  currentDepartment?: string;
}) {
  const { metrics, charts } = data;

  const maxTrendCompleted = useMemo(() =>
    Math.max(...charts.completionTrend.map(d => d.completed), 1),
  [charts.completionTrend]);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const currentMonthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const goToCurrentMonth = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  // Build calendar grid for the viewed month
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const calendarDays: Array<{ day: number; completed?: number; isToday: boolean }> = [];

  // Pad start
  for (let i = 0; i < startPad; i++) {
    calendarDays.push({ day: 0, isToday: false });
  }

  // Build a trend map keyed by "YYYY-MM-DD" for quick lookup across months
  const trendMap: Record<string, number> = {};
  charts.completionTrend.forEach(d => {
    trendMap[d.date] = d.completed;
  });

  // Format: YYYY-MM-DD prefix for the viewed month
  const ymPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  for (let d = 1; d <= totalDays; d++) {
    const dateKey = `${ymPrefix}-${String(d).padStart(2, '0')}`;
    calendarDays.push({
      day: d,
      completed: trendMap[dateKey],
      isToday: viewYear === now.getFullYear() && viewMonth === now.getMonth() && d === now.getDate(),
    });
  }

  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

      {/* Overdue tasks by department */}
      {Object.keys(overdueByDept).length > 0 && (
        <div className="border border-red-200 bg-red-50/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-700">
              {currentDepartment ? 'Overdue Tasks' : 'Overdue Tasks by Department'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(overdueByDept)
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([dept, count]) => {
                const isCurrent = currentDepartment && currentDepartment === dept;
                return (
                  <div
                    key={dept}
                    className={cn(
                      'px-3 py-1.5 border flex items-center gap-2 text-[11px] font-mono',
                      isCurrent ? 'border-red-400 bg-red-100' : 'border-red-200 bg-white'
                    )}
                  >
                    <span className={isCurrent ? 'font-bold text-red-800' : 'text-gray-700'}>
                      {getDepartmentLabel(dept)}
                    </span>
                    <span className="text-red-600 font-bold">{count}</span>
                    <span className="text-[9px] text-red-500">overdue</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Full-width Calendar */}
      <div className="border border-gray-200 p-3">
        {/* Month navigation header */}
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="w-4 h-4 text-gray-500" />
          <button
            type="button"
            onClick={goToPrevMonth}
            className="p-1 hover:bg-gray-100 transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <button
            type="button"
            onClick={goToCurrentMonth}
            className="text-xs font-mono font-bold uppercase tracking-widest text-gray-700 hover:text-black transition-colors"
          >
            {currentMonthLabel}
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className="p-1 hover:bg-gray-100 transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
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
          <span className="ml-auto">
            {charts.completionTrend
              .filter(t => t.date.startsWith(ymPrefix))
              .reduce((s, d) => s + d.completed, 0)} tasks done this month
          </span>
        </div>
      </div>

    </div>
  );
}