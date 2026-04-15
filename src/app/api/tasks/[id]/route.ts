import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import { withAuth, canModifyTask } from '@/lib/auth';
import { UpdateTaskSchema } from '@/lib/validations';
import { TaskStatus } from '@/types';
import {
  validateTaskTransition,
  unlockDependentTasks,
  updateProjectCompletion,
  createSystemLog,
} from '@/lib/workflow';
import { triggerEvent, CHANNELS, EVENTS } from '@/lib/pusher';

// GET /api/tasks/[id]
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  await connectDB();
  const params = await ctx.params;
  const task = await TaskModel.findById(params.id)
    .populate('assignedUser', 'name email department avatar')
    .populate('dependencyTaskId', 'title status department sequence')
    .lean();

  if (!task) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: task });
});

// PATCH /api/tasks/[id]
export const PATCH = withAuth(async (req: NextRequest, ctx, { user }) => {
  await connectDB();

  const { id } = await ctx.params;
  const task = await TaskModel.findById(id);

  if (!task) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
  }

  if (!canModifyTask(user, task.department)) {
    return NextResponse.json(
      { success: false, error: 'You cannot modify tasks outside your department' },
      { status: 403 }
    );
  }

  const body = await req.json();

  if (body.status) {
    const transition = validateTaskTransition(task.status, body.status, task.isLocked);
    if (!transition.valid) {
      return NextResponse.json({ success: false, error: transition.reason }, { status: 400 });
    }

    if (body.status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
      body.completedAt = new Date();
    }
    if (body.status === TaskStatus.IN_PROGRESS && !task.startDate) {
      body.startDate = new Date();
    }
  }

  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const oldStatus = task.status;
  const updated = await TaskModel.findByIdAndUpdate(id, { $set: parsed.data }, { new: true })
    .populate('assignedUser', 'name email department')
    .populate('dependencyTaskId', 'title status');

  if (!updated) {
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }

  if (parsed.data.status && parsed.data.status !== oldStatus) {
    await createSystemLog({
      taskId: id,
      content: `Status changed: "${oldStatus}" → "${parsed.data.status}" by ${user.name}`,
      authorId: user._id.toString(),
    });

    if (parsed.data.status === TaskStatus.DONE) {
      await unlockDependentTasks(id);
    }

    await updateProjectCompletion(updated.projectId.toString());
  }

  await triggerEvent(
    CHANNELS.project(updated.projectId.toString()),
    EVENTS.TASK_UPDATED,
    updated.toObject()
  );

  return NextResponse.json({ success: true, data: updated });
});
