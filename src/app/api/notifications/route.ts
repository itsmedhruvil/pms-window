import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import NotificationModel from '@/models/Notification';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// GET /api/notifications
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 50);
  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';

  // Use a single aggregation pipeline to fetch notifications and unread count
  // in one round-trip instead of two separate queries
  const matchStage: Record<string, unknown> = { userId: user._id };
  if (unreadOnly) matchStage.isRead = false;

  const [result] = await NotificationModel.aggregate([
    { $match: matchStage },
    {
      $facet: {
        items: [
          { $sort: { createdAt: -1 } },
          { $limit: limit },
        ],
        unreadCount: [
          { $match: { isRead: false } },
          { $count: 'count' },
        ],
      },
    },
    {
      $project: {
        items: 1,
        unreadCount: {
          $ifNull: [{ $arrayElemAt: ['$unreadCount.count', 0] }, 0],
        },
      },
    },
  ]);

  return NextResponse.json({
    success: true,
    data: {
      items: result?.items || [],
      unreadCount: result?.unreadCount ?? 0,
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