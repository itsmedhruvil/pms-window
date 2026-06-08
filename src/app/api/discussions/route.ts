import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DiscussionModel from '@/models/Discussion';
import DiscussionReadModel from '@/models/DiscussionRead';
import CommentModel from '@/models/Comment';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';
import { NotificationType } from '@/types/notifications';
import { notifyUsers } from '@/lib/notifications';

// GET /api/discussions
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const projectId = req.nextUrl.searchParams.get('projectId');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 100);

  const query: Record<string, unknown> = {};
  if (projectId) query.projectId = projectId;

  // Only show discussions where user is in the mentions array (includes starter)
  if (user.role === UserRole.DEPARTMENT_USER) {
    query.mentions = user._id;
  }

  const discussions = await DiscussionModel.find(query)
    .populate('startedBy', 'name email department')
    .populate('projectId', 'projectTitle clientName')
    .populate('mentions', 'name email department')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Fetch unread counts for this user across all discussions
  const discussionIds = discussions.map((d) => d._id);
  const readRecords = await DiscussionReadModel.find({
    discussionId: { $in: discussionIds },
    userId: user._id,
  }).lean();
  const readMap = new Map(readRecords.map((r) => [r.discussionId.toString(), r.lastReadAt]));

  // Fetch comment counts per discussion for unread calculation
  const commentCounts = await CommentModel.aggregate([
    { $match: { discussionId: { $in: discussionIds } } },
    { $group: { _id: '$discussionId', count: { $sum: 1 }, lastCreated: { $max: '$createdAt' } } },
  ]);
  const commentCountMap = new Map(commentCounts.map((c) => [c._id.toString(), c]));

  // Enhance discussions with unread info
  const enhanced = discussions.map((d) => {
    const dId = d._id.toString();
    const lastReadAt = readMap.get(dId);
    const commentInfo = commentCountMap.get(dId);
    const lastMessageAt = commentInfo?.lastCreated || d.createdAt;
    const totalComments = commentInfo?.count || 0;
    const unread = lastReadAt && lastReadAt >= lastMessageAt ? 0 : totalComments;
    return {
      ...d,
      lastMessageAt,
      totalComments,
      unreadCount: unread > 0 ? unread : (lastReadAt ? 0 : totalComments),
      lastReadAt: lastReadAt || null,
    };
  });

  return NextResponse.json({ success: true, data: enhanced });
});

// POST /api/discussions
export const POST = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const { projectId, title, description } = body;

    if (!projectId || !title) {
      return NextResponse.json(
        { success: false, error: 'Project ID and title are required' },
        { status: 400 }
      );
    }

    // Starter is automatically added to mentions (access list)
    const discussion = await DiscussionModel.create({
      projectId,
      title,
      description: description || '',
      startedBy: user._id,
      mentions: [user._id], // starter has access
    });

    const populated = await DiscussionModel.findById(discussion._id)
      .populate('startedBy', 'name email department')
      .populate('projectId', 'projectTitle clientName')
      .populate('mentions', 'name email department')
      .lean();

    // Fire-and-forget: rich push + in-app notification to admins
    if (populated) {
      const UserModel = (await import('@/models/User')).default;
      const admins = await UserModel.find({
        role: { $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
        isActive: true,
      }).select('_id').lean();
      const adminIds = admins.map((a) => a._id.toString());
      if (adminIds.length > 0) {
        const projectInfo = populated.projectId && typeof populated.projectId === 'object'
          ? (populated.projectId as any).projectTitle || 'Project'
          : 'Project';
        const descriptionPreview = populated.description
          ? populated.description.slice(0, 120) + (populated.description.length > 120 ? '...' : '')
          : '';
        await notifyUsers({
          type: NotificationType.DISCUSSION_CREATED,
          title: `💡 New Discussion: ${populated.title}`,
          body: `${user.name} started a discussion in "${projectInfo}".${descriptionPreview ? ` "${descriptionPreview}"` : ''}`,
          link: `/discussions`,
          userIds: adminIds,
          metadata: {
            discussionId: populated._id.toString(),
            projectId,
            startedBy: user.name,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);
