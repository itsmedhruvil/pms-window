import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';

export const GET = withAuth(async (_req: NextRequest, _ctx, { user }) => {
  return NextResponse.json({
    success: true,
    data: {
      role: user.role,
      department: user.department,
    },
  });
});

// PATCH /api/users/me — update current user (e.g. FCM token)
export const PATCH = withAuth(async (req: NextRequest, _ctx, { user }) => {
  const body = await req.json();

  if (body.fcmToken !== undefined) {
    user.fcmToken = body.fcmToken || '';
    await user.save();
  }

  return NextResponse.json({ success: true });
});