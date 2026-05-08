import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// POST /api/tasks/[id]/duplicate
export const POST = withAuth(
  async (_req: NextRequest, ctx, { user }) => {
    await connectDB();
    const params = await ctx.params;
    const { id } = params;

    const originalTask = await TaskModel.findById(id);
    if (!originalTask) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Create duplicate task
    const duplicateTask = new TaskModel({
      ...originalTask.toObject(),
      _id: undefined, // Let MongoDB generate new ID
      title: `Copy of ${originalTask.title}`,
      status: 'not_started',
      assignedUser: null,
      startDate: null,
      completedAt: null,
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedTask = await duplicateTask.save();

    return NextResponse.json({ success: true, data: savedTask });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);