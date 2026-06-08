import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import UserModel from '@/models/User';
import { withAuth, canModifyTask } from '@/lib/auth';
import { createSystemLog } from '@/lib/workflow';
import { NotificationType } from '@/types/notifications';
import { notifyUsers } from '@/lib/notifications';

const AssignSchema = z.object({
  userId: z.string().nullable(), // null = unassign
});

// POST /api/tasks/[id]/assign
export const POST = withAuth(async (req: NextRequest, ctx, { user }) => {
  await connectDB();

  const params = await ctx.params;
  const { id } = params;
  const body = await req.json();
  const parsed = AssignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const task = await TaskModel.findById(id);
  if (!task) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
  }

  if (!canModifyTask(user, task.department)) {
    return NextResponse.json(
      { success: false, error: 'Cannot assign tasks outside your department' },
      { status: 403 }
    );
  }

  const { userId } = parsed.data;

  if (userId) {
    // Validate the target user exists and belongs to the correct department
    const targetUser = await UserModel.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (targetUser.department !== task.department) {
      return NextResponse.json(
        {
          success: false,
          error: `User department "${targetUser.department}" does not match task department "${task.department}"`,
        },
        { status: 400 }
      );
    }

    task.assignedUser = targetUser._id;

    await createSystemLog({
      taskId: id,
      content: `Task assigned to ${targetUser.name} by ${user.name}`,
      authorId: user._id.toString(),
    });

    // Determine if this is an internal task vs project task
    const isInternal = !task.projectId;
    const notificationType = isInternal ? NotificationType.INTERNAL_TASK_ASSIGNED : NotificationType.TASK_ASSIGNED;
    const link = isInternal ? `/internal-tasks?task=${id}` : `/tasks/${id}`;

    // Send rich push + in-app notification to the assigned user
    await notifyUsers({
      type: notificationType,
      title: `${isInternal ? '📋 Internal Task' : '📋 Task'} Assigned: ${task.title || 'Task'}`,
      body: `You have been assigned ${isInternal ? 'internal task' : 'task'} "${task.title || 'Task'}" in ${task.department} by ${user.name}.`,
      link,
      userIds: [targetUser._id.toString()],
      metadata: {
        taskId: id,
        assignedBy: user.name,
        department: task.department,
        isInternal,
      },
    });
  } else {
    const prevUser = task.assignedUser;
    task.assignedUser = undefined;

    if (prevUser) {
      await createSystemLog({
        taskId: id,
        content: `Task unassigned by ${user.name}`,
        authorId: user._id.toString(),
      });
    }
  }

  await task.save();

  const updated = await TaskModel.findById(id)
    .populate('assignedUser', 'name email department avatar')
    .lean();

  return NextResponse.json({ success: true, data: updated });
});
