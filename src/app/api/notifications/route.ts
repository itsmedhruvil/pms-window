import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import NotificationModel from '@/models/Notification';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { TaskStatus, UserRole } from '@/types';
import { NotificationType } from '@/types/notifications';
import { notifyUsers } from '@/lib/notifications';

// GET /api/notifications — fetch current user's notifications
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const includeDismissed = searchParams.get('includeDismissed') === 'true';
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const visibleTypes = [
    NotificationType.TASK_PENDING,
    NotificationType.PROJECT_CREATED,
    NotificationType.DISCUSSION_CREATED,
  ];

  const query: Record<string, unknown> = {
    userId: user._id,
    type: { $in: visibleTypes },
  };

  if (!includeDismissed) {
    query.dismissed = false;
  }
  if (unreadOnly) {
    query.read = false;
  }

  const notifications = await NotificationModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const unreadCount = await NotificationModel.countDocuments({
    userId: user._id,
    type: { $in: visibleTypes },
    read: false,
    dismissed: false,
  });

  // Serialize for client
  const serialized = notifications.map((n) => {
    const id = n._id instanceof Object ? n._id.toString() : String(n._id);
    return {
      id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      timestamp: n.createdAt,
      read: n.read,
      dismissed: n.dismissed,
      metadata: n.metadata,
    };
  });

  return NextResponse.json({
    success: true,
    data: serialized,
    unreadCount,
  });
});

// POST /api/notifications/mark-all-read — mark all notifications as read
export const POST = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === 'mark-all-read') {
    await NotificationModel.updateMany(
      { userId: user._id, read: false, dismissed: false },
      { $set: { read: true } }
    );

    return NextResponse.json({ success: true });
  }

  if (action === 'clear-all') {
    await NotificationModel.updateMany(
      { userId: user._id, dismissed: false },
      { $set: { dismissed: true } }
    );

    return NextResponse.json({ success: true });
  }

  if (action === 'pending-task-check') {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await checkAndNotifyPendingTasks();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, error: 'Invalid action' },
    { status: 400 }
  );
});

/**
 * Send one daily summary of unfinished assigned tasks to each assignee.
 */
async function checkAndNotifyPendingTasks() {
  const now = new Date();
  const dueSoonLimit = new Date(now);
  dueSoonLimit.setDate(dueSoonLimit.getDate() + 3);

  const pendingTasks = await TaskModel.find({
    status: { $ne: TaskStatus.DONE },
    assignedUser: { $ne: null },
  })
    .populate('assignedUser', '_id')
    .lean();

  if (pendingTasks.length === 0) return;

  const userTaskMap = new Map<string, typeof pendingTasks>();

  for (const task of pendingTasks) {
    if (!task.assignedUser) continue;
    const assignedUser = task.assignedUser as { _id?: string | { toString(): string } } | null;
    const userId = assignedUser?._id?.toString();
    if (!userId) continue;

    const existing = userTaskMap.get(userId) || [];
    existing.push(task);
    userTaskMap.set(userId, existing);
  }

  // Send one notification per user summarizing their pending tasks.
  for (const [userId, tasks] of userTaskMap.entries()) {
    const taskCount = tasks.length;

    // Send at most one pending-task summary per user each day.
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const alreadyNotified = await NotificationModel.findOne({
      userId,
      type: NotificationType.TASK_PENDING,
      createdAt: { $gte: todayStart },
    });

    if (alreadyNotified) continue;

    const overdueCount = tasks.filter((task) => task.dueDate && new Date(task.dueDate) < now).length;
    const dueSoonCount = tasks.filter((task) => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= now && dueDate <= dueSoonLimit;
    }).length;

    const title = `${taskCount} pending task${taskCount === 1 ? '' : 's'} need attention`;
    const urgency = [
      overdueCount > 0 ? `${overdueCount} overdue` : '',
      dueSoonCount > 0 ? `${dueSoonCount} due within 3 days` : '',
    ].filter(Boolean).join(', ');
    const body = urgency
      ? `You have ${taskCount} unfinished assigned tasks. ${urgency}.`
      : `You have ${taskCount} unfinished assigned tasks. Review your task list when you can.`;

    const hasProjectTasks = tasks.some((task) => Boolean(task.projectId));
    const link = hasProjectTasks ? '/tasks' : '/internal-tasks';

    await notifyUsers({
      type: NotificationType.TASK_PENDING,
      title,
      body,
      link,
      userIds: [userId],
      metadata: {
        taskCount,
        overdueCount,
        dueSoonCount,
        isInternal: !hasProjectTasks,
      },
    });
  }
}