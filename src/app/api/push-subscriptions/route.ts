import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import PushSubscriptionModel from '@/models/PushSubscription';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// POST /api/push-subscriptions - Register a push subscription
export const POST = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const { endpoint, auth, p256dh } = body;

    if (!endpoint || !auth || !p256dh) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: endpoint, auth, p256dh' },
        { status: 400 }
      );
    }

    // Upsert: update if endpoint exists for this user, else create
    await PushSubscriptionModel.findOneAndUpdate(
      { userId: user._id, endpoint },
      {
        userId: user._id,
        endpoint,
        auth,
        p256dh,
        userAgent: req.headers.get('user-agent') || null,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);

// DELETE /api/push-subscriptions - Remove a push subscription
export const DELETE = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: endpoint' },
        { status: 400 }
      );
    }

    await PushSubscriptionModel.deleteOne({ userId: user._id, endpoint });

    return NextResponse.json({ success: true });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);