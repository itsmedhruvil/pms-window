import { NextRequest, NextResponse } from 'next/server';
import { sendPushToOneSignalUser, sendPushToOneSignalUsers } from '@/lib/onesignal';
import UserModel from '@/models/User';
import connectDB from '@/lib/db';

/**
 * GET /api/test-push?userId=<userId>
 * Trigger a test push notification via OneSignal
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    if (targetUserId) {
      // Send to specific user
      const sent = await sendPushToOneSignalUser(
        targetUserId,
        '🧪 Test Push Notification',
        'This is a test notification from Unique Arts PMS. Push notifications are working! 🎉',
        '/'
      );
      
      return NextResponse.json({
        success: true,
        message: `Test push notification sent to user ${targetUserId}`,
        sent,
      });
    }

    // Send to all active users
    const users = await UserModel.find({ isActive: true }).select('_id').lean();
    const userIds = users.map((u: any) => u._id.toString());

    if (userIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active users found. Users must sign in and subscribe via OneSignal first.',
        usersFound: 0,
      });
    }

    const sent = await sendPushToOneSignalUsers(
      userIds,
      '🧪 Test Push Notification',
      'This is a test notification from Unique Arts PMS. Push notifications are working! 🎉',
      '/'
    );

    return NextResponse.json({
      success: true,
      message: `Test push notification sent to ${userIds.length} user(s)`,
      usersTargeted: userIds.length,
      delivered: sent,
    });
  } catch (error: any) {
    console.error('[Test Push Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}