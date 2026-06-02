import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DiscussionModel from '@/models/Discussion';
import CommentModel from '@/models/Comment';
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

// PUT /api/discussions/[id] - Update discussion title/description
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const { title, description } = body;

    if (!title && description === undefined) {
      return NextResponse.json(
        { success: false, error: 'At least one of title or description is required' },
        { status: 400 }
      );
    }

    const updateFields: Record<string, unknown> = {};
    if (title) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;

    const discussion = await DiscussionModel.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    )
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
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);

// DELETE /api/discussions/[id] - Delete discussion and associated comments
export const DELETE = withAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await connectDB();
    const { id } = await params;

    const discussion = await DiscussionModel.findByIdAndDelete(id);
    if (!discussion) {
      return NextResponse.json(
        { success: false, error: 'Discussion not found' },
        { status: 404 }
      );
    }

    // Also clean up associated comments
    await CommentModel.deleteMany({ discussionId: id });

    return NextResponse.json({ success: true, data: { id } });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);