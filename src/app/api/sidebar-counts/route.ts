import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import DiscussionModel from '@/models/Discussion';
import ProjectModel from '@/models/Project';
import CommentModel from '@/models/Comment';
import { withAuth } from '@/lib/auth';
import { TaskStatus, AlertStatus, ProjectStatus, UserRole } from '@/types';

export const GET = withAuth(async (_req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

  // Run all counts in parallel for efficiency
  const [
    activeAlerts,
    totalDiscussions,
    projectTasksPending,
    internalTasksPending,
    overdueTasks,
    totalActiveProjects,
    projectsOnHold,
  ] = await Promise.all([
    // Active (non-resolved) alerts count
    AlertModel.countDocuments({ status: { $ne: AlertStatus.RESOLVED } }),

    // Total discussions count
    DiscussionModel.countDocuments(),

    // Project tasks not done (filter by dept for non-admins)
    TaskModel.countDocuments({
      ...(isAdmin ? {} : { department: user.department as string }),
      status: { $ne: TaskStatus.DONE },
      projectId: { $ne: null },
    }),

    // Internal tasks not done (no projectId)
    TaskModel.countDocuments({
      ...(isAdmin ? {} : { department: user.department as string }),
      status: { $ne: TaskStatus.DONE },
      projectId: null,
    }),

    // Overdue tasks (not done and past due date)
    TaskModel.countDocuments({
      ...(isAdmin ? {} : { department: user.department as string }),
      status: { $ne: TaskStatus.DONE },
      dueDate: { $lt: new Date(), $ne: null },
    }),

    // Active projects (new + in_production + on_hold)
    ProjectModel.countDocuments({
      status: { $in: [ProjectStatus.NEW, ProjectStatus.IN_PRODUCTION, ProjectStatus.ON_HOLD] },
    }),

    // On hold projects
    ProjectModel.countDocuments({ status: ProjectStatus.ON_HOLD }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      activeAlerts,
      discussions: totalDiscussions,
      pendingTasks: projectTasksPending + internalTasksPending,
      projectTasksPending,
      internalTasksPending,
      overdueTasks,
      activeProjects: totalActiveProjects,
      projectsOnHold,
    },
  });
});