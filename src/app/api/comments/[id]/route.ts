import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import CommentModel from '@/models/Comment';
import { isAdminRole, withAuth } from '@/lib/auth';

// DELETE /api/comments/[id] - Delete a single message/comment
// Allowed: comment author OR admin/super_admin
export const DELETE = withAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }, { user }) => {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid comment id' },
        { status: 400 }
      );
    }

    const comment = await CommentModel.findById(id).lean();
    if (!comment) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    const authorId = comment.author?.toString();
    const isOwner = authorId === user._id.toString();
    if (!isOwner && !isAdminRole(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only the message author or an admin can delete this message' },
        { status: 403 }
      );
    }

    await CommentModel.deleteOne({ _id: id });

    return NextResponse.json({ success: true, data: { id } });
  }
);
