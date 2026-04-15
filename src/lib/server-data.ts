/**
 * server-data.ts
 *
 * Direct database query functions for use in Next.js Server Components.
 * These bypass the HTTP API layer entirely — no self-fetch, no auth header
 * forwarding issues, no round-trip latency.
 *
 * Import ONLY in server components (page.tsx, layout.tsx, etc.)
 * Never import in 'use client' files.
 */

import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import UserModel from '@/models/User';
import CommentModel from '@/models/Comment';
import {
  Department,
  ProjectStatus,
  ProjectPriority,
  TaskStatus,
  AlertType,
  AlertStatus,
  UserRole,
  DEPARTMENT_SEQUENCE,
} from '@/types';
import { subDays } from 'date-fns';
import type { IUserDocument } from '@/models/User';

// ─── Projects ────────────────────────────────────────────────────────────────

export interface ProjectListFilters {
  status?: ProjectStatus;
  priority?: ProjectPriority;
  search?: string;
  page?: number;
  limit?: number;
  userId?: string;        // restrict to assigned (dept users)
  isAdmin?: boolean;
}

export async function getProjects(filters: ProjectListFilters = {}) {
  await connectDB();

  const { status, priority, search, page = 1, limit = 50, userId, isAdmin = true } = filters;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (search) {
    query.$or = [
      { clientName: { $regex: search, $options: 'i' } },
      { projectTitle: { $regex: search, $options: 'i' } },
    ];
  }
  if (!isAdmin && userId) {
    query.assignedUsers = userId;
  }

  const [items, total] = await Promise.all([
    ProjectModel.find(query)
      .sort({ priority: -1, deadline: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email department')
      .lean(),
    ProjectModel.countDocuments(query),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getProjectDetail(id: string) {
  await connectDB();

  const [project, tasks, alerts] = await Promise.all([
    ProjectModel.findById(id)
      .populate('createdBy', 'name email department')
      .populate('assignedUsers', 'name email department')
      .lean(),
    TaskModel.find({ projectId: id })
      .populate('assignedUser', 'name email department avatar')
      .populate('dependencyTaskId', 'title status department')
      .sort({ sequence: 1 })
      .lean(),
    AlertModel.find({ projectId: id })
      .populate('raisedBy', 'name email')
      .populate('acknowledgedBy', 'name department')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!project) return null;
  return { project, tasks, alerts };
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface TaskListFilters {
  department?: Department;
  projectId?: string;
  status?: TaskStatus;
  assignedUserId?: string;
  isAdmin?: boolean;
  limit?: number;
}

export async function getTasks(filters: TaskListFilters = {}) {
  await connectDB();

  const { department, projectId, status, assignedUserId, isAdmin = true, limit = 100 } = filters;

  const query: Record<string, unknown> = {};
  if (projectId) query.projectId = projectId;
  if (status) query.status = status;

  if (!isAdmin && department) {
    query.department = department;
    if (assignedUserId) {
      query.$or = [{ assignedUser: assignedUserId }, { assignedUser: null }];
    }
  } else if (department) {
    query.department = department;
  }

  return TaskModel.find(query)
    .populate('assignedUser', 'name email department avatar')
    .populate('dependencyTaskId', 'title status department')
    .sort({ sequence: 1 })
    .limit(limit)
    .lean();
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export interface AlertListFilters {
  status?: AlertStatus;
  projectId?: string;
  department?: Department;    // dept users see only their alerts
  isAdmin?: boolean;
  limit?: number;
}

export async function getAlerts(filters: AlertListFilters = {}) {
  await connectDB();

  const { status, projectId, department, isAdmin = true, limit = 100 } = filters;

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (projectId) query.projectId = projectId;
  if (!isAdmin && department) {
    query.affectedDepartments = department;
  }

  return AlertModel.find(query)
    .populate('raisedBy', 'name email')
    .populate('projectId', 'projectTitle clientName')
    .populate('acknowledgedBy', 'name department')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUsers(filters: { department?: Department; role?: UserRole } = {}) {
  await connectDB();

  const query: Record<string, unknown> = { isActive: true };
  if (filters.department) query.department = filters.department;
  if (filters.role) query.role = filters.role;

  return UserModel.find(query).select('-__v').sort({ name: 1 }).lean();
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardData() {
  await connectDB();

  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);

  const [
    projectStats,
    tasksByDept,
    alertStats,
    completionTrend,
    overdueProjects,
    avgCompletionTimes,
    activeAlerts,
  ] = await Promise.all([
    ProjectModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    TaskModel.aggregate([
      { $group: { _id: { department: '$department', status: '$status' }, count: { $sum: 1 } } },
      { $group: { _id: '$_id.department', statuses: { $push: { status: '$_id.status', count: '$count' } }, total: { $sum: '$count' } } },
    ]),

    AlertModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),

    TaskModel.aggregate([
      { $match: { completedAt: { $gte: thirtyDaysAgo }, status: TaskStatus.DONE } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, completed: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    ProjectModel.countDocuments({
      deadline: { $lt: now },
      status: { $nin: [ProjectStatus.COMPLETED, ProjectStatus.DISPATCHED] },
    }),

    TaskModel.aggregate([
      { $match: { status: TaskStatus.DONE, startDate: { $exists: true, $ne: null }, completedAt: { $exists: true, $ne: null } } },
      { $project: { department: 1, durationHours: { $divide: [{ $subtract: ['$completedAt', '$startDate'] }, 3600000] } } },
      { $group: { _id: '$department', avgHours: { $avg: '$durationHours' }, totalCompleted: { $sum: 1 } } },
    ]),

    AlertModel.find({ status: AlertStatus.ACTIVE })
      .populate('projectId', 'projectTitle clientName')
      .populate('raisedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // Process project stats
  const projectStatusMap: Record<string, number> = {};
  projectStats.forEach((s: { _id: string; count: number }) => { projectStatusMap[s._id] = s.count; });

  const totalActiveProjects =
    (projectStatusMap[ProjectStatus.NEW] || 0) +
    (projectStatusMap[ProjectStatus.IN_PRODUCTION] || 0) +
    (projectStatusMap[ProjectStatus.ON_HOLD] || 0);

  // Task completion rates
  const taskCompletionRate: Record<string, number> = {};
  const tasksByDeptFormatted: Array<{
    department: string; total: number; done: number;
    inProgress: number; blocked: number; todo: number; completionRate: number;
  }> = [];

  tasksByDept.forEach((dept: { _id: string; statuses: Array<{ status: string; count: number }>; total: number }) => {
    const sm: Record<string, number> = {};
    dept.statuses.forEach((s) => { sm[s.status] = s.count; });
    const done = sm[TaskStatus.DONE] || 0;
    const rate = dept.total > 0 ? Math.round((done / dept.total) * 100) : 0;
    taskCompletionRate[dept._id] = rate;
    tasksByDeptFormatted.push({
      department: dept._id, total: dept.total, done,
      inProgress: sm[TaskStatus.IN_PROGRESS] || 0,
      blocked: sm[TaskStatus.BLOCKED] || 0,
      todo: sm[TaskStatus.TODO] || 0,
      completionRate: rate,
    });
  });

  // Alert frequency
  const alertFrequency: Record<string, number> = {};
  alertStats.forEach((a: { _id: string; count: number }) => { alertFrequency[a._id] = a.count; });

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
  avgCompletionTimes.forEach((d: { _id: string; avgHours: number }) => {
    avgCompletionByDept[d._id] = Math.round(d.avgHours * 10) / 10;
    globalAvgHours += d.avgHours;
    deptCount++;
  });
  const avgTaskCompletionTime = deptCount > 0 ? Math.round(globalAvgHours / deptCount) : 0;

  // Fill completion trend for last 14 days
  const trendMap: Record<string, number> = {};
  completionTrend.forEach((t: { _id: string; completed: number }) => { trendMap[t._id] = t.completed; });
  const trend = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(now, 13 - i).toISOString().split('T')[0];
    return { date, completed: trendMap[date] || 0, created: 0 };
  });

  return {
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
    charts: { tasksByDepartment: tasksByDeptFormatted, completionTrend: trend, avgCompletionByDept },
    activeAlerts,
  };
}

// ─── Serialization ────────────────────────────────────────────────────────────
// Mongoose lean() returns BSON ObjectIds and Dates. Next.js requires plain
// JSON-serializable objects when passing from Server → Client components.
// This helper converts ObjectId → string and Date → ISO string recursively.

export function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
