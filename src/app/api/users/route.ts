import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import { withAuth } from '@/lib/auth';
import { CreateUserSchema } from '@/lib/validations';
import { UserRole } from '@/types';

// GET /api/users
export const GET = withAuth(async (req: NextRequest) => {
  await connectDB();

  const department = req.nextUrl.searchParams.get('department');
  const role = req.nextUrl.searchParams.get('role');

  const query: Record<string, unknown> = { isActive: true };
  if (department) query.department = department;
  if (role) query.role = role;

  const users = await UserModel.find(query)
    // Never expose other users' push tokens (or internal Clerk ids).
    .select('-__v -fcmToken -clerkId')
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ success: true, data: users });
});

// POST /api/users — admins may add team members, only super admins may add
// another super admin.
export const POST = withAuth(
  async (req: NextRequest, _ctx, { user: currentUser }) => {
    await connectDB();

    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (
      parsed.data.role === UserRole.SUPER_ADMIN &&
      currentUser.role !== UserRole.SUPER_ADMIN
    ) {
      return NextResponse.json(
        { success: false, error: 'Only a super admin can create another super admin' },
        { status: 403 }
      );
    }

    const userData = {
      email: parsed.data.email.trim().toLowerCase(),
      name: parsed.data.name.trim(),
      role: parsed.data.role,
      department: parsed.data.department,
    };

    const existingUser = await UserModel.findOne({ email: userData.email });
    if (existingUser) {
      return NextResponse.json({ success: false, error: 'A user with this email already exists' }, { status: 400 });
    }

    const createdUser = await UserModel.create(userData);
    const safeUser = createdUser.toObject() as unknown as Record<string, unknown>;
    delete safeUser.fcmToken;
    delete safeUser.clerkId;
    return NextResponse.json({ success: true, data: safeUser });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);

