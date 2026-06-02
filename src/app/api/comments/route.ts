import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import CommentModel from '@/models/Comment';
import UserModel from '@/models/User';
import DiscussionModel from '@/models/Discussion';
import { withAuth } from '@/lib/auth';
import { CreateCommentSchema, PaginationSchema } from '@/lib/validations';
import { sendPushToOneSignalUsers } from '@/lib/onesignal';

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

  // Fire-and-forget: push notification via OneSignal for @mentions
  if (mentionIds.length > 0) {
    const uniqueMentionIds = mentionIds.filter((id) => id !== user._id.toString());
    if (uniqueMentionIds.length > 0) {
      let mentionLink = '/';
      if (parsed.data.discussionId) {
        mentionLink = '/discussions';
      } else if (parsed.data.taskId) {
        mentionLink = `/tasks/${parsed.data.taskId}`;
      } else if (parsed.data.alertId) {
        mentionLink = `/projects`;
      }

      sendPushToOneSignalUsers(
        uniqueMentionIds,
        `@${user.name} mentioned you`,
        `${user.name} mentioned you: ${parsed.data.content.slice(0, 100)}${parsed.data.content.length > 100 ? '...' : ''}`,
        mentionLink
      ).catch(() => {});
    }
  }

  // If this is a reply to a discussion, add @mentioned users to the discussion access list + notify participants
  if (parsed.data.discussionId) {
    const discussion = await DiscussionModel.findById(parsed.data.discussionId).lean();
    if (discussion) {
      // Add any newly @mentioned users to the discussion's mentions (access list)
      if (mentionIds.length > 0) {
        await DiscussionModel.findByIdAndUpdate(parsed.data.discussionId, {
          $addToSet: { mentions: { $each: mentionIds } },
        });
      }

      // Collect participants to notify (starter + mentioned users, minus comment author)
      const participants = new Set<string>();
      participants.add(discussion.startedBy.toString());
      mentionIds.forEach((id) => participants.add(id));
      participants.delete(user._id.toString());

      // Fire-and-forget: push notification via OneSignal to all participants
      if (participants.size > 0) {
        sendPushToOneSignalUsers(
          Array.from(participants),
          'New reply in discussion',
          `${user.name} replied: ${parsed.data.content.slice(0, 100)}${parsed.data.content.length > 100 ? '...' : ''}`,
          `/discussions`
        ).catch(() => {});
      }
    }
  }

  const populated = await CommentModel.findById(comment._id)
    .populate('author', 'name email department avatar role')
    .populate('mentions', 'name email department')
    .lean();

  return NextResponse.json({ success: true, data: populated }, { status: 201 });
});