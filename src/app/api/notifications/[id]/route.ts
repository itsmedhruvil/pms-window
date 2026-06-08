import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import NotificationModel from '@/models/Notification';
import { withAuth } from '@/lib/auth';

// PATCH /api/notifications/[id] — mark as read or dismiss
export const PATCH = withAuth(async (req: NextRequest, context: { params: Promise<{ id: string }> }, { user }) => {
  const { id } = await context.params;
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const { action } = body as { action?: 'read' | 'dismiss' };

  if (!action || !['read', 'dismiss'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "read" or "dismiss".' },
      { status: 400 }
    );
  }

  const notification = await NotificationModel.findById(id);

  if (!notification) {
    return NextResponse.json(
      { success: false, error: 'Notification not found' },
      { status: 404 }
    );
  }

  if (notification.userId.toString() !== user._id.toString()) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    );
  }

  if (action === 'read') {
    notification.read = true;
  } else if (action === 'dismiss') {
    notification.dismissed = true;
  }

  await notification.save();

  return NextResponse.json({ success: true });
});