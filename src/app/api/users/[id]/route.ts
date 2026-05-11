import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { UpdateUserSchema } from '@/lib/validations';
import { UserRole } from '@/types';
import { clerkClient } from '@clerk/nextjs/server';

// GET /api/users/[id]
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  await connectDB();
  const { id } = await ctx.params;

  const user = await UserModel.findById(id).select('-__v').lean();
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: user });
});

/**
 * Sync a user's role + department to Clerk's publicMetadata
 * so client-side useUser() picks up changes immediately.
 */
async function syncClerkMetadata(clerkUserId: string, role: string, department: string) {
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);
    await client.users.updateUser(clerkUser.id, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        role,
        department,
      },
    });
  } catch (err) {
    console.warn('[syncClerkMetadata] Failed:', err);
  }
}

// PATCH /api/users/[id]
export const PATCH = withAuth(
  async (req: NextRequest, ctx, { user: currentUser }) => {
    await connectDB();
    const { id } = await ctx.params;

    // Only super_admin can edit others; admins can edit themselves
    if (
      currentUser._id.toString() !== id &&
      currentUser.role !== UserRole.SUPER_ADMIN
    ) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Non-super-admins cannot change roles
    if (parsed.data.role && currentUser.role !== UserRole.SUPER_ADMIN) {
      delete parsed.data.role;
    }

    const updated = await UserModel.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updated) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Sync changes to Clerk metadata (non-blocking, fire-and-forget)
    if (updated.clerkId && (parsed.data.role || parsed.data.department)) {
      syncClerkMetadata(
        updated.clerkId,
        parsed.data.role || String(updated.role),
        parsed.data.department || String(updated.department),
      );
    }

    return NextResponse.json({ success: true, data: updated });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);

// DELETE /api/users/[id] — soft delete + task unassignment
export const DELETE = withAuth(
  async (_req: NextRequest, ctx, { user: currentUser }) => {
    await connectDB();
    const { id } = await ctx.params;

    if (currentUser._id.toString() === id) {
      return NextResponse.json(
        { success: false, error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    const targetUser = await UserModel.findById(id);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { success: false, error: 'User is already deactivated' },
        { status: 400 }
      );
    }

    await UserModel.findByIdAndUpdate(id, { isActive: false });

    // Unassign all incomplete tasks
    const result = await TaskModel.updateMany(
      { assignedUser: id, status: { $nin: ['done'] } },
      { $unset: { assignedUser: '' } }
    );

    return NextResponse.json({
      success: true,
      message: `User "${targetUser.name}" deactivated. ${result.modifiedCount} task(s) unassigned.`,
    });
  },
  [UserRole.SUPER_ADMIN]
);