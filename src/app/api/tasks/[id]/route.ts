import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import CommentModel from '@/models/Comment';
import { withAuth, canModifyTask } from '@/lib/auth';
import { UpdateTaskSchema } from '@/lib/validations';
import { TaskStatus, UserRole } from '@/types';
import {
  validateTaskTransition,
  unlockDependentTasks,
  updateProjectCompletion,
  createSystemLog,
} from '@/lib/workflow';
import { createNotification, notifyAdmins } from '@/lib/notifications';

// GET /api/tasks/[id]
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  await connectDB();
  const params = await ctx.params;
  const task = await TaskModel.findById(params.id)
    .populate('projectId', 'projectTitle clientName')
    .populate('templateTaskId', 'title department sequence')
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
    if (body.status !== TaskStatus.DONE && task.status === TaskStatus.DONE) {
      body.completedAt = null;
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
    .populate('projectId', 'projectTitle clientName')
    .populate('templateTaskId', 'title department sequence')
    .populate('assignedUser', 'name email department')
    .populate('dependencyTaskId', 'title status');

  if (!updated) {
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }

  // Helper to extract user ID from populated or raw assignedUser field
  const extractUserId = (assigned: unknown): string | null => {
    if (!assigned) return null;
    if (typeof assigned === 'object' && assigned !== null) {
      const obj = assigned as Record<string, unknown>;
      if (obj._id && typeof (obj._id as { toString?: () => string }).toString === 'function') {
        return (obj._id as { toString(): string }).toString();
      }
      if (typeof obj._id === 'string') return obj._id;
      if (typeof (obj as { toString?: () => string }).toString === 'function') {
        return (obj as { toString(): string }).toString();
      }
    }
    if (typeof assigned === 'string') return assigned;
    if (typeof (assigned as { toString?: () => string }).toString === 'function') {
      return (assigned as { toString(): string }).toString();
    }
    return null;
  };

  if (parsed.data.status && parsed.data.status !== oldStatus) {
    await createSystemLog({
      taskId: id,
      content: `Status changed: "${oldStatus}" → "${parsed.data.status}" by ${user.name}`,
      authorId: user._id.toString(),
    });

    if (parsed.data.status === TaskStatus.DONE) {
      await unlockDependentTasks(id);
    }

    if (task.projectId) {
      await updateProjectCompletion(task.projectId.toString());
    }

    // Fire-and-forget: notify task assignee and admins about status change
    const projectTitle = updated.projectId && typeof updated.projectId === 'object' && 'projectTitle' in updated.projectId
      ? (updated.projectId as unknown as { projectTitle: string }).projectTitle || 'Project'
      : 'Project';

    // Notify the assigned user about status change
    const statusChangeAssigneeId = extractUserId(updated.assignedUser);
    if (statusChangeAssigneeId) {
      createNotification({
        userId: statusChangeAssigneeId,
        type: 'task_assigned',
        title: `📋 Task Status Changed: ${updated.title}`,
        message: `"${updated.title}" in "${projectTitle}" changed from "${oldStatus}" to "${parsed.data.status}" by ${user.name}.`,
        link: task.projectId ? `/tasks/${id}` : undefined,
        relatedId: id,
        relatedModel: 'Task',
      }).catch(() => {});
    }

    // Notify admins about significant status changes
    if (parsed.data.status === TaskStatus.DONE || parsed.data.status === TaskStatus.IN_PROGRESS) {
      notifyAdmins({
        type: 'task_assigned',
        title: `📋 Task ${parsed.data.status === TaskStatus.DONE ? 'Completed' : 'In Progress'}`,
        message: `"${updated.title}" in "${projectTitle}" is now "${parsed.data.status}" by ${user.name}.`,
        link: task.projectId ? `/tasks/${id}` : undefined,
        relatedId: id,
        relatedModel: 'Task',
      }).catch(() => {});
    }
  }

  const oldAssignedUserId = extractUserId(task.assignedUser);
  const newAssignedUserId = extractUserId(updated.assignedUser);

  if (newAssignedUserId && oldAssignedUserId !== newAssignedUserId) {
    const projectTitle = updated.projectId && typeof updated.projectId === 'object' && 'projectTitle' in updated.projectId
      ? (updated.projectId as unknown as { projectTitle: string }).projectTitle || 'Project'
      : 'Project';

    // Notify the newly assigned user
    createNotification({
      userId: newAssignedUserId,
      type: 'task_assigned',
      title: `👤 Task Assigned: ${updated.title}`,
      message: `You have been assigned task "${updated.title}" in project "${projectTitle}".`,
      link: task.projectId ? `/tasks/${id}` : undefined,
      relatedId: id,
      relatedModel: 'Task',
    }).catch(() => {});

    // Notify admins about the assignment change
    notifyAdmins({
      type: 'task_assigned',
      title: `👤 Task Reassigned`,
      message: `"${updated.title}" in "${projectTitle}" was assigned to a new user by ${user.name}.`,
      link: task.projectId ? `/tasks/${id}` : undefined,
      relatedId: id,
      relatedModel: 'Task',
    }).catch(() => {});
  }

  if (parsed.data.imageAttachments) {
    await createSystemLog({
      taskId: id,
      content: `Images updated by ${user.name}`,
      authorId: user._id.toString(),
    });
  }

  return NextResponse.json({ success: true, data: updated });
});

// DELETE /api/tasks/[id]
export const DELETE = withAuth(
  async (_req: NextRequest, ctx, { user }) => {
    await connectDB();
    const params = await ctx.params;
    const { id } = params;

    const task = await TaskModel.findById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    if (!canModifyTask(user, task.department)) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete tasks outside your department' },
        { status: 403 }
      );
    }

    const projectId = task.projectId;

    // Delete task and all related comments
    await CommentModel.deleteMany({ taskId: id });
    await TaskModel.findByIdAndDelete(id);

    // Update project completion percentage
    if (projectId) {
      await updateProjectCompletion(projectId.toString());
    }

    return NextResponse.json({ success: true, message: 'Task deleted' });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);
