import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { ProjectStatus, TaskStatus, AlertStatus } from '@/types';
import type { Department } from '@/types';
import { subDays } from 'date-fns';

export const GET = withAuth(async (_req: NextRequest) => {
  await connectDB();

  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);

  // Use a single $facet aggregation to get all stats in one query
  const [dashboardData] = await TaskModel.aggregate([
    {
      $facet: {
        // Task stats per department with completion rates
        tasksByDept: [
          {
            $group: {
              _id: { department: '$department', status: '$status' },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: '$_id.department',
              statuses: {
                $push: { status: '$_id.status', count: '$count' },
              },
              total: { $sum: '$count' },
            },
          },
        ],
        // Completion trend for last 30 days
        completionTrend: [
          {
            $match: {
              completedAt: { $gte: thirtyDaysAgo },
              status: TaskStatus.DONE,
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
              completed: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        // Avg completion time per department
        avgCompletionTimes: [
          {
            $match: {
              status: TaskStatus.DONE,
              startDate: { $exists: true, $ne: null },
              completedAt: { $exists: true, $ne: null },
            },
          },
          {
            $project: {
              department: 1,
              durationHours: {
                $divide: [
                  { $subtract: ['$completedAt', '$startDate'] },
                  1000 * 60 * 60,
                ],
              },
            },
          },
          {
            $group: {
              _id: '$department',
              avgHours: { $avg: '$durationHours' },
              totalCompleted: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  // Run project stats, alert stats, overdue projects, and active alerts in parallel
  const [projectStats, alertStats, overdueProjects, activeAlerts] = await Promise.all([
    ProjectModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AlertModel.aggregate([
      { $match: { status: { $ne: AlertStatus.RESOLVED } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    ProjectModel.countDocuments({
      deadline: { $lt: now },
      status: { $nin: [ProjectStatus.COMPLETED, ProjectStatus.DISPATCHED] as ProjectStatus[] },
    }),
    AlertModel.find({ status: AlertStatus.ACTIVE })
      .populate('projectId', 'projectTitle clientName')
      .populate('raisedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // Process project stats
  const projectStatusMap: Record<string, number> = {};
  projectStats.forEach((s: { _id: string; count: number }) => {
    projectStatusMap[s._id] = s.count;
  });

  const totalActiveProjects =
    (projectStatusMap[ProjectStatus.NEW] || 0) +
    (projectStatusMap[ProjectStatus.IN_PRODUCTION] || 0) +
    (projectStatusMap[ProjectStatus.ON_HOLD] || 0);

  // Process task completion rates
  const taskCompletionRate: Record<string, number> = {};
  const tasksByDeptFormatted: Array<{
    department: string;
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    todo: number;
    completionRate: number;
  }> = [];

  (dashboardData?.tasksByDept || []).forEach((dept: { _id: string; statuses: Array<{ status: string; count: number }>; total: number }) => {
    const statusMap: Record<string, number> = {};
    dept.statuses.forEach((s) => { statusMap[s.status] = s.count; });

    const done = statusMap[TaskStatus.DONE] || 0;
    const rate = dept.total > 0 ? Math.round((done / dept.total) * 100) : 0;

    taskCompletionRate[dept._id] = rate;
    tasksByDeptFormatted.push({
      department: dept._id,
      total: dept.total,
      done,
      inProgress: statusMap[TaskStatus.IN_PROGRESS] || 0,
      blocked: statusMap[TaskStatus.BLOCKED] || 0,
      todo: statusMap[TaskStatus.TODO] || 0,
      completionRate: rate,
    });
  });

  // Alert frequency
  const alertFrequency: Record<string, number> = {};
  alertStats.forEach((a: { _id: string; count: number }) => {
    alertFrequency[a._id] = a.count;
  });

  // Bottleneck detection
  let bottleneckDepartment: Department | null = null;
  let lowestRate = 101;
  tasksByDeptFormatted.forEach((dept) => {
    if (dept.blocked > 0 && dept.completionRate < lowestRate) {
      lowestRate = dept.completionRate;
      bottleneckDepartment = dept.department as Department;
    }
  });

  // Avg completion time
  let globalAvgHours = 0;
  let deptCount = 0;
  const avgCompletionByDept: Record<string, number> = {};
  (dashboardData?.avgCompletionTimes || []).forEach((d: { _id: string; avgHours: number }) => {
    avgCompletionByDept[d._id] = Math.round(d.avgHours * 10) / 10;
    globalAvgHours += d.avgHours;
    deptCount++;
  });
  const avgTaskCompletionTime = deptCount > 0 ? Math.round(globalAvgHours / deptCount) : 0;

  // Fill completion trend for last 14 days
  const trendMap: Record<string, number> = {};
  (dashboardData?.completionTrend || []).forEach((t: { _id: string; completed: number }) => {
    trendMap[t._id] = t.completed;
  });

  const trend = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(now, 13 - i).toISOString().split('T')[0];
    return { date, completed: trendMap[date] || 0, created: 0 };
  });

  return NextResponse.json({
    success: true,
    data: {
      metrics: {
        totalActiveProjects,
        projectsOnHold: projectStatusMap[ProjectStatus.ON_HOLD] || 0,
        projectsCompleted: projectStatusMap[ProjectStatus.COMPLETED] || 0,
        projectsDispatched: projectStatusMap[ProjectStatus.DISPATCHED] || 0,
        overdueProjects,
        taskCompletionRate,
        avgTaskCompletionTime,
        alertFrequency,
        bottleneckDepartment,
        activeAlertCount: activeAlerts.length,
      },
      charts: {
        tasksByDepartment: tasksByDeptFormatted,
        completionTrend: trend,
        avgCompletionByDept,
      },
      activeAlerts,
    },
  });
});