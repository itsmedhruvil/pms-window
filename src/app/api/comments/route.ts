import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import CommentModel from '@/models/Comment';
import UserModel from '@/models/User';
import NotificationModel from '@/models/Notification';
import DiscussionModel from '@/models/Discussion';
import { withAuth } from '@/lib/auth';
import { CreateCommentSchema, PaginationSchema } from '@/lib/validations';

// GET /api/comments?taskId=xxx OR ?alertId=xxx OR ?discussionId=xxx
export const GET = withAuth(async (req: NextRequest) => {
  await connectDB();

  const taskId = req.nextUrl.searchParams.get('taskId');
  const alertId = req.nextUrl.searchParams.get('alertId');
  const discussionId = req.nextUrl.searchParams.get('discussionId');
  const pagination = PaginationSchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  if (!taskId && !alertId && !discussionId) {
    return NextResponse.json(
      { success: false, error: 'taskId, alertId, or discussionId is required' },
      { status: 400 }
    );
  }

  const query: Record<string, unknown> = {};
  if (taskId) query.taskId = taskId;
  if (alertId) query.alertId = alertId;
  if (discussionId) query.discussionId = discussionId;

  const skip = (pagination.page - 1) * pagination.limit;

  const [items, total] = await Promise.all([
    CommentModel.find(query)
      .populate('author', 'name email department avatar role')
      .populate('mentions', 'name email department')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(pagination.limit)
      .lean(),
    CommentModel.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    },
  });
});

// POST /api/comments
export const POST = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const body = await req.json();
  const parsed = CreateCommentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Resolve @mention user IDs from names if provided as strings
  let mentionIds: string[] = [];
  if (parsed.data.mentions && parsed.data.mentions.length > 0) {
    const mentionedUsers = await UserModel.find({
      _id: { $in: parsed.data.mentions },
    }).select('_id');
    mentionIds = mentionedUsers.map((u) => u._id.toString());
  }

  const comment = await CommentModel.create({
    taskId: parsed.data.taskId,
    alertId: parsed.data.alertId,
    discussionId: parsed.data.discussionId,
    content: parsed.data.content,
    author: user._id,
    mentions: mentionIds,
    attachments: parsed.data.attachments || [],
    isSystemLog: false,
  });

  // If this is a reply to a discussion, notify the discussion participants
  if (parsed.data.discussionId) {
    const discussion = await DiscussionModel.findById(parsed.data.discussionId).lean();
    if (discussion) {
      const participants = new Set<string>();
      participants.add(discussion.startedBy.toString());
      
      // Also notify mentioned users
      mentionIds.forEach((id) => participants.add(id));

      // Remove the comment author from participants
      participants.delete(user._id.toString());

      const notificationPromises = Array.from(participants).map((participantId) =>
        NotificationModel.create({
          userId: participantId,
          type: 'discussion_reply',
          title: 'New reply in discussion',
          message: `${user.name} replied: ${parsed.data.content.slice(0, 100)}${parsed.data.content.length > 100 ? '...' : ''}`,
          link: `/discussions?discussionId=${discussion._id}`,
          relatedId: discussion._id,
          relatedModel: 'Discussion',
        })
      );
      await Promise.all(notificationPromises);
    }
  }

  const populated = await CommentModel.findById(comment._id)
    .populate('author', 'name email department avatar role')
    .populate('mentions', 'name email department')
    .lean();

  return NextResponse.json({ success: true, data: populated }, { status: 201 });
});