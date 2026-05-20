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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const projectIds = new Set<string>();

      for (const taskId of taskIds) {
        if (!taskId || typeof taskId !== 'string') {
          throw new Error('Invalid task ID provided');
        }

        const task = await TaskModel.findById(taskId).session(session);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        if (!canModifyTask(user, task.department)) {
          throw new Error('You cannot delete tasks outside your department');
        }

        if (task.projectId) {
          projectIds.add(task.projectId.toString());
        }
        await CommentModel.deleteMany({ taskId }, { session });
        await TaskModel.findByIdAndDelete(taskId, { session });
      }

      await Promise.all(Array.from(projectIds).map((projectId) => updateProjectCompletion(projectId)));

      await session.commitTransaction();

      return NextResponse.json({ success: true, data: { deletedIds: taskIds } });
    } catch (error) {
      await session.abortTransaction();
      console.error('Bulk delete tasks error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to delete tasks' },
        { status: 500 }
      );
    } finally {
      session.endSession();
    }
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
);
