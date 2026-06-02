import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import { sendPushToOneSignalUsers } from '@/lib/onesignal';

// POST /api/test-push - Send a test push notification to all active users
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const title = body.title || '🧪 Test Push Notification';
    const bodyText = body.body || 'This is a test push notification sent to all users.';
    const link = body.link || '/';

    // Fetch all active users
    const allUsers = await UserModel.find({ isActive: true }).select('_id').lean();
    const allUserIds = allUsers.map((u) => u._id.toString());

    if (allUserIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active users found to send notification to' },
        { status: 400 }
      );
    }

    // Send push notification to all active users
    const result = await sendPushToOneSignalUsers(allUserIds, title, bodyText, link);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to send push notification via OneSignal' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        notificationTitle: title,
        notificationBody: bodyText,
        totalUsersNotified: allUserIds.length,
        message: `Test push notification sent to ${allUserIds.length} active users`,
      },
    });
  } catch (error) {
    console.error('[Test Push] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}