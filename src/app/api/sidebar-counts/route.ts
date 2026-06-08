import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import DiscussionModel from '@/models/Discussion';
import DiscussionReadModel from '@/models/DiscussionRead';
import CommentModel from '@/models/Comment';
import ProjectModel from '@/models/Project';
import { withAuth } from '@/lib/auth';
import { TaskStatus, AlertStatus, ProjectStatus, UserRole } from '@/types';

export const GET = withAuth(async (_req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

  // Run all counts in parallel for efficiency
  const [
    activeAlerts,
    totalDiscussions,
    unreadDiscussions,
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

    // Unread discussions for this user
    (async () => {
      const discussions = await DiscussionModel.find({}, { _id: 1, createdAt: 1 }).lean();
      const discussionIds = discussions.map((d) => d._id);
      if (discussionIds.length === 0) return 0;
      const readRecords = await DiscussionReadModel.find({
        discussionId: { $in: discussionIds },
        userId: user._id,
      }).lean();
      const readMap = new Map(readRecords.map((r) => [r.discussionId.toString(), r.lastReadAt.getTime()]));
      let unread = 0;
      for (const d of discussions) {
        const lastRead = readMap.get(d._id.toString());
        if (!lastRead) {
          unread++;
        }
      }
      return unread;
    })(),

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
      unreadDiscussions,
      pendingTasks: projectTasksPending + internalTasksPending,
      projectTasksPending,
      internalTasksPending,
      overdueTasks,
      activeProjects: totalActiveProjects,
      projectsOnHold,
    },
  });
});