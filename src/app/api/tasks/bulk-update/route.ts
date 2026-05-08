import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { triggerEvent, CHANNELS, EVENTS } from '@/lib/pusher';
import { UserRole, TaskStatus } from '@/types';
import mongoose from 'mongoose';

export const POST = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Updates array is required' },
        { status: 400 }
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updatedTasks = [];

      for (const update of updates) {
        const { taskId, status, completedAt } = update;

        if (!taskId || !status) {
          throw new Error(`Invalid update data for task ${taskId}`);
        }

        const task = await TaskModel.findById(taskId).session(session);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        // Update task
        task.status = status;
        if (status === TaskStatus.DONE && completedAt) {
          task.completedAt = new Date(completedAt);
        }

        await task.save({ session });
        updatedTasks.push(task);

        // Trigger realtime update
        await triggerEvent(CHANNELS.project(task.projectId.toString()), EVENTS.TASK_UPDATED, {
          taskId: task._id.toString(),
          projectId: task.projectId.toString(),
          status: task.status,
          completedAt: task.completedAt,
        });
      }

      await session.commitTransaction();

      return NextResponse.json({
        success: true,
        data: updatedTasks.map(task => ({
          _id: task._id,
          status: task.status,
          completedAt: task.completedAt,
        })),
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Bulk task update error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to update tasks' },
        { status: 500 }
      );
    } finally {
      session.endSession();
    }
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
);