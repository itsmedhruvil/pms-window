import connectDB from '@/lib/db';
import NotificationModel from '@/models/Notification';
import UserModel from '@/models/User';
import TaskModel from '@/models/Task';
import { triggerEvent, CHANNELS, EVENTS } from '@/lib/pusher';
import { UserRole, Department } from '@/types';
import { sendPushToUser, sendPushToUsers, buildPushPayload } from '@/lib/push-notifications';
import type { INotificationDocument, NotificationType } from '@/models/Notification';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedId?: string;
  relatedModel?: string;
}

/**
 * Create a single notification for a specific user and trigger realtime event.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<INotificationDocument | null> {
  try {
    await connectDB();
    const notification = await NotificationModel.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link || null,
      relatedId: params.relatedId || null,
      relatedModel: params.relatedModel || null,
    });

    // Trigger realtime event (best-effort)
    try {
      triggerEvent(CHANNELS.global, EVENTS.NOTIFICATION_CREATED, {
        notification: notification.toJSON(),
      });
    } catch {
      // Non-critical
    }

    // Send push notification (best-effort)
    try {
      const pushPayload = buildPushPayload(
        params.title,
        params.message,
        params.link
      );
      await sendPushToUser(params.userId, pushPayload);
    } catch {
      // Non-critical
    }

    return notification;
  } catch (error) {
    console.error('[createNotification Error]', error);
    return null;
  }
}

/**
 * Create notifications for all admin/super_admin users.
 */
export async function notifyAdmins(params: Omit<CreateNotificationParams, 'userId'>): Promise<void> {
  try {
    await connectDB();
    const admins = await UserModel.find({
      role: { $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
      isActive: true,
    }).select('_id').lean();

      for (const admin of admins) {
      await createNotification({
        ...params,
        userId: admin._id.toString(),
      }).catch(() => {});
    }

    // Also send push notifications to all admins
    try {
      const adminIds = admins.map((a) => a._id.toString());
      const pushPayload = buildPushPayload(
        params.title,
        params.message,
        params.link
      );
      await sendPushToUsers(adminIds, pushPayload);
    } catch {
      // Non-critical
    }
  } catch (error) {
    console.error('[notifyAdmins Error]', error);
  }
}

/**
 * Create notifications for all users in a specific department.
 */
export async function notifyDepartment(
  department: Department,
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  try {
    await connectDB();
    const users = await UserModel.find({
      department,
      isActive: true,
    }).select('_id').lean();

    for (const user of users) {
      await createNotification({
        ...params,
        userId: user._id.toString(),
      }).catch(() => {});
    }

    // Also send push notifications to all department users
    try {
      const userIds = users.map((u) => u._id.toString());
      const pushPayload = buildPushPayload(
        params.title,
        params.message,
        params.link
      );
      await sendPushToUsers(userIds, pushPayload);
    } catch {
      // Non-critical
    }
  } catch (error) {
    console.error('[notifyDepartment Error]', error);
  }
}

/**
 * Create notifications for a specific list of user IDs.
 */
export async function notifyUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  for (const uid of userIds) {
    await createNotification({
      ...params,
      userId: uid,
    }).catch(() => {});
  }

  // Also send push notifications to all specified users
  try {
    const pushPayload = buildPushPayload(
      params.title,
      params.message,
      params.link
    );
    await sendPushToUsers(userIds, pushPayload);
  } catch {
    // Non-critical
  }
}

/**
 * Check for overdue tasks and create notifications for assigned users.
 * Designed to be called from an API route or cron-like endpoint.
 */
export async function checkAndNotifyOverdueTasks(): Promise<number> {
  try {
    await connectDB();
    const now = new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overdueTasks = await TaskModel.find({
      dueDate: { $lt: now, $ne: null },
      status: { $nin: ['done'] },
    })
      .populate('assignedUser', '_id')
      .populate('projectId', 'projectTitle')
      .lean() as any[];

    let count = 0;

    for (const task of overdueTasks) {
      // Notify the assigned user
      if (task.assignedUser) {
        const assignedUserId =
          typeof task.assignedUser === 'object'
            ? (task.assignedUser as { _id: { toString(): string } })._id.toString()
            : task.assignedUser.toString();

        const projectTitle =
          task.projectId && typeof task.projectId === 'object'
            ? (task.projectId as { projectTitle: string }).projectTitle || 'Project'
            : 'Project';

        await createNotification({
          userId: assignedUserId,
          type: 'task_overdue',
          title: 'Task Overdue',
          message: `"${task.title}" in "${projectTitle}" is overdue.`,
          link: task.projectId ? `/tasks/${task._id}` : undefined,
          relatedId: task._id.toString(),
          relatedModel: 'Task',
        });

        count++;
      }

      // Also notify admins
      const projectTitle =
        task.projectId && typeof task.projectId === 'object'
          ? (task.projectId as { projectTitle: string }).projectTitle || 'Project'
          : 'Project';

      await notifyAdmins({
        type: 'task_overdue',
        title: 'Task Overdue',
        message: `Task "${task.title}" in "${projectTitle}" is overdue.`,
        link: task.projectId ? `/tasks/${task._id}` : undefined,
        relatedId: task._id.toString(),
        relatedModel: 'Task',
      });
    }

    return count;
  } catch (error) {
    console.error('[checkAndNotifyOverdueTasks Error]', error);
    return 0;
  }
}