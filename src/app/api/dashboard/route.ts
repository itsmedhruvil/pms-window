import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { Department, ProjectStatus, TaskStatus, AlertType, AlertStatus, UserRole } from '@/types';
import { subDays, startOfDay } from 'date-fns';

export const GET = withAuth(async (_req: NextRequest) => {
  await connectDB();

  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);

  // Run all aggregations in parallel
  const [
    projectStats,
    tasksByDept,
    alertStats,
    completionTrend,
    overdueProjects,
    avgCompletionTimes,
    activeAlerts,
  ] = await Promise.all([
    // Project status breakdown
    ProjectModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Tasks per department with completion rates
    TaskModel.aggregate([
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
    ]),

    // Alert frequency by type
    AlertModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),

    // Task completion trend (last 30 days)
    TaskModel.aggregate([
      {
        $match: {
          completedAt: { $gte: thirtyDaysAgo },
          status: TaskStatus.DONE,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
          },
          completed: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Overdue projects
    ProjectModel.countDocuments({
      deadline: { $lt: now },
      status: { $nin: [ProjectStatus.COMPLETED, ProjectStatus.DISPATCHED] },
    }),

    // Avg task completion time per department (in hours)
    TaskModel.aggregate([
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
    ]),

    // Active alerts for sidebar
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

  // Process task completion rates per department
  const taskCompletionRate: Record<Department, number> = {} as Record<Department, number>;
  const tasksByDeptFormatted: Array<{
    department: string;
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    todo: number;
    completionRate: number;
  }> = [];

  tasksByDept.forEach((dept: { _id: Department; statuses: Array<{ status: string; count: number }>; total: number }) => {
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

  // Process alert frequency
  const alertFrequency: Record<AlertType, number> = {} as Record<AlertType, number>;
  alertStats.forEach((a: { _id: AlertType; count: number }) => {
    alertFrequency[a._id] = a.count;
  });

  // Identify bottleneck: department with lowest completion rate + most blocked tasks
  let bottleneckDepartment: Department | null = null;
  let lowestRate = 101;
  tasksByDeptFormatted.forEach((dept) => {
    if (dept.blocked > 0 && dept.completionRate < lowestRate) {
      lowestRate = dept.completionRate;
      bottleneckDepartment = dept.department as Department;
    }
  });

  // Process avg completion time
  const avgCompletionByDept: Record<string, number> = {};
  let globalAvgHours = 0;
  let deptCount = 0;
  avgCompletionTimes.forEach((d: { _id: string; avgHours: number }) => {
    avgCompletionByDept[d._id] = Math.round(d.avgHours * 10) / 10;
    globalAvgHours += d.avgHours;
    deptCount++;
  });
  const avgTaskCompletionTime = deptCount > 0 ? Math.round(globalAvgHours / deptCount) : 0;

  // Build completion trend with gaps filled
  const trendMap: Record<string, { completed: number; created: number }> = {};
  completionTrend.forEach((t: { _id: string; completed: number }) => {
    trendMap[t._id] = { completed: t.completed, created: 0 };
  });

  // Fill last 14 days
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const date = subDays(now, i);
    const dateStr = date.toISOString().split('T')[0];
    trend.push({
      date: dateStr,
      completed: trendMap[dateStr]?.completed || 0,
      created: trendMap[dateStr]?.created || 0,
    });
  }

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
