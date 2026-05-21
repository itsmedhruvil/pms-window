import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import CommentModel from '@/models/Comment';
import { withAuth, canModifyTask } from '@/lib/auth';
import { UserRole } from '@/types';
import mongoose from 'mongoose';
import { updateProjectCompletion } from '@/lib/workflow';

export const POST = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();
    const body = await req.json();
    const { taskIds } = body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'taskIds array is required' },
        { status: 400 }
      );
    }

    // Validate and check permissions in bulk - much faster than one-by-one
    const tasks = await TaskModel.find({
      _id: { $in: taskIds },
    })
      .select('department projectId _id')
      .lean();

    if (tasks.length !== taskIds.length) {
      const foundIds = new Set(tasks.map(t => t._id.toString()));
      const missingIds = taskIds.filter((id: string) => !foundIds.has(id));
      return NextResponse.json(
        { success: false, error: `Tasks not found: ${missingIds.join(', ')}` },
        { status: 404 }
      );
    }

    // Check permissions
    for (const task of tasks) {
      if (!canModifyTask(user, task.department)) {
        return NextResponse.json(
          { success: false, error: `You cannot delete tasks in department: ${task.department}` },
          { status: 403 }
        );
      }
    }

    // Collect unique project IDs for completion updates
    const projectIds = [...new Set(
      tasks
        .filter(t => t.projectId)
        .map(t => t.projectId!.toString())
    )];

    // Use bulk operations instead of transaction with individual operations
    await Promise.all([
      // Delete all comments for these tasks in one query
      CommentModel.deleteMany({ taskId: { $in: taskIds } }),
      // Delete all tasks in one query
      TaskModel.deleteMany({ _id: { $in: taskIds } }),
    ]);

    // Update project completion percentages in parallel
    if (projectIds.length > 0) {
      await Promise.all(
        projectIds.map(projectId => updateProjectCompletion(projectId))
      );
    }

    return NextResponse.json({ success: true, data: { deletedIds: taskIds, deletedCount: tasks.length } });
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
);