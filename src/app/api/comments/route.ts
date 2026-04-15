import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import CommentModel from '@/models/Comment';
import UserModel from '@/models/User';
import { withAuth } from '@/lib/auth';
import { CreateCommentSchema, PaginationSchema } from '@/lib/validations';
import { triggerEvent, CHANNELS, EVENTS } from '@/lib/pusher';

// GET /api/comments?taskId=xxx OR ?alertId=xxx
export const GET = withAuth(async (req: NextRequest) => {
  await connectDB();

  const taskId = req.nextUrl.searchParams.get('taskId');
  const alertId = req.nextUrl.searchParams.get('alertId');
  const pagination = PaginationSchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  if (!taskId && !alertId) {
    return NextResponse.json(
      { success: false, error: 'taskId or alertId is required' },
      { status: 400 }
    );
  }

  const query: Record<string, unknown> = {};
  if (taskId) query.taskId = taskId;
  if (alertId) query.alertId = alertId;

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
    content: parsed.data.content,
    author: user._id,
    mentions: mentionIds,
    isSystemLog: false,
  });

  const populated = await CommentModel.findById(comment._id)
    .populate('author', 'name email department avatar role')
    .populate('mentions', 'name email department')
    .lean();

  // Realtime: push to project channel if we can determine it
  if (parsed.data.taskId) {
    const TaskModel = (await import('@/models/Task')).default;
    const task = await TaskModel.findById(parsed.data.taskId).select('projectId');
    if (task) {
      await triggerEvent(
        CHANNELS.project(task.projectId.toString()),
        EVENTS.COMMENT_ADDED,
        { comment: populated, taskId: parsed.data.taskId }
      );
    }
  }

  if (parsed.data.alertId) {
    const AlertModel = (await import('@/models/Alert')).default;
    const alert = await AlertModel.findById(parsed.data.alertId).select('projectId');
    if (alert) {
      await triggerEvent(
        CHANNELS.project(alert.projectId.toString()),
        EVENTS.COMMENT_ADDED,
        { comment: populated, alertId: parsed.data.alertId }
      );
    }
  }

  return NextResponse.json({ success: true, data: populated }, { status: 201 });
});
