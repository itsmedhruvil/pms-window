import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DiscussionModel from '@/models/Discussion';
import NotificationModel from '@/models/Notification';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// GET /api/discussions
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const projectId = req.nextUrl.searchParams.get('projectId');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 100);

  const query: Record<string, unknown> = {};
  if (projectId) query.projectId = projectId;

  // Only show discussions where user is mentioned or is the starter
  if (user.role === UserRole.DEPARTMENT_USER) {
    query.$or = [
      { startedBy: user._id },
      { mentions: user._id },
    ];
  }

  const discussions = await DiscussionModel.find(query)
    .populate('startedBy', 'name email department')
    .populate('projectId', 'projectTitle clientName')
    .populate('mentions', 'name email department')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ success: true, data: discussions });
});

// POST /api/discussions
export const POST = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const { projectId, title, description, mentions } = body;

    if (!projectId || !title) {
      return NextResponse.json(
        { success: false, error: 'Project ID and title are required' },
        { status: 400 }
      );
    }

    const discussion = await DiscussionModel.create({
      projectId,
      title,
      description: description || '',
      startedBy: user._id,
      mentions: mentions || [],
    });

    // Create notifications for mentioned users
    if (mentions && mentions.length > 0) {
      const notificationPromises = mentions
        .filter((mentionId: string) => mentionId !== user._id.toString())
        .map((mentionId: string) =>
          NotificationModel.create({
            userId: mentionId,
            type: 'discussion_mention',
            title: `You were mentioned in: ${title}`,
            message: `${user.name} started a discussion and mentioned you: ${title}${description ? ` - ${description.slice(0, 100)}` : ''}`,
            link: `/discussions`,
            relatedId: discussion._id,
            relatedModel: 'Discussion',
          })
        );
      await Promise.all(notificationPromises);
    }

    const populated = await DiscussionModel.findById(discussion._id)
      .populate('startedBy', 'name email department')
      .populate('projectId', 'projectTitle clientName')
      .populate('mentions', 'name email department')
      .lean();

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);