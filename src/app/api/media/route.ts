import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

type StoredTaskFile = {
  id?: string;
  name?: string;
  url?: string;
  size?: number;
  type?: string;
  publicId?: string;
  uploadedAt?: Date | string;
};

export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('limit') || '30', 10)));
  const mediaFields = ['files', 'imageAttachments', 'attachments'];
  const query: Record<string, unknown> = {
    $and: [
      {
        $or: mediaFields.map((field) => ({ [`${field}.0`]: { $exists: true } })),
      },
    ],
  };

  if (user.role === UserRole.DEPARTMENT_USER) {
    (query.$and as Record<string, unknown>[]).push({
      department: user.department,
      $or: [{ assignedUser: user._id }, { assignedUser: null }],
    });
  }

  const tasks = await TaskModel.find(query)
    .select('_id title department projectId files imageAttachments attachments updatedAt')
    .populate('projectId', 'projectTitle clientName')
    .sort({ updatedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .lean();

  const hasMore = tasks.length > limit;
  if (hasMore) tasks.pop();

  const items = tasks.flatMap((task) => {
    const project = task.projectId && typeof task.projectId === 'object' && '_id' in task.projectId
      ? task.projectId as unknown as { _id: { toString(): string }; projectTitle?: string; clientName?: string }
      : null;
    const sources = [task.files, task.imageAttachments, task.attachments] as Array<StoredTaskFile[] | undefined>;
    const files = new Map<string, StoredTaskFile>();

    for (const source of sources) {
      for (const file of source || []) {
        if (!file?.url) continue;
        const key = file.id || file.publicId || file.url;
        files.set(key, file);
      }
    }

    return Array.from(files.values()).map((file) => ({
      id: file.id || file.publicId || file.url,
      url: file.url!,
      name: file.name || 'Untitled file',
      type: file.type || '',
      size: file.size || 0,
      uploadedAt: file.uploadedAt || task.updatedAt,
      taskId: task._id.toString(),
      taskTitle: task.title,
      department: task.department,
      projectId: project?._id.toString() || null,
      projectTitle: project?.projectTitle || 'Internal tasks',
      clientName: project?.clientName || '',
    }));
  });

  return NextResponse.json({
    success: true,
    data: { items, page, hasMore },
  });
});