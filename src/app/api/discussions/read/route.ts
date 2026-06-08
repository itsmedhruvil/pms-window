import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DiscussionReadModel from '@/models/DiscussionRead';
import DiscussionModel from '@/models/Discussion';
import { withAuth } from '@/lib/auth';

/**
 * POST /api/discussions/read
 * Mark a discussion as read by the current user up to the current time.
 * Body: { discussionId: string }
 */
export const POST = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const body = await req.json();
  const { discussionId } = body;

  if (!discussionId) {
    return NextResponse.json(
      { success: false, error: 'discussionId is required' },
      { status: 400 }
    );
  }

  // Upsert the read record (create or update)
  await DiscussionReadModel.findOneAndUpdate(
    { discussionId, userId: user._id },
    { lastReadAt: new Date() },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true });
});