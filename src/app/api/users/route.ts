import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import { withAuth } from '@/lib/auth';
import { CreateUserSchema } from '@/lib/validations';

// GET /api/users
export const GET = withAuth(async (req: NextRequest) => {
  await connectDB();

  const department = req.nextUrl.searchParams.get('department');
  const role = req.nextUrl.searchParams.get('role');

  const query: Record<string, unknown> = { isActive: true };
  if (department) query.department = department;
  if (role) query.role = role;

  const users = await UserModel.find(query)
    .select('-__v')
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ success: true, data: users });
});

// POST /api/users
export const POST = withAuth(async (req: NextRequest) => {
  await connectDB();

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { clerkId, ...safeData } = parsed.data;
  const userData = {
    ...safeData,
    email: safeData.email.trim().toLowerCase(),
    name: safeData.name.trim(),
  };

  const existingUser = await UserModel.findOne({ email: userData.email });
  if (existingUser) {
    return NextResponse.json({ success: false, error: 'A user with this email already exists' }, { status: 400 });
  }

  const createdUser = await UserModel.create(userData);
  return NextResponse.json({ success: true, data: createdUser });
});

