import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { triggerEvent, CHANNELS, EVENTS } from '@/lib/pusher';
import { UserRole, TaskStatus } from '@/types';

export const POST = withAuth(
  async (req: NextRequest, _ctx, { user: _user }) => {
    await connectDB();

    const body = await req.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Updates array is required' },
        { status: 400 }
      );
    }

    // Fetch all tasks in one query instead of one-by-one
    const taskIds = updates.map(u => u.taskId).filter(Boolean);
    const tasks = await TaskModel.find({ _id: { $in: taskIds } })
      .select('_id projectId status completedAt')
      .lean();

    const taskMap = new Map(tasks.map(t => [t._id.toString(), t]));

    // Prepare bulk operations
    const bulkOps: Record<string, unknown>[] = [];
    const projectUpdates = new Set<string>();
    const eventsToTrigger: Array<{ channel: string; event: string; data: Record<string, unknown> }> = [];

    for (const update of updates) {
      const { taskId, status, completedAt } = update;

      if (!taskId || !status) {
        throw new Error(`Invalid update data for task ${taskId}`);
      }

      const existingTask = taskMap.get(taskId);
      if (!existingTask) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Build update operation
      const setFields: Record<string, unknown> = { status };
      if (status === TaskStatus.DONE && completedAt) {
        setFields.completedAt = new Date(completedAt);
      }
      if (status === TaskStatus.DONE && existingTask.status !== TaskStatus.DONE) {
        setFields.completedAt = new Date();
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: taskId },
          update: { $set: setFields },
        },
      });

      if (existingTask.projectId) {
        projectUpdates.add(existingTask.projectId.toString());
        eventsToTrigger.push({
          channel: CHANNELS.project(existingTask.projectId.toString()),
          event: EVENTS.TASK_UPDATED,
          data: {
            taskId: existingTask._id.toString(),
            projectId: existingTask.projectId.toString(),
            status,
            completedAt: setFields.completedAt || existingTask.completedAt,
          },
        });
      }
    }

    // Execute all updates in a single bulkWrite operation
    if (bulkOps.length > 0) {
      await TaskModel.bulkWrite(bulkOps);
    }

    // Trigger realtime events (fire and forget - don't block response)
    if (eventsToTrigger.length > 0) {
      for (const { channel, event, data } of eventsToTrigger) {
        try {
          triggerEvent(channel, event, data);
        } catch (err) {
          console.error('Failed to trigger event:', err);
        }
      }
    }

    // Update project completions (fire and forget)
    if (projectUpdates.size > 0) {
      const { updateProjectCompletion } = await import('@/lib/workflow');
      for (const pid of projectUpdates) {
        updateProjectCompletion(pid).catch((err: Error) => {
          console.error(`Failed to update project ${pid} completion:`, err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { updatedCount: updates.length, projectIds: Array.from(projectUpdates) },
    });
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
);
