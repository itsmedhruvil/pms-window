import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import { sendFcmPushToUsers, getFcmConfigStatus } from '@/lib/firebase-admin';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// GET /api/test-push - Report server-side push configuration (admin only)
export const GET = withAuth(
  async () => {
    const status = getFcmConfigStatus();
    return NextResponse.json({ success: true, data: status });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);

// POST /api/test-push - Send a test push notification
export const POST = withAuth(async (req: NextRequest, _ctx, { user }) => {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    await connectDB();

    // Push delivery requires Firebase Admin credentials on the server.
    // Without them, sending is skipped and every token "fails" — surface a
    // clear configuration error instead of a misleading send failure.
    const config = getFcmConfigStatus();
    if (!config.configured) {
      const missing = config.missing.length > 0 ? ` Missing: ${config.missing.join(', ')}.` : '';
      console.error(`[Test Push] Firebase Admin not configured.${missing}`);
      return NextResponse.json(
        {
          success: false,
          error:
            'Push notifications are disabled: Firebase Admin credentials are not configured on the server.' +
            missing +
            ' Add FIREBASE_SERVICE_ACCOUNT_JSON (recommended) or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, then redeploy.',
          data: config,
        },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title || '🔔 Test Notification';
    const bodyText = body.body || 'Push notifications are working. This is a test from Unique Arts PMS.';
    const link = body.link || '/dashboard';
    const onlyMe = body.onlyMe === true;

    // Fetch target users with FCM tokens. `onlyMe` avoids spamming the team
    // while testing a device.
    const users = onlyMe
      ? await UserModel.find({
          _id: user._id,
          fcmToken: { $nin: ['', null] },
        })
          .select('fcmToken')
          .lean()
      : await UserModel.find({
          isActive: true,
          fcmToken: { $nin: ['', null] },
        })
          .select('fcmToken')
          .lean();

    const tokens = users
      .map((u: { fcmToken?: string | null }) => u.fcmToken)
      .filter((t: string | null | undefined): t is string => Boolean(t));

    if (tokens.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: onlyMe
            ? 'No push token is registered for your account on this device. Open the notification bell and click "Enable" first.'
            : 'No users with registered FCM tokens found',
        },
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
        onlyMe,
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
});