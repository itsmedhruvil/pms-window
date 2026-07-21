import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import { sendFcmPushToUsers } from '@/lib/firebase-admin';

// POST /api/test-push - Send a test push notification to all active users
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const title = body.title || '🧪 Test Push Notification';
    const bodyText = body.body || 'This is a test push notification sent to all users.';
    const link = body.link || '/';

    // Fetch all active users with FCM tokens
    const users = await UserModel.find({
      isActive: true,
      fcmToken: { $ne: '', $exists: true },
    }).select('fcmToken').lean();

    const tokens = users
      .map((u: { fcmToken?: string }) => u.fcmToken)
      .filter((t: string | undefined): t is string => Boolean(t));

    if (tokens.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No users with registered FCM tokens found' },
        { status: 400 }
      );
    }

    // Send push notification via FCM
    const result = await sendFcmPushToUsers(tokens, title, bodyText, link, {
      type: 'test',
      source: 'test-push',
    });

    if (result.failed > 0 && result.success === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to send push notification via FCM' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        notificationTitle: title,
        notificationBody: bodyText,
        totalUsers: tokens.length,
        sent: result.success,
        failed: result.failed,
        message: `Test push notification sent to ${result.success}/${tokens.length} users`,
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