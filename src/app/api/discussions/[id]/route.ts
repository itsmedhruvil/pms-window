import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DiscussionModel from '@/models/Discussion';
import NotificationModel from '@/models/Notification';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// GET /api/discussions/[id]
export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await params;

  const discussion = await DiscussionModel.findById(id)
    .populate('startedBy', 'name email department')
    .populate('projectId', 'projectTitle clientName')
    .populate('mentions', 'name email department')
    .lean();

  if (!discussion) {
    return NextResponse.json(
      { success: false, error: 'Discussion not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: discussion });
});

// PATCH /api/discussions/[id] - Add participants via @mention
export const PATCH = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'userIds array is required' },
        { status: 400 }
      );
    }

    const discussion = await DiscussionModel.findById(id);
    if (!discussion) {
      return NextResponse.json(
        { success: false, error: 'Discussion not found' },
        { status: 404 }
      );
    }

    // Add new users to mentions (avoid duplicates)
    const existingMentions = discussion.mentions.map((m: any) => m.toString());
    const newUserIds = userIds.filter((uid: string) => !existingMentions.includes(uid));

    if (newUserIds.length > 0) {
      await DiscussionModel.findByIdAndUpdate(id, {
        $addToSet: { mentions: { $each: newUserIds } },
      });

      // Notify newly added users
      const notificationPromises = newUserIds.map((userId: string) =>
        NotificationModel.create({
          userId,
          type: 'discussion_mention',
          title: `You were added to: ${discussion.title}`,
          message: `You have been added to a discussion: ${discussion.title}`,
          link: `/discussions`,
          relatedId: discussion._id,
          relatedModel: 'Discussion',
        })
      );
      await Promise.all(notificationPromises);
    }

    const updated = await DiscussionModel.findById(id)
      .populate('startedBy', 'name email department')
      .populate('projectId', 'projectTitle clientName')
      .populate('mentions', 'name email department')
      .lean();

    return NextResponse.json({ success: true, data: updated });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);