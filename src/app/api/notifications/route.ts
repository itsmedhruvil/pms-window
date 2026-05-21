import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import NotificationModel from '@/models/Notification';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// GET /api/notifications
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 50);
  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';

  const query: Record<string, unknown> = { userId: user._id };
  if (unreadOnly) query.isRead = false;

  const notifications = await NotificationModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const unreadCount = await NotificationModel.countDocuments({
    userId: user._id,
    isRead: false,
  });

  return NextResponse.json({
    success: true,
    data: {
      items: notifications,
      unreadCount,
    },
  });
});

// PATCH /api/notifications - Mark as read
export const PATCH = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const { notificationIds, markAllRead } = body;

    if (markAllRead) {
      await NotificationModel.updateMany(
        { userId: user._id, isRead: false },
        { isRead: true }
      );
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      await NotificationModel.updateMany(
        { _id: { $in: notificationIds }, userId: user._id },
        { isRead: true }
      );
    }

    return NextResponse.json({ success: true });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);