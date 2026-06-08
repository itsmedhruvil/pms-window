import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import NotificationModel from '@/models/Notification';
import TaskModel from '@/models/Task';
import UserModel from '@/models/User';
import { withAuth } from '@/lib/auth';
import { NotificationType } from '@/types/notifications';
import { notifyUsers } from '@/lib/notifications';

// GET /api/notifications — fetch current user's notifications
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const includeDismissed = searchParams.get('includeDismissed') === 'true';
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  const query: Record<string, unknown> = {
    userId: user._id,
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

  if (action === 'overdue-check') {
    await checkAndNotifyOverdueTasks();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, error: 'Invalid action' },
    { status: 400 }
  );
});

/**
 * Check for overdue tasks and send notifications to assigned users.
 */
async function checkAndNotifyOverdueTasks() {
  const now = new Date();

  // Find all non-done tasks past their due date
  const overdueTasks = await TaskModel.find({
    status: { $ne: 'done' },
    dueDate: { $lt: now, $ne: null },
  })
    .populate('assignedUser', '_id')
    .lean();

  if (overdueTasks.length === 0) return;

  // Group by assigned user to avoid duplicate notifications per user
  const userTaskMap = new Map<string, typeof overdueTasks>();

  for (const task of overdueTasks) {
    if (!task.assignedUser) continue;
    const userId = (task.assignedUser as any)._id?.toString();
    if (!userId) continue;

    const existing = userTaskMap.get(userId) || [];
    existing.push(task);
    userTaskMap.set(userId, existing);
  }

  // Send one notification per user summarizing their overdue tasks
  for (const [userId, tasks] of userTaskMap.entries()) {
    const isInternal = tasks.every((t) => !t.projectId);
    const taskCount = tasks.length;
    const firstTask = tasks[0];

    // Check if we already sent an overdue notification for these tasks today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const alreadyNotified = await NotificationModel.findOne({
      userId,
      type: NotificationType.TASK_OVERDUE,
      createdAt: { $gte: todayStart },
    });

    if (alreadyNotified) continue; // Only once per day per user

    const title = taskCount === 1
      ? `⏰ Task Overdue: "${firstTask.title}"`
      : `⏰ ${taskCount} Tasks Overdue`;

    const body = taskCount === 1
      ? `"${firstTask.title}" was due ${firstTask.dueDate ? formatRelativeDate(firstTask.dueDate) : 'recently'}.`
      : `You have ${taskCount} overdue task${taskCount > 1 ? 's' : ''} that need attention.`;

    const link = isInternal ? '/internal-tasks' : '/tasks';

    await notifyUsers({
      type: NotificationType.TASK_OVERDUE,
      title,
      body,
      link,
      userIds: [userId],
      metadata: {
        taskCount,
        isInternal,
        taskIds: tasks.map((t) => t._id.toString()),
      },
    });
  }
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)} weeks ago`;
}