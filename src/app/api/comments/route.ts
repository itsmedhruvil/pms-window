import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import CommentModel from '@/models/Comment';
import UserModel from '@/models/User';
import DiscussionModel from '@/models/Discussion';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { CreateCommentSchema, PaginationSchema } from '@/lib/validations';
import { notifyUsers } from '@/lib/notifications';
import { NotificationType } from '@/types/notifications';

// GET /api/comments?taskId=xxx OR ?alertId=xxx OR ?discussionId=xxx
export const GET = withAuth(async (req: NextRequest) => {
  await connectDB();

  const taskId = req.nextUrl.searchParams.get('taskId');
  const alertId = req.nextUrl.searchParams.get('alertId');
  const discussionId = req.nextUrl.searchParams.get('discussionId');
  const pagination = PaginationSchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  if (discussionId && !mongoose.Types.ObjectId.isValid(discussionId)) {
    return NextResponse.json(
      { success: false, error: 'discussionId must be a valid ID' },
      { status: 400 }
    );
  }

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

    }
  }

  const populated = await CommentModel.findById(comment._id)
    .populate('author', 'name email department avatar role')
    .populate('mentions', 'name email department')
    .lean();

  await dispatchCommentNotifications({
    authorId: user._id.toString(),
    authorName: user.name,
    content: parsed.data.content,
    mentionIds,
    taskId: parsed.data.taskId,
    alertId: parsed.data.alertId,
    discussionId: parsed.data.discussionId,
  });

  return NextResponse.json({ success: true, data: populated }, { status: 201 });
});

/**
 * Notify the people a new comment is relevant to:
 * - @mentioned users get a mention notification
 * - discussion participants get a reply notification
 * - the task assignee / alert raiser get a comment notification
 * The author is never notified about their own comment.
 */
async function dispatchCommentNotifications(input: {
  authorId: string;
  authorName: string;
  content: string;
  mentionIds: string[];
  taskId?: string;
  alertId?: string;
  discussionId?: string;
}) {
  try {
    const { authorId, authorName, content, mentionIds } = input;
    const preview = content.length > 140 ? `${content.slice(0, 140)}…` : content;
    const body = preview ? `${authorName}: ${preview}` : `${authorName} attached a file`;

    const notified = new Set<string>([authorId]);
    const mentionSet = new Set(mentionIds);
    const metadata: Record<string, unknown> = {};
    if (input.taskId) metadata.taskId = input.taskId;
    if (input.alertId) metadata.alertId = input.alertId;
    if (input.discussionId) metadata.discussionId = input.discussionId;

    let link = '/';
    let contextTitle = 'a conversation';

    if (input.discussionId) {
      const discussion = await DiscussionModel.findById(input.discussionId)
        .select('title startedBy mentions')
        .lean();
      if (discussion) {
        contextTitle = `"${discussion.title}"`;
        link = `/discussions?thread=${input.discussionId}`;
        const participants = [
          discussion.startedBy?.toString(),
          ...(discussion.mentions || []).map((id) => id.toString()),
        ].filter((id): id is string => Boolean(id));

        const replyRecipients = participants.filter(
          (id) => !notified.has(id) && !mentionSet.has(id)
        );
        replyRecipients.forEach((id) => notified.add(id));
        if (replyRecipients.length > 0) {
          await notifyUsers({
            type: NotificationType.DISCUSSION_REPLY,
            title: `New reply in ${contextTitle}`,
            body,
            link,
            userIds: replyRecipients,
            metadata,
          });
        }
      }
    } else if (input.taskId) {
      const task = await TaskModel.findById(input.taskId)
        .select('title assignedUser projectId')
        .lean();
      if (task) {
        contextTitle = `"${task.title}"`;
        link = `/tasks/${input.taskId}`;
        const assignee = task.assignedUser?.toString();
        if (assignee && !notified.has(assignee) && !mentionSet.has(assignee)) {
          notified.add(assignee);
          await notifyUsers({
            type: NotificationType.COMMENT_MENTION,
            title: `New comment on ${contextTitle}`,
            body,
            link,
            userIds: [assignee],
            metadata,
          });
        }
      }
    } else if (input.alertId) {
      const alert = await AlertModel.findById(input.alertId).select('message raisedBy').lean();
      if (alert) {
        contextTitle = 'an alert';
        link = '/alerts';
        const raiser = alert.raisedBy?.toString();
        if (raiser && !notified.has(raiser) && !mentionSet.has(raiser)) {
          notified.add(raiser);
          await notifyUsers({
            type: NotificationType.COMMENT_MENTION,
            title: 'New comment on your alert',
            body,
            link,
            userIds: [raiser],
            metadata,
          });
        }
      }
    }

    const actualMentions = mentionIds.filter((id) => id !== authorId);
    if (actualMentions.length > 0) {
      await notifyUsers({
        type: NotificationType.COMMENT_MENTION,
        title: `You were mentioned in ${contextTitle}`,
        body,
        link,
        userIds: actualMentions,
        metadata,
      });
    }
  } catch (error) {
    // Notifications are best-effort and must never fail comment creation.
    console.error('[comments] Failed to dispatch notifications:', error);
  }
}