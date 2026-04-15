'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AlertTriangle, TrendingUp, Clock, Layers, Zap } from 'lucide-react';
import { cn, DEPARTMENT_LABELS, ALERT_TYPE_LABEL } from '@/lib/utils';
import { Department, AlertType } from '@/types';

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

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-3">
          <Zap className="w-4 h-4 text-red-600 flex-shrink-0" />
          <div>
            <span className="text-xs font-mono font-bold text-red-700 uppercase tracking-wide">
              Bottleneck Detected:
            </span>
            <span className="text-xs text-red-700 ml-2">
              {DEPARTMENT_LABELS[metrics.bottleneckDepartment]} department has the most blocked tasks
              with the lowest completion rate.
            </span>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks per department */}
        <ChartCard title="Tasks by Department" subtitle="Breakdown by status">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.tasksByDepartment} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#666' }}
                tickFormatter={(v) => DEPARTMENT_LABELS[v as Department]?.split(' ')[0] || v}
              />
              <YAxis tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#666' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: 'monospace', border: '1px solid #e5e7eb', borderRadius: 0 }}
                formatter={(value, name) => [value, String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
              />
              <Bar dataKey="done" stackId="a" fill="#111" name="Done" />
              <Bar dataKey="inProgress" stackId="a" fill="#555" name="In Progress" />
              <Bar dataKey="todo" stackId="a" fill="#ddd" name="Todo" />
              <Bar dataKey="blocked" stackId="a" fill="#ef4444" name="Blocked" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Completion trend */}
        <ChartCard title="Completion Trend" subtitle="Last 14 days">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={charts.completionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#666' }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#666' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: 'monospace', border: '1px solid #e5e7eb', borderRadius: 0 }}
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#111"
                strokeWidth={2}
                dot={{ fill: '#111', r: 3 }}
                name="Completed"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Department completion rates */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.values(Department).map((dept) => {
          const rate = metrics.taskCompletionRate[dept] || 0;
          return (
            <div key={dept} className="border border-gray-200 p-3">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">
                {DEPARTMENT_LABELS[dept]}
              </p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-2xl font-black font-mono text-gray-900">{rate}%</span>
                <span className="text-xs text-gray-500 mb-0.5">complete</span>
              </div>
              <div className="h-1.5 bg-gray-100 w-full">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    rate === 100 ? 'bg-gray-900' : rate > 60 ? 'bg-gray-700' : rate > 30 ? 'bg-gray-500' : 'bg-red-500'
                  )}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert frequency */}
      <div className="border border-gray-200 p-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500 mb-3">
          Alert Frequency by Type
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.values(AlertType).map((type) => {
            const count = metrics.alertFrequency[type] || 0;
            return (
              <div key={type} className={cn(
                'p-3 border',
                count > 0 ? 'border-red-200 bg-red-50/50' : 'border-gray-100'
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
              </div>
            );
          })}
        </div>
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
      'border p-4',
      variant === 'alert' && (typeof value === 'number' ? value > 0 : true)
        ? 'border-red-300 bg-red-50'
        : 'border-gray-200 bg-white'
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

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 font-mono">{title}</h3>
        <p className="text-[11px] text-gray-500 font-mono">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
